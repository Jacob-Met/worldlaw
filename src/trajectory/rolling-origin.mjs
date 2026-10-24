/** Conditional repeated-origin measurement challenge; never a model selector. */
import {normalizeAngularRuns,AngularDataError} from './angular-discovery.mjs';
import {fitAngularWindow} from '../science/angular-kinematics.mjs';
import {initialStateSensitivity} from './initial-state-sensitivity.mjs';
import {trajectoryBaselines} from './baselines.mjs';
const insist=(ok,message)=>{if(!ok)throw new AngularDataError(message,'invalid_rolling_origin');};
const finite=Number.isFinite;
const copy=x=>JSON.parse(JSON.stringify(x));
const uniqueIntegers=(a,max)=>Array.isArray(a)&&a.length>0&&a.length<=max&&new Set(a).size===a.length&&Array.from(a).every(Number.isSafeInteger);
export function rollingOriginChallenge(model,rawRun,requested={}){
 const [run]=normalizeAngularRuns([rawRun]);
 const options={origins:requested.origins,horizonSamples:requested.horizonSamples,windowSize:requested.windowSize??9,positionSigma:requested.positionSigma??null,maxStep:requested.maxStep??.01,numericalTolerance:requested.numericalTolerance??.001,maxTotalSteps:requested.maxTotalSteps??300000};
 insist(uniqueIntegers(options.origins,64)&&uniqueIntegers(options.horizonSamples,8)&&options.origins.length*options.horizonSamples.length<=96,'Declare unique integer origins and sample horizons, at most 96 origin/horizon pairs.');
 insist(Number.isInteger(options.windowSize)&&options.windowSize>=5&&options.windowSize<=31&&options.windowSize%2===1,'Declare an odd prelude window from 5 through 31 samples.');
 insist(options.positionSigma===null||(finite(options.positionSigma)&&options.positionSigma>=0&&options.positionSigma<=1e6),'Position noise must be null or a bounded nonnegative radian scale.');
 insist(options.origins.every(i=>i>=options.windowSize-1)&&options.horizonSamples.every(n=>n>=1&&n<=1000),'Every origin needs its complete preceding window; horizons must be 1–1000 samples.');
 insist(options.origins.every(i=>options.horizonSamples.every(n=>i+n<run.samples.length)),'Every declared origin/horizon must have its complete receiving window.');
 insist(finite(options.maxStep)&&options.maxStep>=1e-5&&options.maxStep<=.1&&finite(options.numericalTolerance)&&options.numericalTolerance>=1e-12&&options.numericalTolerance<=100,'Declare bounded solver step and numerical tolerance.');
 insist(Number.isSafeInteger(options.maxTotalSteps)&&options.maxTotalSteps>=1&&options.maxTotalSteps<=1000000,'Combined integration budget must be 1–1000000.');
 const pairs=options.origins.flatMap(origin=>options.horizonSamples.map(horizon=>{
  const samples=run.samples.slice(origin,origin+horizon+1);
  const steps=samples.slice(1).reduce((sum,row,i)=>{const dt=row.time-samples[i].time;return sum+Math.max(1,Math.ceil(dt/options.maxStep))+Math.max(1,Math.ceil(dt/(options.maxStep/2)));},0);
  return {origin,horizon,samples,steps};
 }));
 const reservedSteps=pairs.reduce((sum,p)=>sum+p.steps,0);
 insist(Number.isSafeInteger(reservedSteps)&&reservedSteps<=options.maxTotalSteps,'Complete rolling-origin comparison exceeds the combined integration budget.');
 const rates=new Map(options.origins.map(origin=>{
  try{return [origin,{status:'estimated',...fitAngularWindow(run.samples.slice(origin-options.windowSize+1,origin+1),run.samples[origin],options.positionSigma)}];}
  catch(error){return [origin,{status:'unavailable',reason:error.message}];}
 }));
 const trials=pairs.map(({origin,horizon,samples,steps})=>{
  const prefix={startIndex:origin-options.windowSize+1,endIndex:origin,startTime:run.samples[origin-options.windowSize+1].time,endTime:samples[0].time};
  const base={originIndex:origin,horizonSamples:horizon,originTime:samples[0].time,endTime:samples.at(-1).time,duration:samples.at(-1).time-samples[0].time,prefix,rateEstimate:rates.get(origin),reservedSteps:steps};
  if(base.rateEstimate.status!=='estimated')return {...base,status:'rate_unavailable',forecast:null,receiving:null,baselines:null};
  const segment={...run,id:run.id,initialRate:base.rateEstimate.rate,samples};
  try{
   const report=initialStateSensitivity(model,segment,{maxStep:options.maxStep,numericalTolerance:options.numericalTolerance,maxTotalSteps:steps});
   const variant=report.forecasts.variants[0],baselines=trajectoryBaselines(segment);
   return {...base,status:variant.status,forecast:variant,receiving:report.receiving,baselines};
  }catch(error){return {...base,status:'failed',reason:error.message,forecast:null,receiving:null,baselines:null};}
 });
 const summaries=options.horizonSamples.map(horizon=>{
  const population=trials.filter(t=>t.horizonSamples===horizon),complete=population.every(t=>t.status==='screened');
  const pairedRMSE=key=>complete?Math.hypot(...population.map(t=>key==='model'?t.receiving.scores[0].rmse:t.baselines.find(b=>b.id===key).positionRMSE))/Math.sqrt(population.length):null;
  const modelRMSE=pairedRMSE('model'),baselines=['persistence','initial_rate'].map(id=>{const rmse=pairedRMSE(id),skill=complete&&rmse>0?1-(modelRMSE/rmse)**2:null;return {id,rmse,skill:finite(skill)?skill:null,skillStatus:!complete?'incomplete_model':rmse===0?'perfect_baseline':finite(skill)?'available':'numerical_range'};});
  return {horizonSamples:horizon,origins:population.length,status:complete?'complete':'incomplete',failedOrigins:population.filter(t=>t.status!=='screened').map(t=>({originIndex:t.originIndex,status:t.status})),declaredPredictionCount:population.length*horizon,screenedPredictionCount:population.filter(t=>t.status==='screened').length*horizon,modelRMSE,baselines};
 });
 return {schema:'worldlaw.rolling-origin/v1',model:copy(model),run:copy(run),options:copy(options),reservedSteps,trials,summaries,
  meaning:'The frozen law is repeatedly initialized from each declared measured prefix. These are conditional forecasts, not an original-start free trajectory or independent repeated experiments.',
  limitations:['No model, window or horizon is selected using receiving errors. Changing declarations after viewing results is exploratory reuse.','Later measurements may initialize later declared origins; they never initialize an earlier origin.','Overlapping windows reuse observations; aggregate counts do not imply independent evidence or calibrated confidence.','Conditional prefix noise excludes cubic bias, timestamp error and calibration uncertainty.','Numerical screening does not establish physical validity. Incomplete horizons suppress aggregate model and paired baseline scores; all declared trials remain visible.']};
}
export function exportRollingOrigin(result){
 insist(result?.schema==='worldlaw.rolling-origin/v1','Expected a rolling-origin investigation.');
 const text=JSON.stringify({schema:'worldlaw.rolling-origin-notebook/v1',model:result.model,run:result.run,options:result.options});insist(text.length<=3000000,'Rolling-origin notebook exceeds 3 MB.');return text;
}
export function reopenRollingOrigin(text){
 insist(typeof text==='string'&&text.length<=3000000,'Expected a bounded JSON notebook.');let raw;try{raw=JSON.parse(text);}catch{throw new AngularDataError('Invalid rolling-origin JSON.','invalid_rolling_origin');}
 insist(raw?.schema==='worldlaw.rolling-origin-notebook/v1','Unsupported rolling-origin notebook.');return rollingOriginChallenge(raw.model,raw.run,raw.options);
}
