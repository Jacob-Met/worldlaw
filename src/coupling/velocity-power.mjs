/** Sampled power accounting for the exact retained coupled trajectory.
 * No new integration, fitting, state correction, or physical calibration.
 */
import {readDynamicsInputs,INPUT_SCHEMA,MATRIX_INPUT_SCHEMA,LOSS_INPUT_SCHEMA,SKEW_INPUT_SCHEMA} from './dynamics.mjs';
import {predictCoupling,requireThat,pair,finite} from './science.mjs';
export function inspectVelocityPower(model,rawInputs,trajectory){
 const inputs=readDynamicsInputs(rawInputs);predictCoupling(model,[0,0]);
 const base={modelId:model.id,label:model.label??model.id};
 requireThat(trajectory?.modelId===model.id,'Trajectory and response model identities differ.');
 if(!trajectory.refined)return {...base,status:'unavailable',reason:'No complete retained refined trajectory.',rows:[]};
 const source=trajectory.refined.rows;
 requireThat(Array.isArray(source)&&source.length>=2&&source.length<=1001,'Retain two to 1001 trajectory samples.');
 const matrix=inputs.schema!==INPUT_SCHEMA,loss=inputs.schema===LOSS_INPUT_SCHEMA||inputs.schema===SKEW_INPUT_SCHEMA;
 const cross=matrix?inputs.inertiaCross:0,dc=loss?inputs.dampingCross:0,g=inputs.schema===SKEW_INPUT_SCHEMA?inputs.velocitySkew:0;
 const conservative=model.matrix[0][1]===model.matrix[1][0]&&!model.quadratic;
 let previous=null,initialEnergy=null,initialKinetic=null,cumulativeLoss=0,cumulativeAppliedWork=0,cumulativeSkewWork=0;
 const rows=source.map((row,index)=>{
  const time=finite(row.time,'trajectory time',100),q=pair(row.position,'trajectory position',1e6),v=pair(row.rate,'trajectory rate',1e6);
  requireThat(time>=0&&time<=inputs.duration&&(index===0?time===0:time>previous.time),'Retain the original increasing trajectory clock.');
  const torque=predictCoupling(model,q);
  const kineticEnergy=.5*(inputs.inertia[0]*v[0]*v[0]+2*cross*v[0]*v[1]+inputs.inertia[1]*v[1]*v[1]);
  const lossForce=[inputs.damping[0]*v[0]+dc*v[1],dc*v[0]+inputs.damping[1]*v[1]],skewForce=[g*v[1],-g*v[0]];
  const lossPower=v[0]*lossForce[0]+v[1]*lossForce[1],skewPower=v[0]*skewForce[0]+v[1]*skewForce[1],appliedPower=v[0]*torque[0]+v[1]*torque[1];
  const potentialEnergy=conservative?-.5*(q[0]*(model.matrix[0][0]*q[0]+model.matrix[0][1]*q[1])+q[1]*(model.matrix[1][0]*q[0]+model.matrix[1][1]*q[1]))-model.bias[0]*q[0]-model.bias[1]*q[1]:null;
  const totalEnergy=conservative?kineticEnergy+potentialEnergy:null;
  if(previous){const dt=time-previous.time;cumulativeLoss+=dt*(previous.lossPower+lossPower)/2;cumulativeAppliedWork+=dt*(previous.appliedPower+appliedPower)/2;cumulativeSkewWork+=dt*(previous.skewPower+skewPower)/2;}
  else{initialEnergy=totalEnergy;initialKinetic=kineticEnergy;}
  const energyBalanceResidual=conservative?totalEnergy-initialEnergy+cumulativeLoss:null;
  const kineticWorkResidual=kineticEnergy-initialKinetic-cumulativeAppliedWork+cumulativeLoss+cumulativeSkewWork;
  const result={time,kineticEnergy,lossPower,skewPower,appliedPower,potentialEnergy,totalEnergy,cumulativeLoss,cumulativeAppliedWork,cumulativeSkewWork,energyBalanceResidual,kineticWorkResidual};
  requireThat(Object.values(result).every(x=>x===null||Number.isFinite(x)),'Sampled power accounting became nonfinite.','numerical_failure');
  previous=result;return result;
 });
 return {...base,status:'available',conservative,trajectoryStatus:trajectory.status,domainStatus:trajectory.refined.domainStatus,rows,
  maximumAbsSkewPower:Math.max(...rows.map(r=>Math.abs(r.skewPower))),
  maximumAbsEnergyBalanceResidual:conservative?Math.max(...rows.map(r=>Math.abs(r.energyBalanceResidual))):null,
  maximumAbsKineticWorkResidual:Math.max(...rows.map(r=>Math.abs(r.kineticWorkResidual))),
  units:{energy:'J',power:'W',time:'s'},method:'Trapezoidal work sums over the retained refined output samples; no extra solver steps.',
  qualification:'M, D and G remain declared constant assumptions. vᵀGv = 0 algebraically; D alone contributes dissipative loss. Displayed powers and work balances are floating-point diagnostics, not verified error bounds or physical validation. Potential and total energy are unavailable for a nonsymmetric or unsupported non-affine response law.'};
}

