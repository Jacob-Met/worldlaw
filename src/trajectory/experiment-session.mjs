/** Plan → acquire independent synthetic evidence → explicitly refit → receive. */
import {createChallenge,exportChallenge,restoreChallenge,CHALLENGE_SCHEMA,NOTEBOOK_SCHEMA,INTERACTION_NOTEBOOK_SCHEMA,DIRECTIONAL_NOTEBOOK_SCHEMA} from './session.mjs';
import {validateRun,RUN_UNITS,MAX_TEXT_LENGTH,TrajectoryDataError} from './data.mjs';
import {planTrajectoryExperiment} from './planner.mjs';
import {acquireVirtualPendulum,VIRTUAL_PENDULUM_INSTRUMENT as INSTRUMENT} from './virtual-experiment.mjs';

export const EXPERIMENT_SCHEMA='worldlaw.trajectory-experiment/v1';
export const EXPERIMENT_HISTORY_SCHEMA='worldlaw.trajectory-experiment-history/v1';
const DEFAULT_SETTINGS={inertia:.8,command:0,bounds:{initialPosition:{min:-2.2,max:2.2},initialRate:{min:-.6,max:.6}},
  predictionBounds:{position:{min:-3.2,max:3.2},rate:{min:-8,max:8}},duration:8,sampleInterval:.04,
  positionCount:9,rateCount:3,maxModels:8,maxStep:.01,maxTotalSteps:250000,minDisagreement:.01};
const proofs=new WeakMap();
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
function fail(message,code='invalid_experiment'){throw new TrajectoryDataError(message,code);}
function insist(value,message,code){if(!value)fail(message,code);}
function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function fingerprint(value){
  const text=canonical(value);let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
  return 'experiment-'+hash.toString(16).padStart(8,'0');
}
function trainingContext(current){
  const d=current.discovery;
  return {trainingRuns:current.bundle.trainingRuns,options:current.options,selected:d.selected.id,
    candidates:d.candidates.map(m=>({id:m.id,terms:m.terms,metrics:m.metrics})),competitive:d.competitive.map(m=>m.id)};
}
function contextKey(current){return fingerprint(trainingContext(current));}
function fitInput(current){return canonical({bundle:current.bundle,options:current.options});}
function ledger(session){return canonical({base:session.base,history:session.history,plan:session.plan,
  acquisition:session.acquisition,evaluationRunId:session.evaluationRunId,comparison:session.comparison});}
function snapshot(current,runId){
  const model=current.discovery.selected,result=current.results.find(r=>r.modelId===model.id&&r.runId===runId);
  return {modelId:model.id,equation:model.equation,trainingRunCount:current.bundle.trainingRuns.length,
    trainingSampleCount:current.bundle.trainingRuns.reduce((n,r)=>n+r.samples.length,0),
    status:result?.status??'unavailable',positionRMSE:result?.status==='ok'?result.rollout.metrics.positionRMSE:null,
    rows:result?.status==='ok'?copy(result.rollout.rows):[],error:result?.error?copy(result.error):null};
}
function register(session){
  insist(session.current.bundle.challengeRuns.some(run=>run.id===session.evaluationRunId),
    'The reserved evaluation recording is missing from this experiment.','invalid_experiment');
  proofs.set(session,{input:fitInput(session.current),training:canonical(trainingContext(session.current)),
    ledger:ledger(session),
    snapshot:snapshot(session.current,session.evaluationRunId)});
  return session;
}
function checkSession(session){
  const proof=proofs.get(session);
  insist(session?.schema===EXPERIMENT_SCHEMA&&proof,'Use a created or reopened experiment session.','invalid_experiment');
  insist(proof.input===fitInput(session.current)&&proof.training===canonical(trainingContext(session.current)),
    'The fitted evidence or model revision changed. Recreate the experiment session before planning or acquiring.','stale_plan');
  insist(proof.ledger===ledger(session),
    'The plan or acquisition history changed outside its recorded transition. Plan again from a valid notebook.','stale_plan');
  return proof;
}
function capability(current){
  if(current.bundle.schema!=='worldlaw.trajectory-bundle/v1')return {available:false,reason:'The virtual release instrument is available for the controlled unforced pendulum example. These measured angular recordings have no connected acquisition instrument.'};
  const runs=[...current.bundle.trainingRuns,...current.bundle.challengeRuns];
  const compatible=runs.every(run=>run.kind==='synthetic'&&run.inertia===INSTRUMENT.inertia&&
    (run.source.generator==='scripts/generate-trajectory-fixtures-92be.mjs'||run.source.instrumentId===INSTRUMENT.id)&&
    run.source.oracle?.inertia===.8&&run.source.oracle?.rate===-.24&&run.source.oracle?.gravity===-2.2&&run.source.oracle?.bias===0&&
    run.samples.every(sample=>sample.command===0));
  return {available:compatible,reason:compatible?'':'Load the small-angle ambiguity example to acquire new releases from its independent virtual instrument. Other inputs do not identify a connected acquisition instrument.'};
}
function requireInstrument(session){const c=capability(session.current);insist(c.available,c.reason,'instrument_unavailable');}
export function createExperimentSession(challenge){
  insist(challenge?.schema===CHALLENGE_SCHEMA,'Start from an evaluated trajectory challenge.');
  // Recompute public input objects; a caller's cached model/receiving claim is not evidence.
  const base=JSON.parse(exportChallenge(challenge)),current=restoreChallenge(JSON.stringify(base));
  return register({schema:EXPERIMENT_SCHEMA,current,base,history:[],plan:null,acquisition:null,comparison:null,
    settings:copy(DEFAULT_SETTINGS),evaluationRunId:current.bundle.challengeRuns[0].id});
}
export function planNextExperiment(session,requestedSettings={}){
  checkSession(session);requireInstrument(session);
  insist(object(requestedSettings),'Run-design settings must be an object.','invalid_options');
  insist(!session.acquisition,'Apply the acquired evidence before planning another run, or start a new notebook.','pending_evidence');
  insist(session.current.bundle.trainingRuns.length<4,'This notebook already contains four training runs. Start a new explicitly selected evidence set for another experiment.','resource_limit');
  const settings={...copy(DEFAULT_SETTINGS),...copy(requestedSettings)};
  insist(Number.isInteger(settings.maxTotalSteps)&&settings.maxTotalSteps>0&&settings.maxTotalSteps<=250000,'The interactive planner supports a complete budget of at most 250,000 steps.','resource_limit');
  const planned=planTrajectoryExperiment(session.current.discovery,settings),key=contextKey(session.current);
  const plan={...planned,id:fingerprint({key,options:planned.options}),contextKey:key};
  return register({...session,plan,settings:copy(planned.options),acquisition:null});
}
function matchingProtocol(plan){
  insist(plan.options.inertia===INSTRUMENT.inertia&&plan.options.command===INSTRUMENT.command,
    'The planned inertia or command does not match the independent virtual instrument (0.8 kg·m², zero command).','instrument_mismatch');
  const request=plan.selected.acquisitionRequest;
  insist(request.initialPosition>=INSTRUMENT.allowedInitialPosition.min&&request.initialPosition<=INSTRUMENT.allowedInitialPosition.max&&
    request.initialRate>=INSTRUMENT.allowedInitialRate.min&&request.initialRate<=INSTRUMENT.allowedInitialRate.max&&
    request.duration>=INSTRUMENT.allowedDuration.min&&request.duration<=INSTRUMENT.allowedDuration.max&&
    request.sampleInterval>=INSTRUMENT.allowedSampleInterval.min&&request.sampleInterval<=INSTRUMENT.allowedSampleInterval.max,
    'The recommended release exceeds this virtual instrument\'s supported protocol. Narrow the design settings.','instrument_mismatch');
}
function retainedRuns(session){return [...session.current.bundle.trainingRuns,...session.current.bundle.challengeRuns,
  ...session.history.map(event=>event.run),...(session.acquisition?[session.acquisition.run]:[])];}
function freshSeed(runs){
  const used=new Set(runs.map(run=>run.source?.seed).filter(Number.isInteger));
  let seed=73001;
  while(used.has(seed))seed=(seed+7919)>>>0;
  return seed;
}
export function acquireNextExperiment(session,options={}){
  checkSession(session);requireInstrument(session);
  insist(object(options)&&Object.keys(options).every(k=>['seed','noiseSigma','contextKey'].includes(k)),'Acquisition options contain an unsupported field.','invalid_options');
  insist(!session.acquisition,'This planned run has already been acquired; apply its evidence before another acquisition.','repeated_evidence');
  insist(session.plan?.selected&&session.plan.status==='proposed','The planner has no informative executable recommendation.','no_proposal');
  insist(session.plan.contextKey===contextKey(session.current)&&(!options.contextKey||options.contextKey===session.plan.contextKey),'This recommendation belongs to another fitted revision.','stale_plan');
  matchingProtocol(session.plan);
  const runs=retainedRuns(session),request={...session.plan.selected.acquisitionRequest,seed:options.seed??freshSeed(runs),noiseSigma:options.noiseSigma??.00002};
  const rawRun=acquireVirtualPendulum(request,{existingRuns:runs});
  const run=validateRun(rawRun,{role:'training',inheritedUnits:RUN_UNITS});
  const acquisition={id:run.id,run,request,planSettings:copy(session.plan.options),planId:session.plan.id,contextKey:session.plan.contextKey};
  return register({...session,acquisition});
}
export function applyNextExperiment(session,options={}){
  const proof=checkSession(session);requireInstrument(session);
  insist(object(options),'Apply options must be an object.','invalid_options');
  insist(session.acquisition,'Acquire the proposed run before adding its evidence.','missing_acquisition');
  insist((!options.contextKey||options.contextKey===session.acquisition.contextKey)&&
    (!options.acquisitionId||options.acquisitionId===session.acquisition.id)&&session.acquisition.contextKey===contextKey(session.current),
    'The pending evidence belongs to a different fitted revision or acquisition.','stale_plan');
  const bundle=copy(session.current.bundle);bundle.trainingRuns.push(copy(session.acquisition.run));
  const current=createChallenge(bundle,session.current.options);
  current.positionTolerance=session.current.positionTolerance;
  current.selectedRunId=session.current.selectedRunId;
  const evaluationRun=current.bundle.challengeRuns.find(run=>run.id===session.evaluationRunId);
  const comparison={evaluationRunId:evaluationRun.id,evaluationLabel:evaluationRun.label,evaluationRun:copy(evaluationRun),
    before:copy(proof.snapshot),after:snapshot(current,evaluationRun.id),meaning:'Same reserved recording before and after training on separately acquired synthetic evidence. Inspecting it is exploratory reuse; a worse result is not reverted.'};
  const event={planSettings:copy(session.acquisition.planSettings),request:copy(session.acquisition.request),run:copy(session.acquisition.run)};
  return register({...session,current,history:[...session.history,event],plan:null,acquisition:null,comparison});
}
export function experimentView(session){
  checkSession(session);const c=capability(session.current);
  return {contextKey:contextKey(session.current),available:c.available,unavailableReason:c.reason,
    instrument:{id:INSTRUMENT.id,label:'Independent virtual pendulum · synthetic',kind:'synthetic'},settings:session.settings,
    plan:session.plan,acquisition:session.acquisition,comparison:session.comparison,
    notice:session.comparison?.after.status==='failed'?'The revised training leader failed its reserved challenge. The acquired evidence and failed revision remain applied.':null};
}
export function exportExperimentSession(session){
  checkSession(session);const raw=JSON.parse(exportChallenge(session.current));
  if(session.history.length||session.plan||session.acquisition){
    raw.experiment={schema:EXPERIMENT_HISTORY_SCHEMA,base:copy(session.base),history:copy(session.history),
      pending:session.acquisition?{planSettings:copy(session.acquisition.planSettings),request:copy(session.acquisition.request),run:copy(session.acquisition.run)}:null,
      planSettings:session.plan?copy(session.plan.options):null};
  }
  const text=JSON.stringify(raw,null,2);insist(text.length<=MAX_TEXT_LENGTH,'The evidence and experiment history exceed the 3 MB notebook limit.','resource_limit');return text;
}
function replayAcquisition(session,event,apply){
  insist(object(event)&&object(event.request)&&object(event.planSettings),'An experiment history event needs its design, request and source run.','invalid_history');
  let next=planNextExperiment(session,event.planSettings);
  next=acquireNextExperiment(next,{seed:event.request.seed,noiseSigma:event.request.noiseSigma});
  const normalized=validateRun(event.run,{role:'training',inheritedUnits:RUN_UNITS});
  const replayed=next.acquisition.run;
  const withoutPositions=run=>({...run,samples:run.samples.map(sample=>({...sample,position:0}))});
  // Engines may round elementary functions differently. Only recorded positions receive
  // a tight numerical interoperability allowance; provenance, clock and protocol stay exact.
  const positionsMatch=replayed.samples.length===normalized.samples.length&&replayed.samples.every((sample,i)=>
    Math.abs(sample.position-normalized.samples[i].position)<=64*Number.EPSILON*Math.max(1,Math.abs(sample.position),Math.abs(normalized.samples[i].position)));
  insist(canonical(next.acquisition.request)===canonical(event.request)&&
    canonical(withoutPositions(replayed))===canonical(withoutPositions(normalized))&&positionsMatch,
    'Recorded acquisition evidence does not match its declared independent instrument protocol.','invalid_history');
  // Preserve the supplied observations. Reopening validates a declared virtual protocol;
  // it neither authenticates a source nor replaces observations with local solver output.
  next=register({...next,acquisition:{...next.acquisition,run:normalized}});
  return apply?applyNextExperiment(next):next;
}
export function restoreExperimentSession(text){
  insist(typeof text==='string'&&text.length<=MAX_TEXT_LENGTH,'Notebook files must be JSON smaller than 3 MB.','resource_limit');
  let raw;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('The notebook JSON could not be read.');}
  if(!raw?.experiment)return createExperimentSession(restoreChallenge(text));
  insist([NOTEBOOK_SCHEMA,INTERACTION_NOTEBOOK_SCHEMA,DIRECTIONAL_NOTEBOOK_SCHEMA].includes(raw.schema)&&object(raw.experiment)&&raw.experiment.schema===EXPERIMENT_HISTORY_SCHEMA,'Unsupported experiment notebook.','invalid_history');
  const recipe=raw.experiment;
  insist(object(recipe.base)&&[NOTEBOOK_SCHEMA,INTERACTION_NOTEBOOK_SCHEMA,DIRECTIONAL_NOTEBOOK_SCHEMA].includes(recipe.base.schema)&&!recipe.base.experiment&&Array.isArray(recipe.history)&&recipe.history.length<=4,
    'Experiment history needs one nonrecursive base and at most four acquisitions.','invalid_history');
  let session=createExperimentSession(restoreChallenge(JSON.stringify(recipe.base)));
  for(const event of Array.from(recipe.history))session=replayAcquisition(session,event,true);
  if(recipe.pending)session=replayAcquisition(session,recipe.pending,false);
  else if(recipe.planSettings)session=planNextExperiment(session,recipe.planSettings);
  const outer=restoreChallenge(text);
  insist(fitInput(session.current)===fitInput(outer),'Current notebook evidence does not match its recomputed experiment history.','invalid_history');
  session.current.selectedModelId=outer.selectedModelId;session.current.selectedRunId=outer.selectedRunId;session.current.positionTolerance=outer.positionTolerance;
  return register(session);
}

