import {createLMStudy} from '../trajectory-lm/session.mjs';
import {normalizeAngularBundle} from '../trajectory/angular-discovery.mjs';
import {reservePredictionWork} from '../predictive-selection/select.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
import {calibrateConditionRate} from './fit.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
export function createConditionPrefixStudy(raw){
 if(raw?.schema!=='worldlaw.condition-prefix/v1'||typeof raw.fixedRestoringAssumption!=='string'||!raw.fixedRestoringAssumption.trim())throw Error('Declare the fixed restoring-law assumption for the new condition');
 const original=createLMStudy(raw.original),source={schema:raw.schema,original:copy(original.source),course:copy(raw.course),options:copy(raw.options),fixedRestoringAssumption:raw.fixedRestoringAssumption};
 const finish=extra=>({source,original,...extra,meaning:'Original source-derived restoring coefficients are frozen. Only an explicit prefix calibrates new-condition linear damping; the suffix is scored after freezing, starting from the original first state without reset. Reused measured data remains exploratory. A boundary is not an inferred interior value or physical diagnosis.'});
 // Reuse complete original identity/kind/unforced admission, even though this
 // course has an explicit calibration prefix rather than being wholly held out.
 const admitted=normalizeAngularBundle({...original.original.bundle,challengeRuns:[source.course]});
 source.course=copy(admitted.challengeRuns[0]);const run=admitted.challengeRuns[0],o=source.options;
 const seed=original.refinement?.model;if(!seed)return finish({status:'original_seed_unavailable',calibration:null,comparisons:[]});
 const candidates=[['weak_full_six',original.original.selection.originalSelectedModel],['predictive_full_six',original.original.selection.selectedModel],['maintained_coordinate',original.original.refinement?.refinedModel],['pooled_sensitivity',seed]];
 const executable=candidates.filter(([,m])=>m),comparisonReservation=reservePredictionWork([run],o.maxStep,executable.length);
 if(comparisonReservation.steps>1000000||comparisonReservation.rows>65536)return finish({status:'complete_incumbent_forecast_budget_refused',calibration:null,comparisons:[],comparisonReservation});
 let calibration;try{calibration=calibrateConditionRate(seed,run,o);}catch(e){return finish({status:'calibration_refused',error:e.message,calibration:null,comparisons:[],comparisonReservation});}
 const start=calibration.prefixCount,comparisons=candidates.map(([label,model])=>{if(!model)return{label,status:'unavailable'};try{const r=rolloutAngularWithResolution(model,run,{maxStep:o.maxStep,maxSteps:reservePredictionWork([run],o.maxStep).steps}),residuals=r.rollout.rows.slice(start).map((x,i)=>x.predicted-run.samples[start+i].position);return{label,status:r.resolution.status==='compared'&&r.resolution.maxAbsPositionDifference<=o.screen?'screened':'unresolved',laterRMSE:Math.hypot(...residuals)/Math.sqrt(residuals.length),...r};}catch(e){return{label,status:'failed',error:e.message};}});
 return finish({status:calibration.status,calibration,comparisons,comparisonReservation});
}
export const saveConditionPrefixStudy=study=>JSON.stringify(study.source,null,2);
export function reopenConditionPrefixStudy(text){if(typeof text!=='string'||text.length>3000000)throw Error('Use original source JSON under3MB');return createConditionPrefixStudy(JSON.parse(text));}
