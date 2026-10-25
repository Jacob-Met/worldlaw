// Finite cross-probe hypotheses. Screening intervals are not confidence intervals.
import {validateNotebook,evaluateHistory,exportNotebook} from './paired-history.mjs';
export const PROBE_SCHEMA='worldlaw.probe-response/v1';
export const SATURATED_PROBE_SCHEMA='worldlaw.probe-response/v2';
export const PROBE_MODELS=Object.freeze([
 {id:'no-change',label:'No preparation response',units:'N·m',feature:()=>0},
 {id:'offset',label:'Constant torque offset',units:'N·m',feature:()=>1},
 {id:'drag',label:'Change proportional to rate',units:'N·m·s/rad',feature:p=>p.rate},
 {id:'restoring',label:'Change proportional to sin(angle)',units:'N·m',feature:p=>Math.sin(p.position)},
]);
export function probeModelForCandidate(candidate){
 const base=PROBE_MODELS.find(m=>m.id===candidate?.id);if(base)return base;
 const scale=candidate?.rateSaturationScale;
 if(typeof scale!=='number'||!Number.isFinite(scale)||scale<1e-6||scale>1e6||candidate.id!=='saturated-rate:'+scale)throw Error('Unknown declared probe feature.');
 return {id:candidate.id,label:'Saturated rate response ('+scale+' rad/s)',units:'N·m',rateSaturationScale:scale,feature:p=>Math.tanh(p.rate/scale)};
}
export function probeModelsFor(study){
 return [...PROBE_MODELS,...(study.rateSaturationScales??[]).map(scale=>({
  id:'saturated-rate:'+scale,label:'Saturated rate response ('+scale+' rad/s)',units:'N·m',
  rateSaturationScale:scale,feature:p=>Math.tanh(p.rate/scale),
 }))];
}
const fail=m=>{throw Error(m);};
const bounded=(x,b=1e6)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=b;
function identifier(x){if(typeof x!=='string'||!/^[a-zA-Z0-9_:-]{1,64}$/.test(x))fail('Use a short safe identifier.');return x;}
function preparation(p){
 if(!p||!bounded(p.duration,30)||p.duration<0||!bounded(p.recovery,30)||p.recovery<0)fail('Declare fixed preparation duration and recovery in seconds, from 0 to 30.');
 return {id:identifier(p.id),duration:p.duration,recovery:p.recovery};
}
export function validateProbeStudy(raw){
 if(!raw||![PROBE_SCHEMA,SATURATED_PROBE_SCHEMA].includes(raw.schema)||!Array.isArray(raw.runs)||raw.runs.length>24)fail('Expected a probe-response study with at most 24 runs.');
 const scales=raw.rateSaturationScales;
 if((raw.schema===SATURATED_PROBE_SCHEMA)!==(scales!==undefined))fail('Saturation declarations require the explicit probe-response/v2 schema.');
 if(scales!==undefined&&(!Array.isArray(scales)||scales.length<1||scales.length>3||Array.from(scales).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<.000001||v>1000000)||new Set(scales).size!==scales.length))fail('Declare 1–3 distinct saturation rates from 1e-6 to 1e6 rad/s.');
 const fixed=preparation(raw.preparation),ids=new Set(),prints=new Set(),readings=new Set(),sources=new Set();
 const runs=raw.runs.map(r=>{
  const id=identifier(r?.id);if(ids.has(id))fail('Run identifiers must be distinct.');ids.add(id);
  if(!['training','challenge'].includes(r.role))fail('Declare each run as training or challenge.');
  if(JSON.stringify(preparation(r.preparation))!==JSON.stringify(fixed))fail('All probe runs must declare the same preparation and recovery.');
  const n=validateNotebook(r.notebook);sources.add(n.source);
  if(n.simulation&&n.simulation.duration!==fixed.duration)fail('Virtual preparation duration does not match this study.');
  const probe={};for(const field of ['command','position','rate']){
   if(!bounded(r.probe?.[field]))fail('Declare finite command, position and rate for each probe.');probe[field]=r.probe[field];
   if(n.trials.some(t=>Math.abs(t[field]-probe[field])>1e-9))fail('Every trial must use the declared fixed probe state; mixed-state runs cannot estimate this response.');
  }
  // Pair labels and acquisition-order indices cannot disguise repeated torque evidence.
  const fingerprint=JSON.stringify(n.trials.map(t=>[t.history,t.command,t.position,t.rate,t.jointTorque]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(prints.has(fingerprint))fail('A recording cannot be reused across probe runs.');prints.add(fingerprint);
  const runReadings=new Set(n.trials.map(t=>JSON.stringify([t.history,t.command,t.position,t.rate,t.jointTorque])));
  if([...runReadings].some(key=>readings.has(key)))fail('Exact reading evidence overlaps another probe run; use separately acquired evidence.');
  for(const key of runReadings)readings.add(key);
  return {id,role:r.role,preparation:fixed,probe,notebook:JSON.parse(exportNotebook(n))};
 });
 if(sources.size>1)fail('Keep measured and synthetic probe investigations separate.');
 if(new Set(runs.map(r=>r.probe.command)).size>1)fail('Keep applied command fixed while investigating rate and angle response.');
 return {schema:raw.schema,preparation:fixed,runs,...(scales===undefined?{}:{rateSaturationScales:[...scales]})};
}
function constrain(interval,x,observed){
 if(x===0)return {interval,conflict:observed[0]>0||observed[1]<0};
 const ends=observed.map(v=>v/x).sort((a,b)=>a-b);
 const next=[Math.max(interval[0],ends[0]),Math.min(interval[1],ends[1])];
 return {interval:next,conflict:next[0]>next[1]};
}
export function fitProbeModels(raw){
 const study=validateProbeStudy(raw);
 if(study.runs.some(r=>r.role!=='training'))fail('Fit accepts training runs only.');
 const points=study.runs.map(r=>({...r,...evaluateHistory(r.notebook)}));
 const reasons=[];
 if(points.length<3||new Set(points.map(p=>JSON.stringify(p.probe))).size<2)reasons.push('Use at least three training runs spanning at least two probe states.');
 if(points.some(p=>p.order.status!=='counterbalanced'))reasons.push('Every training run needs at least four pairs in each acquisition order.');
 if(reasons.length)return {status:'insufficient-training',reasons,points,candidates:[]};
 const candidates=probeModelsFor(study).map(model=>{
  let interval=model.id==='no-change'?[0,0]:[-100,100],conflict=false;
  const exclusions=[];
  for(const p of points){const c=constrain(interval,model.feature(p.probe),p.interval);interval=c.interval;if(c.conflict){conflict=true;exclusions.push(p.id);}}
  const excited=model.id==='no-change'||points.some(p=>Math.abs(model.feature(p.probe))>1e-8);
  return {id:model.id,label:model.label,units:model.units,...(model.rateSaturationScale===undefined?{}:{rateSaturationScale:model.rateSaturationScale}),compatible:!conflict,excited,exclusions,coefficientInterval:conflict?null:interval,coefficientBounds:model.id==='no-change'?[0,0]:[-100,100]};
 });
 const count=candidates.filter(c=>c.compatible).length;
 return {status:count===0?'none-compatible':count===1?'single-offered-hypothesis':'ambiguous',reasons,points,candidates};
}
export function analyzeProbeStudy(raw){
 const study=validateProbeStudy(raw);
 const fit=fitProbeModels({...study,runs:study.runs.filter(r=>r.role==='training')});
 const challenges=study.runs.filter(r=>r.role==='challenge').map(r=>{
  const obs=evaluateHistory(r.notebook),qualified=obs.order.status==='counterbalanced';
  const predictions=fit.candidates.filter(c=>c.compatible).map(c=>{
   const x=probeModelsFor(study).find(m=>m.id===c.id).feature(r.probe);
   const interval=c.coefficientInterval.map(v=>v*x).sort((a,b)=>a-b);
   return {id:c.id,interval,status:!qualified?'order-confounded':interval[0]>obs.interval[1]||interval[1]<obs.interval[0]?'contradicted':'compatible'};
  });
  return {id:r.id,probe:r.probe,source:r.notebook.source,observed:obs.decisionDifference,interval:obs.interval,qualified,predictions};
 });
 const jointChallenges=fit.candidates.filter(c=>c.compatible).map(c=>{
  let interval=[...c.coefficientInterval],conflict=false;
  for(const p of challenges.filter(p=>p.qualified)){const x=probeModelsFor(study).find(m=>m.id===c.id).feature(p.probe),next=constrain(interval,x,p.interval);interval=next.interval;conflict ||= next.conflict;}
  return {id:c.id,status:!challenges.length?'untested':conflict?'contradicted':challenges.some(p=>!p.qualified)?'incomplete':'compatible'};
 });
 return {fit,challenges,jointChallenges,source:study.runs[0]?.notebook.source??null,
  interpretation:(study.rateSaturationScales?'Finite constant, rate, sine and explicitly declared saturated-rate hypotheses; the discrete rate scales are not a continuously identified time or velocity law. ':'Finite constant, rate and sine response hypotheses only. ')+'Conditional on fixed declared preparation. Bounds are heuristic screens, not calibrated confidence. Compatibility does not identify hidden memory, drag, restoring forces or causality; mixed effects and instrument artifacts remain possible.'};
}
export function exportProbeStudy(raw){return JSON.stringify(validateProbeStudy(raw),null,2)+'\n';}
export function importProbeStudy(text){
 if(typeof text!=='string'||text.length>4000000)fail('Use probe JSON below 4 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid probe study JSON.');}return validateProbeStudy(raw);
}
