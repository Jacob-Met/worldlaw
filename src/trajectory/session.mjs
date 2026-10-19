/** Training-only model selection followed by a separate receiving experiment. */
import {discover} from '../science/torque-discovery.mjs';
import {deriveTorqueObservations} from '../science/trajectory-observations.mjs';
import {discoverIntegral} from './integral-discovery.mjs';
import {rolloutWithResolution} from './resolution.mjs';
import {validateBundle,MAX_TEXT_LENGTH,TrajectoryDataError} from './data.mjs';
export const CHALLENGE_SCHEMA='worldlaw.trajectory-challenge/v1';
export const NOTEBOOK_SCHEMA='worldlaw.trajectory-notebook/v1';
export const DEFAULT_OPTIONS=Object.freeze({method:'integral',noiseSigma:0.01,maxTerms:4,ambiguityDelta:6,maxStep:0.01,rateWindowSize:9,modelLimit:8});
function check(condition,message){if(!condition)throw new TrajectoryDataError(message,'invalid_options');}
export function normalizeOptions(raw={}){
  check(raw!==null&&typeof raw==='object'&&!Array.isArray(raw),'Discovery settings must be an object.');
  const result={...DEFAULT_OPTIONS};
  for(const key of Object.keys(DEFAULT_OPTIONS))if(raw[key]!==undefined)result[key]=raw[key];
  check(['integral','derivative'].includes(result.method),'Choose integral or derivative fitting.');
  check(typeof result.noiseSigma==='number'&&Number.isFinite(result.noiseSigma)&&result.noiseSigma>=1e-8&&result.noiseSigma<=1000,'Assumed residual noise must be between 0.00000001 and 1000.');
  check(Number.isInteger(result.maxTerms)&&result.maxTerms>=0&&result.maxTerms<=7,'The term limit must be an integer from 0 to 7.');
  check(typeof result.ambiguityDelta==='number'&&Number.isFinite(result.ambiguityDelta)&&result.ambiguityDelta>=0&&result.ambiguityDelta<=100,'The ambiguity threshold must be from 0 to 100.');
  check(typeof result.maxStep==='number'&&Number.isFinite(result.maxStep)&&result.maxStep>=1e-5&&result.maxStep<=0.1,'The solver step must be from 0.00001 to 0.1 seconds.');
  check(Number.isInteger(result.rateWindowSize)&&result.rateWindowSize>=5&&result.rateWindowSize<=31&&result.rateWindowSize%2===1,'The derivative window must be an odd integer from 5 to 31.');
  check(Number.isInteger(result.modelLimit)&&result.modelLimit>=1&&result.modelLimit<=8,'Compare between 1 and 8 models.');
  return result;
}
function fitTraining(bundle,options){
  const shared={noiseSigma:options.noiseSigma,maxTerms:options.maxTerms,ambiguityDelta:options.ambiguityDelta};
  if(options.method==='integral')return discoverIntegral(bundle.trainingRuns,{...shared,rateWindowSize:options.rateWindowSize});
  const derived=bundle.trainingRuns.map(run=>deriveTorqueObservations(run.samples,{inertia:run.inertia,windowSize:options.rateWindowSize}));
  const observations=derived.flatMap(run=>run.observations);
  check(observations.length<=4096,'Derivative fitting supports at most 4096 derived training rows; shorten the training runs.');
  const discovery=discover(observations,shared);
  return {...discovery,method:'local_cubic_second_derivative',residualUnits:'N·m',noiseSigmaUnits:'N·m',diagnostics:{...discovery.diagnostics,derivation:derived.map((d,i)=>({runId:bundle.trainingRuns[i].id,...d.diagnostics})),fitData:'training_runs_only'}};
}
function summary(discovery,results,bundle,options){
  const received=results.filter(r=>r.modelId===discovery.selected.id&&r.status==='ok');
  const count=received.reduce((s,r)=>s+r.rollout.metrics.count,0);
  const selectedRMSE=count?Math.sqrt(received.reduce((s,r)=>s+r.rollout.metrics.count*r.rollout.metrics.positionRMSE**2,0)/count):null;
  return {trainingRunCount:bundle.trainingRuns.length,challengeRunCount:bundle.challengeRuns.length,
    trainingSampleCount:bundle.trainingRuns.reduce((s,r)=>s+r.samples.length,0),challengeSampleCount:bundle.challengeRuns.reduce((s,r)=>s+r.samples.length,0),
    fittedModelCount:discovery.candidates.length,comparedModelCount:new Set(results.map(r=>r.modelId)).size,
    selectedPositionRMSE:selectedRMSE,completedChallengeRuns:received.length,failedRollouts:results.filter(r=>r.status==='failed').length,
    fitResidualUnits:options.method==='integral'?'rad':'N·m',selectionBasis:'training_evidence_only',
    evidenceKinds:[...new Set([...bundle.trainingRuns,...bundle.challengeRuns].map(r=>r.kind))],
    limitations:['Finite-library scalar models with caller-supplied constant inertia and initial velocity.',
      'Challenge observations do not enter fitting, ranking, or initial velocity estimation.',
      'Inspecting challenge errors and choosing settings is exploratory reuse, not a new blind validation.',
      'Source kinds and acquisition independence are declared by the input author, not authenticated.',
      'Numerical step error, calibration error and missing physical structure can all affect forward error.']};
}
export function createChallenge(rawBundle,rawOptions={}){
  const bundle=validateBundle(rawBundle), options=normalizeOptions(rawOptions);
  const discovery=fitTraining(bundle,options);
  // The entire candidate list remains in its training-derived order. Challenge
  // residuals are receiving evidence and never silently become a model selector.
  const models=discovery.candidates.slice(0,options.modelLimit);
  const results=[];
  for(const model of models)for(const run of bundle.challengeRuns){
    try{const received=rolloutWithResolution(model,run,{maxStep:options.maxStep,maxSteps:200000});results.push({modelId:model.id,runId:run.id,status:'ok',...received});}
    catch(error){results.push({modelId:model.id,runId:run.id,status:'failed',rollout:null,resolution:null,error:{code:error.code??'prediction_failed',message:error.message??String(error)}});}
  }
  return {schema:CHALLENGE_SCHEMA,bundle,options,discovery,results,selectedModelId:discovery.selected.id,
    selectedRunId:bundle.challengeRuns[0].id,positionTolerance:0.05,summary:summary(discovery,results,bundle,options)};
}
function selection(state){
  const modelId=state.selectedModelId??state.discovery.selected.id;
  const runId=state.selectedRunId??state.bundle.challengeRuns[0].id;
  const positionTolerance=state.positionTolerance??0.05;
  if(typeof positionTolerance!=='number'||!Number.isFinite(positionTolerance)||positionTolerance<=0||positionTolerance>1e6)throw new TrajectoryDataError('The displayed position tolerance must be positive and at most 1,000,000 radians.');
  if(!state.results.some(r=>r.modelId===modelId&&r.runId===runId))throw new TrajectoryDataError('The selected model/run is unavailable in this challenge.');
  return {selectedModelId:modelId,selectedRunId:runId,positionTolerance};
}
export function exportChallenge(state){
  if(state?.schema!==CHALLENGE_SCHEMA)throw new TrajectoryDataError('Expected an evaluated trajectory challenge.');
  const selected=selection(state);
  const raw={schema:NOTEBOOK_SCHEMA,bundle:validateBundle(state.bundle),options:normalizeOptions(state.options),...selected};
  const text=JSON.stringify(raw,null,2);
  if(text.length>MAX_TEXT_LENGTH)throw new TrajectoryDataError('The notebook exceeds the 3 MB portable limit.');
  return text;
}
export function restoreChallenge(text){
  if(typeof text!=='string'||text.length>MAX_TEXT_LENGTH)throw new TrajectoryDataError('Notebook files must be JSON smaller than 3 MB.');
  let raw;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new TrajectoryDataError('The notebook JSON could not be read.');}
  if(raw?.schema==='worldlaw.trajectory-bundle/v1')return createChallenge(raw);
  if(raw?.schema!==NOTEBOOK_SCHEMA)throw new TrajectoryDataError('Unsupported trajectory notebook.');
  const state=createChallenge(raw.bundle,raw.options);
  if(raw.selectedModelId!==undefined)state.selectedModelId=raw.selectedModelId;
  if(raw.selectedRunId!==undefined)state.selectedRunId=raw.selectedRunId;
  if(raw.positionTolerance!==undefined)state.positionTolerance=raw.positionTolerance;
  selection(state);
  return state;
}
