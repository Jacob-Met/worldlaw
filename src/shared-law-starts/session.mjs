import{createPrefixStartsStudy}from'../prefix-starts/session.mjs';
import{fitPrefixInitialState,forecastPrefixInitialState}from'../prefix-starts/fit.mjs';
import{fitSharedLawStarts}from'./fit.mjs';
import{compareTrainingStarts}from'../predictive-selection/training-starts.mjs';
import{reservePredictionWork}from'../predictive-selection/select.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
export function createSharedLawStartsStudy(raw){
 if(raw?.schema!=='worldlaw.shared-law-starts-inputs/v1')throw Error('Unsupported shared-law/start source');
 const original=createPrefixStartsStudy(raw.original),source={schema:raw.schema,original:copy(original.source),options:copy(raw.options)},finish=x=>({source,original,...x,meaning:'Optional shared training law and private training initial-state fit. Every original first row stays observed; initialization parameters are not corrected measurements. Training alone fits coefficients. Receiving original prefixes estimate only starts; later observations score continuous forecasts. Original five-law study and coordinate-start baseline retained; explicit separate bounded stages.'});
 try{
  const seed=original.original.original.original.selection.selectedModel,bundle=original.source.original.original.bundle,o=source.options,receivingOptions=original.source.options;
  if(!seed)throw Error('Training-selected predictive seed unavailable');
  const fit=fitSharedLawStarts(seed,bundle.trainingRuns,o);let coordinate;
  try{coordinate=compareTrainingStarts([seed],bundle.trainingRuns,{positionWidth:o.positionWidth,rateWidth:o.rateWidth,sweeps:o.coordinateSweeps,maxStep:o.maxStep,maxNumericalDifference:o.screen,maxTotalSteps:o.maxTotalSteps});}catch(e){coordinate={status:'refused',error:e.message,results:[]};}
  const models=[['joint_shared_law_training_starts',fit.model],['coordinate_training_starts',coordinate.results?.[0]?.model]],pairs=bundle.challengeRuns.map(run=>{const prefix=copy(run);prefix.samples=prefix.samples.filter(s=>s.time<=run.samples[0].time+receivingOptions.prefixDuration);return{run,prefix};});
  const n=models.filter(([,m])=>m).length,maximum=1+receivingOptions.gridCount**2+4*receivingOptions.sweeps,a=reservePredictionWork(pairs.map(x=>x.prefix),receivingOptions.maxStep,n*maximum),b=reservePredictionWork(bundle.challengeRuns,receivingOptions.maxStep,n*2),reservation={steps:a.steps+b.steps,rows:a.rows+b.rows};
  if(reservation.steps>receivingOptions.maxTotalSteps||reservation.rows>262144)return finish({status:'complete_receiving_budget_refused',fit,coordinate,reservation,results:[]});
  const results=[];for(const[label,model]of models)for(const{run,prefix}of pairs){if(!model){results.push({label,runId:run.id,status:'training_model_unavailable'});continue;}try{const start=fitPrefixInitialState(model,prefix,receivingOptions);if(!start.best){results.push({label,runId:run.id,status:start.status,start});continue;}const forecast=forecastPrefixInitialState(start,run,{maxTotalSteps:receivingOptions.maxTotalSteps});results.push({label,runId:run.id,status:forecast.results.every(x=>x.status==='screened')?'screened':'forecast_incomplete',start,forecast});}catch(e){results.push({label,runId:run.id,status:'receiving_refused',error:e.message});}}
  return finish({status:results.length&&results.every(x=>x.status==='screened')?'complete':'comparison_incomplete',fit,coordinate,reservation,results});
 }catch(e){return finish({status:'optional_training_refused',error:e.message,results:[]});}
}
export const saveSharedLawStartsStudy=s=>JSON.stringify(s.source,null,2);
export function reopenSharedLawStartsStudy(text){if(typeof text!=='string'||text.length>3000000)throw Error('Use original JSON under3MB');return createSharedLawStartsStudy(JSON.parse(text));}
