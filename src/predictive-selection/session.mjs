import {normalizeAngularBundle} from '../trajectory/angular-discovery.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
import {selectPredictiveStructure,reservePredictionWork} from './select.mjs';
export const SCHEMA='worldlaw.predictive-notebook/v1';
export function createPredictiveChallenge(rawBundle,options={}){
 const bundle=normalizeAngularBundle(rawBundle);
 const selection=selectPredictiveStructure(bundle.trainingRuns,options);
 const models=[selection.originalSelectedModel];
 if(selection.selectedModel&&selection.selectedModel.id!==models[0].id)models.push(selection.selectedModel);
 const reservation=reservePredictionWork(bundle.challengeRuns,selection.options.maxStep,models.length);
 const results=[];
 for(const model of models)for(const run of bundle.challengeRuns){
  const budget=reservePredictionWork([run],selection.options.maxStep).steps;
  if(reservation.steps>1000000||reservation.rows>65536||budget>1000000){results.push({modelId:model.id,runId:run.id,status:'unavailable',error:{code:'challenge_budget',message:'Complete final challenge exceeds its separate execution reservation.'},rollout:null,resolution:null});continue;}
  try{const received=rolloutAngularWithResolution(model,run,{maxStep:selection.options.maxStep,maxSteps:budget});results.push({modelId:model.id,runId:run.id,status:'complete',numericalStatus:received.resolution.status==='compared'&&received.resolution.positionRMSEDifference<=selection.options.maxNumericalDifference?'screened':'unresolved',...received});}
  catch(error){results.push({modelId:model.id,runId:run.id,status:'failed',error:{message:error.message,code:error.code||'prediction_failed'},rollout:null,resolution:null});}
 }
 return {schema:'worldlaw.predictive-challenge/v1',bundle,selection,challengeReservation:reservation,results,
  limitations:'The separate challenge is evaluated after structure and coefficients are frozen. Viewing it while choosing settings is exploratory reuse, not fresh blind validation. A failed selected law is never replaced by a better-looking alternative.'};
}
export function exportPredictiveChallenge(state){
 if(state?.schema!=='worldlaw.predictive-challenge/v1')throw Error('Expected a predictive challenge.');
 const text=JSON.stringify({schema:SCHEMA,bundle:state.bundle,options:state.selection.options});
 if(text.length>3000000)throw Error('Notebook exceeds 3 MB.');return text;
}
export function importPredictiveChallenge(text){
 if(typeof text!=='string'||text.length>3000000)throw Error('Use a JSON notebook under 3 MB.');
 const raw=JSON.parse(text);if(raw?.schema!==SCHEMA)throw Error('Unsupported predictive notebook.');
 return createPredictiveChallenge(raw.bundle,raw.options);
}
