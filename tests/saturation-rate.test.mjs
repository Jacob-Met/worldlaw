import test from'node:test';import assert from'node:assert/strict';
import{compareSaturationRates,screenSaturationChallenges}from'../src/unknown-lab/saturation-profile.mjs';
import{freezeSaturationRateRequest,receiveSaturationRateAcquisition,exportSaturationRateAcquisition,importSaturationRateAcquisition}from'../src/unknown-lab/saturation-rate-acquisition.mjs';
import{saturatedRatePlanningExample,authoredSaturationObservation,SATURATION_RATE_EXAMPLE_SETTINGS as config}from'../src/unknown-lab/saturation-rate-fixture.mjs';
const protocol={runId:'future-rate',arrangement:'Authored fixed preparation and paired torque readout',pairs:16};
const request=()=>freezeSaturationRateRequest(saturatedRatePlanningExample(),config,protocol);
test('complete state and prospective window margin; source and controls stay immutable',()=>{
 const study=saturatedRatePlanningExample(),input=structuredClone(config),before=JSON.stringify(study),plan=compareSaturationRates(study,input);
 assert.equal(plan.selected,'rate-2');assert(plan.courses[2].margin.outer[0]>.138);
 assert.deepEqual(plan.courses[2].probe,{command:0,position:.6,rate:.3});assert.equal(plan.courses[0].separates,false);assert.equal(plan.courses[4].separates,false);
 assert.deepEqual(plan.uncomparedScaleRanges,[{lower:.2,upper:.5,lowerClosed:false,upperClosed:false}]);
 const snapshot=JSON.stringify(plan);input.probes[2].rate=42;input.windows[0][1]=.19;assert.equal(JSON.stringify(plan),snapshot);assert.equal(JSON.stringify(study),before);
});
test('qualified independent outcomes screen both frozen windows without revising training or excluding the gap',()=>{
 for(const [scale,status]of [[.1,['outer-overlap-only','excluded']],[.5,['excluded','outer-overlap-only']],[.3,['excluded','excluded']]]){
  const frozen=request(),snapshot=JSON.stringify(frozen),observation=authoredSaturationObservation(frozen,scale),received=receiveSaturationRateAcquisition(frozen,observation);
  assert.equal(received.qualification.status,'within-declared-plan');assert.deepEqual(received.windows.map(w=>w.status),status);
  assert.equal(received.study.runs.at(-1).role,'challenge');assert.equal(JSON.stringify(frozen),snapshot);assert.equal(received.uncomparedScaleRanges.length,1);
  assert.deepEqual(compareSaturationRates(received.study,config),compareSaturationRates(frozen.study,config));
 }
});
test('source-only receipt replay ignores forged derived outputs and recomputes original measurement',()=>{
 const frozen=request(),observation=authoredSaturationObservation(frozen),raw=JSON.parse(exportSaturationRateAcquisition(frozen,observation));
 assert.equal(raw.plan,undefined);raw.result={windows:[{status:'identified'}]};raw.request.forecast={selected:'forged'};
 const replay=importSaturationRateAcquisition(JSON.stringify(raw));assert.deepEqual(replay.result.windows.map(w=>w.status),['outer-overlap-only','excluded']);
 const noOutcome=importSaturationRateAcquisition(exportSaturationRateAcquisition(frozen));assert.equal(noOutcome.result,null);
});
test('stale, mismatched, reused, or relabelled acquisition inputs refuse',()=>{
 const frozen=request(),original=authoredSaturationObservation(frozen);
 for(const mutate of [o=>o.protocol.probe.rate=.4,o=>o.run.probe.position=.7,o=>o.run.preparation.duration=3,o=>o.run.role='training',o=>o.run.id='other',o=>o.run.notebook.source='measured']){
  const o=structuredClone(original);mutate(o);assert.throws(()=>receiveSaturationRateAcquisition(frozen,o));
 }
 const stale=structuredClone(frozen.study);stale.runs[0].notebook.trials[0].jointTorque+=.001;assert.throws(()=>receiveSaturationRateAcquisition(frozen,original,stale));
 const reused={protocol:frozen.protocol,run:{...structuredClone(frozen.study.runs[0]),id:frozen.protocol.runId,role:'challenge',probe:frozen.protocol.probe}};assert.throws(()=>receiveSaturationRateAcquisition(frozen,reused));
 const first=receiveSaturationRateAcquisition(frozen,original);
 const next=freezeSaturationRateRequest(first.study,config,{...protocol,runId:'second-acquisition'});
 const duplicate={protocol:next.protocol,run:{...structuredClone(first.observation.run),id:next.protocol.runId}};
 assert.throws(()=>receiveSaturationRateAcquisition(next,duplicate),/recording cannot be reused|reading evidence overlaps/);
 const changed=structuredClone(frozen);changed.protocol.probe.rate=1;assert.throws(()=>receiveSaturationRateAcquisition(changed,original));
});
test('order and realized radius failure retain observation but make no window inference',()=>{
 for(const kind of ['order','radius']){
  const frozen=request(),o=authoredSaturationObservation(frozen);
  if(kind==='radius')o.run.notebook.noiseSigma=1;else for(const t of o.run.notebook.trials){const i=Number(t.pairId.split('-')[1]);t.sampleIndex=2*i+(t.history==='conditioned'?1:0);}
  const r=receiveSaturationRateAcquisition(frozen,o);assert.equal(r.qualification.status,'unqualified');assert(r.windows.every(w=>w.status==='not-evaluated'));assert(r.observed.interval.length===2);
 }
});
test('whole-work refusal, cost and radius controls, training-excluded windows and untouched joint API',()=>{
 const study=saturatedRatePlanningExample();
 for(const patch of [{budget:0},{contrastRadius:1}]){const r=compareSaturationRates(study,{...config,...patch});assert.equal(r.selected,null);assert.equal(r.courses.length,5);}
 const limited=compareSaturationRates(study,{...config,settings:{...config.settings,maxEvaluations:2}});assert.equal(limited.status,'budget-unresolved');assert.deepEqual(limited.courses,[]);assert.equal(limited.selected,null);
 assert.throws(()=>freezeSaturationRateRequest(study,{...config,budget:0},protocol));
 assert.throws(()=>compareSaturationRates(study,{...config,windows:[[.05,.5],[.5,1]]}));
 assert.equal(screenSaturationChallenges(study).status,'untested');
});
