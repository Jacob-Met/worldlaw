import {createLMStudy} from '../trajectory-lm/session.mjs';
import {fitConditionTrajectories} from './fit.mjs';
import {reservePredictionWork} from '../predictive-selection/select.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
export function createConditionStudy(raw){
 if(raw?.schema!=='worldlaw.condition-trajectories/v1')throw Error('Unsupported condition trajectory source');
 const source=copy({schema:raw.schema,original:raw.original,options:raw.options,challengeAssignments:raw.challengeAssignments});
 // Original pooled LM and both maintained incumbents remain independent results.
 const original=createLMStudy(source.original);source.original=copy(original.source);
 if(Array.isArray(source.challengeAssignments))source.challengeAssignments=source.challengeAssignments.map(a=>a&&({challengeId:a.challengeId,trainingId:a.trainingId,sameConditionAssumption:a.sameConditionAssumption}));
 const finish=(extra)=>({source,original,...extra,meaning:'Explicit condition-specific training damping with shared restoring terms. Each challenge association is a user-declared same-condition hypothesis, not inferred from challenge values. No coefficient for an unobserved condition is predicted. Per-stage work budgets, no global certification.'});
 const seed=original.refinement?.model;
 if(!seed)return finish({status:'original_seed_unavailable',joint:null,challenge:[]});
 let joint;try{joint=fitConditionTrajectories(seed,original.original.bundle.trainingRuns,source.options);}catch(e){return finish({status:'joint_refused',error:e.message,joint:null,challenge:[]});}
 if(!joint.models)return finish({status:'joint_unresolved',joint,challenge:[]});
 const runs=original.original.bundle.challengeRuns,assignments=source.challengeAssignments;
 // Admit the complete set of associations before any conditional forecast.
 if(!Array.isArray(assignments)||assignments.length!==runs.length||new Set(assignments.map(a=>a?.challengeId)).size!==runs.length||assignments.some(a=>!a||!runs.some(r=>r.id===a.challengeId)||!joint.models.some(m=>m.runId===a.trainingId)||typeof a.sameConditionAssumption!=='string'||!a.sameConditionAssumption.trim()))return finish({status:'challenge_association_refused',joint,challenge:[]});
 const reservation=reservePredictionWork(runs,source.options.maxStep);
 if(reservation.steps>1000000||reservation.rows>65536)return finish({status:'challenge_budget_refused',joint,reservation,challenge:[]});
 const challenge=runs.map(run=>{const assignment=assignments.find(a=>a.challengeId===run.id),model=joint.models.find(m=>m.runId===assignment.trainingId).model;try{const r=rolloutAngularWithResolution(model,run,{maxStep:source.options.maxStep,maxSteps:reservePredictionWork([run],source.options.maxStep).steps});return{runId:run.id,assignment,model,status:r.resolution.status==='compared'&&r.resolution.maxAbsPositionDifference<=source.options.screen?'screened':'unresolved',...r};}catch(e){return{runId:run.id,assignment,status:'failed',error:e.message};}});
 return finish({status:challenge.every(r=>r.status==='screened')?'complete':'challenge_incomplete',joint,reservation,challenge});
}
export const saveConditionStudy=study=>JSON.stringify(study.source,null,2);
export function reopenConditionStudy(text){if(typeof text!=='string'||text.length>3000000)throw Error('Use source JSON under3M characters');return createConditionStudy(JSON.parse(text));}
