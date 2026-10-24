// Finite set-membership hypotheses, not calibrated confidence or causal inference.
import {validateNotebook,evaluateHistory,exportNotebook} from './paired-history.mjs';
export const DURATION_SCHEMA='worldlaw.duration-response/v1';
export const TIME_CONSTANTS=Object.freeze([.2,.4,.8,1.3,2,4,8]);
const fail=m=>{throw new Error(m);};
const bounded=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const shape=(family,t,tau)=>family==='memoryless'?0:family==='constant'?1:-Math.expm1(-t/tau);
export function validateDurationStudy(raw){
 if(!raw||raw.schema!==DURATION_SCHEMA||!Array.isArray(raw.runs)||raw.runs.length>24)fail('Expected a duration study with at most 24 runs.');
 const ids=new Set(),fingerprints=new Set(),sources=new Set(),virtualSeeds=new Set();
 const runs=raw.runs.map(run=>{
  if(!run||typeof run.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(run.id)||ids.has(run.id))fail('Run ids must be distinct safe identifiers.');
  ids.add(run.id);
  if(!['training','challenge'].includes(run.role)||!bounded(run.duration,0,30))fail('Declare training/challenge and duration from 0 to 30 seconds.');
  const n=validateNotebook(run.notebook);sources.add(n.source);
  if(n.simulation&&n.simulation.duration!==run.duration)fail('Declared duration differs from virtual acquisition duration.');
  if(n.simulation){
   if(virtualSeeds.has(n.simulation.seed))fail('Use a fresh virtual seed for each separate duration acquisition.');
   virtualSeeds.add(n.simulation.seed);
  }
  // Ignore pair labels and input order when detecting exact recycled observations.
  const fingerprint=JSON.stringify(n.trials.map(({pairId,...row})=>row).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(fingerprints.has(fingerprint))fail('A recording cannot be reused as another training or challenge run.');
  fingerprints.add(fingerprint);
  return {id:run.id,role:run.role,duration:run.duration,notebook:JSON.parse(exportNotebook(n))};
 });
 if(sources.size>1)fail('Keep measured and synthetic duration investigations separate.');
 return {schema:DURATION_SCHEMA,runs};
}
export function fitDurationModels(training){
 const study=validateDurationStudy({schema:DURATION_SCHEMA,runs:training});
 if(study.runs.some(r=>r.role!=='training'))fail('Fitting accepts training runs only.');
 const points=study.runs.map(r=>({id:r.id,duration:r.duration,...evaluateHistory(r.notebook)}));
 const reasons=[];
 if(points.length<3||new Set(points.map(p=>p.duration)).size<3)reasons.push('At least three distinct training durations are required.');
 if(points.some(p=>p.order.status!=='counterbalanced'))reasons.push('Every training run needs at least four pairs in each acquisition order.');
 if(reasons.length)return {status:'insufficient-training',reasons,points,candidates:[]};
 const specs=[{family:'memoryless',tau:null},{family:'constant',tau:null},...TIME_CONSTANTS.map(tau=>({family:'saturation',tau}))];
 const candidates=specs.map(({family,tau})=>{
  let low=family==='memoryless'?0:-100,high=family==='memoryless'?0:100;
  const exclusions=[];
  for(const p of points){
   const x=shape(family,p.duration,tau),a=p.decisionDifference-p.boundary,b=p.decisionDifference+p.boundary;
   if(x===0){if(a>0||b<0)exclusions.push(p.id);}
   else{low=Math.max(low,a/x);high=Math.min(high,b/x);}
  }
  const compatible=!exclusions.length&&low<=high;
  return {id:family+(tau===null?'':'-'+tau),family,tau,compatible,
   amplitudeInterval:compatible?[low,high]:null,amplitudeBounds:family==='memoryless'?[0,0]:[-100,100],exclusions,
   reason:compatible?'Every training contrast intersects this fixed-law prediction.':exclusions.length?'Zero prediction conflicts with training.':'No amplitude within the declared −100 to 100 N·m range explains all training contrasts.'};
 });
 const survivors=candidates.filter(c=>c.compatible);
 return {status:!survivors.length?'none-compatible':survivors.length===1?'single-grid-hypothesis':'ambiguous',reasons:[],points,candidates};
}
export function analyzeDurationStudy(raw){
 const study=validateDurationStudy(raw);
 // Freeze the complete fit before reading any challenge outcomes.
 const fit=fitDurationModels(study.runs.filter(r=>r.role==='training'));
 const challenges=study.runs.filter(r=>r.role==='challenge').map(run=>{
  const observed=evaluateHistory(run.notebook),qualified=observed.order.status==='counterbalanced';
  const predictions=fit.candidates.filter(c=>c.compatible).map(c=>{
   const x=shape(c.family,run.duration,c.tau),interval=c.amplitudeInterval.map(a=>a*x);
   const overlap=interval[1]>=observed.interval[0]&&interval[0]<=observed.interval[1];
   return {id:c.id,interval,status:qualified?(overlap?'compatible':'contradicted'):'order-confounded'};
  });
  return {id:run.id,duration:run.duration,source:run.notebook.source,observed:observed.decisionDifference,
   interval:observed.interval,qualified,predictions};
 });
 const jointChallenges=fit.candidates.filter(c=>c.compatible).map(c=>{
  let [low,high]=c.amplitudeInterval,conflict=false;
  for(const run of challenges.filter(r=>r.qualified)){
   const x=shape(c.family,run.duration,c.tau);
   if(x===0){if(run.interval[0]>0||run.interval[1]<0)conflict=true;}
   else{low=Math.max(low,run.interval[0]/x);high=Math.min(high,run.interval[1]/x);}
  }
  const unqualifiedCount=challenges.filter(r=>!r.qualified).length;
  return {id:c.id,unqualifiedCount,status:!challenges.length?'untested':
   conflict||low>high?'contradicted':unqualifiedCount?'incomplete':'compatible'};
 });
 return {fit,challenges,jointChallenges,source:study.runs[0]?.notebook.source??null,
  interpretation:'Finite fixed hypotheses and three-standard-error screening bounds only. Compatibility is not identification, calibrated uncertainty, hidden-state proof or physical causality. Separate run labels do not authenticate independent acquisition.'};
}
export function exportDurationStudy(raw){return JSON.stringify(validateDurationStudy(raw),null,2)+'\n';}
export function importDurationStudy(text){
 if(typeof text!=='string'||text.length>4000000)fail('Use a duration study JSON below 4 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid duration study JSON.');}
 return validateDurationStudy(raw);
}
