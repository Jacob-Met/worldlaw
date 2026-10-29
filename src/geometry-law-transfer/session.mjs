import {createSharedLawStartsStudy} from '../shared-law-starts/session.mjs';
import {createPrefixStartsStudy} from '../prefix-starts/session.mjs';
import {fitPrefixInitialState,forecastPrefixInitialState} from '../prefix-starts/fit.mjs';
import {reservePredictionWork} from '../predictive-selection/select.mjs';
import {transferPendulumLength} from './map.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
/** Recompute both original studies; no cached model or transferred forecast is admitted. */
export function createGeometryTransferStudy(raw){
 if(raw?.schema!=='worldlaw.geometry-transfer-inputs/v1')throw Error('Unsupported conditional geometry-transfer source');
 const original=createSharedLawStartsStudy(raw.original),receiving=createPrefixStartsStudy(raw.receiving);
 const receivingShared=raw.receivingShared?createSharedLawStartsStudy(raw.receivingShared):null;
 if(receivingShared&&JSON.stringify(receivingShared.source.original)!==JSON.stringify(receiving.source))throw Error('Local shared-law comparison must bind the exact same receiving originals and settings');
 const source={...(receivingShared?{receivingShared:copy(receivingShared.source)}:{}),schema:raw.schema,original:copy(original.source),receiving:copy(receiving.source),declaration:copy(raw.declaration)};
 const finish=x=>({source,original,receiving,receivingShared,...x,meaning:'Conditional nominal-length transfer. Source training alone supplies shared coefficients. Receiving prefix fits only initial state; suffix only scores. Unchanged source law and all five receiving-study incumbents retained. Geometry and unchanged angular damping are explicit assumptions, not identified facts. Separate original-study and added comparison budgets.'});
 try{
  if(!original.fit?.model)throw Error('Source shared-law fit unavailable');
  const models=[['unchanged_source_law',original.fit.model],['conditional_inverse_length',transferPendulumLength(original.fit.model,source.declaration)]];
  const runs=receiving.source.original.original.bundle.challengeRuns,o=receiving.source.options;
  const pairs=runs.map(run=>{const prefix=copy(run);prefix.samples=prefix.samples.filter(s=>s.time<=run.samples[0].time+o.prefixDuration);return{run,prefix};});
  const maximum=1+o.gridCount**2+4*o.sweeps,a=reservePredictionWork(pairs.map(x=>x.prefix),o.maxStep,models.length*maximum),b=reservePredictionWork(runs,o.maxStep,models.length*2),reservation={steps:a.steps+b.steps,rows:a.rows+b.rows};
  if(reservation.steps>o.maxTotalSteps||reservation.rows>262144)return finish({status:'complete_transfer_budget_refused',reservation,results:[]});
  const results=[];
  for(const[label,model]of models)for(const{run,prefix}of pairs){try{const fit=fitPrefixInitialState(model,prefix,o);if(!fit.best){results.push({label,runId:run.id,status:fit.status,fit});continue;}const forecast=forecastPrefixInitialState(fit,run,{maxTotalSteps:o.maxTotalSteps});results.push({label,runId:run.id,status:forecast.results.every(x=>x.status==='screened')?'screened':'forecast_incomplete',fit,forecast});}catch(e){results.push({label,runId:run.id,status:'transfer_receiving_refused',error:e.message});}}
  return finish({status:results.length&&results.every(x=>x.status==='screened')?'complete':'comparison_incomplete',models,reservation,results});
 }catch(e){return finish({status:'conditional_transfer_refused',error:e.message,results:[]});}
}
export const saveGeometryTransferStudy=s=>JSON.stringify(s.source,null,2);
export function reopenGeometryTransferStudy(text){if(typeof text!=='string'||text.length>6000000)throw Error('Use original source JSON under6MB');return createGeometryTransferStudy(JSON.parse(text));}
