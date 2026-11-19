import test from 'node:test';
import assert from 'node:assert/strict';
import {designBoundedCorrelatedReadings} from '../src/trajectory/bounded-correlated-discriminator.mjs';
import {designCorrelatedReadings} from '../src/trajectory/correlated-gaussian-discriminator.mjs';
import {designGaussianReadings} from '../src/trajectory/gaussian-discriminator.mjs';

// FROZEN before candidate source: board fr-disc-active-intervention-worldlaw
// message 160666, seed 0x6E502B71, 96 authored held-out ensembles,
// 513 deterministic plus 32 off-grid tau checks, z=3.29, cap=4.
// This receiver uses an independent dense Cholesky decomposition, not the
// candidate's chronological innovations or tau-interval enclosure code.
const rng=(seed)=>{let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);};
function denseZ(a,b,indices,times,tau,sigma){
  if(!indices.length)return 0;
  const n=indices.length;
  const d=indices.map(i=>(a.rows[i+1].position-b.rows[i+1].position)/sigma);
  const c=indices.map((i,x)=>indices.map((j,y)=>tau===0?Number(x===y):Math.exp(-Math.abs(times[i]-times[j])/tau)));
  const l=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let v=c[i][j];for(let k=0;k<j;k++)v-=l[i][k]*l[j][k];
    if(i===j){assert.ok(v>0,'dense reference covariance must be positive definite');l[i][j]=Math.sqrt(v);}
    else l[i][j]=v/l[j][j];
  }
  const x=[];
  for(let i=0;i<n;i++){let v=d[i];for(let j=0;j<i;j++)v-=l[i][j]*x[j];x[i]=v/l[i][i];}
  return Math.hypot(...x);
}
function cohort(){
  const rand=rng(0x6E502B71),cases=[];
  for(let caseId=0;caseId<96;caseId++){
    const n=9+caseId%4,modelCount=2+caseId%3;
    const times=[];let clock=0;
    for(let i=0;i<n;i++){clock+=.04+.14*rand();times.push(Number(clock.toFixed(9)));}
    const sigma=.002+.048*rand(),tauMin=caseId%9===0?0:.05+.45*rand();
    const tauMax=tauMin+.08+(5-tauMin-.08)*rand();
    const amplitude=caseId%16===0?.8:.008+.11*rand();
    const phase=.2+1.5*rand(),rate=.5+2.1*rand();
    const predictions=Array.from({length:modelCount},(_,m)=>({modelId:'law-'+m,rows:[
      {time:0,position:.4},
      ...times.map(t=>({time:t,position:.4+.29*Math.sin(1.3*t+phase)+
        (m-(modelCount-1)/2)*amplitude*(.7*Math.sin((m+1)*rate*t+.3*m)+.5*Math.cos(2.3*t-.17*m))}))
    ]}));
    cases.push({caseId,times,predictions,sigma,tauMin,tauMax});
  }
  return cases;
}
const params={targetZ:3.29,maxReadings:4,maxInnovationTerms:2_000_000};
test('point tau=0.4 and tau=0 retain exact previous sensor design decisions',()=>{
  const rows=[{time:0,position:0},{time:.1,position:.12},{time:.2,position:-.11},{time:.4,position:.06}];
  const predictions=[{modelId:'a',rows},{modelId:'b',rows:rows.map(r=>({...r,position:0}))}];
  const options={sigma:.035,targetZ:3.29,maxReadings:2,maxInnovationTerms:200000};
  const point=designCorrelatedReadings(predictions,{...options,correlationTime:.4});
  const bounded=designBoundedCorrelatedReadings(predictions,{...options,tauMin:.4,tauMax:.4,nominalCorrelationTime:.4});
  assert.equal(bounded.status,point.status);assert.deepEqual(bounded.readings,point.readings);assert.equal(bounded.minPairwiseZ,point.minPairwiseZ);
  const iid=designGaussianReadings(predictions,{sigma:options.sigma,targetZ:options.targetZ,maxReadings:2});
  const boundedZero=designBoundedCorrelatedReadings(predictions,{...options,tauMin:0,tauMax:0,nominalCorrelationTime:0});
  assert.equal(boundedZero.status,iid.status);assert.deepEqual(boundedZero.readings,iid.readings);assert.equal(boundedZero.minPairwiseZ,iid.minPairwiseZ);
});
test('adversarial common-mode and opposite-sign innovations preserve uncertainty rather than point tau confidence',()=>{
  const times=[0,.1,.2];
  const models=d=>[{modelId:'a',rows:times.map((t,i)=>({time:t,position:i?d[i-1]:0}))},
                    {modelId:'b',rows:times.map(t=>({time:t,position:0}))}];
  const common=designBoundedCorrelatedReadings(models([.2,.2]),{sigma:.1,targetZ:3.29,maxReadings:2,tauMin:.1,tauMax:100,nominalCorrelationTime:.1,maxInnovationTerms:200000});
  assert.notEqual(common.status,'distinguishable','a near-common-mode pair cannot certify z across high correlation');
  const opposite=designBoundedCorrelatedReadings(models([.15,-.15]),{sigma:.1,targetZ:3.29,maxReadings:2,tauMin:.5,tauMax:3,nominalCorrelationTime:.5,maxInnovationTerms:200000});
  assert.equal(opposite.status,'distinguishable');assert.equal(opposite.measurementCount,2);
  assert.ok(opposite.minPairwiseZ>=3.29);
  for(const tau of [.5,1,1.7,3])assert.ok(denseZ(models([.15,-.15])[0],models([.15,-.15])[1],[0,1],[.1,.2],tau,.1)>=3.29);
});
test('96 frozen unfamiliar ensembles: no false robust certificate at independent full-covariance tau sweep',()=>{
  let certified=0,unreachable=0,unresolved=0,measured=0,claimedMin=0;
  for(const item of cohort()){
    const x=designBoundedCorrelatedReadings(item.predictions,{...params,sigma:item.sigma,tauMin:item.tauMin,tauMax:item.tauMax,nominalCorrelationTime:item.tauMin});
    assert.equal(x.schema,'worldlaw.bounded-correlated-discriminator/v1');
    assert.ok(x.work.innovationTerms<=params.maxInnovationTerms);
    assert.ok(['distinguishable','threshold_unreachable_on_grid','observationally_equivalent_on_grid','budget_insufficient','search_inconclusive'].includes(x.status));
    const indices=x.readings.map(r=>r.sampleIndex-1);
    assert.equal(indices.length,x.measurementCount);
    if(x.certifiedMinimumReadings!==null){claimedMin++;assert.equal(x.status,'distinguishable');assert.equal(x.certifiedMinimumReadings,x.measurementCount);}
    if(x.status==='distinguishable'){
      certified++;measured++;
      assert.ok(x.minPairwiseZ>=params.targetZ);
      for(let a=0;a<item.predictions.length;a++)for(let b=a+1;b<item.predictions.length;b++){
        let independentMinimum=Infinity;
        const rand=rng((0x6E502B71+item.caseId*157+a*31+b)>>>0);
        for(let j=0;j<545;j++){
          const u=j<513?j/512:rand(),tau=item.tauMin+(item.tauMax-item.tauMin)*u;
          const z=denseZ(item.predictions[a],item.predictions[b],indices,item.times,tau,item.sigma);
          independentMinimum=Math.min(independentMinimum,z);
          assert.ok(z+1e-6>=params.targetZ,
            'false positive robust certificate at case '+item.caseId+' model pair '+a+','+b+' tau='+tau+' z='+z);
        }
        assert.ok(x.minPairwiseZ<=independentMinimum+1e-5,'the conservative score may not exceed any independent oracle sample');
      }
    }else if(x.status==='threshold_unreachable_on_grid'){
      unreachable++;
      assert.equal(x.measurementCount,0);
      const witness=x.fullGridCounterexample;
      assert.ok(witness&&witness.tauSeconds>=item.tauMin&&witness.tauSeconds<=item.tauMax);
      const a=item.predictions.find(z=>z.modelId===witness.firstModelId),b=item.predictions.find(z=>z.modelId===witness.secondModelId);
      const z=denseZ(a,b,item.times.map((_,i)=>i),item.times,witness.tauSeconds,item.sigma);
      assert.ok(z<params.targetZ+1e-6,'claimed unattainable must have independent full-grid counterexample');
    }else if(x.measurementCount)measured++;else unresolved++;
  }
  assert.ok(certified>=1,'predeclared corpus must exercise a positive robust design');
  assert.ok(unreachable>=1,'predeclared corpus must exercise an impossible robust target');
  console.log(JSON.stringify({frozenSeed:'0x6E502B71',cases:96,certified,unreachable,unresolved,measured,claimedMin}));
});
test('invalid interval, budget and misordered schedules refuse before any claim',()=>{
  const models=[{modelId:'a',rows:[{time:0,position:0},{time:.1,position:1}]},{modelId:'b',rows:[{time:0,position:0},{time:.1,position:0}]}];
  const q={sigma:.05,targetZ:3.29,maxReadings:1,nominalCorrelationTime:.2,maxInnovationTerms:2000};
  assert.throws(()=>designBoundedCorrelatedReadings(models,{...q,tauMin:.4,tauMax:.1}),/interval|minimum|upper/i);
  assert.throws(()=>designBoundedCorrelatedReadings(models,{...q,tauMin:.1,tauMax:.4,maxInnovationTerms:1}),/budget/i);
  const changed=structuredClone(models);changed[1].rows[1].time=.12;
  assert.throws(()=>designBoundedCorrelatedReadings(changed,{...q,tauMin:.1,tauMax:.4}),/schedule|timestamps/i);
});
