/** Measurement -> explicit rate choice -> unchanged-law prediction with replay. */
import {estimateAngularPrelude} from '../science/angular-prelude.mjs';
import {normalizeAngularRuns,AngularDataError} from './angular-discovery.mjs';
import {initialStateSensitivity} from './initial-state-sensitivity.mjs';
const insist=(ok,message)=>{if(!ok)throw new AngularDataError(message,'invalid_prelude_investigation');};
const copy=value=>JSON.parse(JSON.stringify(value));
export function preparePrelude(raw,run,{windowSizes=[5,9,17,31],positionSigma=.001}={}){
 insist(raw&&raw.schema==='worldlaw.angular-prelude-input/v1','Expected worldlaw.angular-prelude-input/v1.');
 insist(raw.units?.time==='s'&&raw.units?.position==='rad','Prelude units must be seconds and radians.');
 insist(['measured','synthetic','unknown'].includes(raw.kind),'Declare prelude evidence kind.');
 insist(raw.source&&typeof raw.source.label==='string'&&raw.source.label.trim().length>0,'Declare a prelude source label.');
 const serialized=JSON.stringify(raw);insist(serialized.length<=200000,'Prelude input exceeds 200 KB.');
 const [normalizedRun]=normalizeAngularRuns([run]);
 insist(raw.targetRunId===normalizedRun.id,'Prelude targetRunId must match the selected challenge run.');
 insist(raw.kind===normalizedRun.kind,'Prelude evidence kind must match the target recording declaration.');
 if(normalizedRun.source.recordingId!==undefined||raw.source.recordingId!==undefined)
  insist(raw.source.recordingId===normalizedRun.source.recordingId,'Prelude and challenge must declare the same recording identity.');
 const estimate=estimateAngularPrelude(raw.samples,normalizedRun.samples[0],{windowSizes,positionSigma});
 return {input:copy(raw),estimate};
}
export function comparePrelude(model,run,input,options={}){
 const prepared=preparePrelude(input,run,options);
 insist(Number.isInteger(options.chosenWindowSize),'Choose one declared prelude window explicitly; no automatic ranking is performed.');
 const selected=prepared.estimate.estimates.find(e=>e.windowSize===options.chosenWindowSize);
 insist(selected?.status==='estimated','The chosen window must have an available estimate.');
 const originalRun=normalizeAngularRuns([run])[0];
 const derivedRun={...originalRun,initialRate:selected.rate};
 const settings={...options,windowSizes:prepared.estimate.settings.windowSizes,positionSigma:prepared.estimate.settings.positionSigma,
   positionHalfWidth:options.positionHalfWidth??0,rateHalfWidth:options.rateHalfWidth??0,maxStep:options.maxStep??.01};
 const maxTotalSteps=settings.maxTotalSteps??300000;
 insist(Number.isSafeInteger(maxTotalSteps)&&maxTotalSteps>=1&&maxTotalSteps<=1000000,'Prelude comparison budget must be 1–1000000 combined integration steps.');
 const perVariant=originalRun.samples.slice(1).reduce((sum,row,i)=>{const dt=row.time-originalRun.samples[i].time;return sum+Math.max(1,Math.ceil(dt/settings.maxStep))+Math.max(1,Math.ceil(dt/(settings.maxStep/2)));},0);
 const count=(settings.positionHalfWidth===0?1:3)*(settings.rateHalfWidth===0?1:3);
 const reservedSteps=perVariant*(count+1);
 insist(Number.isSafeInteger(reservedSteps)&&reservedSteps<=maxTotalSteps,'Original plus derived-start comparison exceeds the combined integration budget.');
 settings.maxTotalSteps=maxTotalSteps;
 const derived=initialStateSensitivity(model,derivedRun,{...settings,maxTotalSteps:perVariant*count});
 const original=initialStateSensitivity(model,originalRun,{...settings,positionHalfWidth:0,rateHalfWidth:0,maxTotalSteps:perVariant});
 return {schema:'worldlaw.prelude-comparison/v1',model:copy(model),originalRun,input:prepared.input,options:settings,
   estimate:prepared.estimate,reservedSteps,chosenWindowSize:selected.windowSize,originalRate:originalRun.initialRate,derivedRate:selected.rate,
   original,derived,interpretation:'An explicitly chosen pre-challenge measurement estimate changes prediction initialization only; the model, training rank and later observed angles are unchanged. Conditional sigma excludes approximation bias and is not used as an automatic grid width.'};
}
export function exportPreludeComparison(state){
 insist(state?.schema==='worldlaw.prelude-comparison/v1','Expected a prelude comparison.');
 const text=JSON.stringify({schema:'worldlaw.prelude-notebook/v1',model:state.model,run:state.originalRun,input:state.input,options:state.options},null,2);
 insist(text.length<=3000000,'Prelude notebook exceeds 3 MB.');return text;
}
export function reopenPreludeComparison(text){
 insist(typeof text==='string'&&text.length<=3000000,'Prelude notebook must be JSON smaller than 3 MB.');
 let raw;try{raw=JSON.parse(text);}catch{throw new AngularDataError('Invalid prelude notebook JSON.','invalid_prelude_investigation');}
 insist(raw?.schema==='worldlaw.prelude-notebook/v1','Unsupported prelude notebook.');
 return comparePrelude(raw.model,raw.run,raw.input,raw.options);
}
