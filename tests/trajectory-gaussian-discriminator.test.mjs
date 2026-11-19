import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {designGaussianReadings,GAUSSIAN_DESIGN_SCHEMA} from '../src/trajectory/gaussian-discriminator.mjs';
import {planTrajectoryExperiment,TrajectoryPlanningError} from '../src/trajectory/planner.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {createExperimentSession,planNextExperiment,acquireNextExperiment,exportExperimentSession,restoreExperimentSession} from '../src/trajectory/experiment-session.mjs';

const p=(id,x)=>({modelId:id,rows:[{time:0,position:0},...x.map((position,i)=>({time:i+1,position}))]});
const law=(id,terms=[])=>({schema:'worldlaw.torque-model/v1',id,terms,units:{...UNITS}});
const discovery=models=>({schema:'worldlaw.discovery/v1',units:{...UNITS},
  candidates:models,competitive:models,trainingRuns:[{id:'training-only'}]});
const design={inertia:2,bounds:{initialPosition:{min:0,max:0},initialRate:{min:0,max:0}},
  duration:2,sampleInterval:.5,maxStep:.1,minDisagreement:0};
const noFuture=run=>Object.keys(run).every(key=>!['observed','truth','challenge','oracle'].includes(key));

test('two competing laws: exact minimum reading cardinality on original finite schedule',()=>{
  const predictions=[p('law A',[0,0,0]),p('law B',[1,3,2])];
  const input={sigma:1,targetZ:Math.sqrt(10),maxReadings:3};
  const a=designGaussianReadings(predictions,input);
  assert.equal(a.schema,GAUSSIAN_DESIGN_SCHEMA);
  assert.equal(a.status,'distinguishable');
  assert.deepEqual(a.readings.map(x=>x.sampleIndex),[2,3]);
  assert.equal(a.certifiedMinimumReadings,2);
  assert.equal(a.lowerBoundReadings,2);
  assert.ok(Math.abs(a.minPairwiseZ-Math.sqrt(13))<1e-12);
  assert.deepEqual(input,{sigma:1,targetZ:Math.sqrt(10),maxReadings:3});
  assert.deepEqual(designGaussianReadings(predictions,input),a);
  const one=designGaussianReadings(predictions,{sigma:1,targetZ:3,maxReadings:1});
  assert.equal(one.certifiedMinimumReadings,1);
  assert.deepEqual(one.readings.map(x=>x.sampleIndex),[2]);
});

test('one-reading budget reverses the legacy full-trajectory RMS ranking on authored controls',()=>{
  const distributed=[p('zero',[0,0,0,0]),p('distributed',[2,2,2,2])];
  const concentrated=[p('zero',[0,0,0,0]),p('concentrated',[0,0,0,3])];
  const rms=x=>Math.hypot(...x[1].rows.slice(1).map((r,i)=>r.position-x[0].rows[i+1].position))/2;
  assert.ok(rms(distributed)>rms(concentrated));
  const options={sigma:1,targetZ:2.5,maxReadings:1};
  const priorChoice=designGaussianReadings(distributed,options);
  const informedChoice=designGaussianReadings(concentrated,options);
  assert.equal(priorChoice.status,'budget_insufficient');
  assert.equal(priorChoice.lowerBoundReadings,2);
  assert.equal(informedChoice.status,'distinguishable');
  assert.equal(informedChoice.certifiedMinimumReadings,1);
  assert.deepEqual(informedChoice.readings.map(r=>r.time),[4]);
});

test('budget and observational equivalence are not mislabeled successes',()=>{
  const ab=[p('A',[0,0,0]),p('B',[1,3,2])];
  const budget=designGaussianReadings(ab,{sigma:1,targetZ:Math.sqrt(12),maxReadings:1});
  assert.equal(budget.status,'budget_insufficient');
  assert.equal(budget.certifiedMinimumReadings,null);
  assert.equal(budget.lowerBoundReadings,2);
  const equivalent=designGaussianReadings([p('A',[0,0,0]),p('B',[0,0,0])],{sigma:1,targetZ:1,maxReadings:3});
  assert.equal(equivalent.status,'observationally_equivalent_on_grid');
  assert.equal(equivalent.certifiedMinimumReadings,null);
  assert.equal(equivalent.lowerBoundReadings,null);
  assert.equal(equivalent.minPairwiseZ,0);
});

test('three laws recover and certify a global minimum beyond the per-pair lower bound',()=>{
  const multi=designGaussianReadings([p('A',[0,0,0]),p('B',[2,0,0]),p('C',[0,2,0])],
    {sigma:1,targetZ:2,maxReadings:3});
  assert.equal(multi.status,'distinguishable');
  assert.equal(multi.measurementCount,2);
  assert.equal(multi.lowerBoundReadings,1);
  assert.equal(multi.certifiedMinimumReadings,2);
  assert.equal(multi.exactSubsetSearch.status,'optimal_incumbent',
    'complete enumeration proves greedy two-reading incumbent minimal even though per-pair bound is one');
  assert.deepEqual(multi.readings.map(x=>x.sampleIndex),[1,2]);
  assert.equal(multi.pairwise.length,3);
});

test('independent exhaustive subset oracle verifies claimed minimal reading counts on unfamiliar pairs',()=>{
  let state=0x6a09e667;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let trial=0;trial<250;trial++){
    const n=3+Math.floor(rand()*5),sigma=.1+rand()*2,targetZ=.5+rand()*4;
    const a=Array.from({length:n},()=>rand()*4-2),b=Array.from({length:n},()=>rand()*4-2);
    const maxReadings=1+Math.floor(rand()*n);
    const got=designGaussianReadings([p('A',a),p('B',b)],{sigma,targetZ,maxReadings});
    const threshold2=targetZ*targetZ;
    let least=Infinity,ever=false;
    for(let mask=1;mask<(1<<n);mask++){
      let count=0,squared=0;
      for(let j=0;j<n;j++)if(mask&(1<<j)){count++;squared+=((a[j]-b[j])/sigma)**2;}
      if(squared>=threshold2){least=Math.min(least,count);ever=true;}
    }
    const selectedScore=got.readings.reduce((total,r)=>total+((a[r.sampleIndex-1]-b[r.sampleIndex-1])/sigma)**2,0);
    assert.ok(got.measurementCount<=maxReadings);
    if(ever&&least<=maxReadings){
      assert.equal(got.status,'distinguishable',`trial ${trial}`);
      assert.equal(got.certifiedMinimumReadings,least,`trial ${trial}`);
      assert.ok(selectedScore>=threshold2,`trial ${trial}`);
    }else{
      assert.equal(got.certifiedMinimumReadings,null,`trial ${trial}`);
      assert.equal(got.status,ever?'budget_insufficient':'threshold_unreachable_on_grid',`trial ${trial}`);
    }
  }
});

test('multi-law cardinality certificates never beat an exhaustive independent oracle',()=>{
  let state=0x3c6ef372;
  const rand=()=>{state=(Math.imul(state,22695477)+1)>>>0;return state/4294967296;};
  for(let trial=0;trial<100;trial++){
    const m=3,n=5,sigma=.2+rand(),targetZ=.6+rand()*2;
    const paths=Array.from({length:m},(_,i)=>p('law-'+i,Array.from({length:n},()=>rand()*3-1.5)));
    const got=designGaussianReadings(paths,{sigma,targetZ,maxReadings:n});
    let best=Infinity;
    for(let mask=1;mask<(1<<n);mask++){
      let count=0,min=Infinity;
      for(let i=0;i<n;i++)if(mask&(1<<i))count++;
      for(let a=0;a<m;a++)for(let b=a+1;b<m;b++){
        let energy=0;
        for(let i=0;i<n;i++)if(mask&(1<<i))energy+=((paths[a].rows[i+1].position-paths[b].rows[i+1].position)/sigma)**2;
        min=Math.min(min,energy);
      }
      if(min>=targetZ*targetZ)best=Math.min(best,count);
    }
    if(got.certifiedMinimumReadings!==null)assert.equal(got.certifiedMinimumReadings,best,`trial ${trial}`);
    if(got.status==='distinguishable')assert.ok(got.measurementCount>=best);
    else assert.equal(best,Infinity);
  }
});

test('exact shared-subset search repairs a greedy decoy failure without changing its diagnostic trace',()=>{
  // Three hypotheses, three timestamps: a single all-pair decoy point lures
  // greedy, whereas the first two complementary points would succeed jointly.
  const trajectories=[p('A',[0,0,0]),p('B',[4,0,2]),p('C',[4,4,4])];
  const targetZ=Math.sqrt(12);
  const got=designGaussianReadings(trajectories,{sigma:1,targetZ,maxReadings:2});
  assert.equal(got.status,'distinguishable');
  assert.deepEqual(got.greedyOrder,[3,1]);
  assert.deepEqual(got.readings.map(x=>x.sampleIndex),[1,2]);
  assert.equal(got.lowerBoundReadings,1);
  assert.equal(got.certifiedMinimumReadings,2);
  assert.equal(got.exactSubsetSearch.status,'minimum_found');
  // Held-out exact witness, not shared with the greedy search.
  const subset=[0,1];
  for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
    const z=Math.sqrt(subset.reduce((sum,j)=>sum+
      (trajectories[a].rows[j+1].position-trajectories[b].rows[j+1].position)**2,0));
    assert.ok(z>=targetZ);
  }
});

test('trajectory planner uses declared noise rather than uncalibrated RMS spread when opted in',()=>{
  const d=discovery([law('free'),law('bias',[{id:'bias',coefficient:2}])]);
  const low=planTrajectoryExperiment(d,{...design,noiseSigma:.05,noiseTargetZ:3,noiseMaxReadings:4});
  assert.equal(low.method,'finite-grid_minimax_independent_gaussian_discrimination');
  assert.equal(low.status,'proposed');
  assert.equal(low.selected.power.status,'distinguishable');
  assert.equal(low.selected.power.certifiedMinimumReadings,1);
  assert.match(low.diagnostics.rankingReason,/Fewest independently noisy prospective readings/);
  assert.equal(low.selected.power.readings[0].time,2);
  assert.ok(low.selected.predictions.every(x=>x.rows.every(noFuture)));
  assert.deepEqual(low.provenance.trainingRunIds,['training-only']);
  assert.equal(low.diagnostics.reservedPowerProducts,16);
  const noisy=planTrajectoryExperiment(d,{...design,noiseSigma:1,noiseTargetZ:3,noiseMaxReadings:4});
  assert.equal(noisy.status,'uninformative');
  assert.equal(noisy.selected.power.status,'threshold_unreachable_on_grid');
  assert.match(noisy.diagnostics.rankingReason,/No release reached the declared noise separation threshold/);
  const incumbent=planTrajectoryExperiment(d,design);
  assert.equal(incumbent.method,'rms_pairwise_position_disagreement');
  assert.equal(incumbent.scoreUnits,'rad');
  assert.equal(incumbent.status,'proposed');
});

test('the independent controller numerical gate actually admits stable Gaussian proposals',()=>{
  const d=discovery([law('free'),law('bias',[{id:'bias',coefficient:2}])]);
  const plan=planTrajectoryExperiment(d,{...design,noiseSigma:.05,noiseTargetZ:3,noiseMaxReadings:4});
  const qualified=qualifyTrajectoryPlan(d,plan);
  assert.equal(qualified.status,'screen_passed',JSON.stringify(qualified.selectedQualification));
  assert.equal(qualified.selectedQualification.status,'screen_passed');
  assert.ok(qualified.selectedQualification.powerMarginZ>qualified.selectedQualification.powerSensitivityZ);
  assert.ok(qualified.selectedQualification.refinedPower.minPairwiseZ>=plan.options.noiseTargetZ);
  const forged=structuredClone(plan);forged.selected.power.minPairwiseZ+=5;
  forged.ranked[0].power.minPairwiseZ+=5;
  const refused=qualifyTrajectoryPlan(d,forged);
  assert.equal(refused.status,'numerically_unresolved');
  assert.equal(refused.selectedQualification.reason,'plan_power_mismatch');
});

test('work preflight and invalid noise contracts fail before comparing a partial grid',()=>{
  const d=discovery([law('free'),law('bias',[{id:'bias',coefficient:2}])]);
  for(const x of [{...design,noiseSigma:0},{...design,noiseSigma:-1},{...design,noiseMaxReadings:2},
    {...design,noiseSigma:1,noiseMaxReadings:0}]) {
    assert.throws(()=>planTrajectoryExperiment(d,x),e=>e instanceof TrajectoryPlanningError && e.code==='invalid_design');
  }
  assert.throws(()=>planTrajectoryExperiment(d,{...design,noiseSigma:.05,noiseMaxReadings:4,maxPowerProducts:15}),
    e=>e instanceof TrajectoryPlanningError && e.code==='resource_limit');
});

test('actual independent virtual acquisition uses the same prospective noise contract and survives replay',()=>{
  const bundle=JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
  const initial=createExperimentSession(createChallenge(bundle));
  assert.throws(()=>planNextExperiment(initial,{noiseSigma:.06}),
    e=>e.code==='instrument_mismatch');
  const planned=planNextExperiment(initial,{noiseSigma:.012,noiseTargetZ:.000001,noiseMaxReadings:1,maxModels:2});
  assert.equal(planned.plan.status,'proposed');
  assert.equal(planned.plan.selected.power.certifiedMinimumReadings,1);
  assert.throws(()=>acquireNextExperiment(planned,{seed:92501,noiseSigma:.02}),
    e=>e.code==='instrument_mismatch');
  const pending=acquireNextExperiment(planned,{seed:92501});
  assert.equal(pending.acquisition.request.noiseSigma,.012);
  assert.equal(pending.acquisition.run.source.positionNoiseSigma,.012);
  const reopened=restoreExperimentSession(exportExperimentSession(pending));
  assert.equal(reopened.plan.options.noiseSigma,.012);
  assert.deepEqual(reopened.acquisition.run,pending.acquisition.run);
});

test('held-out Gaussian reading and independent randomized-label negative control',()=>{
  // This study fixes its two prospective means and measurement policy first.
  const planned=designGaussianReadings([p('A',[0,0]),p('B',[3.3,0])],{sigma:1,targetZ:3,maxReadings:1});
  assert.equal(planned.certifiedMinimumReadings,1);
  let state=0x51a7e29;
  const uniform=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
  const normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
  let errors=0,negativeControlErrors=0,N=2000;
  for(let i=0;i<N;i++){
    const trueClass=i%2;
    const measured=(trueClass?3.3:0)+normal();
    const predictedClass=measured>1.65?1:0;
    if(predictedClass!==trueClass)errors++;
    // Nullgarden-style label randomization is held out from both plan and readings:
    // its independent coin has no relationship to the physical source.
    const randomizedLabel=uniform()<.5?0:1;
    if(predictedClass!==randomizedLabel)negativeControlErrors++;
  }
  assert.ok(errors/N<.09, `Unexpected held-out measurement error ${errors}/${N}`);
  assert.ok(negativeControlErrors/N>.44 && negativeControlErrors/N<.56,
    `Label-permutation negative control unexpectedly predictive: ${negativeControlErrors}/${N}`);
});


test('full common-subset search proves a budget impossible even when every separate pair admits one reading',()=>{
  const models=[p('A',[0,0,0]),p('B',[4,0,0]),p('C',[0,4,0])];
  const impossible=designGaussianReadings(models,{sigma:1,targetZ:2,maxReadings:1});
  assert.equal(impossible.lowerBoundReadings,1);
  assert.equal(impossible.status,'budget_insufficient');
  assert.equal(impossible.exactSubsetSearch.status,'proved_budget_insufficient');
  assert.equal(impossible.certifiedMinimumReadings,null);
  const possible=designGaussianReadings(models,{sigma:1,targetZ:2,maxReadings:2});
  assert.equal(possible.certifiedMinimumReadings,2);
  assert.deepEqual(possible.readings.map(x=>x.sampleIndex),[1,2]);
});

test('frozen independent exhaustive subset oracle verifies minimum or nonexistence across 210 unfamiliar multi-law designs',()=>{
  let state=0x7f4a7c15;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let trial=0;trial<210;trial++){
    const modelCount=3+(trial%2),n=5+(trial%3),sigma=.15+rand()*2,targetZ=.5+rand()*5;
    const paths=Array.from({length:modelCount},(_,i)=>p('unknown'+i,
      Array.from({length:n},()=>Math.round((rand()*5-2.5)*1000)/1000)));
    const budget=1+Math.floor(rand()*n);
    const result=designGaussianReadings(paths,{sigma,targetZ,maxReadings:budget});
    let minCount=Infinity;
    for(let mask=1;mask<(1<<n);mask++){
      let count=0,worst=Infinity;
      for(let k=0;k<n;k++)if(mask&(1<<k))count++;
      for(let a=0;a<modelCount;a++)for(let b=a+1;b<modelCount;b++){
        let squared=0;
        for(let k=0;k<n;k++)if(mask&(1<<k))
          squared+=((paths[a].rows[k+1].position-paths[b].rows[k+1].position)/sigma)**2;
        worst=Math.min(worst,squared);
      }
      if(worst>=targetZ**2)minCount=Math.min(minCount,count);
    }
    if(minCount<=budget){
      assert.equal(result.status,'distinguishable',`trial ${trial}`);
      assert.equal(result.certifiedMinimumReadings,minCount,`trial ${trial}`);
      const selected=result.readings.map(r=>r.sampleIndex-1);
      assert.equal(selected.length,minCount);
      for(let a=0;a<modelCount;a++)for(let b=a+1;b<modelCount;b++){
        let squared=0;
        for(const k of selected)
          squared+=((paths[a].rows[k+1].position-paths[b].rows[k+1].position)/sigma)**2;
        assert.ok(squared>=targetZ**2,`witness trial ${trial} pair ${a}/${b}`);
      }
    }else{
      assert.equal(result.certifiedMinimumReadings,null,`trial ${trial}`);
      assert.equal(result.status,minCount===Infinity?'threshold_unreachable_on_grid':'budget_insufficient',
        `trial ${trial}`);
    }
  }
});

test('no greedy witness cannot be mislabeled an optimal incumbent when pairwise lower bound exceeds budget',()=>{
  const models=[p('A',[0,0,0]),p('B',[1,1,0]),p('C',[0,1,1])];
  const got=designGaussianReadings(models,{sigma:1,targetZ:1.4,maxReadings:1});
  assert.equal(got.status,'budget_insufficient');
  assert.equal(got.lowerBoundReadings,2);
  assert.equal(got.certifiedMinimumReadings,null);
  assert.equal(got.exactSubsetSearch.status,'pairwise_bound_insufficient');
});

test('large schedules retain the incumbent bounded greedy behavior with explicit unproved search status',()=>{
  const n=25;
  const models=[p('A',Array(n).fill(0)),
    p('B',Array.from({length:n},(_,i)=>i===0?4:0)),
    p('C',Array.from({length:n},(_,i)=>i===1?4:0))];
  const result=designGaussianReadings(models,{sigma:1,targetZ:2,maxReadings:2});
  assert.equal(result.exactSubsetSearch.status,'skipped');
  assert.equal(result.certifiedMinimumReadings,null);
  assert.equal(result.status,'distinguishable');
});

test('200-sample default-scale prospective course repairs greedy decoy without a false cardinality certificate',()=>{
  const n=200;const make=x=>Array.from({length:n},(_,i)=>x[i]??0);
  const a=make({}),b=make({9:4,89:2}),c=make({9:4,52:4,89:4});
  const result=designGaussianReadings([p('A',a),p('B',b),p('C',c)],
    {sigma:1,targetZ:Math.sqrt(12),maxReadings:2});
  assert.equal(result.exactSubsetSearch.status,'skipped');
  assert.equal(result.wideGridRepair.status,'repaired_witness');
  assert.equal(result.status,'distinguishable');
  assert.equal(result.certifiedMinimumReadings,null);
  assert.deepEqual(result.readings.map(r=>r.sampleIndex),[10,53]);
  assert.deepEqual(result.greedyOrder,[90,10]);
  assert.ok(result.minPairwiseZ>Math.sqrt(12));
});

test('held-out wide-grid decoy permutations: 64 independent placements recover both complementary readings',()=>{
  const n=200,N=64,target2=12;
  let seed=0xd12eadc5;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let trial=0;trial<N;trial++){
    const chosen=new Set();
    while(chosen.size<3)chosen.add(Math.floor(rng()*n));
    const [first,second,decoy]=[...chosen];
    const a=Array(n).fill(0),b=Array(n).fill(0),c=Array(n).fill(0);
    b[first]=4;b[decoy]=2;
    c[first]=4;c[second]=4;c[decoy]=4;
    const paths=[p('A',a),p('B',b),p('C',c)];
    const got=designGaussianReadings(paths,{sigma:1,targetZ:Math.sqrt(target2),maxReadings:2});
    assert.equal(got.exactSubsetSearch.status,'skipped');
    assert.equal(got.wideGridRepair.status,'repaired_witness',`trial ${trial}`);
    assert.equal(got.status,'distinguishable',`trial ${trial}`);
    assert.equal(got.certifiedMinimumReadings,null,`trial ${trial}`);
    assert.deepEqual(got.readings.map(r=>r.sampleIndex).sort((a,b)=>a-b),
      [first+1,second+1].sort((a,b)=>a-b),`trial ${trial}`);
    const greedy=got.greedyOrder.map(i=>i-1);
    let worst=Infinity;
    for(let x=0;x<3;x++)for(let y=x+1;y<3;y++){
      const energy=greedy.reduce((sum,j)=>sum+
        (paths[x].rows[j+1].position-paths[y].rows[j+1].position)**2,0);
      worst=Math.min(worst,energy);
    }
    assert.ok(worst<target2,`original greedy unexpectedly succeeded in trial ${trial}`);
  }
});

test('wide-grid local repair refuses false success when one sensor reading cannot separate all pairs',()=>{
  const n=200,a=Array(n).fill(0),b=Array(n).fill(0),c=Array(n).fill(0);
  b[7]=4;c[77]=4;
  const got=designGaussianReadings([p('A',a),p('B',b),p('C',c)],
    {sigma:1,targetZ:2,maxReadings:1});
  assert.equal(got.status,'search_inconclusive');
  assert.equal(got.certifiedMinimumReadings,null);
  assert.equal(got.wideGridRepair.status,'not_applicable');
  assert.equal(got.exactSubsetSearch.status,'skipped');
});
