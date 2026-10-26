/** Conditional useful coordinates for symmetric affine torque fields.
 * Reuses fitted laws and existing trajectories; never learns inertia from static data.
 */
import {predictCoupling,requireThat,pair} from './science.mjs';
import {readDynamicsInputs,MATRIX_INPUT_SCHEMA,LOSS_INPUT_SCHEMA,SKEW_INPUT_SCHEMA} from './dynamics.mjs';
import {readSymmetricInertia} from './inertia.mjs';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const mv=(a,b)=>a.map(r=>dot(r,b));
const transpose=a=>[[a[0][0],a[1][0]],[a[0][1],a[1][1]]];
const mm=(a,b)=>a.map(r=>transpose(b).map(c=>dot(r,c)));
const finiteAll=a=>a.flat(Infinity).every(Number.isFinite);
export function deriveCoupledModes(model,rawInputs){
 const inputs=readDynamicsInputs(rawInputs);predictCoupling(model,[0,0]);
 const base={modelId:model.id,label:model.label??model.id};
 if(model.matrix[0][1]!==model.matrix[1][0])return {...base,status:'asymmetric',reason:'The fitted matrix is not symmetric. This real orthogonal stiffness-mode construction does not apply; the original candidate is retained.'};
 const scale=inputs.inertia.map(Math.sqrt),skew=inputs.schema===SKEW_INPUT_SCHEMA,loss=skew||inputs.schema===LOSS_INPUT_SCHEMA,mass=loss||inputs.schema===MATRIX_INPUT_SCHEMA?readSymmetricInertia(inputs.inertia,inputs.inertiaCross):null;
 const matrix=mass?mm(mm(mass.forceToMass,model.matrix),mass.fromMass):model.matrix.map((r,i)=>r.map((v,j)=>v/scale[i]/scale[j]));
 // atan2 handles either diagonal order and exactly repeated isotropic matrices.
 const angle=.5*Math.atan2(2*matrix[0][1],matrix[0][0]-matrix[1][1]);
 const c=Math.cos(angle),s=Math.sin(angle),basis=[[c,-s],[s,c]],inverse=transpose(basis);
 const stiffness=mm(mm(inverse,matrix),basis),bias=mv(inverse,mass?mv(mass.forceToMass,model.bias):model.bias.map((v,i)=>v/scale[i]));
 const lossMatrix=[[inputs.damping[0],loss?inputs.dampingCross:0],[loss?inputs.dampingCross:0,inputs.damping[1]]];
 const massDamping=mass?mm(mm(mass.forceToMass,lossMatrix),mass.fromMass):[[inputs.damping[0]/inputs.inertia[0],0],[0,inputs.damping[1]/inputs.inertia[1]]];
 const damping=mm(mm(inverse,massDamping),basis);
 const velocitySkew=skew?mm(mm(inverse,mm(mm(mass.forceToMass,[[0,inputs.velocitySkew],[-inputs.velocitySkew,0]]),mass.fromMass)),basis):null;
 if(skew)requireThat(finiteAll(velocitySkew),'The transformed skew coupling became nonfinite.','numerical_failure');
 const magnitude=Math.max(...matrix.flat().map(Math.abs)),resolution=64*Number.EPSILON*magnitude+Number.MIN_VALUE;
 const values=[stiffness[0][0],stiffness[1][1]],separation=Math.hypot(matrix[0][0]-matrix[1][1],2*matrix[0][1]);
 requireThat(finiteAll([scale,matrix,basis,stiffness,bias,damping,values,resolution,separation]),'The mode transformation became nonfinite.','numerical_failure');
 return {...base,status:'available',scale,basis,stiffness,bias,damping,eigenvalues:values,
  ...(skew?{velocitySkew,frequencyQualification:'Stiffness-only reference frequencies with both D and G removed; these are not the full velocity-coupled modal frequencies.'}:{}),
  ...(mass?{inertiaKind:'symmetric',toMass:mass.toMass,fromMass:mass.fromMass,forceToMass:mass.forceToMass}:{}),
  directions:transpose(basis).map(v=>mass?mv(mass.fromMass,v):v.map((x,i)=>x/scale[i])),
  frequencies:values.map(v=>v < -resolution?Math.sqrt(-v):null),
  stability:values.map(v=>v < -resolution?'restoring':v > resolution?'anti-restoring':'near_zero'),
  axisAmbiguity:separation<=resolution,
  numerical:{resolution,offDiagonalResidual:Math.max(Math.abs(stiffness[0][1]),Math.abs(stiffness[1][0])),interpretation:'Floating-point diagnostics, not verified error bounds or coefficient uncertainty.'},
  qualification:(skew?'The transformed skew velocity matrix remains in the equation and can couple these stiffness coordinates. Stiffness-only frequencies omit both D and G. ':'')+'Coordinates follow this fitted symmetric affine law and '+(mass?'declared constant symmetric inertia.':'declared diagonal inertia.')+' They do not identify physical bodies, inertia or topology. Generic damping may remain coupled. '+(skew?'Frequency references omit both loss and skew velocity coupling.':'Frequencies describe the undamped conditional equation only.')};
}
export function transformModeRow(mode,row){
 requireThat(mode?.status==='available','Choose an available mode transformation.');
 const q=pair(row.position,'trajectory position'),v=pair(row.rate,'trajectory rate'),torque=pair(row.torque,'trajectory torque',1e30),inverse=transpose(mode.basis);
 const matrix=mode.inertiaKind==='symmetric';
 const position=mv(inverse,matrix?mv(mode.toMass,q):q.map((x,i)=>x*mode.scale[i])),rate=mv(inverse,matrix?mv(mode.toMass,v):v.map((x,i)=>x*mode.scale[i])),force=mv(inverse,matrix?mv(mode.forceToMass,torque):torque.map((x,i)=>x/mode.scale[i]));
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
  const massPosition=mv(mode.basis,row.position),back=mode.inertiaKind==='symmetric'?mv(mode.fromMass,massPosition):massPosition.map((x,j)=>x/mode.scale[j]);
  roundtripResidual=Math.max(roundtripResidual,...back.map((x,j)=>Math.abs(x-original.position[j])));
 });
 return {...mode,trajectoryStatus:trajectory.status,rows,checks:{responseResidual,powerResidual,roundtripResidual},domainStatus:trajectory.refined.domainStatus};
}

