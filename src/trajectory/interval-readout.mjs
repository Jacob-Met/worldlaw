import {averagePredictedIntervals} from './interval-average.mjs';
export const INTERVAL_READOUT_FORMAT='worldlaw.additional-interval-readings/v1';
const insist=(x,m)=>{if(!x)throw Error(m);};
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const keys=(x,names,label)=>insist(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>names.includes(k)),`Unsupported ${label} fields; retain original inputs only`);
const text=(x,label)=>{insist(typeof x==='string'&&x.trim()&&x.length<=1000,`Attribute ${label}`);return x.trim();};
const finite=(x,label)=>{insist(typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6,`Finite ${label} required`);return x;};
async function hash(x){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(x))))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function readoutBinding(model,run){return {modelId:model.id,runId:run.id,modelSHA256:await hash(model),pointRunSHA256:await hash(run)};}
export async function inspectIntervalReadings(raw,{model,run,forecast}){
 keys(raw,['format','binding','initialPoint','readings'],'study');insist(raw.format===INTERVAL_READOUT_FORMAT,'Open an additional interval-reading source');
 const binding=await readoutBinding(model,run);insist(canonical(raw.binding)===canonical(binding),'Saved source does not match the selected model and original point run');
 const p=raw.initialPoint;keys(p,['kind','time','position','rate','source','pointObservationId'],'point origin');insist(p.kind==='independent-point-state','Independently supplied point origin required; an averaged reading is not point state');
 const pointObservationId=text(p.pointObservationId,'original point observation identity'),source=text(p.source,'independent point-state provenance');
 insist(p.time===run.samples[0].time&&p.position===run.samples[0].position&&p.rate===run.initialRate,'Independent point origin must match the unchanged forecast time, angle and rate');
 insist(forecast?.rows?.length===run.samples.length&&forecast.rows.every((r,i)=>r.time===run.samples[i].time&&r.observed===run.samples[i].position),'Complete matching ordinary forecast required');
 insist(Array.isArray(raw.readings)&&raw.readings.length>=1&&raw.readings.length<=256,'Retain1–256 complete additional readings');
 const times=new Map(forecast.rows.map(r=>[r.time,r])),seen=new Set();
 const readings=raw.readings.map(r=>{keys(r,['id','source','start','end','reportedTime','timestampConvention','weighting','observed'],'interval reading');const id=text(r.id,'reading identity');insist(id!==pointObservationId&&!seen.has(id),'Keep unique reading identities separate from point origin');seen.add(id);insist(r.weighting==='uniform','Only explicitly uniform scalar-angle weighting is supported');const start=finite(r.start,'interval start'),end=finite(r.end,'interval end'),reportedTime=finite(r.reportedTime,'reported time');insist(start>p.time,'Additional intervals must start after the independent point origin');insist(times.has(reportedTime),'Reported time requires an exact existing prediction node');return {id,source:text(r.source,'interval source'),start,end,reportedTime,timestampConvention:r.timestampConvention,weighting:'uniform',observed:finite(r.observed,'observed angle')};});
 const averaged=averagePredictedIntervals(forecast.rows,readings);
 const rows=averaged.rows.map(r=>({...r,pointPrediction:times.get(r.reportedTime).predicted,pointResidual:r.observed-times.get(r.reportedTime).predicted,averageResidual:r.observed-r.averagePrediction}));
 const rms=k=>Math.hypot(...rows.map(r=>r[k]))/Math.sqrt(rows.length);
 return {source:{format:INTERVAL_READOUT_FORMAT,binding,initialPoint:{kind:p.kind,time:p.time,position:p.position,rate:p.rate,source,pointObservationId},readings},rows,ordinaryPointMetrics:structuredClone(forecast.metrics),intervalPointRMSE:rms('pointResidual'),intervalAverageRMSE:rms('averageResidual'),segments:averaged.segments,boundary:'Uniform scalar-angle averaging is a caller-declared sensor hypothesis, not generic camera averaging or calibrated exposure. Source declarations do not authenticate acquisition. Original point observations and frozen predictions are unchanged. Trapezoidal comparison is not an integration-error bound.'};
}
