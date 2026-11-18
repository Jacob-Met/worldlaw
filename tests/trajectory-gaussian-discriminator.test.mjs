import test from 'node:test';
import assert from 'node:assert/strict';
import {designGaussianReadings,GAUSSIAN_DESIGN_SCHEMA} from '../src/trajectory/gaussian-discriminator.mjs';
import {planTrajectoryExperiment,TrajectoryPlanningError} from '../src/trajectory/planner.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';

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

test('three laws expose unproved global optimality rather than claiming an exact greedy certificate',()=>{
  const multi=designGaussianReadings([p('A',[0,0,0]),p('B',[2,0,0]),p('C',[0,2,0])],
    {sigma:1,targetZ:2,maxReadings:3});
  assert.equal(multi.status,'distinguishable');
  assert.equal(multi.measurementCount,2);
  assert.equal(multi.lowerBoundReadings,1);
  assert.equal(multi.certifiedMinimumReadings,null);
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

test('trajectory planner uses declared noise rather than uncalibrated RMS spread when opted in',()=>{
  const d=discovery([law('free'),law('bias',[{id:'bias',coefficient:2}])]);
  const low=planTrajectoryExperiment(d,{...design,noiseSigma:.05,noiseTargetZ:3,noiseMaxReadings:4});
  assert.equal(low.method,'finite-grid_minimax_independent_gaussian_discrimination');
  assert.equal(low.status,'proposed');
  assert.equal(low.selected.power.status,'distinguishable');
  assert.equal(low.selected.power.certifiedMinimumReadings,1);
  assert.equal(low.selected.power.readings[0].time,2);
  assert.ok(low.selected.predictions.every(x=>x.rows.every(noFuture)));
  assert.deepEqual(low.provenance.trainingRunIds,['training-only']);
  assert.equal(low.diagnostics.reservedPowerProducts,16);
  const noisy=planTrajectoryExperiment(d,{...design,noiseSigma:1,noiseTargetZ:3,noiseMaxReadings:4});
  assert.equal(noisy.status,'uninformative');
  assert.equal(noisy.selected.power.status,'threshold_unreachable_on_grid');
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
