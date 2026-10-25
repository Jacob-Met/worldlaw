/** Authored omitted-force counterexample, not an acquired physical record.
 * The known physical equation is M q'' + D q' = actuatorTorque - K q.
 * Supplying actuatorTorque alone intentionally violates the receiver's RHS
 * assumption. Along these motions K q aliases a change of fitted inertia.
 */
export function createInertiaCounterexample() {
 const rows=Array.from({length:801},(_,i)=>{
  const time=6*i/800;
  const position=[Math.sin(time),Math.cos(2*time)];
  const rate=[Math.cos(time),-2*Math.sin(2*time)];
  const acceleration=[-Math.sin(time),-4*Math.cos(2*time)];
  const torque=[
   2*acceleration[0]+.3*acceleration[1]+.2*rate[0]+.5*position[0],
   .3*acceleration[0]+1.5*acceleration[1]+.4*rate[1]+.8*position[1]
  ];
  return{time,position,torque};
 });
 return{
  schema:'worldlaw.coupled-inertia-observations/v1',
  units:{time:'s',position:'rad',torque:'N·m'},
  interpretation:'constant-symmetric-inertia-with-diagonal-viscous-loss',
  torqueDeclaration:'Intentional missing-force demonstration: supplied actuator torque omits separate restoring torque -diag(0.5,0.8) q. It is NOT the complete right-hand side of the offered equation. Full rank and tiny weak residuals do not make the resulting coefficients physical inertia.',
  source:{
   label:'Authored missing-spring counterexample',
   description:'Known authored truth: M=[[2,0.3],[0.3,1.5]] kg·m², D=[0.2,0.4] N·m·s/rad, K=[0.5,0.8] N·m/rad; q=[sin(t),cos(2t)] rad. Actual dynamics: M q″+D q′=actuator torque−K q. The supplied actuator-only torque admits effective M=[[1.5,0.3],[0.3,1.3]], not the known true M. Analytic samples over 6 seconds; no measured machine, calibration or independently acquired record is claimed. Truth is explanatory text, not a fitted input.'
  },
  courses:[{id:'authored-omitted-restoring-torque',rows}]
 };
}
