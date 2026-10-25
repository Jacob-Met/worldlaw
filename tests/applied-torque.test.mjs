import test from 'node:test';import assert from 'node:assert/strict';
import {identifyAppliedTorque,exportAppliedTorque,reopenAppliedTorque} from '../src/trajectory/applied-torque.mjs';
import {appliedTorqueExample} from '../src/trajectory/applied-torque-example.mjs';
test('applied torque identifies inertia and losses and predicts separate excitation',()=>{
 const r=identifyAppliedTorque(appliedTorqueExample());assert.equal(r.status,'identified_declared_model');
 for(const [key,value] of Object.entries({inertia:3,damping:.6,stiffness:2}))assert.ok(Math.abs(r.candidate[key]-value)<.003);
 assert.ok(r.challenges[0].rollout.metrics.positionRMSE<.001);assert.equal(r.rank,3);
});
test('one frequency leaves inertia and stiffness confounded without a candidate',()=>{
 const r=identifyAppliedTorque(appliedTorqueExample({singleMode:true}));assert.equal(r.status,'unidentifiable');assert.equal(r.rank,2);assert.equal(r.candidate,null);assert.deepEqual(r.challenges,[]);
});
test('initial rate and held-out outcomes cannot fit inertia',()=>{
 const source=appliedTorqueExample(),baseline=identifyAppliedTorque(source);source.trainingRuns[0].initialRate=99;source.challengeRuns[0].samples[500].position+=1;
 const changed=identifyAppliedTorque(source);assert.deepEqual(changed.candidate,baseline.candidate);assert.notEqual(changed.challenges[0].rollout.metrics.positionRMSE,baseline.challenges[0].rollout.metrics.positionRMSE);
});
test('source-only replay recomputes derived claims and preserves calibrated channel',()=>{
 const result=identifyAppliedTorque(appliedTorqueExample()),text=exportAppliedTorque(result);const raw=JSON.parse(text);assert.equal(raw.source.trainingRuns[0].inertia,null);assert.ok(!Object.hasOwn(raw.source.trainingRuns[0].samples[0],'command'));
 raw.candidate={inertia:99};assert.deepEqual(reopenAppliedTorque(JSON.stringify(raw)).candidate,result.candidate);
});
test('arbitrary commands, conflicting units, copied challenges and invented inertia refuse',()=>{
 for(const change of [s=>s.trainingRuns[0].samples[0].command=1,s=>s.units.appliedTorque='A',s=>s.trainingRuns[0].inertia=3,s=>s.calibrationBasis='',s=>s.challengeRuns=[{...s.trainingRuns[0],id:'copy'}]]){
  const source=appliedTorqueExample();change(source);assert.throws(()=>identifyAppliedTorque(source));
 }
});
test('negative physical inertia stays rejected',()=>{
 const source=appliedTorqueExample();for(const run of source.trainingRuns)for(const row of run.samples)row.appliedTorque=-row.appliedTorque;
 const r=identifyAppliedTorque(source);assert.equal(r.status,'inadmissible_coefficients');assert.equal(r.candidate,null);assert.equal(r.challenges.length,0);
});
test('irregular clocks identify the same physical coefficients',()=>{
 const source=appliedTorqueExample();source.trainingRuns[0].samples=source.trainingRuns[0].samples.map((row,i)=>{
  const t=row.time+(i>0?.0001*Math.sin(i):0),q=Math.sin(t)+.2*Math.cos(2*t),v=Math.cos(t)-.4*Math.sin(2*t),a=-Math.sin(t)-.8*Math.cos(2*t);
  return {time:t,position:q,appliedTorque:3*a+.6*v+2*q};
 });const r=identifyAppliedTorque(source);assert.equal(r.status,'identified_declared_model');assert.ok(Math.abs(r.candidate.inertia-3)<.003);
});
test('forecast work refusal preserves identified training candidate and original settings',()=>{
 const r=identifyAppliedTorque(appliedTorqueExample(),{maxStep:.00001});assert.ok(r.candidate);assert.equal(r.challenges[0].status,'failed');
 const reopened=reopenAppliedTorque(exportAppliedTorque(r));assert.equal(reopened.options.maxStep,.00001);assert.deepEqual(reopened.candidate,r.candidate);assert.equal(reopened.challenges[0].status,'failed');
});
test('UTF8 portable input byte budget is enforced before parsing',()=>{
 assert.throws(()=>reopenAppliedTorque('é'.repeat(1_500_001)),/below3MB/);
});
