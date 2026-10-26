/** Authored input course; the proposal mechanism never reads the generating law. */
export function appliedRestoringExample({family='gravity',amplitude=1,noise=0,seed=293}={}){
 let state=seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296-.5);
 const run=(id,challenge)=>{
  const a=amplitude*(challenge?.85:1.1),b=amplitude*(challenge?.31:.23),w=challenge?1.7:1.3,z=challenge?3.8:3.1;
  return {id,label:id,kind:'synthetic',inertia:null,initialRate:b*z,source:{label:'Authored calibrated-torque course; not a physical measurement',recordingId:id},samples:Array.from({length:challenge?1801:2701},(_,i)=>{
   const time=i*.003,q=a*Math.cos(w*time)+b*Math.sin(z*time),v=-a*w*Math.sin(w*time)+b*z*Math.cos(z*time),acc=-a*w*w*Math.cos(w*time)-b*z*z*Math.sin(z*time);
   const restoring=family==='gravity'?Math.sin(q):family==='cubic'?q+.4*q**3:family==='quintic'?q+.4*q**5:q;
   return {time,position:q+(i&&!challenge?noise*random():0),appliedTorque:.7*acc+.19*v+3.4*restoring};
  })};
 };
 return {schema:'worldlaw.applied-torque-study/v1',label:'Authored '+family+' restoring control',
  interpretation:'applied_joint_torque_equals_inertia_acceleration_plus_linear_loss_and_stiffness',
  calibrationBasis:'Authored analytic SI torque values with inertia .7 and damping .19; the original linear restoring equation is a baseline hypothesis to challenge. This course does not establish physical calibration.',
  units:{time:'s',position:'rad',appliedTorque:'N·m',initialRate:'rad/s'},trainingRuns:[run('authored-restoring-training-'+family,false)],challengeRuns:[run('authored-restoring-separate-'+family,true)]};
}

/** Authored coordinate datum only: original torque and initial rate are unchanged. */
export function appliedRestoringReferenceExample({datumShift=.25,...options}={}){
 if(!Number.isFinite(datumShift)||Math.abs(datumShift)>2*Math.PI)throw Error('Use a finite authored angle datum within one turn.');
 const source=appliedRestoringExample(options);
 for(const run of [...source.trainingRuns,...source.challengeRuns])for(const row of run.samples)row.position+=datumShift;
 source.label+=` · recorded datum ${datumShift} rad`;
 source.calibrationBasis+=` Recorded angle coordinates have an authored ${datumShift} rad offset; applied torque and initial rates are unchanged. This declaration is not physical reference calibration.`;
 return source;
}
