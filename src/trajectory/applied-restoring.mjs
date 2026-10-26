/** Conditional restoring-family proposals from original calibrated-torque evidence. */
import {normalizeAppliedTorque,normalizeAppliedTorqueOptions} from './applied-torque.mjs';
import {weakWindows} from './weak-operator.mjs';
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {rolloutWithResolution} from './resolution.mjs';
import {reservePredictionWork} from '../predictive-selection/select.mjs';

export const APPLIED_RESTORING_SCHEMA='worldlaw.applied-restoring-notebook/v1';
export const RESTORING_FAMILIES=Object.freeze([
 Object.freeze({id:'linear',label:'Linear restoring',terms:Object.freeze(['spring'])}),
 Object.freeze({id:'gravity',label:'Sinusoidal restoring',terms:Object.freeze(['gravity'])}),
 Object.freeze({id:'cubic',label:'Linear + cubic restoring',terms:Object.freeze(['spring','cubic'])}),
]);
const TERMS=['command','rate','spring','gravity','cubic'];
const MAX_WEAK_WORK=25000000,MAX_STEPS=2000000,MAX_ROWS=262144;
const clone=value=>JSON.parse(JSON.stringify(value));
const insist=(ok,message)=>{if(!ok)throw Error(message);};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function settings(requested){
 insist(object(requested),'Restoring proposal settings must be an object.');
 const options={...normalizeAppliedTorqueOptions(requested),trainingFraction:requested.trainingFraction??.7,
  positionTolerance:requested.positionTolerance??.01,ambiguityDelta:requested.ambiguityDelta??6,
  maxNumericalDifference:requested.maxNumericalDifference??.001,maxTotalSteps:requested.maxTotalSteps??MAX_STEPS};
 insist(Number.isFinite(options.trainingFraction)&&options.trainingFraction>=.5&&options.trainingFraction<=.85,'Fit the first 50–85% of each original training recording.');
 insist(Number.isFinite(options.positionTolerance)&&options.positionTolerance>=1e-7&&options.positionTolerance<=1,'Declare a conditional position tolerance from 0.0000001 to 1 rad.');
 insist(Number.isFinite(options.ambiguityDelta)&&options.ambiguityDelta>=0&&options.ambiguityDelta<=100,'Use a finite heuristic ambiguity gap from 0 to 100.');
 insist(Number.isFinite(options.maxNumericalDifference)&&options.maxNumericalDifference>=0&&options.maxNumericalDifference<=1,'Declare a two-step numerical difference from 0 to 1 rad.');
 insist(Number.isSafeInteger(options.maxTotalSteps)&&options.maxTotalSteps>=1&&options.maxTotalSteps<=MAX_STEPS,'Reserve 1–2000000 complete forward steps.');
 return options;
}
const torqueRun=(run,inertia)=>({...run,inertia,samples:run.samples.map(row=>({time:row.time,position:row.position,command:row.appliedTorque}))});
function weakRows(runs,options){
 const blocks=runs.map(run=>({runId:run.id,rows:weakWindows(torqueRun(run,1),{...options,terms:TERMS},null,insist)}));
 const rows=blocks.flatMap(block=>block.rows);
 insist(rows.length>=8&&rows.length<=2048,'Each fit needs 8–2048 complete weak windows across its original training recordings.');
 return {rows,blocks:blocks.map(block=>({runId:block.runId,windows:block.rows.map(({target,columns,...metadata})=>metadata)}))};
}
function fitFamily(rows,family){
 const columns=[rows.map(row=>row.target),rows.map(row=>row.columns[1]),...family.terms.map(id=>rows.map(row=>row.columns[TERMS.indexOf(id)]))];
 const target=rows.map(row=>row.columns[0]),rank=linearColumnRank(columns),fit=fitLinearColumns(columns,target);
 const base={rank,coefficientCount:columns.length,windowCount:rows.length};
 if(!fit)return {...base,status:'unidentifiable',candidate:null};
 const [inertia,damping,...restoring]=fit.coefficients;
 if(!fit.coefficients.every(value=>Number.isFinite(value)&&Math.abs(value)<=1e12)||inertia<=1e-12||damping<0)
  return {...base,status:'inadmissible_coefficients',candidate:null,rejectedCoefficients:{inertia,damping,restoring}};
 const residuals=target.map((value,i)=>value-columns.reduce((sum,column,j)=>sum+column[i]*fit.coefficients[j],0));
 const candidate={inertia,damping,restoring:family.terms.map((id,i)=>({id,coefficient:restoring[i],unit:id==='cubic'?'N·m/rad³':id==='gravity'?'N·m':'N·m/rad'})),
  inertiaUnit:'kg·m²',dampingUnit:'N·m·s/rad',conditionEstimate:fit.conditionEstimate,
  weakRMSE:Math.hypot(...residuals)/Math.sqrt(rows.length),weakResidualUnits:'N·m·s²'};
 candidate.model={schema:'worldlaw.torque-model/v1',id:'applied-restoring-'+family.id,
  terms:[{id:'command',coefficient:1},{id:'rate',coefficient:-damping},...candidate.restoring.map(({id,coefficient})=>({id,coefficient:-coefficient}))]};
 return {...base,status:'fitted',candidate};
}
function forecasts(candidate,runs,options){
 return runs.map(run=>{
  try{
   const budget=reservePredictionWork([run],options.maxStep).steps;
   const receipt=rolloutWithResolution(candidate.model,torqueRun(run,candidate.inertia),{maxStep:options.maxStep,maxSteps:budget});
   const screened=receipt.resolution.status==='compared'&&receipt.resolution.positionRMSEDifference<=options.maxNumericalDifference;
   return {runId:run.id,status:screened?'screened':'numerically_unresolved',...receipt};
  }catch(error){return {runId:run.id,status:'failed',error:{message:error.message,code:error.code??'prediction_failed'}};}
 });
}

export function proposeAppliedRestoring(raw,requested={}){
 const source=normalizeAppliedTorque(raw),options=settings(requested);
 // The source's original linear interpretation remains the baseline. Calling
 // this explicit revision compares a fixed catalog; it never edits that source.
 const partitions=source.trainingRuns.map(run=>{
  const prefixCount=Math.floor(run.samples.length*options.trainingFraction);
  insist(prefixCount>=17&&run.samples.length-prefixCount>=2,'Each recording needs at least 17 fitting-prefix and two later validation samples.');
  return {runId:run.id,prefixCount,validationCount:run.samples.length-prefixCount,
   fitThrough:run.samples[prefixCount-1].time,validationFrom:run.samples[prefixCount].time,validationThrough:run.samples.at(-1).time};
 });
 const prefixes=source.trainingRuns.map((run,i)=>({...run,samples:run.samples.slice(0,partitions[i].prefixCount)}));
 // The entire training catalog is reserved before fitting. A later challenge
 // budget refusal must not revoke or change this training-only proposal.
 const trainingReservation=reservePredictionWork(source.trainingRuns,options.maxStep,RESTORING_FAMILIES.length);
 const challengeReservation=reservePredictionWork(source.challengeRuns,options.maxStep,RESTORING_FAMILIES.length);
 const reservation={training:trainingReservation,challenge:challengeReservation,stepLimit:options.maxTotalSteps,rowLimit:MAX_ROWS};
 insist(trainingReservation.steps<=options.maxTotalSteps,'The complete restoring comparison exceeds its declared forward-step reservation; no partial catalog was compared.');
 insist(trainingReservation.rows<=MAX_ROWS,'The complete restoring comparison exceeds its retained prediction-row reservation.');
 insist(source.trainingRuns.every(run=>reservePredictionWork([run],options.maxStep).steps<=1000000),'A training recording exceeds the maintained coarse/refined solver budget.');
 reservation.challengeStatus=trainingReservation.steps+challengeReservation.steps<=options.maxTotalSteps&&trainingReservation.rows+challengeReservation.rows<=MAX_ROWS&&source.challengeRuns.every(run=>reservePredictionWork([run],options.maxStep).steps<=1000000)?'reserved':'work_refused';
 reservation.weakWork=[...prefixes,...source.trainingRuns].reduce((sum,run)=>sum+run.samples.length*Math.min(2049,Math.ceil((run.samples.at(-1).time-run.samples[0].time)/options.windowStride)+1)*TERMS.length,0);
 insist(reservation.weakWork<=MAX_WEAK_WORK,'The complete weak-window comparison exceeds its bounded work allowance; use a larger window stride.');
 const prefix=weakRows(prefixes,options),full=weakRows(source.trainingRuns,options);
 const validationCount=partitions.reduce((sum,part)=>sum+part.validationCount,0);
 const candidates=RESTORING_FAMILIES.map(family=>{
  const initialFit=fitFamily(prefix.rows,family),finalFit=fitFamily(full.rows,family);
  const row={id:family.id,label:family.label,terms:[...family.terms],initialFit,finalFit,status:'incomplete',validation:[],validationRMSE:null,score:null,withinTolerance:false,challenges:[]};
  if(initialFit.candidate){
   row.validation=forecasts(initialFit.candidate,source.trainingRuns,options).map((receipt,i)=>{
    if(!receipt.rollout)return {...receipt,partition:partitions[i]};
    const rows=receipt.rollout.rows.slice(partitions[i].prefixCount),rmse=Math.hypot(...rows.map(sample=>sample.residual))/Math.sqrt(rows.length);
    return {...receipt,partition:partitions[i],validationCount:rows.length,validationRMSE:rmse};
   });
   if(finalFit.candidate&&row.validation.every(receipt=>receipt.status==='screened')){
    row.validationRMSE=Math.hypot(...row.validation.map(receipt=>receipt.validationRMSE*Math.sqrt(receipt.validationCount/validationCount)));
    row.score=validationCount*Math.log(Math.max(row.validationRMSE**2,options.positionTolerance**2))+initialFit.coefficientCount*Math.log(validationCount);
    row.withinTolerance=row.validationRMSE<=options.positionTolerance;row.status='complete';
   }
  }
  return row;
 });
 // Freeze the training-only decision before inspecting any challenge outcome.
 const ranked=candidates.filter(candidate=>candidate.status==='complete').sort((a,b)=>Number(b.withinTolerance)-Number(a.withinTolerance)||a.score-b.score||a.initialFit.coefficientCount-b.initialFit.coefficientCount||a.id.localeCompare(b.id));
 const best=ranked[0],competitive=best?ranked.filter(candidate=>candidate.withinTolerance===best.withinTolerance&&candidate.score-best.score<=options.ambiguityDelta):[];
 const status=!best?'no_complete_family':ranked.length!==candidates.length?'incomplete_comparison':!best.withinTolerance?'no_family_within_declared_tolerance':competitive.length>1?'ambiguous':'proposed';
 const decision={status,preferredId:best?.id??null,proposedId:status==='proposed'?best.id:null,competitiveIds:competitive.map(candidate=>candidate.id),
  withinToleranceIds:ranked.filter(candidate=>candidate.withinTolerance).map(candidate=>candidate.id),ranking:ranked.map(candidate=>candidate.id)};
 for(const candidate of candidates)if(candidate.finalFit.candidate)candidate.challenges=reservation.challengeStatus==='reserved'?forecasts(candidate.finalFit.candidate,source.challengeRuns,options):source.challengeRuns.map(run=>({runId:run.id,status:'work_refused',error:{code:'challenge_work_limit',message:'The complete separate-challenge catalog exceeds the remaining work allowance. The training proposal is retained; no subset was forecast.'}}));
 return {schema:'worldlaw.applied-restoring-proposal/v1',source,options,revision:'Explicit alternative restoring-family hypotheses; original linear source retained.',reservation,partitions,
  weakWindows:{prefix:prefix.blocks,full:full.blocks},validationCount,...decision,candidates,
  limitations:['A fixed three-family proposal, not unrestricted mechanism discovery or a uniquely identified physical law.',
   'Only the first declared fraction of each training recording fits proposal coefficients. Later original training angles rank full free-running predictions from the original initial position/rate; supplied forcing throughout the recording remains available.',
   'The preferred family is then fitted again using all original training samples. Separate challenge positions and outcomes cannot select a family, coefficient, cutoff, or tolerance.',
   'Qualification by the declared position tolerance precedes complexity ranking; alternatives outside tolerance cannot displace a qualified family. The declared angular tolerance and complexity/ambiguity score are screening assumptions, not calibrated noise, probability, or confidence. A family outside the competitive score set is not physically excluded.',
   'Positive constant scalar inertia and nonnegative linear damping are imposed; restoring coefficients need not be passive. Wrong torque calibration can change inferred inertia without degrading motion predictions.',
   'Noisy input coordinates, timing/alignment errors, unoffered mechanisms, and changed future forcing can mislead all candidates. Two-step agreement is not numerical convergence.']};
}

export function exportAppliedRestoring(result,{acceptedId=null}={}){
 insist(result?.schema==='worldlaw.applied-restoring-proposal/v1','Expected a restoring proposal.');
 if(acceptedId!==null)insist(result.candidates.some(candidate=>candidate.id===acceptedId&&candidate.status==='complete'),'Choose an available complete family explicitly.');
 const text=JSON.stringify({schema:APPLIED_RESTORING_SCHEMA,source:normalizeAppliedTorque(result.source),options:settings(result.options),acceptedId},null,2);
 insist(new TextEncoder().encode(text).length<=3000000,'Use a restoring notebook below 3 MB.');return text;
}
export function reopenAppliedRestoring(text){
 insist(typeof text==='string'&&new TextEncoder().encode(text).length<=3000000,'Use a restoring notebook below 3 MB.');
 const raw=JSON.parse(text);insist(object(raw)&&raw.schema===APPLIED_RESTORING_SCHEMA,'Expected an original-input restoring notebook.');
 insist(raw.acceptedId===null||RESTORING_FAMILIES.some(family=>family.id===raw.acceptedId),'Invalid explicit family choice.');
 const proposal=proposeAppliedRestoring(raw.source,raw.options);
 if(raw.acceptedId!==null)insist(proposal.candidates.some(candidate=>candidate.id===raw.acceptedId&&candidate.status==='complete'),'The retained explicit choice is unavailable after recomputation.');
 return {proposal,acceptedId:raw.acceptedId};
}
