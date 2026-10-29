import{createJointStateStudy}from'../joint-state/session.mjs';
import{reservePredictionWork}from'../predictive-selection/select.mjs';
import{fitPrefixInitialState,forecastPrefixInitialState}from'./fit.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
export function createPrefixStartsStudy(raw){
 if(raw?.schema!=='worldlaw.prefix-starts-inputs/v1')throw Error('Unsupported prefix initialization source');
 const original=createJointStateStudy(raw.original),source={schema:raw.schema,original:copy(original.source),options:copy(raw.options)},o=source.options;
 const finish=x=>({source,original,...x,meaning:'Shared laws fit original training courses only. Receiving original prefixes estimate model initialization parameters, not corrected observations or measurement uncertainty. Later course values only score continuous forecasts. All original incumbents retained; budgets are explicit per stage.'});
 try{
  if(!Number.isFinite(o.prefixDuration)||o.prefixDuration<=0||o.prefixDuration>30)throw Error('Declare original prefix duration within30s');
  const parent=original.original,maintained=parent.original,models=[['weak_full_six',maintained.selection.originalSelectedModel],['predictive_full_six',maintained.selection.selectedModel],['maintained_coordinate',maintained.refinement?.refinedModel],['position_only',parent.refinement?.model],['joint_channels',original.fit?.model]];
  const courses=source.original.original.bundle.challengeRuns;
  if(!courses.length) return finish({status:'no_receiving_courses',results:[]});
  const pairs=courses.map(run=>{const prefix=copy(run);prefix.samples=prefix.samples.filter(x=>x.time<=run.samples[0].time+o.prefixDuration);if(prefix.samples.length<8||prefix.samples.length===run.samples.length)throw Error('Each original receiving course needs8prefix rows and a later suffix');return{run,prefix};});
  if(!Number.isInteger(o.gridCount)||o.gridCount<3||o.gridCount>17||o.gridCount%2!==1||!Number.isInteger(o.sweeps)||o.sweeps<0||o.sweeps>16)throw Error('Bound complete prefix search');
  const n=models.filter(([,m])=>m).length,maxEval=1+o.gridCount**2+4*o.sweeps,a=reservePredictionWork(pairs.map(x=>x.prefix),o.maxStep,n*maxEval),b=reservePredictionWork(courses,o.maxStep,n*2),reservation={steps:a.steps+b.steps,rows:a.rows+b.rows,models:n,maximumPrefixEvaluations:maxEval};
  if(!Number.isSafeInteger(o.maxTotalSteps)||o.maxTotalSteps<1||o.maxTotalSteps>4000000||reservation.steps>o.maxTotalSteps||reservation.rows>262144) return finish({status:'complete_additional_budget_refused',reservation,results:[]});
  const results=[];for(const[label,model]of models)for(const{run,prefix}of pairs){if(!model){results.push({label,runId:run.id,status:'original_model_unavailable'});continue;}try{const fit=fitPrefixInitialState(model,prefix,o);if(!fit.best){results.push({label,runId:run.id,status:fit.status,fit,forecast:null});continue;}const forecast=forecastPrefixInitialState(fit,run,{maxTotalSteps:o.maxTotalSteps});results.push({label,runId:run.id,status:forecast.results.every(x=>x.status==='screened')?'screened':'forecast_incomplete',fit,forecast});}catch(e){results.push({label,runId:run.id,status:'refused',error:e.message});}}
  return finish({status:results.every(x=>x.status==='screened')?'complete':'comparison_incomplete',reservation,results});
 }catch(e){return finish({status:'prefix_study_refused',error:e.message,results:[]});}
}
export const savePrefixStartsStudy=s=>JSON.stringify(s.source,null,2);
export function reopenPrefixStartsStudy(text){if(typeof text!=='string'||text.length>3000000)throw Error('Use source JSON under3MB');return createPrefixStartsStudy(JSON.parse(text));}
