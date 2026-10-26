/** Conditional identification from explicitly calibrated applied joint torque. */
import {validateBundle,TrajectoryDataError,RUN_UNITS} from './data.mjs';
import {weakWindows} from './weak-operator.mjs';
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {rolloutWithResolution} from './resolution.mjs';
export const APPLIED_TORQUE_SCHEMA='worldlaw.applied-torque-study/v1';
const units={time:'s',position:'rad',appliedTorque:'N·m',initialRate:'rad/s'};
const fail=m=>{throw new TrajectoryDataError(m,'invalid_applied_torque');};
const insist=(v,m)=>{if(!v)fail(m);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function normalizeAppliedTorque(raw){
 insist(object(raw)&&raw.schema===APPLIED_TORQUE_SCHEMA,'Expected an applied-torque study.');
 insist(raw.interpretation==='applied_joint_torque_equals_inertia_acceleration_plus_linear_loss_and_stiffness','Declare the applied joint torque balance explicitly.');
 insist(typeof raw.calibrationBasis==='string'&&raw.calibrationBasis.trim()&&raw.calibrationBasis.length<=2000,'Supply the applied-torque calibration basis; an arbitrary actuator command is not applied torque.');
 insist(object(raw.units)&&Object.keys(raw.units).length===4&&Object.entries(units).every(([k,v])=>raw.units[k]===v),'Declare s, rad, N·m applied torque and rad/s.');
 const surrogate={schema:'worldlaw.trajectory-bundle/v1',label:raw.label,units:RUN_UNITS};
 for(const role of ['trainingRuns','challengeRuns']){
  insist(Array.isArray(raw[role]),'Provide original training and separate challenge runs.');
  surrogate[role]=raw[role].map(run=>{
   insist(object(run)&&run.inertia===null&&!Object.hasOwn(run,'command'),'Physical inertia must be unknown; arbitrary commands are not admitted.');
   insist(run.units===undefined||(object(run.units)&&Object.keys(run.units).length===4&&Object.entries(units).every(([k,v])=>run.units[k]===v)),'Run units must agree with applied-torque study units.');
   insist(Array.isArray(run.samples),'Supply original samples.');
   return {...run,units:RUN_UNITS,inertia:1,samples:run.samples.map(row=>{
    insist(object(row)&&!Object.hasOwn(row,'command')&&Object.keys(row).every(k=>['time','position','appliedTorque'].includes(k)),'Each sample must contain only time, position and appliedTorque.');
    return {time:row.time,position:row.position,command:row.appliedTorque};
   })};
  });
 }
 // Reuse maintained source, sample-budget and cross-role copying checks. The
 // unit inertia is admission-only and is never fitted, exported or forecast.
 const admitted=validateBundle(surrogate);
 const result={schema:APPLIED_TORQUE_SCHEMA,label:admitted.label,interpretation:raw.interpretation,calibrationBasis:raw.calibrationBasis.trim(),units:{...units}};
 for(const role of ['trainingRuns','challengeRuns'])result[role]=admitted[role].map(run=>({id:run.id,label:run.label,kind:run.kind,source:run.source,inertia:null,initialRate:run.initialRate,samples:run.samples.map(row=>({time:row.time,position:row.position,appliedTorque:row.command}))}));
 return result;
}
export function normalizeAppliedTorqueOptions(requested={}){
 insist(object(requested),'Identification settings must be an object.');
 const options={windowDuration:requested.windowDuration??.8,windowStride:requested.windowStride??.4,maxStep:requested.maxStep??.005};
 insist(Number.isFinite(options.windowDuration)&&options.windowDuration>=.02&&options.windowDuration<=60,'Window duration must be .02–60 seconds.');
 insist(Number.isFinite(options.windowStride)&&options.windowStride>=.01&&options.windowStride<=options.windowDuration,'Window stride must be .01 seconds through duration.');
 insist(Number.isFinite(options.maxStep)&&options.maxStep>=1e-5&&options.maxStep<=.1,'Forward step must be .00001–.1 seconds.');
 return options;
}
export function identifyAppliedTorque(raw,requested={}){
 const source=normalizeAppliedTorque(raw),options=normalizeAppliedTorqueOptions(requested);
 const blocks=source.trainingRuns.map(run=>({runId:run.id,rows:weakWindows({samples:run.samples.map(row=>({...row,command:row.appliedTorque}))},{...options,terms:['command','rate','spring']},null,insist)}));
 const rows=blocks.flatMap(b=>b.rows);insist(rows.length>=8&&rows.length<=2048,'Require8–2048 complete weak windows.');
 const columns=[rows.map(r=>r.target),rows.map(r=>r.columns[1]),rows.map(r=>r.columns[2])],target=rows.map(r=>r.columns[0]);
 insist([target,...columns].every(a=>a.every(Number.isFinite)&&Number.isFinite(Math.hypot(...a))),'Nonfinite weak equations.');
 const rank=linearColumnRank(columns),fit=fitLinearColumns(columns,target);
 const result={schema:'worldlaw.applied-torque-identification/v1',source,options,rank,coefficientCount:3,windowCount:rows.length,status:'unidentifiable',candidate:null,challenges:[],windows:blocks.map(b=>({runId:b.runId,windows:b.rows.map(({target,columns,...metadata})=>metadata)})),limitations:['Conditional constant scalar inertia, linear viscous loss and linear restoring law only.','Calibration and alignment are source declarations; arbitrary actuator commands do not identify physical inertia.','Noisy position features and applied torque, overlap and quadrature can bias coefficients. No calibrated confidence is supplied.','Initial rates enter independent forward prediction only. Separate challenge outcomes never fit coefficients.']};
 if(!fit)return result;
 const [inertia,damping,stiffness]=fit.coefficients;
 if(!fit.coefficients.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e12)||inertia<=1e-12||damping<0){result.status='inadmissible_coefficients';result.rejectedCoefficients={inertia,damping,stiffness};return result;}
 const residuals=target.map((v,i)=>v-columns.reduce((sum,col,j)=>sum+col[i]*fit.coefficients[j],0));
 result.status='identified_declared_model';result.candidate={inertia,damping,stiffness,units:{inertia:'kg·m²',damping:'N·m·s/rad',stiffness:'N·m/rad'},conditionEstimate:fit.conditionEstimate,weakRmse:Math.hypot(...residuals)/Math.sqrt(rows.length),residualUnits:'N·m·s²',residualMeaning:'torque_integral_divided_by_position_operator_gain_not_forward_error'};
 const model={schema:'worldlaw.torque-model/v1',id:'identified-applied-torque',terms:[{id:'command',coefficient:1},{id:'rate',coefficient:-damping},{id:'spring',coefficient:-stiffness}]};
 for(const run of source.challengeRuns){
  try{const forecast=rolloutWithResolution(model,{...run,inertia,samples:run.samples.map(row=>({time:row.time,position:row.position,command:row.appliedTorque}))},{maxStep:options.maxStep,maxSteps:200000});result.challenges.push({runId:run.id,status:'ok',...forecast});}
  catch(error){result.challenges.push({runId:run.id,status:'failed',error:{message:error.message,code:error.code??'prediction_failed'}});}
 }
 return result;
}
export function exportAppliedTorque(result){const text=JSON.stringify({schema:'worldlaw.applied-torque-notebook/v1',source:normalizeAppliedTorque(result.source),options:result.options},null,2);insist(new TextEncoder().encode(text).length<=3_000_000,'Use a JSON input file below3MB.');return text;}
export function reopenAppliedTorque(text){insist(typeof text==='string'&&new TextEncoder().encode(text).length<=3_000_000,'Use a JSON input file below3MB.');const raw=JSON.parse(text);return raw.schema===APPLIED_TORQUE_SCHEMA?identifyAppliedTorque(raw):raw.schema==='worldlaw.applied-torque-notebook/v1'?identifyAppliedTorque(raw.source,raw.options):fail('Unsupported applied-torque input.');}
