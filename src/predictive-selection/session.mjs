import {normalizeAngularBundle} from '../trajectory/angular-discovery.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
import {selectPredictiveStructure,reservePredictionWork} from './select.mjs';
import {refineForwardCoefficients} from './refine.mjs';
import {comparePositionNoiseCovariance} from './covariance.mjs';
export const SCHEMA='worldlaw.predictive-notebook/v1';
export const REFINED_SCHEMA='worldlaw.predictive-notebook/v2';
export const COVARIANCE_SCHEMA='worldlaw.predictive-notebook/v3';
export function createPredictiveChallenge(rawBundle,options={},refinementOptions=null,covarianceOptions=null){
 if(covarianceOptions!==null){
  if(typeof covarianceOptions!=='object'||Array.isArray(covarianceOptions)||Object.getOwnPropertySymbols(covarianceOptions).length)throw Error('Covariance options must be an object of finite JSON numbers.');
  const entries=Object.entries(covarianceOptions);
  if(!entries.every(([,value])=>typeof value==='number'&&Number.isFinite(value)))throw Error('Covariance options must be an object of finite JSON numbers.');
  covarianceOptions=Object.fromEntries(entries);
 }
 const bundle=normalizeAngularBundle(rawBundle);
 const selection=selectPredictiveStructure(bundle.trainingRuns,options);
 const models=[selection.originalSelectedModel];
 if(selection.selectedModel&&selection.selectedModel.id!==models[0].id)models.push(selection.selectedModel);
 let refinement=null;
 if(refinementOptions!==null){
  try{
   if(!selection.selectedModel)throw Error('No complete predictive-selected structure is available to refine.');
   refinement=refineForwardCoefficients(selection.selectedModel,bundle.trainingRuns,refinementOptions);
   if(refinement.refinedModel){
    const proposed=reservePredictionWork(bundle.challengeRuns,selection.options.maxStep,models.length+1);
    if(proposed.steps<=1000000&&proposed.rows<=65536)models.push(refinement.refinedModel);
    else refinement.challengeFailure={code:'challenge_budget',message:'Refined comparison exceeds the complete separate challenge reservation; original predictions remain available.'};
   }
  }catch(error){refinement={status:'refused',error:{message:error.message,code:error.code||'refinement_refused'},refinedModel:null};}
 }
 let covariance=null;
 if(covarianceOptions!==null){
  try{
   if(!selection.selectedModel)throw Error('No complete predictive-selected structure is available for covariance comparison.');
   if(!covarianceOptions||typeof covarianceOptions!=='object'||Array.isArray(covarianceOptions))throw Error('Covariance options must be an object.');
   covariance=comparePositionNoiseCovariance(selection.selectedModel,bundle.trainingRuns,{...covarianceOptions,windowDuration:selection.options.windowDuration,windowStride:selection.options.windowStride});
   if(covariance.refinedModel){
    const proposed=reservePredictionWork(bundle.challengeRuns,selection.options.maxStep,models.length+1);
    if(proposed.steps<=1000000&&proposed.rows<=65536)models.push(covariance.refinedModel);
    else covariance.challengeFailure={code:'challenge_budget',message:'Covariance comparison exceeds the complete separate challenge reservation; original predictions remain available.'};
   }
  }catch(error){covariance={status:'refused',error:{message:error.message,code:error.code||'covariance_refused'},refinedModel:null};}
 }
 const reservation=reservePredictionWork(bundle.challengeRuns,selection.options.maxStep,models.length);
 const results=[];
 if(refinement?.challengeFailure)for(const run of bundle.challengeRuns)results.push({modelId:refinement.refinedModel.id,runId:run.id,status:'unavailable',error:refinement.challengeFailure,rollout:null,resolution:null});
 if(covariance?.challengeFailure)for(const run of bundle.challengeRuns)results.push({modelId:covariance.refinedModel.id,runId:run.id,status:'unavailable',error:covariance.challengeFailure,rollout:null,resolution:null});
 for(const model of models)for(const run of bundle.challengeRuns){
  const budget=reservePredictionWork([run],selection.options.maxStep).steps;
  if(reservation.steps>1000000||reservation.rows>65536||budget>1000000){results.push({modelId:model.id,runId:run.id,status:'unavailable',error:{code:'challenge_budget',message:'Complete final challenge exceeds its separate execution reservation.'},rollout:null,resolution:null});continue;}
  try{const received=rolloutAngularWithResolution(model,run,{maxStep:selection.options.maxStep,maxSteps:budget});results.push({modelId:model.id,runId:run.id,status:'complete',numericalStatus:received.resolution.status==='compared'&&received.resolution.positionRMSEDifference<=selection.options.maxNumericalDifference?'screened':'unresolved',...received});}
  catch(error){results.push({modelId:model.id,runId:run.id,status:'failed',error:{message:error.message,code:error.code||'prediction_failed'},rollout:null,resolution:null});}
 }
 return {schema:'worldlaw.predictive-challenge/v1',bundle,selection,challengeReservation:reservation,results,
  ...(refinementOptions!==null?{refinementOptions:JSON.parse(JSON.stringify(refinementOptions)),refinement}:{}),
  ...(covarianceOptions!==null?{covarianceOptions:JSON.parse(JSON.stringify(covarianceOptions)),covariance}:{}),
  limitations:'The separate challenge is evaluated after structure and coefficients are frozen. Viewing it while choosing settings is exploratory reuse, not fresh blind validation. A failed selected law is never replaced by a better-looking alternative.'};
}
export function exportPredictiveChallenge(state){
 if(state?.schema!=='worldlaw.predictive-challenge/v1')throw Error('Expected a predictive challenge.');
 const text=JSON.stringify({schema:state.covariance?COVARIANCE_SCHEMA:state.refinement?REFINED_SCHEMA:SCHEMA,bundle:state.bundle,options:state.selection.options,...(state.refinement?{refinementOptions:state.refinementOptions}:{}),...(state.covariance?{covarianceOptions:state.covarianceOptions}:{})});
 if(text.length>3000000)throw Error('Notebook exceeds 3 MB.');return text;
}
export function importPredictiveChallenge(text){
 if(typeof text!=='string'||text.length>3000000)throw Error('Use a JSON notebook under 3 MB.');
 const raw=JSON.parse(text);if(![SCHEMA,REFINED_SCHEMA,COVARIANCE_SCHEMA].includes(raw?.schema))throw Error('Unsupported predictive notebook.');
 if(raw.schema===REFINED_SCHEMA&&(!raw.refinementOptions||typeof raw.refinementOptions!=='object'||Array.isArray(raw.refinementOptions)))throw Error('Refinement notebook requires an explicit options object.');
 if(raw.schema===COVARIANCE_SCHEMA&&(!raw.covarianceOptions||typeof raw.covarianceOptions!=='object'||Array.isArray(raw.covarianceOptions)))throw Error('Covariance notebook requires an explicit options object.');
 if(raw.schema===COVARIANCE_SCHEMA&&raw.refinementOptions!==undefined&&(!raw.refinementOptions||typeof raw.refinementOptions!=='object'||Array.isArray(raw.refinementOptions)))throw Error('Optional forward refinement requires an explicit options object.');
 return createPredictiveChallenge(raw.bundle,raw.options,[REFINED_SCHEMA,COVARIANCE_SCHEMA].includes(raw.schema)?raw.refinementOptions??null:null,raw.schema===COVARIANCE_SCHEMA?raw.covarianceOptions:null);
}
