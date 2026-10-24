// Fixed-preparation recovery experiment. All bounds below are screening assumptions,
// not confidence intervals or an identification of a physical memory mechanism.
import {validateNotebook, evaluateHistory, exportNotebook} from './paired-history.mjs';
export const RECOVERY_SCHEMA='worldlaw.recovery-response/v1';
const MAX_BYTES=2000000;
const byteLength=text=>new TextEncoder().encode(text).length;
const finite=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_:-]{1,80}$/.test(v);
function require(value,message){if(!value)throw new Error(message);}
// Ignore descriptive labels so renaming an imported recording cannot make it new.
function evidenceKey(n){return JSON.stringify(n.trials.map(t=>[t.history,t.command,t.position,t.rate,t.jointTorque]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));}
function normalizeRun(run,protocol,source){
 require(run&&id(run.recordingId),'Provide a short recordingId for every recording.');
 require(run.protocolId===protocol,'All recordings must declare the same fixed preparation protocol.');
 require(finite(run.delaySeconds,60),'Recovery delay must be between 0 and 60 seconds.');
 const n=validateNotebook(run.evidence);
 require(n.source===source,'Do not mix measured and synthetic sources in one recovery experiment.');
 return {recordingId:run.recordingId,protocolId:protocol,delaySeconds:run.delaySeconds,evidence:JSON.parse(exportNotebook(n))};
}
export function validateRecovery(raw){
 require(raw&&raw.schema===RECOVERY_SCHEMA,'Expected a recovery-response notebook.');
 require(id(raw.protocolId),'Provide a fixed preparation protocolId.');
 require(['synthetic','measured'].includes(raw.source),'Declare measured or synthetic evidence.');
 require(typeof raw.protocolNote==='string'&&raw.protocolNote.trim().length>=8&&raw.protocolNote.length<=500,'Describe the fixed preparation and matched readout protocol (8–500 characters).');
 require(Array.isArray(raw.tauSeconds)&&raw.tauSeconds.length>=1&&raw.tauSeconds.length<=16&&raw.tauSeconds.every(t=>finite(t,60)&&t>=.05)&&new Set(raw.tauSeconds).size===raw.tauSeconds.length,'Provide 1–16 distinct relaxation times from 0.05 to 60 seconds.');
 require(Array.isArray(raw.amplitudeBounds)&&raw.amplitudeBounds.length===2&&raw.amplitudeBounds.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=100)&&raw.amplitudeBounds[0]<raw.amplitudeBounds[1],'Provide increasing amplitude bounds within ±100 N·m.');
 require(Array.isArray(raw.training)&&raw.training.length>=2&&raw.training.length<=32,'Provide 2–32 training recordings.');
 require(Array.isArray(raw.challenges)&&raw.challenges.length<=32,'Provide at most 32 challenge recordings.');
 const training=raw.training.map(r=>normalizeRun(r,raw.protocolId,raw.source));
 const challenges=raw.challenges.map(r=>normalizeRun(r,raw.protocolId,raw.source));
 const all=[...training,...challenges];
 require(new Set(all.map(r=>r.recordingId)).size===all.length,'Recording identities must be distinct across training and challenges.');
 require(new Set(all.map(r=>evidenceKey(r.evidence))).size===all.length,'A recording cannot be reused, including under a renamed identity.');
 require(new Set(training.map(r=>r.delaySeconds)).size>=2,'Training needs at least two distinct recovery delays.');
 const notebook={schema:RECOVERY_SCHEMA,source:raw.source,protocolId:raw.protocolId,protocolNote:raw.protocolNote,amplitudeBounds:[...raw.amplitudeBounds],tauSeconds:[...raw.tauSeconds],training,challenges};
 require(byteLength(JSON.stringify(notebook)+'\n')<=MAX_BYTES,'Recovery evidence exceeds the aggregate 2 MB UTF-8 budget.');
 return notebook;
}
function summary(run){const r=evaluateHistory(run.evidence);return {recordingId:run.recordingId,delaySeconds:run.delaySeconds,estimate:r.decisionDifference,boundary:r.boundary,standardError:r.standardError,qualified:r.order.status==='counterbalanced',order:r.order.status};}
function factor(model,delay){return model.kind==='zero'?0:model.kind==='persistent'?1:Math.exp(-delay/model.tauSeconds);}
function intersect(range,row,model){
 const f=factor(model,row.delaySeconds);
 if(f===0)return Math.abs(row.estimate)<=row.boundary?range:null;
 const next=[Math.max(range[0],(row.estimate-row.boundary)/f),Math.min(range[1],(row.estimate+row.boundary)/f)];
 return next[0]<=next[1]?next:null;
}
export function fitRecovery(raw){
 // Intentionally accept no challenge data; predictions have a training-only input boundary.
 const n=validateRecovery({...raw,challenges:[]}), rows=n.training.map(summary);
 const models=[{id:'zero',kind:'zero'},{id:'persistent',kind:'persistent'},...n.tauSeconds.map(t=>({id:'decay:'+t,kind:'decay',tauSeconds:t}))];
 const qualified=rows.every(r=>r.qualified);
 const candidates=models.map(model=>{
  let range=model.kind==='zero'?[0,0]:[...n.amplitudeBounds];
  let numerator=0,denominator=0;
  for(const row of rows){const f=factor(model,row.delaySeconds),w=1/row.standardError**2;numerator+=w*f*row.estimate;denominator+=w*f*f;if(range)range=intersect(range,row,model);}
  const excited=model.kind==='zero'||(denominator>1e-24&&rows.some(row=>factor(model,row.delaySeconds)>1e-8));
  let amplitude=model.kind==='zero'||!excited?0:Math.max(n.amplitudeBounds[0],Math.min(n.amplitudeBounds[1],numerator/denominator));
  if(qualified&&excited&&range)amplitude=Math.max(range[0],Math.min(range[1],amplitude));
  const residuals=rows.map(row=>({...row,prediction:amplitude*factor(model,row.delaySeconds)}));
  return {...model,amplitude,amplitudeRange:qualified&&excited?range:null,status:!qualified?'unqualified_order':!excited?'insufficient_excitation':range?'compatible':'training_contradiction',residuals};
 });
 return {schema:'worldlaw.recovery-fit/v1',source:n.source,protocolId:n.protocolId,training:rows,candidates,status:!qualified?'unqualified_order':candidates.some(c=>c.status==='compatible')?'screened':'no_candidate'};
}
export function predictRecovery(fit,delays){
 require(Array.isArray(delays)&&delays.length<=128&&delays.every(d=>finite(d,60)),'Provide at most 128 prediction delays in [0,60].');
 return fit.candidates.map(c=>({id:c.id,status:c.status,points:delays.map(delay=>({delaySeconds:delay,prediction:c.amplitude*factor(c,delay),range:c.amplitudeRange?.map(a=>a*factor(c,delay))??null}))}));
}
export function evaluateRecovery(raw){
 const n=validateRecovery(raw),fit=fitRecovery(n),observations=n.challenges.map(summary);
 const predictions=predictRecovery(fit,observations.map(r=>r.delaySeconds));
 const tests=fit.candidates.map((c,i)=>{
  let range=c.amplitudeRange?[...c.amplitudeRange]:null;
  const rows=observations.map((row,j)=>{if(row.qualified&&range)range=intersect(range,row,c);return {...row,...predictions[i].points[j]};});
  // A single shared amplitude must explain all qualified recordings. Per-point
  // overlapping intervals can conceal mutually contradictory amplitude demands.
  const status=c.status!=='compatible'?'not_admitted':!rows.length?'untested':range===null?'challenged':rows.some(r=>!r.qualified)?'incomplete':'compatible';
  return {id:c.id,status,rows};
 });
 return {schema:'worldlaw.recovery-result/v1',fit,tests,qualification:'Finite response hypotheses; three-standard-error screens inherit noise, order and protocol assumptions. Compatibility does not establish physical memory, calibrated coverage, or independent acquisition.'};
}
export function exportRecovery(raw){const n=validateRecovery(raw),pretty=JSON.stringify(n,null,2)+'\n';return byteLength(pretty)<=MAX_BYTES?pretty:JSON.stringify(n)+'\n';}
export function importRecovery(text){require(typeof text==='string'&&byteLength(text)<=MAX_BYTES,'Use recovery JSON under 2 MB.');return validateRecovery(JSON.parse(text));}
