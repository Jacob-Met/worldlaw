import {discoverWeak} from './weak-discovery.mjs';
import {compareTrajectorySkill} from './baselines.mjs';
/** Training-only model selection followed by a separate receiving experiment. */
import {discover, DEFAULT_TERMS} from '../science/torque-discovery.mjs';
import {deriveTorqueObservations} from '../science/trajectory-observations.mjs';
import {discoverIntegral} from './integral-discovery.mjs';
import {rolloutWithResolution} from './resolution.mjs';
import {ANGULAR_BUNDLE_SCHEMA,normalizeAngularBundle,discoverAngular} from './angular-discovery.mjs';
import {discoverAngularWeak} from './angular-weak.mjs';
import {rolloutAngularWithResolution} from './angular-resolution.mjs';
import {validateBundle,MAX_TEXT_LENGTH,TrajectoryDataError} from './data.mjs';
export const CHALLENGE_SCHEMA='worldlaw.trajectory-challenge/v1';
export const NOTEBOOK_SCHEMA='worldlaw.trajectory-notebook/v1';
export const INTERACTION_NOTEBOOK_SCHEMA='worldlaw.trajectory-notebook/v2';
export const DIRECTIONAL_NOTEBOOK_SCHEMA='worldlaw.trajectory-notebook/v3';
export const DEFAULT_OPTIONS=Object.freeze({method:'integral',noiseSigma:0.01,maxTerms:4,ambiguityDelta:6,maxStep:0.01,rateWindowSize:9,modelLimit:8});
const ANGULAR_DEFAULT_OPTIONS=Object.freeze({...DEFAULT_OPTIONS,windowDuration:1,windowStride:0.5});
const angularBundle=bundle=>bundle?.schema===ANGULAR_BUNDLE_SCHEMA;
const normalizeBundle=bundle=>angularBundle(bundle)?normalizeAngularBundle(bundle):validateBundle(bundle);
function check(condition,message){if(!condition)throw new TrajectoryDataError(message,'invalid_options');}
export function normalizeOptions(raw={}, {angular=false}={}){
  check(raw!==null&&typeof raw==='object'&&!Array.isArray(raw),'Discovery settings must be an object.');
  const defaults=angular||raw.method==='weak'?ANGULAR_DEFAULT_OPTIONS:DEFAULT_OPTIONS;
  const result={...defaults};
  for(const key of Object.keys(defaults))if(raw[key]!==undefined)result[key]=raw[key];
  check((angular?['integral','weak']:['integral','derivative','weak']).includes(result.method),angular?'Choose cumulative integral or compact-window weak fitting for angular evidence.':'Choose integral, derivative or compact-window weak fitting for known-inertia torque evidence.');
  check(typeof result.noiseSigma==='number'&&Number.isFinite(result.noiseSigma)&&result.noiseSigma>=1e-8&&result.noiseSigma<=1000,'Assumed residual noise must be between 0.00000001 and 1000.');
  check(Number.isInteger(result.maxTerms)&&result.maxTerms>=0&&result.maxTerms<=(angular?6:7),`The term limit must be an integer from 0 to ${angular?6:7}.`);
  check(typeof result.ambiguityDelta==='number'&&Number.isFinite(result.ambiguityDelta)&&result.ambiguityDelta>=0&&result.ambiguityDelta<=100,'The ambiguity threshold must be from 0 to 100.');
  check(typeof result.maxStep==='number'&&Number.isFinite(result.maxStep)&&result.maxStep>=1e-5&&result.maxStep<=0.1,'The solver step must be from 0.00001 to 0.1 seconds.');
  check(Number.isInteger(result.rateWindowSize)&&result.rateWindowSize>=5&&result.rateWindowSize<=31&&result.rateWindowSize%2===1,'The derivative window must be an odd integer from 5 to 31.');
  check(Number.isInteger(result.modelLimit)&&result.modelLimit>=1&&result.modelLimit<=8,'Compare between 1 and 8 models.');
  if(angular||result.method==='weak'){
    check(typeof result.windowDuration==='number'&&Number.isFinite(result.windowDuration)&&result.windowDuration>=0.02&&result.windowDuration<=60,'The weak fitting window must be from 0.02 to 60 seconds.');
    check(typeof result.windowStride==='number'&&Number.isFinite(result.windowStride)&&result.windowStride>=0.01&&result.windowStride<=result.windowDuration,'The weak window stride must be from 0.01 seconds through the window duration.');
  }
  if(raw.commandPositionInteraction!==undefined){
    check(typeof raw.commandPositionInteraction==='boolean','commandPositionInteraction must be boolean.');
    check(!raw.commandPositionInteraction||(!angular&&result.method==='weak'),'Command-position interaction requires known-inertia weak fitting.');
    result.commandPositionInteraction=raw.commandPositionInteraction;
  }
  if(raw.directionalQuadraticLoss!==undefined){
    check(typeof raw.directionalQuadraticLoss==='boolean','directionalQuadraticLoss must be boolean.');
    check(!raw.directionalQuadraticLoss||(!angular&&result.method==='weak'),'Directional quadratic loss requires known-inertia weak fitting.');
    result.directionalQuadraticLoss=raw.directionalQuadraticLoss;
  }
  return result;
}
function fitTraining(bundle,options){
  const shared={noiseSigma:options.noiseSigma,maxTerms:options.maxTerms,ambiguityDelta:options.ambiguityDelta};
  if(angularBundle(bundle)){
    if(options.method==='weak')return discoverAngularWeak(bundle.trainingRuns,{...shared,rateWindowSize:options.rateWindowSize,windowDuration:options.windowDuration,windowStride:options.windowStride});
    return discoverAngular(bundle.trainingRuns,{...shared,rateWindowSize:options.rateWindowSize});
  }
  if(options.method==='weak')return discoverWeak(bundle.trainingRuns,{...shared,...((options.commandPositionInteraction||options.directionalQuadraticLoss)?{terms:[...DEFAULT_TERMS,...(options.commandPositionInteraction?['command_position']:[]),...(options.directionalQuadraticLoss?['rate_squared']:[])]} : {}),rateWindowSize:options.rateWindowSize,windowDuration:options.windowDuration,windowStride:options.windowStride});
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
  let predictionSkill;
  try {predictionSkill=compareTrajectorySkill(bundle.challengeRuns,results,discovery.selected.id);}
  catch(error){predictionSkill={status:'unavailable',reason:error.message};}
  return {predictionSkill,trainingRunCount:bundle.trainingRuns.length,challengeRunCount:bundle.challengeRuns.length,
    trainingSampleCount:bundle.trainingRuns.reduce((s,r)=>s+r.samples.length,0),challengeSampleCount:bundle.challengeRuns.reduce((s,r)=>s+r.samples.length,0),
    fittedModelCount:discovery.candidates.length,comparedModelCount:new Set(results.map(r=>r.modelId)).size,
    selectedPositionRMSE:received.length===bundle.challengeRuns.length?selectedRMSE:null,completedChallengeRuns:received.length,failedRollouts:results.filter(r=>r.status==='failed').length,
    fitResidualUnits:discovery.residualUnits??(options.method==='integral'?'rad':'N·m'),selectionBasis:'training_evidence_only',
    evidenceKinds:[...new Set([...bundle.trainingRuns,...bundle.challengeRuns].map(r=>r.kind))],
    limitations:[angularBundle(bundle)?'Finite-library angular-acceleration models; physical inertia and absolute torque remain unknown.':'Finite-library scalar models with caller-supplied constant inertia and initial velocity.',
      ...(angularBundle(bundle)?['Unforced scalar rotation is a declared assumption; absent actuator data cannot verify it.','A supplied initial angular rate is used for prediction. Compact-window weak fitting does not use that rate.']:[]),
      'Challenge observations do not enter fitting, ranking, or initial velocity estimation.',
      'Inspecting challenge errors and choosing settings is exploratory reuse, not a new blind validation.',
      'Source kinds and acquisition independence are declared by the input author, not authenticated.',
      'Numerical step error, calibration error and missing physical structure can all affect forward error.']};
}
export function createChallenge(rawBundle,rawOptions={}){
  const bundle=normalizeBundle(rawBundle), angular=angularBundle(bundle), options=normalizeOptions(rawOptions,{angular});
  const discovery=fitTraining(bundle,options);
  // The entire candidate list remains in its training-derived order. Challenge
  // residuals are receiving evidence and never silently become a model selector.
  const models=discovery.candidates.slice(0,options.modelLimit);
  const results=[];
  for(const model of models)for(const run of bundle.challengeRuns){
    try{const receive=angular?rolloutAngularWithResolution:rolloutWithResolution;const received=receive(model,run,{maxStep:options.maxStep,maxSteps:200000});results.push({modelId:model.id,runId:run.id,status:'ok',...received});}
    catch(error){results.push({modelId:model.id,runId:run.id,status:'failed',rollout:null,resolution:null,error:{code:error.code??'prediction_failed',message:error.message??String(error)}});}
  }
  return {schema:CHALLENGE_SCHEMA,bundle,options,supportedMethods:angular?['integral','weak']:['integral','derivative','weak'],discovery,results,selectedModelId:discovery.selected.id,
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
  const bundle=normalizeBundle(state.bundle);
  const raw={schema:state.options.directionalQuadraticLoss?DIRECTIONAL_NOTEBOOK_SCHEMA:state.options.commandPositionInteraction?INTERACTION_NOTEBOOK_SCHEMA:NOTEBOOK_SCHEMA,bundle,options:normalizeOptions(state.options,{angular:angularBundle(bundle)}),...selected};
  const text=JSON.stringify(raw,null,2);
  if(text.length>MAX_TEXT_LENGTH)throw new TrajectoryDataError('The notebook exceeds the 3 MB portable limit.');
  return text;
}
export function restoreChallenge(text){
  if(typeof text!=='string'||text.length>MAX_TEXT_LENGTH)throw new TrajectoryDataError('Notebook files must be JSON smaller than 3 MB.');
  let raw;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new TrajectoryDataError('The notebook JSON could not be read.');}
  if(raw?.schema==='worldlaw.trajectory-bundle/v1'||raw?.schema===ANGULAR_BUNDLE_SCHEMA)return createChallenge(raw);
  if(![NOTEBOOK_SCHEMA,INTERACTION_NOTEBOOK_SCHEMA,DIRECTIONAL_NOTEBOOK_SCHEMA].includes(raw?.schema))throw new TrajectoryDataError('Unsupported trajectory notebook.');
  if(raw.schema===DIRECTIONAL_NOTEBOOK_SCHEMA&&raw.options?.directionalQuadraticLoss!==true)throw new TrajectoryDataError('Version 3 requires the explicit directional quadratic loss declaration.');
  if(raw.schema!==DIRECTIONAL_NOTEBOOK_SCHEMA&&raw.options?.directionalQuadraticLoss===true)throw new TrajectoryDataError('Directional quadratic loss requires a version 3 notebook.');
  if(raw.schema===INTERACTION_NOTEBOOK_SCHEMA&&raw.options?.commandPositionInteraction!==true)throw new TrajectoryDataError('Version 2 requires the explicit command-position interaction declaration.');
  if(raw.schema===NOTEBOOK_SCHEMA&&raw.options?.commandPositionInteraction===true)throw new TrajectoryDataError('Command-position interaction requires a version 2 notebook.');
  const state=createChallenge(raw.bundle,raw.options);
  if(raw.selectedModelId!==undefined)state.selectedModelId=raw.selectedModelId;
  if(raw.selectedRunId!==undefined)state.selectedRunId=raw.selectedRunId;
  if(raw.positionTolerance!==undefined)state.positionTolerance=raw.positionTolerance;
  selection(state);
  return state;
}


