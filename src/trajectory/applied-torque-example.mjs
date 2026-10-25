import {APPLIED_TORQUE_SCHEMA} from './applied-torque.mjs';
export function appliedTorqueExample({singleMode=false}={}){
 const run=(id,challenge)=>({id,label:id,kind:'synthetic',inertia:null,initialRate:challenge?.56:1,source:{label:'Authored analytic control; not a physical acquisition',recordingId:id},samples:Array.from({length:challenge?2001:4001},(_,i)=>{
  const t=i*.002,a=challenge?.7:1,b=singleMode?0:challenge?.3:.2,w=challenge?.8:1,z=challenge?1.7:2;
  const q=a*Math.sin(w*t)+b*Math.cos(z*t),v=a*w*Math.cos(w*t)-b*z*Math.sin(z*t),acc=-a*w*w*Math.sin(w*t)-b*z*z*Math.cos(z*t);
  return {time:t,position:q,appliedTorque:3*acc+.6*v+2*q};
 })});
 return {schema:APPLIED_TORQUE_SCHEMA,label:'Authored calibrated-torque oscillator',interpretation:'applied_joint_torque_equals_inertia_acceleration_plus_linear_loss_and_stiffness',calibrationBasis:'Analytic torque equation with I=3, damping=.6, stiffness=2; exact authored channel values, sampled then held by the solver.',units:{time:'s',position:'rad',appliedTorque:'N·m',initialRate:'rad/s'},trainingRuns:[run('authored-training',false)],challengeRuns:[run('authored-separate',true)]};
}
