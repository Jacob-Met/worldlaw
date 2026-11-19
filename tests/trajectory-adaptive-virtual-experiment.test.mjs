import test from 'node:test';
import assert from 'node:assert/strict';
import {runAdaptiveVirtualExperiment} from '../src/trajectory/adaptive-virtual-experiment.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';

const law=(id,terms)=>({schema:'worldlaw.torque-model/v1',id,terms,units:{...UNITS}});
const correct=law('controlled-physical-pendulum',[
  {id:'rate',coefficient:-.24},{id:'gravity',coefficient:-2.2}
]);
const wrong=law('opposite-unphysical-dynamics',[
  {id:'rate',coefficient:+.24},{id:'gravity',coefficient:+2.2}
]);
const discovery={schema:'worldlaw.discovery/v1',units:{...UNITS},
  candidates:[correct,wrong],competitive:[correct,wrong],
  trainingRuns:[{id:'independent-training-only'}]};
const design={inertia:.8,
  bounds:{initialPosition:{min:1.2,max:1.2},initialRate:{min:0,max:0}},
  positionCount:1,rateCount:1,duration:2,sampleInterval:.04,
  maxStep:.005,maxTotalSteps:250000
};
const sensor={sigma:.01,maxReadings:4,decisionThreshold:.98};
const prior={id:'virtual-sensor-training',kind:'synthetic',
  source:{label:'independent prior source'},samples:[]};

test('controlled real virtual plant is screened and measured after a frozen prospective EIG choice',()=>{
  const run=runAdaptiveVirtualExperiment(discovery,design,sensor,
    {seed:123456,existingRuns:[prior]});
  assert.equal(run.status,'acquired_adaptive_evidence');
  assert.equal(run.numericalQualification.status,'screen_passed');
  assert.equal(run.plan.status,'proposed');
  assert.equal(run.instrument,'synthetic independent explicit-equation pendulum');
  assert.ok(run.evidence.measurementCount>=1&&run.evidence.measurementCount<=4);
  assert.equal(run.evidence.measurementCount,run.trace.length);
  assert.equal(run.evidence.source.sampleIndices.length,run.trace.length);
  assert.equal(run.receiving.selectedModelId,'controlled-physical-pendulum');
  assert.equal(run.receiving.unobservedSensorValuesConsumed,0);
  assert.equal(run.unmeasuredPositionsConsumed,0);
  for(let i=0;i<run.trace.length;i++){
    const step=run.trace[i];
    assert.equal(step.round,i+1);
    assert.equal(step.prospective.sampleIndex,step.actualObservation.sampleIndex);
    assert.equal(step.prospective.time,step.actualObservation.time);
    assert.deepEqual(step.actualObservation,run.evidence.readings[i]);
    if(i)assert.ok(step.prospective.sampleIndex>run.trace[i-1].prospective.sampleIndex);
    assert.equal(Object.hasOwn(step.prospective,'position'),false);
  }
  // Independently verify these predicted model forecasts did not include the
  // newly acquired source measurements before acquisition began.
  const priorPlan=planTrajectoryExperiment(discovery,design);
  assert.deepEqual(run.plan.selected.predictions,priorPlan.selected.predictions);
  assert.equal(run.evidence.source.positionNoiseSigma,sensor.sigma);
  assert.equal(run.evidence.kind,'synthetic');
});

test('frozen-source 64 seed replay: correct offered law selected with independent fresh sensor draws',()=>{
  let correctCount=0,confidence=0,count=0;
  for(let seed=50001;seed<=50064;seed++){
    const run=runAdaptiveVirtualExperiment(discovery,design,
      {...sensor,correlationTime:.35,maxReadings:3},{seed,existingRuns:[prior]});
    assert.equal(run.status,'acquired_adaptive_evidence');
    assert.equal(run.evidence.source.seed,seed);
    assert.equal(run.evidence.source.positionNoiseCorrelationTime,.35);
    assert.ok(run.actualSensorReadings<=3);
    if(run.receiving.selectedModelId===correct.modelId)correctCount++;
    if(run.receiving.status==='conditional_decision_ready')confidence++;
    count++;
  }
  assert.ok(correctCount/count>.95,'The independently integrated reference is not reliably identified.');
  assert.ok(confidence/count>.95,'The frozen physical source rarely clears its declared conditional threshold.');
});

test('unsupported combined static design, missing sensor parameters and reused noise refuse before new measurement',()=>{
  assert.throws(()=>runAdaptiveVirtualExperiment(discovery,
    {...design,noiseSigma:.01},sensor,{seed:1,existingRuns:[prior]}),
    /separately|static sensor/);
  assert.throws(()=>runAdaptiveVirtualExperiment(discovery,design,
    {...sensor,sigma:0},{seed:1,existingRuns:[prior]}),/sigma/);
  assert.throws(()=>runAdaptiveVirtualExperiment(discovery,design,
    {...sensor,oracleCoefficient:-2.2},{seed:1,existingRuns:[prior]}),
    /Unsupported adaptive sensor field/);
  assert.throws(()=>runAdaptiveVirtualExperiment(discovery,design,
    sensor,{existingRuns:[prior]}),/seed/);
  assert.throws(()=>runAdaptiveVirtualExperiment(discovery,design,
    sensor,{seed:123456}),/existingRuns/);
  const run=runAdaptiveVirtualExperiment(discovery,design,sensor,
    {seed:123456,existingRuns:[prior]});
  assert.throws(()=>runAdaptiveVirtualExperiment(discovery,design,sensor,
    {seed:123456,existingRuns:[prior,run.evidence]}),/already retained|reused/);
});

test('all-model falsification remains limited by offered family, never promoted to causal truth',()=>{
  const wrong1=law('wrong-low-gravity',[
    {id:'rate',coefficient:-.8},{id:'gravity',coefficient:-.1}
  ]);
  const wrong2=law('wrong-high-gravity',[
    {id:'rate',coefficient:-.7},{id:'gravity',coefficient:-1.1}
  ]);
  const absentTruth={...discovery,candidates:[wrong1,wrong2],
    competitive:[wrong1,wrong2]};
  const run=runAdaptiveVirtualExperiment(absentTruth,design,
    {...sensor,decisionThreshold:.85},{seed:98765,existingRuns:[prior]});
  assert.ok(['acquired_adaptive_evidence','acquisition_refused'].includes(run.status));
  if(run.status==='acquired_adaptive_evidence'){
    assert.ok(run.receiving.models.every(m=>m.modelId.startsWith('wrong-')));
    assert.ok(run.interpretation.includes('no unknown truth or refit'));
    assert.equal(run.evidence.source.oracle.gravity,-2.2);
    assert.equal(run.unmeasuredPositionsConsumed,0);
  }else{
    assert.equal(run.acquisitionPerformed,false);
    assert.equal(run.evidence,null);
  }
});
