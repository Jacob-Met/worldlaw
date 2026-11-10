/** Known-inertia recorded outcomes. No instrument execution or residual-based admission. */
import {createChallenge,exportChallenge,restoreChallenge} from './session.mjs';
import {restoreExperimentSession} from './experiment-session.mjs';
import {validateRun,validateBundle,RUN_UNITS,MAX_TEXT_LENGTH,TrajectoryDataError} from './data.mjs';
import {planTrajectoryExperiment} from './planner.mjs';
import {qualifyTrajectoryPlan,TrajectoryPlanQualificationError} from '../experiment-design/qualify-trajectory-plan.mjs';
import {rolloutWithResolution} from './resolution.mjs';
import {TERMS} from '../science/torque-discovery.mjs';

export const RECORDED_EXPERIMENT_SCHEMA='worldlaw.recorded-trajectory-experiment/v1';
const proofs=new WeakMap(),termIds=new Set(TERMS.map(t=>t.id));
const clone=x=>JSON.parse(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=(message,code='invalid_experiment')=>{throw new TrajectoryDataError(message,code);};
const insist=(condition,message,code)=>{if(!condition)fail(message,code);};
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
function fingerprint(value){let h=2166136261;for(const c of canonical(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return 'recorded-'+h.toString(16).padStart(8,'0');}
function immutableCurrent(current){const {selectedModelId,selectedRunId,positionTolerance,...rest}=current;return rest;}
function signature(s){return canonical({...s,current:immutableCurrent(s.current)});}
function register(s){insist(s.history.length<=64,'Recorded history supports at most 64 events.','resource_limit');proofs.set(s,signature(s));exportRecordedExperiment(s);return s;}
function check(s){insist(s?.schema===RECORDED_EXPERIMENT_SCHEMA&&proofs.has(s),'Use a created or reopened recorded experiment.','invalid_experiment');insist(signature(s)===proofs.get(s),'Recorded evidence, model or request changed outside a recorded transition.','stale_plan');}
function context(s){return fingerprint({bundle:s.current.bundle,options:s.current.options,discovery:s.current.discovery});}
function supported(current){
 insist(current.bundle.schema==='worldlaw.trajectory-bundle/v1','Recorded experiments require known positive inertia; angular-only evidence is not supported.','unsupported_schema');
 insist(!current.options.commandPositionInteraction&&!current.options.directionalQuadraticLoss&&!current.options.compareCoulombContact,'This recorded experiment uses the original seven-term torque family only.','unsupported_model');
 insist(current.discovery.schema==='worldlaw.discovery/v1'&&current.discovery.candidates.every(m=>m.schema==='worldlaw.torque-model/v1'&&m.terms.every(t=>termIds.has(t.id))),'The planner requires supported known-inertia torque models.','unsupported_model');
}
function snapshot(current,id){const model=current.discovery.selected,result=current.results.find(r=>r.modelId===model.id&&r.runId===id);return {modelId:model.id,equation:model.equation,trainingRunCount:current.bundle.trainingRuns.length,trainingSampleCount:current.bundle.trainingRuns.reduce((n,r)=>n+r.samples.length,0),status:result?.status??'unavailable',positionRMSE:result?.status==='ok'?result.rollout.metrics.positionRMSE:null,rows:result?.status==='ok'?clone(result.rollout.rows):[],error:result?.error?clone(result.error):null};}
function textJSON(text){insist(typeof text==='string'&&text.length<=MAX_TEXT_LENGTH,'Use JSON smaller than 3 MB.','resource_limit');try{return JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('The recorded experiment JSON could not be read.','invalid_evidence');}}
function selection(current){const raw=JSON.parse(exportChallenge(current));return {selectedModelId:raw.selectedModelId,selectedRunId:raw.selectedRunId,positionTolerance:raw.positionTolerance};}

export function createRecordedExperiment(baseNotebookText){
 textJSON(baseNotebookText);
 const original=restoreExperimentSession(baseNotebookText);
 insist(!original.acquisition,'Apply or explicitly discard the pending virtual acquisition before starting recorded work.','pending_evidence');
 const current=restoreChallenge(exportChallenge(original.current));supported(current);
 return register({schema:RECORDED_EXPERIMENT_SCHEMA,baseNotebookText,current,evaluationRunId:current.bundle.challengeRuns[0].id,history:[],plan:null,acquisition:null,latestAcquisition:null,comparison:null,settings:null,numericalQualification:null});
}
export function planRecordedExperiment(s,settings){
 check(s);supported(s.current);
 insist(!s.acquisition,'Apply or explicitly discard the pending recording before planning again.','pending_evidence');
 insist(s.current.bundle.trainingRuns.length<4,'Four training runs are already retained. Start from a separately selected evidence set.','resource_limit');
 insist(object(settings)&&Number.isFinite(settings.inertia)&&Number.isFinite(settings.command),'Declare the requested known inertia and constant command explicitly.','invalid_options');
 const input={...settings};
 // The maintained planner emits null for an absent optional envelope.
 if(input.predictionBounds===null)delete input.predictionBounds;
 insist(input.maxTotalSteps===undefined||input.maxTotalSteps<=250000,'Interactive planning is limited to 250,000 complete steps.','resource_limit');
 const planned=planTrajectoryExperiment(s.current.discovery,input);
 const key=context(s),plan={...planned,id:fingerprint({contextKey:key,options:planned.options}),contextKey:key};
 let numericalQualification;
 try{numericalQualification=qualifyTrajectoryPlan(s.current.discovery,plan);}
 catch(e){if(!(e instanceof TrajectoryPlanQualificationError))throw e;numericalQualification={status:'unavailable',error:{code:e.code,message:e.message}};}
 return register({...s,plan,settings:clone(plan.options),numericalQualification});
}
function validateNewRun(s,raw){
 const run=validateRun(raw,{role:'training'});
 insist(typeof run.source.recordingId==='string'&&run.source.recordingId.length>0,'Declare a new source recordingId for the supplied recording.','missing_recording_identity');
 for(const prior of [...s.current.bundle.trainingRuns,...s.current.bundle.challengeRuns]){
  insist(run.id!==prior.id&&run.source.recordingId!==prior.source.recordingId,'This recording identity is already retained.','shared_evidence');
  // Reuse the maintained complete/subset/window screen also between training runs.
  validateBundle({schema:'worldlaw.trajectory-bundle/v1',label:'Recorded source independence screen',units:RUN_UNITS,trainingRuns:[run],challengeRuns:[prior]});
 }
 validateBundle({...s.current.bundle,trainingRuns:[...s.current.bundle.trainingRuns,run]});
 return run;
}
export function receiveRecordedOutcome(s,runOrJSON,options={}){
 check(s);
 insist(object(options)&&Object.keys(options).every(k=>['contextKey','planId'].includes(k)),'Unsupported recording admission options.','invalid_options');
 insist(!s.acquisition,'A recording is already pending. Apply or explicitly discard it first.','pending_evidence');
 insist(s.plan?.status==='proposed'&&s.plan.selected,'Freeze an informative release request before receiving a recording.','no_proposal');
 insist(s.plan.contextKey===context(s)&&(!options.contextKey||options.contextKey===context(s))&&(!options.planId||options.planId===s.plan.id),'The supplied recording targets a different request or source revision.','stale_plan');
 const scheduled=Math.round(s.plan.options.duration/s.plan.options.sampleInterval)+1;
 insist(scheduled>=17,'This request schedules fewer than 17 samples and is not a trainable recording course. Plan a longer or more frequent course.','insufficient_training_schedule');
 const raw=typeof runOrJSON==='string'?textJSON(runOrJSON):runOrJSON;
 insist(object(raw),'Supply one complete recorded run.','invalid_evidence');
 const run=validateNewRun(s,raw),requested={...clone(s.plan.selected.acquisitionRequest),inertia:s.plan.options.inertia,command:s.plan.options.command};
 insist(run.inertia===requested.inertia,'Recorded inertia differs from the requested known inertia.','protocol_mismatch');
 insist(run.samples.every(row=>row.command===requested.command),'Every recorded command must match the requested constant command.','protocol_mismatch');
 const intervals=run.samples.slice(1).map((row,i)=>row.time-run.samples[i].time);
 const actual={inertia:run.inertia,command:requested.command,initialPosition:run.samples[0].position,initialRate:run.initialRate,duration:run.samples.at(-1).time-run.samples[0].time,sampleCount:run.samples.length,startTime:run.samples[0].time,endTime:run.samples.at(-1).time,minSampleInterval:Math.min(...intervals),maxSampleInterval:Math.max(...intervals)};
 const deviations={initialPosition:actual.initialPosition-requested.initialPosition,initialRate:actual.initialRate-requested.initialRate,duration:actual.duration-requested.duration,sampleCount:actual.sampleCount-scheduled};
 const models=s.plan.provenance.modelIds.map(id=>s.current.discovery.candidates.find(m=>m.id===id));
 let coarseSteps=0,refinedSteps=0;
 for(const interval of intervals){coarseSteps+=Math.max(1,Math.ceil(interval/s.plan.options.maxStep));refinedSteps+=Math.max(1,Math.ceil(interval/(s.plan.options.maxStep/2)));}
 const stepsPerModel=coarseSteps+refinedSteps,reservedSteps=stepsPerModel*models.length;
 const executionAllowed=Number.isSafeInteger(reservedSteps)&&reservedSteps<=750000;
 const predictions=models.map(model=>{
  if(!executionAllowed)return {modelId:model.id,status:'failed',rollout:null,resolution:null,error:{code:'resource_limit',message:'The complete actual-clock coarse/refined comparison exceeds 750,000 steps. The supplied recording is retained without a forecast.'}};
  try{return {modelId:model.id,status:'ok',...rolloutWithResolution(model,run,{maxStep:s.plan.options.maxStep,maxSteps:stepsPerModel})};}
  catch(e){return {modelId:model.id,status:'failed',rollout:null,resolution:null,error:{code:e.code??'prediction_failed',message:e.message??String(e)}};}
 });
 const acquisition={id:run.id,run,requested,actual,deviations,predictions,planSettings:clone(s.plan.options),planId:s.plan.id,contextKey:context(s),nominalPlan:clone(s.plan),work:{reservedSteps,stepsPerModel,modelCount:models.length,budget:750000,executed:executionAllowed},meaning:'Frozen training models replayed at the supplied first position, initial rate and original timestamps. These are not the original planned forecasts; no observations were fitted or rewritten.'};
 return register({...s,acquisition});
}
export function discardRecordedOutcome(s){check(s);insist(s.acquisition,'No recorded outcome is pending.','missing_acquisition');return register({...s,acquisition:null});}
export function applyRecordedOutcome(s,options={}){
 check(s);insist(object(options)&&Object.keys(options).every(k=>['contextKey','acquisitionId'].includes(k)),'Unsupported application options.','invalid_options');
 insist(s.acquisition,'Receive a recorded outcome before applying evidence.','missing_acquisition');
 insist(s.acquisition.contextKey===context(s)&&(!options.contextKey||options.contextKey===context(s))&&(!options.acquisitionId||options.acquisitionId===s.acquisition.id),'The pending recording belongs to a different source revision.','stale_plan');
 const bundle=clone(s.current.bundle);bundle.trainingRuns.push(clone(s.acquisition.run));
 const current=createChallenge(bundle,s.current.options);
 current.positionTolerance=s.current.positionTolerance;current.selectedRunId=s.current.selectedRunId;
 const evaluationRun=current.bundle.challengeRuns.find(r=>r.id===s.evaluationRunId);
 const comparison={evaluationRunId:evaluationRun.id,evaluationLabel:evaluationRun.label,evaluationRun:clone(evaluationRun),before:snapshot(s.current,evaluationRun.id),after:snapshot(current,evaluationRun.id),meaning:'Same reserved recording before and after applying separately supplied evidence. This is exploratory reuse, not blind validation; worse or failed revisions remain applied.'};
 const event={type:'recording',planSettings:clone(s.acquisition.planSettings),run:clone(s.acquisition.run)};
 return register({...s,current,history:[...s.history,event],plan:null,acquisition:null,latestAcquisition:clone(s.acquisition),numericalQualification:null,comparison});
}
export function recordedExperimentView(s){
 check(s);
 const trainable=!!s.plan&&Math.round(s.plan.options.duration/s.plan.options.sampleInterval)+1>=17;
 return {contextKey:context(s),available:true,instrument:{kind:'recorded',label:'Separately supplied recording · declared provenance'},settings:s.settings,plan:s.plan,numericalQualification:s.numericalQualification,acquisition:s.acquisition,latestAcquisition:s.latestAcquisition,request:s.plan?.selected?JSON.parse(exportRecordedRequest(s)):null,comparison:s.comparison,trainableSchedule:trainable,canReceive:!s.acquisition&&s.plan?.status==='proposed'&&trainable,notice:s.comparison?.after.status==='failed'?'The refitted training leader failed on the reserved recording. Its supplied evidence and failed revision remain applied.':s.plan&&!trainable?'This request has fewer than 17 scheduled samples and cannot admit a training recording.':s.numericalQualification&&s.numericalQualification.status!=='screen_passed'?'The request is not numerically qualified. Existing recordings can still be received; this is not authorization for a new physical acquisition.':null};
}
export function exportRecordedExperiment(s){
 check(s);
 const raw={schema:RECORDED_EXPERIMENT_SCHEMA,baseNotebookText:s.baseNotebookText,history:clone(s.history),pending:s.acquisition?{planSettings:clone(s.acquisition.planSettings),run:clone(s.acquisition.run)}:null,planSettings:s.plan?clone(s.plan.options):null,selection:selection(s.current)};
 const text=JSON.stringify(raw,null,2);insist(text.length<=MAX_TEXT_LENGTH,'Recorded experiment history exceeds the 3 MB limit.','resource_limit');return text;
}
export function restoreRecordedExperiment(text){
 const raw=textJSON(text);
 insist(object(raw)&&raw.schema===RECORDED_EXPERIMENT_SCHEMA&&Array.isArray(raw.history)&&raw.history.length<=64,'Unsupported recorded experiment notebook.','invalid_history');
 let s=createRecordedExperiment(raw.baseNotebookText);
 const replay=(event,apply)=>{
  insist(object(event)&&object(event.planSettings)&&object(event.run),'Recorded history requires request settings and original source run.','invalid_history');
  s=planRecordedExperiment(s,event.planSettings);s=receiveRecordedOutcome(s,event.run);if(apply)s=applyRecordedOutcome(s);
 };
 for(const event of raw.history){if(event?.type==='refit')s=refitRecordedExperiment(s,event.options);else {insist(event?.type===undefined||event.type==='recording','Unknown recorded history event.','invalid_history');replay(event,true);}}
 if(raw.pending){replay(raw.pending,false);insist(raw.planSettings===null||canonical(raw.planSettings)===canonical(raw.pending.planSettings),'Pending request settings conflict with retained plan settings.','invalid_history');}
 else if(raw.planSettings)s=planRecordedExperiment(s,raw.planSettings);
 if(raw.selection!==undefined){
  insist(object(raw.selection)&&Object.keys(raw.selection).every(k=>['selectedModelId','selectedRunId','positionTolerance'].includes(k)),'Invalid selected view.','invalid_history');
  const notebook=JSON.parse(exportChallenge(s.current));Object.assign(notebook,raw.selection);
  const restored=restoreChallenge(JSON.stringify(notebook));
  insist(canonical(restored.bundle)===canonical(s.current.bundle)&&canonical(restored.options)===canonical(s.current.options),'Selection cannot alter evidence or fitting settings.','invalid_history');
  s.current.selectedModelId=restored.selectedModelId;s.current.selectedRunId=restored.selectedRunId;s.current.positionTolerance=restored.positionTolerance;
 }
 return register(s);
}

export function isRecordedExperiment(session){return session?.schema===RECORDED_EXPERIMENT_SCHEMA;}
export function exportRecordedRequest(s){
 check(s);insist(s.plan?.selected,'Plan a release before exporting its request.','no_proposal');
 return JSON.stringify({schema:'worldlaw.recorded-trajectory-request/v1',units:RUN_UNITS,contextKey:context(s),planId:s.plan.id,settings:clone(s.plan.options),request:{...clone(s.plan.selected.acquisitionRequest),inertia:s.plan.options.inertia,command:s.plan.options.command},trainingSource:s.current.bundle.trainingRuns.map(r=>({id:r.id,recordingId:r.source.recordingId??null})),meaning:'Input-only proposed conditions. Not an acquisition, source authentication or physical-safety authorization.'},null,2);
}
export function refitRecordedExperiment(s,options){
 check(s);insist(!s.acquisition,'Apply or explicitly discard pending recorded evidence before changing the fit.','pending_evidence');
 insist(object(options),'Supply fitting options.','invalid_options');
 const current=createChallenge(s.current.bundle,options);supported(current);
 current.positionTolerance=s.current.positionTolerance;current.selectedRunId=s.current.selectedRunId;
 return register({...s,current,history:[...s.history,{type:'refit',options:clone(current.options)}],plan:null,acquisition:null,latestAcquisition:null,numericalQualification:null,comparison:null});
}
