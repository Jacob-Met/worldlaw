import test from 'node:test';
import assert from 'node:assert/strict';
import {designGaussianReadings,GAUSSIAN_DESIGN_SCHEMA} from '../src/trajectory/gaussian-discriminator.mjs';
import {planTrajectoryExperiment,TrajectoryPlanningError} from '../src/trajectory/planner.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

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
  assert.equal(noisy.selected.power.status,'observationally_equivalent_on_grid');
  const incumbent=planTrajectoryExperiment(d,design);
  assert.equal(incumbent.method,'rms_pairwise_position_disagreement');
  assert.equal(incumbent.scoreUnits,'rad');
  assert.equal(incumbent.status,'proposed');
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
