import {validateProbeStudy} from './probe-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
import {PROBE_MIXTURE_FAMILIES} from './probe-mixture.mjs';
import {searchPreparedLinearEnvelope} from '../science/shared-training-search.mjs';
import {checkLinearEnvelopeOffsets,checkLinearEnvelopeSeparator} from '../science/shared-training-check.mjs';
export const MIXTURE_CONSISTENCY_SCHEMA='worldlaw.probe-mixture-consistency/v1';
const CERTIFICATE='worldlaw.probe-mixture-certificate/v1';
const fail=message=>{throw Error(message);};
const dense=x=>Array.isArray(x)&&Array.from({length:x.length},(_,i)=>Object.hasOwn(x,i)).every(Boolean);
function prepare(raw){
 if(!raw||raw.schema!==MIXTURE_CONSISTENCY_SCHEMA)fail('Expected a mixed-response consistency request.');
 if(!['training-only','all-evidence'].includes(raw.scope))fail('Declare training-only or retrospective all-evidence consistency.');
 const family=PROBE_MIXTURE_FAMILIES.find(f=>f.id===raw.family);
 if(!family)fail('Choose one explicit mixed-response family.');
 if(!dense(raw.study?.runs))fail('Retain every original probe run.');
 const study=validateProbeStudy(raw.study);
 const maxIterations=raw.maxIterations??512,maxProducts=raw.maxProducts??1000000;
 if(!Number.isSafeInteger(maxIterations)||maxIterations<0||maxIterations>4096||!Number.isSafeInteger(maxProducts)||maxProducts<0||maxProducts>1000000)fail('Use bounded nonnegative work declarations: at most 4096 iterations and 1000000 matrix products.');
 const source={schema:MIXTURE_CONSISTENCY_SCHEMA,study,family:family.id,scope:raw.scope,maxIterations,maxProducts};
 const sourceKey=JSON.stringify(source),runs=study.runs.filter(r=>raw.scope==='all-evidence'||r.role==='training');
 if(!runs.length)fail('The declared scope contains no probe observations.');
 const observations=runs.map(r=>evaluateHistory(r.notebook));
 const rows=runs.map((r,i)=>{
  const influence=family.features(r.probe),observedTorque=observations[i].decisionDifference;
  const support=100*influence.reduce((s,x)=>s+Math.abs(x),0);
  return {influence,observedTorque,refittedPrediction:0,independentCoefficientBoxRadius:support,numericalTolerance:512*Number.EPSILON*Math.max(1,Math.abs(observedTorque),support)};
 });
 const radii=observations.map(o=>o.boundary);
 return {source,sourceKey,family,runs,observations,rows,radii,qualified:observations.every(o=>o.order.status==='counterbalanced')};
}
function checkPrepared(p,certificate){
 if(!certificate||certificate.schema!==CERTIFICATE||certificate.sourceKey!==p.sourceKey||!['coefficient-witness','coefficient-separator'].includes(certificate.kind)||!dense(certificate.values)||certificate.values.some(x=>typeof x!=='number'||!Number.isFinite(x)))fail('Certificate source, scope, family or finite values do not match.');
 if(!p.qualified)return {status:'unresolved',reason:'order-confounded'};
 if(certificate.kind==='coefficient-witness'){
  if(certificate.values.length!==p.family.labels.length||certificate.values.some(x=>Math.abs(x)>100))fail('Coefficient witness exceeds its declared domain.');
  // Re-evaluate from original probe coordinates, separately from prepared rows.
  const predictions=p.runs.map(r=>p.family.features(r.probe).reduce((s,x,i)=>s+x*certificate.values[i],0));
  const checked=checkLinearEnvelopeOffsets(p.rows,certificate.values,p.radii,predictions,certificate.values);
  return {...checked,reason:checked.status==='verified-interior-witness'?'one-coefficient-vector-inside-every-original-screen':checked.reason,coefficients:[...certificate.values]};
 }
 return checkLinearEnvelopeSeparator(p.rows,certificate.values,100,p.radii);
}
export function checkProbeMixtureCertificate(raw,certificate){return checkPrepared(prepare(raw),certificate);}
export function inspectProbeMixtureConsistency(raw){
 const p=prepare(raw),base={schema:'worldlaw.probe-mixture-consistency-result/v1',source:p.source,scope:p.source.scope,family:p.family.id,labels:p.family.labels,coefficientBound:100,status:'unresolved',certificate:null,forecast:false,interpretation:'Numerical consistency of one declared coefficient family with inherited observation screens. All-evidence mode is retrospective; it is not a frozen forecast or an independently selected model. A witness does not establish unique coefficients or identify physical causes; screens are not calibrated confidence. Search exhaustion or numerical boundary contact stays unresolved.'};
 if(!p.qualified)return {...base,reason:'order-confounded'};
 const context={training:Array(p.family.labels.length).fill(null),receivingRadii:p.radii,marginal:{rows:p.rows,settings:{trainingRadius:100,receivingRadius:0}}};
 const result=searchPreparedLinearEnvelope(context,{maxIterations:p.source.maxIterations,maxProducts:p.source.maxProducts},base,{
  makeCertificate:(kind,values)=>({schema:CERTIFICATE,sourceKey:p.sourceKey,kind:kind==='training-offsets'?'coefficient-witness':'coefficient-separator',values:[...values]}),
  checkCandidate:certificate=>checkPrepared(p,certificate),
  recheck:certificate=>checkProbeMixtureCertificate(p.source,certificate),
 });
 return {...result,sourceRuns:p.runs.map((r,i)=>({id:r.id,role:r.role,probe:r.probe,observed:p.observations[i].decisionDifference,screen:p.observations[i].interval}))};
}
export function exportProbeMixtureConsistency(raw){return JSON.stringify(prepare(raw).source,null,2)+'\n';}
export function importProbeMixtureConsistency(text){
 if(typeof text!=='string'||text.length>5000000||new TextEncoder().encode(text).byteLength>5000000)fail('Use a consistency request below 5 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid consistency request JSON.');}
 return prepare(raw).source;
}
