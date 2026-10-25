// Independent analytic damped normal modes; authored verification, not a recording.
export function analyticInertiaMotion(time,initialPosition=[.7,-.1],initialRate=[.2,.3]){
 const modes=[1,-1].map(sign=>{
  const mass=1.4+sign*.4,decay=.2/(2*mass),frequency=Math.sqrt(2/mass-decay*decay);
  const q0=(initialPosition[0]+sign*initialPosition[1])/2,v0=(initialRate[0]+sign*initialRate[1])/2;
  const sine=(v0+decay*q0)/frequency,exponential=Math.exp(-decay*time);
  return {q:exponential*(q0*Math.cos(frequency*time)+sine*Math.sin(frequency*time)),
   v:exponential*((-decay*q0+frequency*sine)*Math.cos(frequency*time)+(-decay*sine-frequency*q0)*Math.sin(frequency*time))};
 });
 return {time,position:[modes[0].q+modes[1].q,modes[0].q-modes[1].q],rate:[modes[0].v+modes[1].v,modes[0].v-modes[1].v]};
}
export function createInertiaExample(){
 const rows=Array.from({length:801},(_,i)=>{const r=analyticInertiaMotion(i/100);return {time:r.time,position:r.position,torque:r.position.map(q=>-2*q)};});
 return {schema:'worldlaw.coupled-inertia-observations/v1',units:{time:'s',position:'rad',torque:'N·m'},
  interpretation:'constant-symmetric-inertia-with-diagonal-viscous-loss',
  torqueDeclaration:'Authored spring torque excludes the separately modeled diagonal viscous loss. No physical calibration or independently acquired record is claimed.',
  source:{label:'Analytic two-mode verification course',description:'Independent closed-form damped modes, sampled every0.01seconds. M=[[1.4,0.4],[0.4,1.4]] and D=[0.2,0.2] are known control values, not supplied to the fit.'},
  courses:[{id:'authored-two-mode',rows}]};
}
