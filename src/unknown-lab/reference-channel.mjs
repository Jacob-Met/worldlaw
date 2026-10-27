// Reconstructed after scratch loss, 2026-10-27. Conditional set-membership screen.
import {DURATION_SCHEMA,validateDurationStudy} from './duration-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
export const REFERENCE_SCHEMA='worldlaw.reference-channel/v1';
const fail=m=>{throw new Error(m);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function interval(x,name,limit=Infinity){
 if(!Array.isArray(x)||x.length!==2||!x.every(finite)||x[0]>x[1]||x.some(v=>Math.abs(v)>limit))fail(name+' must be an ordered finite pair'+(limit<Infinity?' within ±'+limit:'')+'.');
 return [...x];
}
export function validateReferenceStudy(raw){
 if(!raw||raw.schema!==REFERENCE_SCHEMA||!Array.isArray(raw.runs)||raw.runs.length>12)fail('Expected a reference-channel study with at most 12 paired-channel runs.');
 const gainBounds=interval(raw.gainBounds,'Declared gain bounds',10),assumptions={};
 for(const key of ['referenceInsensitivity','sharedArtifact','stableGain']){
  const v=raw.assumptions?.[key];if(typeof v!=='string'||v.trim().length<12||v.length>800)fail('Describe '+key+' in 12–800 characters.');assumptions[key]=v;
 }
 const acquisitions=new Set(),ids=new Set(),flat=[];
 for(const run of raw.runs){
  if(!run||typeof run.id!=='string'||!/^[A-Za-z0-9_-]{1,54}$/.test(run.id)||ids.has(run.id))fail('Use distinct run identifiers of 1–54 safe characters.');ids.add(run.id);
  for(const channel of ['main','reference']){
   const acquisitionId=run[channel]?.acquisitionId;
   if(typeof acquisitionId!=='string'||!/^[A-Za-z0-9_:-]{1,64}$/.test(acquisitionId)||acquisitions.has(acquisitionId))fail('Every channel needs a distinct acquisition identifier (1–64 safe characters).');acquisitions.add(acquisitionId);
   flat.push({id:run.id+'-'+channel,role:run.role,duration:run.duration,notebook:run[channel].notebook});
  }
 }
 const normalized=validateDurationStudy({schema:DURATION_SCHEMA,runs:flat});
 const runs=raw.runs.map((r,i)=>({id:r.id,role:r.role,duration:r.duration,
  main:{acquisitionId:r.main.acquisitionId,notebook:normalized.runs[2*i].notebook},
  reference:{acquisitionId:r.reference.acquisitionId,notebook:normalized.runs[2*i+1].notebook}}));
 return {schema:REFERENCE_SCHEMA,gainBounds,assumptions,runs};
}
function intersect(a,b){const lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]);return lo<=hi?[lo,hi]:null;}
function constrain(box,c,d){ // c*g <= d; zero does not divide.
 if(c===0)return d>=0?box:null;
 return intersect(box,c>0?[-Infinity,d/c]:[d/c,Infinity]);
}
export function compatibleGainIntervals(main,reference,bounds){
 const m=interval(main,'Main interval'),r=interval(reference,'Reference interval'),g=interval(bounds,'Gain bounds',10),out=[];
 for(const sign of [-1,1]){
  let box=intersect(g,sign<0?[-Infinity,0]:[0,Infinity]);if(!box)continue;
  // Existence of M in [m0,m1], R in [r0,r1] with M=gR.
  const rlo=sign<0?r[1]:r[0],rhi=sign<0?r[0]:r[1];
  box=constrain(box,rlo,m[1]);if(box)box=constrain(box,-rhi,-m[0]);
  if(box)out.push(box);
 }
 if(out.length===2&&out[0][1]>=out[1][0])return [[out[0][0],out[1][1]]];
 return out;
}
function conjunction(left,right){return left.flatMap(a=>right.map(b=>intersect(a,b)).filter(Boolean));}
export function correctedInterval(main,reference,gainBounds){
 const m=interval(main,'Main interval'),r=interval(reference,'Reference interval'),g=interval(gainBounds,'Gain bounds',10);
 const products=g.flatMap(x=>r.map(y=>x*y));return [m[0]-Math.max(...products),m[1]-Math.min(...products)];
}
export function analyzeReferenceStudy(raw){
 const study=validateReferenceStudy(raw);
 const points=study.runs.map(r=>{
  const main=evaluateHistory(r.main.notebook),reference=evaluateHistory(r.reference.notebook);
  return {id:r.id,role:r.role,duration:r.duration,main,reference,qualified:main.order.status==='counterbalanced'&&reference.order.status==='counterbalanced',
   correctedInterval:correctedInterval(main.interval,reference.interval,study.gainBounds),
   allowedGains:compatibleGainIntervals(main.interval,reference.interval,study.gainBounds)};
 });
 const training=points.filter(p=>p.role==='training'),challenges=points.filter(p=>p.role==='challenge');
 const reasons=[];
 if(new Set(training.map(p=>p.duration)).size<3)reasons.push('Require at least three distinct training durations.');
 if(training.some(p=>!p.qualified))reasons.push('Every training channel needs at least four pairs in each acquisition order.');
 let trainingGains=[study.gainBounds];
 if(!reasons.length)for(const p of training)trainingGains=conjunction(trainingGains,p.allowedGains);
 else trainingGains=[];
 const fit={status:reasons.length?'insufficient-training':trainingGains.length?'compatible':'contradicted',reasons,gainIntervals:trainingGains};
 let jointGains=trainingGains.map(x=>[...x]);
 for(const p of challenges.filter(p=>p.qualified))jointGains=conjunction(jointGains,p.allowedGains);
 const unqualifiedCount=challenges.filter(p=>!p.qualified).length;
 const jointStatus=reasons.length?'insufficient-training':!trainingGains.length?'training-contradicted':!challenges.length?'untested':!jointGains.length?'contradicted':unqualifiedCount?'incomplete':'compatible';
 return {schema:'worldlaw.reference-channel-result/v1',source:study.runs[0]?.main.notebook.source??null,fit,points,
  challenges:challenges.map(p=>({id:p.id,status:reasons.length?'insufficient-training':!trainingGains.length?'training-contradicted':!p.qualified?'unqualified':conjunction(trainingGains,p.allowedGains).length?'compatible':'contradicted'})),
  joint:{status:jointStatus,gainIntervals:jointGains,qualifiedCount:challenges.length-unqualifiedCount,unqualifiedCount},
  interpretation:'Conditional artifact-only model M(t)=gR(t), one shared signed gain. Three-standard-error screening intervals are not calibrated confidence. Correction uses the entire declared gain range, not the training fit. A reference channel must be insensitive to the sought effect and share the artifact with stable gain; those declarations and acquisition identities are not authenticated. Rejection can reflect failed channel assumptions, not physical memory.'};
}
export const exportReferenceStudy=raw=>JSON.stringify(validateReferenceStudy(raw),null,2)+'\n';
export function importReferenceStudy(text){
 if(typeof text!=='string'||text.length>4000000)fail('Use reference-channel JSON below 4 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid reference-channel JSON.');}return validateReferenceStudy(raw);
}
