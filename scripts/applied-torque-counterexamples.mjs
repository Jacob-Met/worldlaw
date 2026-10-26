import assert from 'node:assert/strict';
import {identifyAppliedTorque,exportAppliedTorque,reopenAppliedTorque} from '../src/trajectory/applied-torque.mjs';
const truth={inertia:.7,damping:.19,stiffness:3.4};
function run(id,challenge){
 const a=challenge?.13:.2,b=challenge?.11:.07,w=challenge?1.7:1.3,z=challenge?3.8:3.1;
 return {id,label:id,kind:'synthetic',inertia:null,initialRate:b*z,source:{label:'Independent analytic authored receiving; not physical acquisition',recordingId:id},samples:Array.from({length:challenge?1501:2401},(_,i)=>{
  const time=i*.0035,q=a*Math.cos(w*time)+b*Math.sin(z*time),v=-a*w*Math.sin(w*time)+b*z*Math.cos(z*time),acc=-a*w*w*Math.cos(w*time)-b*z*z*Math.sin(z*time);
  return {time,position:q,appliedTorque:truth.inertia*acc+truth.damping*v+truth.stiffness*q};
 })};
}
const source={schema:'worldlaw.applied-torque-study/v1',label:'Independent changed-frequency receiving',interpretation:'applied_joint_torque_equals_inertia_acceleration_plus_linear_loss_and_stiffness',calibrationBasis:'Independently authored analytic SI torque law; software-only control',units:{time:'s',position:'rad',appliedTorque:'N·m',initialRate:'rad/s'},trainingRuns:[run('new-fit',false)],challengeRuns:[run('new-challenge',true)]};
const received=identifyAppliedTorque(source,{windowDuration:.7,windowStride:.35,maxStep:.0035});
assert.equal(received.status,'identified_declared_model');
for(const [key,value]of Object.entries(truth))assert.ok(Math.abs(received.candidate[key]-value)<.002,key);
assert.ok(received.challenges[0].rollout.metrics.positionRMSE<.004);
const changed=structuredClone(source);for(const r of changed.challengeRuns)for(const row of r.samples)row.position+=.1*Math.sin(5*row.time);
const adverse=identifyAppliedTorque(changed,received.options);assert.deepEqual(adverse.candidate,received.candidate);assert.ok(adverse.challenges[0].rollout.metrics.positionRMSE>received.challenges[0].rollout.metrics.positionRMSE*10);
const wrongScale=structuredClone(source);for(const r of [...wrongScale.trainingRuns,...wrongScale.challengeRuns])for(const row of r.samples)row.appliedTorque*=1.7;
const scaled=identifyAppliedTorque(wrongScale,received.options);assert.ok(Math.abs(scaled.candidate.inertia/received.candidate.inertia-1.7)<1e-10);assert.ok(Math.abs(scaled.challenges[0].rollout.metrics.positionRMSE-received.challenges[0].rollout.metrics.positionRMSE)<1e-10);
assert.deepEqual(reopenAppliedTorque(exportAppliedTorque(received)),received);
console.log(JSON.stringify({truth,candidate:received.candidate,heldOutRMSE:received.challenges[0].rollout.metrics.positionRMSE,changedHeldOutRMSE:adverse.challenges[0].rollout.metrics.positionRMSE,falseCalibrationInertia:scaled.candidate.inertia,falseCalibrationHeldOutRMSE:scaled.challenges[0].rollout.metrics.positionRMSE,qualification:'Authored independently of repository fixture. Wrong absolute torque calibration changes inferred inertia without degrading motion predictions; this instrument cannot authenticate calibration.'},null,2));
