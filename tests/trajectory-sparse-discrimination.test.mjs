import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acquireVirtualPendulum,acquireVirtualPendulumReadings} from '../src/trajectory/virtual-experiment.mjs';
import {receiveSparseReadings,runSparseExperiment,SparseDiscriminationError} from '../src/trajectory/sparse-discrimination.mjs';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

const law=(id,terms)=>({schema:'worldlaw.torque-model/v1',id,terms,units:{...UNITS}});
const first=law('physical-reference',[{id:'rate',coefficient:-.24},{id:'gravity',coefficient:-2.2}]);
const second=law('wrong-positive-damping',[{id:'rate',coefficient:+.24},{id:'gravity',coefficient:+2.2}]);
const discovery={schema:'worldlaw.discovery/v1',units:{...UNITS},candidates:[first,second],
  competitive:[first,second],trainingRuns:[{id:'synthetic-training-only'}]};
const settings={inertia:.8,bounds:{initialPosition:{min:1.2,max:1.2},initialRate:{min:0,max:0}},
  positionCount:1,rateCount:1,duration:2,sampleInterval:.04,maxStep:.005,maxTotalSteps:250000,
  noiseSigma:.01,noiseTargetZ:3.29,noiseMaxReadings:4};
const request={initialPosition:1.2,initialRate:0,duration:2,sampleInterval:.04,noiseSigma:.01,seed:345678};
const prior={id:'source-run-1',kind:'synthetic',source:{label:'prior'},samples:[]};

test('the new instrument truly reads only selected postinitial timestamps, while preserving full-path numerical dynamics',()=>{
  const unnoisy={...request,noiseSigma:0};
  const full=acquireVirtualPendulum(unnoisy,{existingRuns:[]});
  const sparse=acquireVirtualPendulumReadings({...unnoisy,sampleIndices:[1,13,26,50]},{existingRuns:[]});
  assert.equal(full.samples.length,51);
  assert.equal(sparse.schema,'worldlaw.virtual-pendulum-sparse/v1');
  assert.equal(sparse.measurementCount,4);
  assert.equal(sparse.source.fullGridSampleCount,51);
  assert.equal(sparse.source.measuredSampleCount,4);
  assert.equal(sparse.source.noise.measurementDrawCount,4);
  assert.deepEqual(sparse.readings.map(r=>r.sampleIndex),[1,13,26,50]);
  for(const row of sparse.readings){
    assert.equal(row.position,full.samples[row.sampleIndex].position);
    assert.equal(row.time,full.samples[row.sampleIndex].time);
    assert.equal(row.command,0);
  }
  assert.equal(Object.hasOwn(sparse,'samples'),false);
  assert.equal(sparse.readings.some(r=>r.sampleIndex===0),false);
  assert.equal(sparse.readings.some(r=>r.sampleIndex===2),false);
});

test('the sparse acquisition rejects missing, duplicate, unsorted, initial or beyond-grid indices without sampling',()=>{
  const base={...request};
  for(const sampleIndices of [[0],[51],[5,5],[9,2],[],[2.2],new Array(129).fill(1)]){
    assert.throws(()=>acquireVirtualPendulumReadings({...base,sampleIndices},{existingRuns:[]}),
      e=>e.code==='invalid_request',JSON.stringify(sampleIndices));
  }
  assert.throws(()=>acquireVirtualPendulumReadings({...base},{existingRuns:[]}),
    e=>e.code==='invalid_request');
  const sparse=acquireVirtualPendulumReadings({...request,sampleIndices:[1,50]},{existingRuns:[]});
  assert.deepEqual(acquireVirtualPendulumReadings({...request,sampleIndices:[1,50]},{existingRuns:[]}),sparse);
  assert.throws(()=>acquireVirtualPendulumReadings({...request,sampleIndices:[1,50]},{existingRuns:[sparse]}),
    e=>e.code==='repeated_evidence');
  assert.throws(()=>acquireVirtualPendulumReadings({...request,sampleIndices:[2,49]},{existingRuns:[sparse]}),
    e=>e.code==='reused_noise_stream');
  assert.throws(()=>acquireVirtualPendulum({...request},{existingRuns:[sparse]}),
    e=>e.code==='reused_noise_stream');
  const noiseless=acquireVirtualPendulumReadings({...request,noiseSigma:0,sampleIndices:[1,25]},{existingRuns:[]});
  assert.throws(()=>acquireVirtualPendulumReadings({...request,noiseSigma:0,sampleIndices:[2,26]},
    {existingRuns:[noiseless]}),e=>e.code==='repeated_evidence');
});

test('guarded real sparse pipeline screens all original models before creating sensor evidence',()=>{
  const result=runSparseExperiment(discovery,settings,{seed:123456,existingRuns:[prior]});
  assert.equal(result.status,'acquired_sparse_evidence');
  assert.equal(result.numericalQualification.status,'screen_passed',JSON.stringify(result.numericalQualification.selectedQualification));
  assert.equal(result.evidence.measurementCount,1);
  assert.equal(result.evidence.source.fullGridSampleCount,51);
  assert.deepEqual(result.evidence.readings.map(r=>r.sampleIndex),result.plan.selected.power.readings.map(r=>r.sampleIndex));
  assert.equal(result.receiving.measuredReadingCount,1);
  assert.equal(result.receiving.unmeasuredPositionsConsumed,0);
  assert.equal(result.receiving.candidates.length,2);
  assert.ok(Math.abs(result.receiving.candidates.reduce((s,c)=>s+c.conditionalEqualPriorWeight,0)-1)<1e-14);
  assert.equal(result.receiving.status,'conditional_discrimination_only');
  assert.equal(result.receiving.selectedModelId,'physical-reference');
  assert.equal(result.evidence.source.noise.measurementDrawCount,1);
  // A receiver must not inspect even readable virtual-instrument oracle provenance.
  const hiddenOracle=structuredClone(result.evidence);
  Object.defineProperty(hiddenOracle.source,'oracle',{get(){throw Error('oracle leaked into receiver');}});
  assert.deepEqual(receiveSparseReadings(result.plan,hiddenOracle),result.receiving);
});

test('sparse receiver rejects forged or stale readings rather than making a favorable choice',()=>{
  const result=runSparseExperiment(discovery,settings,{seed:125789,existingRuns:[prior]});
  for(const altered of [
    ev=>{ev.readings[0].time+=.01;},
    ev=>{ev.readings[0].sampleIndex++;},
    ev=>{ev.source.positionNoiseSigma=.02;},
    ev=>{ev.source.sampleIndices[0]++;},
    ev=>{ev.measurementCount++;},
    ev=>{ev.initialPosition+=.1;},
    ev=>{ev.readings[0].position=NaN;},
  ]){
    const evidence=structuredClone(result.evidence);
    altered(evidence);
    assert.throws(()=>receiveSparseReadings(result.plan,evidence),e=>
      e instanceof SparseDiscriminationError&&e.code==='protocol_mismatch');
  }
  const malformed=structuredClone(result.plan);
  malformed.selected.predictions[0].rows[result.plan.selected.power.readings[0].sampleIndex].time+=.01;
  assert.throws(()=>receiveSparseReadings(malformed,result.evidence),
    e=>e.code==='invalid_plan');
});

test('held-out noisy classifications and independent randomized-label controls on fixed candidate law pair',()=>{
  const plan=planTrajectoryExperiment(discovery,settings);
  assert.equal(plan.status,'proposed');
  assert.equal(qualifyTrajectoryPlan(discovery,plan).status,'screen_passed');
  const indices=plan.selected.power.readings.map(x=>x.sampleIndex);
  let right=0,negativeMatches=0,state=0x3abc1234;
  const uniform=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
  const n=128;
  for(let i=0;i<n;i++){
    // Candidate physical coefficients are frozen before the independent seeds.
    const evidence=acquireVirtualPendulumReadings({...plan.selected.acquisitionRequest,
      noiseSigma:settings.noiseSigma,seed:130000+i,sampleIndices:indices},{existingRuns:[prior]});
    const outcome=receiveSparseReadings(plan,evidence);
    if(outcome.selectedModelId==='physical-reference')right++;
    if(outcome.selectedModelId===(uniform()<.5?'physical-reference':'wrong-positive-damping'))negativeMatches++;
  }
  assert.ok(right/n>.9,`Sparse held-out physical-source selection is only ${right}/${n}`);
  assert.ok(negativeMatches/n>.4&&negativeMatches/n<.6,
    `Nullgarden-style independent randomized-label control was ${negativeMatches}/${n}`);
});
