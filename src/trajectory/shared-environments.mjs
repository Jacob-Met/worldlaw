/** Source-only, training-first angular comparison across explicit observed conditions. */
import {normalizeAngularRuns, normalizeAngularBundle, normalizeAngularForecastRun, rolloutAngular, ANGULAR_UNITS, ANGULAR_MODEL_UNITS} from './angular-discovery.mjs';
import {weakWindows, weakLocalRates} from './weak-operator.mjs';
import {compareAngularEnvironments, reserveEnvironmentComparison, ENVIRONMENT_TERMS, ENVIRONMENT_MODES, EnvironmentFitError} from './shared-environment-fit.mjs';

export const ENVIRONMENT_SETTINGS=Object.freeze({windowDuration:1,windowStride:0.5,rateWindowSize:9,noiseSigma:0.01,maxTerms:4,ambiguityDelta:6});
const weakOptions=Object.freeze({...ENVIRONMENT_SETTINGS,terms:ENVIRONMENT_TERMS});
export const ENVIRONMENT_PROTOCOL=Object.freeze({
  id:'worldlaw-shared-environments/2026-10-27.1',
  terms:[...ENVIRONMENT_TERMS],maxTerms:4,modes:[...ENVIRONMENT_MODES],
  sharedTerms:['spring','gravity','bias'],localTerms:['rate','coulomb','quadratic'],
  settings:{...ENVIRONMENT_SETTINGS},score:'n*log(max(weakRMSE^2,0.01^2))+k*log(n)',
  weighting:'complete normalized weak rows; overlap not whitened',
  maxStep:0.01,refinementMaxStep:0.005,maxStepsPerRun:200000,maxTotalIntegrationSteps:1000000
});
const generated=new WeakSet();
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const insist=(ok,message,code='invalid_environment_source')=>{if(!ok)throw new EnvironmentFitError(message,code);};
function text(x,label,max=120){
  insist(typeof x==='string'&&x.trim().length>0&&x.length<=max,label+' needs nonempty text of at most '+max+' characters.');
  return x.trim();
}
function units(value){
  insist(object(value)&&Object.keys(value).length===3&&Object.entries(ANGULAR_UNITS).every(([key,unit])=>value[key]===unit),
    'Declare exactly seconds, radians, and radians per second. No unit conversion is inferred.','unsupported_units');
}
function deepFreeze(value){
  if(value&&typeof value==='object'){if(!Object.isFrozen(value))Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}
  return value;
}
function distinctEvidence(runs){
  const ids=new Set(),recordings=new Set();
  for(const run of runs){
    insist(!ids.has(run.id),'Every recording role needs a globally distinct run ID.','shared_evidence');ids.add(run.id);
    const recording=text(run.source.recordingId,'Source recordingId',240);
    insist(!recordings.has(recording),'A declared source recording is reused.','shared_evidence');recordings.add(recording);
  }
  // Reuse the maintained full/subwindow-copy screen; no new independence claim.
  for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++)
    normalizeAngularBundle({schema:'worldlaw.angular-bundle/v1',units:ANGULAR_UNITS,trainingRuns:[runs[i]],challengeRuns:[runs[j]]});
}
function admitRawEnvironments(raw,role,minRuns,maxRuns){
  insist(object(raw),'Expected an environment source object.');units(raw.units);
  insist(Array.isArray(raw.environments)&&raw.environments.length>=2&&raw.environments.length<=4,'Declare 2–4 environments.');
  let runCount=0,sampleCount=0;const ids=new Set();
  for(const env of raw.environments){
    insist(object(env),'Each environment must be an object.');
    const id=text(env.id,'Environment ID');
    insist(!ids.has(id),'Environment IDs must be unique.');ids.add(id);
    insist(Array.isArray(env[role])&&env[role].length>=minRuns&&env[role].length<=maxRuns,
      'Each condition needs '+minRuns+'–'+maxRuns+' '+role+'.');
    runCount+=env[role].length;
    insist(runCount<=16,'At most 16 source runs are supported.','resource_limit');
    for(const run of env[role]){
      insist(object(run)&&Array.isArray(run.samples)&&run.samples.length>=17&&run.samples.length<=4096,
        'Every environment recording needs 17–4096 original samples.');
      sampleCount+=run.samples.length;
      insist(sampleCount<=8192,'At most 8192 samples per evidence role are supported.','resource_limit');
    }
  }
  return {runCount,sampleCount};
}
export function normalizeEnvironmentTraining(raw){
  insist(object(raw)&&raw.schema==='worldlaw.environment-bundle/v1','Expected worldlaw.environment-bundle/v1.','unsupported_schema');
  admitRawEnvironments(raw,'trainingRuns',2,4);
  insist(raw.challengeRuns===undefined&&raw.challengeSource===undefined,'Training input cannot contain challenge outcomes.','challenge_in_training');
  const environments=raw.environments.map(env=>{
    insist(env.challengeRuns===undefined,'Training environments cannot contain challenge outcomes.','challenge_in_training');
    return {id:text(env.id,'Environment ID'),label:text(env.label??env.id,'Environment label',240),trainingRuns:normalizeAngularRuns(env.trainingRuns)};
  });
  distinctEvidence(environments.flatMap(env=>env.trainingRuns));
  return {schema:raw.schema,label:text(raw.label??'Compare angular motion across declared conditions','Bundle label',240),units:{...ANGULAR_UNITS},environments};
}
export function normalizeEnvironmentChallenge(raw,trainingSource){
  insist(object(raw)&&raw.schema==='worldlaw.environment-challenge/v1','Expected worldlaw.environment-challenge/v1.','unsupported_schema');
  admitRawEnvironments(raw,'challengeRuns',1,2);
  insist(raw.trainingRuns===undefined,'Challenge input cannot replace training evidence.','invalid_evidence_role');
  const expected=new Set(trainingSource.environments.map(e=>e.id));
  insist(raw.environments.length===expected.size&&raw.environments.every(e=>expected.has(e.id.trim())),
    'Challenge conditions must exactly match the trained environments.','environment_mismatch');
  const environments=trainingSource.environments.map(training=>{
    const env=raw.environments.find(e=>e.id.trim()===training.id);
    insist(env.trainingRuns===undefined,'Challenge environments cannot contain training replacements.','invalid_evidence_role');
    return {id:training.id,label:training.label,challengeRuns:env.challengeRuns.map(normalizeAngularForecastRun)};
  });
  const training=trainingSource.environments.flatMap(e=>e.trainingRuns),challenges=environments.flatMap(e=>e.challengeRuns);
  distinctEvidence([...training,...challenges]);
  return {schema:raw.schema,label:text(raw.label??trainingSource.label,'Challenge label',240),units:{...ANGULAR_UNITS},environments};
}
export function makeEnvironmentAngularModel({candidateId='fixture',environmentId,terms}){
  return {schema:'worldlaw.angular-model/v1',id:candidateId+':'+environmentId,terms:terms.map(t=>({...t})),units:{...ANGULAR_MODEL_UNITS},
    physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',
    method:'complete_weak_environment_comparison'};
}
export function compareSharedEnvironments(raw){
  const source=normalizeEnvironmentTraining(raw);
  const planned=source.environments.map(env=>({env,runs:env.trainingRuns.map(run=>({run,
    metadata:weakWindows(run,weakOptions,null,insist,{onlyWindowMetadata:true})}))}));
  const windows=planned.reduce((sum,e)=>sum+e.runs.reduce((n,r)=>n+r.metadata.length,0),0);
  insist(planned.every(e=>e.runs.every(r=>r.metadata.length>0)),'Every declared recording must contribute complete weak windows.');
  const reservation=reserveEnvironmentComparison(source.environments.length,windows);
  const sampleCount=source.environments.reduce((sum,e)=>sum+e.trainingRuns.reduce((n,r)=>n+r.samples.length,0),0);
  const reservedLocalRateWork=sampleCount*9*(1+2*4+2*4*4);
  insist(reservedLocalRateWork<=4000000,'Local-rate preparation exceeds the complete work budget.','resource_limit');
  // All sample/window/matrix work is admitted before any local-rate or candidate QR.
  const prepared=planned.map(({env,runs})=>({
    id:env.id,label:env.label,trainingRunIds:env.trainingRuns.map(r=>r.id),
    rows:runs.flatMap(({run,metadata})=>{
      const rates=weakLocalRates(run,9,insist);
      const rows=weakWindows(run,weakOptions,rates,insist);
      insist(rows.length===metadata.length&&rows.every((row,i)=>row.firstIndex===metadata[i].firstIndex&&row.lastIndex===metadata[i].lastIndex),
        'Weak preparation changed the admitted support.','operator_support_changed');
      return rows.map(row=>({...row,runId:run.id}));
    })
  }));
  const result=compareAngularEnvironments(prepared,{makeAngularModel:makeEnvironmentAngularModel});
  insist(result.reservedWork===reservation.reservedWork,'Comparison reservation changed.','operator_support_changed');
  const comparison={...result,source,implementationProtocol:ENVIRONMENT_PROTOCOL,preparation:{settings:{...ENVIRONMENT_SETTINGS},completeRows:prepared,
    sampleCount,reservedLocalRateWork,localRateWorkLimit:4000000,
    weighting:'complete weak rows, each normalized by its position-noise gain; overlap not whitened',
    initialRateUse:'Supplied initial rate is preserved for rollout; weak coefficient fitting does not use it.'}};
  generated.add(comparison);return deepFreeze(comparison);
}

function reserveForecasts(runs,modeCount){
  let total=0;
  for(const {run} of runs)for(const maxStep of [0.01,0.005]){
    let required=0;
    for(let i=1;i<run.samples.length;i++){
      required+=Math.max(1,Math.ceil((run.samples[i].time-run.samples[i-1].time)/maxStep));
      insist(Number.isSafeInteger(required)&&required<=200000,'A forecast exceeds 200000 integration steps.','resource_limit');
    }
    total+=required*modeCount;
    insist(total<=1000000,'Complete forecast comparison exceeds 1000000 integration steps.','resource_limit');
  }
  return total;
}
function executeOne(model,run,maxStep){
  try {return {status:'executed',rollout:rolloutAngular(model,run,{maxStep,maxSteps:200000})};}
  catch(error){return {status:'failed',failureReason:error.message,failureCode:error.code??'execution_failure'};}
}
/** Evaluate frozen training-selected models; never calls coefficient fitting. */
export function evaluateSharedEnvironments(comparison,rawChallenge=null){
  insist(generated.has(comparison),'Evaluate a comparison computed from sources in this session; reopen sources to reconstruct it.','untrusted_comparison');
  const role=rawChallenge===null?'training':'challenge';
  const source=role==='training'?comparison.source:normalizeEnvironmentChallenge(rawChallenge,comparison.source);
  const evidence=source.environments.flatMap(env=>(role==='training'?env.trainingRuns:env.challengeRuns).map(run=>({environmentId:env.id,run})));
  const reservedSteps=reserveForecasts(evidence,ENVIRONMENT_MODES.length);
  const runs=evidence.map(({environmentId,run})=>({environmentId,run,forecasts:ENVIRONMENT_MODES.map(mode=>{
    const candidateId=comparison.bestByMode[mode],candidate=comparison.candidates.find(c=>c.id===candidateId);
    const model=candidate?.environmentModels.find(e=>e.environmentId===environmentId)?.model;
    if(!model)return {mode,candidateId,status:'failed',failureReason:'No executable training candidate for this condition.'};
    const base=executeOne(model,run,0.01),fine=executeOne(model,run,0.005);
    const refinement=fine.status==='executed'?{status:'executed',maxStep:0.005,metrics:fine.rollout.metrics,diagnostics:fine.rollout.diagnostics}:
      {status:'failed',maxStep:0.005,failureReason:fine.failureReason,failureCode:fine.failureCode};
    if(base.status==='executed'&&fine.status==='executed'){
      const differences=base.rollout.rows.map((row,i)=>row.predicted-fine.rollout.rows[i].predicted);
      refinement.predictionRMSDifference=Math.hypot(...differences)/Math.sqrt(differences.length);
      refinement.maximumPredictionDifference=Math.max(...differences.map(Math.abs));
    }
    return {mode,candidateId,...base,refinement};
  })}));
  return deepFreeze({schema:'worldlaw.environment-course/v1',role,source,reservedSteps,settings:{maxStep:0.01,refinementMaxStep:0.005},
    selection:'best within each sharing mode, fixed using training only',runs});
}
export function exportEnvironmentSources(comparison,challengeSource=null){
  insist(generated.has(comparison),'Fit training sources before exporting the comparison.','untrusted_comparison');
  const challenge=challengeSource===null?null:normalizeEnvironmentChallenge(challengeSource,comparison.source);
  return JSON.stringify({schema:'worldlaw.environment-notebook/v1',protocol:ENVIRONMENT_PROTOCOL,settings:{...ENVIRONMENT_SETTINGS},
    trainingSource:comparison.source,challengeSource:challenge},null,2);
}
function matchesProtocol(value,expected){
  if(Array.isArray(expected))return Array.isArray(value)&&value.length===expected.length&&expected.every((x,i)=>matchesProtocol(value[i],x));
  if(object(expected))return object(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>matchesProtocol(value[k],v));
  return value===expected;
}
export function readEnvironmentSources(serialized){
  insist(typeof serialized==='string'&&serialized.length<=4000000,'Source file must be JSON at most 4 MB.','resource_limit');
  let raw;try{raw=JSON.parse(serialized);}catch{throw new EnvironmentFitError('Could not parse source JSON.');}
  if(raw?.schema==='worldlaw.environment-bundle/v1')return {trainingSource:normalizeEnvironmentTraining(raw),challengeSource:null};
  insist(raw?.schema==='worldlaw.environment-notebook/v1','Open a training bundle or source-only environment notebook.','unsupported_schema');
  insist(matchesProtocol(raw.protocol,ENVIRONMENT_PROTOCOL),'Notebook protocol differs from this implementation; its results cannot be claimed as an identical replay.','unsupported_protocol');
  insist(object(raw.settings)&&Object.keys(raw.settings).length===Object.keys(ENVIRONMENT_SETTINGS).length&&
    Object.entries(ENVIRONMENT_SETTINGS).every(([key,value])=>raw.settings[key]===value),'Notebook settings do not match this fixed comparison protocol.','unsupported_settings');
  const trainingSource=normalizeEnvironmentTraining(raw.trainingSource);
  const challengeSource=raw.challengeSource===null?null:normalizeEnvironmentChallenge(raw.challengeSource,trainingSource);
  return {trainingSource,challengeSource};
}
