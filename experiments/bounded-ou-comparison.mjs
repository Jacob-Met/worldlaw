/** Frozen 96-ensemble OU interval comparison, prereg taskboard message160666.
 * Independent dense Cholesky evaluates the candidate reading subsets at 545
 * unknown true tau values per model-pair. Authored simulation, no physical
 * sensor calibration or out-of-sample hardware claim.
 */
import assert from 'node:assert/strict';
import {designBoundedCorrelatedReadings} from '../src/trajectory/bounded-correlated-discriminator.mjs';
import {designCorrelatedReadings} from '../src/trajectory/correlated-gaussian-discriminator.mjs';
import {designGaussianReadings} from '../src/trajectory/gaussian-discriminator.mjs';
const rng=(seed)=>{let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);};
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
function denseZ(a,b,indices,times,tau,sigma){
  if(!indices.length)return 0;
  const n=indices.length;
  const d=indices.map(i=>(a.rows[i+1].position-b.rows[i+1].position)/sigma);
  const c=indices.map((i,x)=>indices.map((j,y)=>tau===0?Number(x===y):Math.exp(-Math.abs(times[i]-times[j])/tau)));
  const l=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let v=c[i][j];for(let k=0;k<j;k++)v-=l[i][k]*l[j][k];
    if(i===j){assert.ok(v>0);l[i][j]=Math.sqrt(v);}
    else l[i][j]=v/l[j][j];
  }
  const x=[];
  for(let i=0;i<n;i++){let v=d[i];for(let j=0;j<i;j++)v-=l[i][j]*x[j];x[i]=v/l[i][i];}
  return Math.hypot(...x);
}
const metrics={bounded:[],point_midpoint:[],iid_diagonal:[]};let caseCount=0;
const threshold=3.29;
for(const item of cohort()){
  const options={sigma:item.sigma,targetZ:threshold,maxReadings:4,maxInnovationTerms:2_000_000};
  const mid=(item.tauMin+item.tauMax)/2;
  const designs={
    bounded:designBoundedCorrelatedReadings(item.predictions,{...options,
      tauMin:item.tauMin,tauMax:item.tauMax,nominalCorrelationTime:item.tauMin}),
    point_midpoint:designCorrelatedReadings(item.predictions,{...options,correlationTime:mid}),
    iid_diagonal:designGaussianReadings(item.predictions,options)
  };
  for(const [name,design] of Object.entries(designs)){
    const chosen=design.readings.map(r=>r.sampleIndex-1);
    let independentMinZ=Infinity,worstTau=item.tauMin,minimumPair='';
    for(let a=0;a<item.predictions.length;a++)for(let b=a+1;b<item.predictions.length;b++){
      const rand=rng((0x6E502B71+item.caseId*157+a*31+b)>>>0);
      for(let j=0;j<545;j++){
        const u=j<513?j/512:rand(),tau=item.tauMin+(item.tauMax-item.tauMin)*u;
        const z=denseZ(item.predictions[a],item.predictions[b],chosen,item.times,tau,item.sigma);
        if(z<independentMinZ){independentMinZ=z;worstTau=tau;minimumPair=a+','+b;}
      }
    }
    const claimed=design.status==='distinguishable';
    if(name==='bounded'&&claimed)
      assert.ok(independentMinZ>=threshold-1e-6,
        'independent oracle disproves bounded certificate at case '+item.caseId);
    metrics[name].push({caseId:item.caseId,claimed,readingCount:chosen.length,
      certifiedMinimum:design.certifiedMinimumReadings??null,decision:design.status,
      claimedSeparationZ:design.minPairwiseZ,trueWorstSeparationZ:independentMinZ,
      falseRobustClaim:claimed&&independentMinZ<threshold-1e-6,
      independentlyRobust:independentMinZ>=threshold-1e-6,
      worstTau,worstPair:minimumPair});
  }
  caseCount++;
}
function summarise(data){
  const claims=data.filter(x=>x.claimed),mutualRobust=data.filter(x=>x.independentlyRobust);
  return {ensembles:data.length,claimedRobustSeparations:claims.length,
    robustlyTrueClaims:claims.filter(x=>!x.falseRobustClaim).length,
    falseRobustClaims:claims.filter(x=>x.falseRobustClaim).length,
    truthRobustAcrossAnyStatus:mutualRobust.length,
    meanReadingCountAll:data.reduce((a,b)=>a+b.readingCount,0)/data.length,
    meanReadingCountClaimed:claims.length?claims.reduce((a,b)=>a+b.readingCount,0)/claims.length:null,
    budgetUnresolved:data.filter(x=>x.decision==='search_inconclusive').length,
    provenUnreachable:data.filter(x=>x.decision==='threshold_unreachable_on_grid'||x.decision==='observationally_equivalent_on_grid').length,
    allCases:data};
}
const grouped=Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,summarise(v)]));
assert.equal(caseCount,96);
assert.equal(grouped.bounded.falseRobustClaims,0);
assert.ok(grouped.bounded.claimedRobustSeparations>0);
console.log(JSON.stringify({schema:'worldlaw.bounded-ou-comparison/v1',
  preregisteredBoardMessage:160666,
  scope:'96 frozen authored unknown-tau ensembles, independent dense full-covariance 513+32 tau per pair; not measured physical source.',
  seed:'0x6E502B71',tauOracle:'dense_lower_triangular_cholesky_independent_of_innovations',
  thresholdZ:threshold,maximumReadings:4,grouped},null,2));
