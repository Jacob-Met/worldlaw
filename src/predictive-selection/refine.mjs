/** Local coefficient search using complete training trajectories, never challenge observations. */
import {normalizeAngularRuns} from '../trajectory/angular-discovery.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
import {reservePredictionWork} from './select.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const insist=(ok,message)=>{if(!ok)throw Error(message);};
export function refineForwardCoefficients(original,trainingRuns,input={}){
 insist(input&&typeof input==='object'&&!Array.isArray(input),'Forward refinement options must be an object.');
 const runs=normalizeAngularRuns(trainingRuns);
 const options={sweeps:20,initialFraction:.1,minimumStep:.01,maxStep:.02,maxNumericalDifference:.001,maxTotalSteps:2000000,...input};
 insist(Number.isInteger(options.sweeps)&&options.sweeps>=1&&options.sweeps<=30,'Use 1–30 complete coefficient sweeps.');
 insist(Number.isFinite(options.initialFraction)&&options.initialFraction>0&&options.initialFraction<=1,'Initial coefficient fraction must be above zero and at most one.');
 insist(Number.isFinite(options.minimumStep)&&options.minimumStep>0&&options.minimumStep<=1,'Minimum initial coefficient step must be above zero and at most one, in each coefficient’s own units.');
 insist(Number.isFinite(options.maxStep)&&options.maxStep>=1e-5&&options.maxStep<=.1,'Forward refinement step must be 0.00001–0.1 seconds.');
 insist(Number.isFinite(options.maxNumericalDifference)&&options.maxNumericalDifference>=0&&options.maxNumericalDifference<=1,'Two-step screen must be 0–1 radians.');
 insist(Number.isSafeInteger(options.maxTotalSteps)&&options.maxTotalSteps>=1&&options.maxTotalSteps<=2000000,'Reserve at most two million refinement integration steps.');
 insist(original?.schema==='worldlaw.angular-model/v1'&&Array.isArray(original.terms)&&original.terms.length<=8,'An executable angular model with at most eight terms is required.');
 const baseline=clone(original),count=runs.reduce((sum,r)=>sum+r.samples.length-1,0);
 const maximumEvaluations=1+2*baseline.terms.length*options.sweeps;
 const reservation=reservePredictionWork(runs,options.maxStep,maximumEvaluations);
 insist(reservation.steps<=options.maxTotalSteps,'Complete forward refinement exceeds its integration-step reservation; no partial search was run.');
 const trials=[];
 const makeModel=values=>({...clone(baseline),id:baseline.id+'~forward-refined',terms:baseline.terms.map((t,i)=>({...t,coefficient:values[i]})),
  equation:'α = '+(baseline.terms.map((t,i)=>`${Number(values[i].toPrecision(6))}·${t.id}`).join(' + ')||'0'),
  method:'bounded_local_complete_training_trajectory_refinement',metrics:{meaning:'Original weak-fit metrics do not describe these changed coefficients.'}});
 function evaluate(values){
  const model=makeModel(values),receipts=[];
  for(const run of runs){try{
   const budget=reservePredictionWork([run],options.maxStep).steps;
   const r=rolloutAngularWithResolution(model,run,{maxStep:options.maxStep,maxSteps:Math.min(1000000,budget)});
   receipts.push({runId:run.id,status:r.resolution.status==='compared'&&r.resolution.positionRMSEDifference<=options.maxNumericalDifference?'screened':'numerically_unresolved',metrics:r.rollout.metrics,resolution:r.resolution});
  }catch(error){receipts.push({runId:run.id,status:'failed',error:{code:error.code||'prediction_failed',message:error.message}});}}
  const complete=receipts.every(r=>r.status==='screened');
  const rmse=complete?Math.hypot(...receipts.map(r=>r.metrics.positionRMSE*Math.sqrt(r.metrics.count/count))):null;
  const trial={index:trials.length,coefficients:[...values],status:complete?'complete':'incomplete',trainingRMSE:rmse,runs:receipts};trials.push(trial);return trial;
 }
 let values=baseline.terms.map(t=>t.coefficient),best=evaluate(values),steps=values.map(v=>Math.max(Math.abs(v)*options.initialFraction,options.minimumStep));
 if(best.status==='complete')for(let sweep=0;sweep<options.sweeps;sweep++){
  let improved=false;
  for(let i=0;i<values.length;i++){
   let next=best;
   for(const sign of [-1,1]){const candidate=[...values];candidate[i]+=sign*steps[i];const trial=evaluate(candidate);if(trial.status==='complete'&&trial.trainingRMSE<next.trainingRMSE)next=trial;}
   if(next!==best){best=next;values=[...next.coefficients];improved=true;}
  }
  if(!improved)steps=steps.map(v=>v/2);
 }
 const improved=best.status==='complete'&&best.trainingRMSE<trials[0].trainingRMSE;
 const model=improved?makeModel(best.coefficients):null;
 if(model)model.metrics={count,rmse:best.trainingRMSE,residualUnits:'rad',residualMeaning:'complete_training_forward_position_error',originalWeakMetricsNotApplicable:true};
 return {schema:'worldlaw.forward-coefficient-refinement/v1',options,reservation,maximumEvaluations,originalModel:baseline,
  refinedModel:model,status:trials[0].status!=='complete'?'baseline_unresolved':improved?'training_improved':'no_training_improvement',trials,bestTrialIndex:best.index,
  limitations:['Local coordinate search in one frozen structure, not global optimization or additional structure discovery.','Initial position, supplied initial rate, source rows and timestamps remain fixed.','Training improvement and even cross-recording validation can worsen a separate recording. The original model is never replaced.','Coefficient signs and physical passivity are not imposed. Unknown inertia and torque scale remain unknown.','The minimum initial step is a caller-declared heuristic in each coefficient’s own units.','Two-step agreement is a numerical screen, not a proof of convergence.']};
}
