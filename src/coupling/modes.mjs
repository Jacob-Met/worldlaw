/** Conditional useful coordinates for symmetric affine torque fields.
 * Reuses fitted laws and existing trajectories; never learns inertia from static data.
 */
import {predictCoupling,requireThat,pair} from './science.mjs';
import {readDynamicsInputs} from './dynamics.mjs';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const mv=(a,b)=>a.map(r=>dot(r,b));
const transpose=a=>[[a[0][0],a[1][0]],[a[0][1],a[1][1]]];
const mm=(a,b)=>a.map(r=>transpose(b).map(c=>dot(r,c)));
const finiteAll=a=>a.flat(Infinity).every(Number.isFinite);
export function deriveCoupledModes(model,rawInputs){
 const inputs=readDynamicsInputs(rawInputs);predictCoupling(model,[0,0]);
 const base={modelId:model.id,label:model.label??model.id};
 if(model.matrix[0][1]!==model.matrix[1][0])return {...base,status:'asymmetric',reason:'The fitted matrix is not symmetric. This real orthogonal stiffness-mode construction does not apply; the original candidate is retained.'};
 const scale=inputs.inertia.map(Math.sqrt),matrix=model.matrix.map((r,i)=>r.map((v,j)=>v/scale[i]/scale[j]));
 // atan2 handles either diagonal order and exactly repeated isotropic matrices.
 const angle=.5*Math.atan2(2*matrix[0][1],matrix[0][0]-matrix[1][1]);
 const c=Math.cos(angle),s=Math.sin(angle),basis=[[c,-s],[s,c]],inverse=transpose(basis);
 const stiffness=mm(mm(inverse,matrix),basis),bias=mv(inverse,model.bias.map((v,i)=>v/scale[i]));
 const damping=mm(mm(inverse,[[inputs.damping[0]/inputs.inertia[0],0],[0,inputs.damping[1]/inputs.inertia[1]]]),basis);
 const magnitude=Math.max(...matrix.flat().map(Math.abs)),resolution=64*Number.EPSILON*magnitude+Number.MIN_VALUE;
 const values=[stiffness[0][0],stiffness[1][1]],separation=Math.hypot(matrix[0][0]-matrix[1][1],2*matrix[0][1]);
 requireThat(finiteAll([scale,matrix,basis,stiffness,bias,damping,values,resolution,separation]),'The mode transformation became nonfinite.','numerical_failure');
 return {...base,status:'available',scale,basis,stiffness,bias,damping,eigenvalues:values,
  directions:transpose(basis).map(v=>v.map((x,i)=>x/scale[i])),
  frequencies:values.map(v=>v < -resolution?Math.sqrt(-v):null),
  stability:values.map(v=>v < -resolution?'restoring':v > resolution?'anti-restoring':'near_zero'),
  axisAmbiguity:separation<=resolution,
  numerical:{resolution,offDiagonalResidual:Math.max(Math.abs(stiffness[0][1]),Math.abs(stiffness[1][0])),interpretation:'Floating-point diagnostics, not verified error bounds or coefficient uncertainty.'},
  qualification:'Coordinates follow this fitted symmetric affine law and declared diagonal inertia. They do not identify physical bodies, inertia or topology. Generic damping may remain coupled. Frequencies describe the undamped conditional equation only.'};
}
export function transformModeRow(mode,row){
 requireThat(mode?.status==='available','Choose an available mode transformation.');
 const q=pair(row.position,'trajectory position'),v=pair(row.rate,'trajectory rate'),torque=pair(row.torque,'trajectory torque',1e30),inverse=transpose(mode.basis);
 const position=mv(inverse,q.map((x,i)=>x*mode.scale[i])),rate=mv(inverse,v.map((x,i)=>x*mode.scale[i])),force=mv(inverse,torque.map((x,i)=>x/mode.scale[i]));
 requireThat(finiteAll([position,rate,force]),'Transformed trajectory became nonfinite.','numerical_failure');
 return {time:row.time,position,rate,force};
}
export function inspectModeTrajectory(model,rawInputs,trajectory){
 const mode=deriveCoupledModes(model,rawInputs);if(mode.status!=='available')return mode;
 if(!trajectory?.refined)return {...mode,trajectoryStatus:'unavailable',rows:[]};
 requireThat(trajectory.modelId===model.id,'Trajectory and response model identities differ.');
 requireThat(Array.isArray(trajectory.refined.rows)&&trajectory.refined.rows.length<=1001,'The retained trajectory exceeds the output budget.');
 const rows=trajectory.refined.rows.map(row=>transformModeRow(mode,row));
 let responseResidual=0,powerResidual=0,roundtripResidual=0;
 rows.forEach((row,i)=>{
  const original=trajectory.refined.rows[i],forecast=mv(mode.stiffness,row.position).map((x,j)=>x+mode.bias[j]);
  responseResidual=Math.max(responseResidual,...forecast.map((x,j)=>Math.abs(x-row.force[j])));
  powerResidual=Math.max(powerResidual,Math.abs(dot(original.torque,original.rate)-dot(row.force,row.rate)));
  roundtripResidual=Math.max(roundtripResidual,...mv(mode.basis,row.position).map((x,j)=>Math.abs(x/mode.scale[j]-original.position[j])));
 });
 return {...mode,trajectoryStatus:trajectory.status,rows,checks:{responseResidual,powerResidual,roundtripResidual},domainStatus:trajectory.refined.domainStatus};
}
