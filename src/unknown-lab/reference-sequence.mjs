import {validateReferenceModels,analyzeReferenceModels,predictReferenceModel} from './reference-models.mjs';
import {freezeReferenceRequest,receiveReferenceRequest} from './reference-model-request.mjs';
export const SEQUENCE_SCHEMA='worldlaw.reference-sequence/v1';
export const MAX_SEQUENCE_BYTES=4000000;
const fail=m=>{throw Error(m);};
const copy=x=>JSON.parse(JSON.stringify(x));
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function keys(x,list){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!list.includes(k)))fail('Use a source-only sequential account.');}
function size(x){const text=JSON.stringify(x);if(new TextEncoder().encode(text).length>MAX_SEQUENCE_BYTES)fail('Complete canonical source account exceeds 4 MB.');return text;}
const sourcePrefix=(input,rounds)=>({input,rounds:rounds.map(r=>({id:r.id,offer:r.offer,prospectiveDeclaration:true,outcomes:r.outcomes}))});
const binding=(input,rounds)=>JSON.stringify(sourcePrefix(input,rounds));
function allInput(input,rounds){return {...input,study:{...input.study,runs:[...input.study.runs,...rounds.flatMap(r=>r.outcomes)]}};}
function normalizedOffer(input,offer,id,declaration){return freezeReferenceRequest(input,offer,{id,prospectiveDeclaration:declaration}).offer;}
function compare(input,rounds,offers){
 const analysis=analyzeReferenceModels(allInput(input,rounds));
 const models=analysis.models.filter(m=>m.joint.polygons.length);
 if(!models.length)fail('No joint explanation survives; a new offer cannot resurrect or refit the original family.');
 if(!Array.isArray(offers)||!offers.length||offers.length>32)fail('Supply 1–32 explicit next offers.');
 const ids=new Set();
 const comparisons=offers.map(o=>{
  const offer=normalizedOffer(input,o,'offer-check',true);if(ids.has(offer.id))fail('Next offer IDs must be distinct.');ids.add(offer.id);
  const predictions=models.map(m=>({id:m.id,intervals:predictReferenceModel({...m,training:{polygons:m.joint.polygons}},offer)}));
  const pairs=[];for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++){
   const a=predictions[i],b=predictions[j],gaps=a.intervals.flatMap(x=>b.intervals.map(y=>Math.max(y[0]-x[1],x[0]-y[1])-2*offer.radius));
   pairs.push({left:a.id,right:b.id,separated:gaps.every(g=>g>0),minimumGap:Math.min(...gaps)});
  }
  return {...offer,predictions,pairs,separatedPairs:pairs.filter(p=>p.separated).length,totalPairs:pairs.length};
 });
 const ranked=[...comparisons].sort((a,b)=>b.separatedPairs-a.separatedPairs||a.duration-b.duration||a.id.localeCompare(b.id));
 return {comparisons,recommendation:models.length>1&&ranked[0].separatedPairs?ranked[0].id:null,survivingModelIds:models.map(m=>m.id),scope:'Conditioned on all prior order-qualified actuals with one original shared coefficient tuple per explanation. Full computed sign unions; binary64 screening is not certified interval arithmetic. An anticipated reference range is not a guaranteed intervention.'};
}
export function createReferenceSequence(raw){
 const input=validateReferenceModels(raw);if(input.study.runs.some(r=>r.role!=='training'))fail('Start from explicit original training only.');
 if(input.study.runs.length>=12)fail('Leave capacity for actual acquisitions.');
 if(!analyzeReferenceModels(input).models.some(m=>m.training.status==='compatible'))fail('Original training requires a compatible explanation.');
 const account={schema:SEQUENCE_SCHEMA,input,rounds:[]};size(account);return freeze(account);
}
export function sequenceFromReceiving(request,outcomes){
 const received=receiveReferenceRequest(request,outcomes);
 const first=freezeNextReferenceRound(createReferenceSequence(received.source.request.input),received.source.request.offer,received.source.request);
 return received.source.outcomes.length?receiveReferenceSequence(first,{schema:'worldlaw.reference-sequence-acquisition/v1',request:referenceRoundRequest(first),runs:received.source.outcomes}):first;
}
export function analyzeReferenceSequence(raw){
 size(raw);keys(raw,['schema','input','rounds']);if(raw.schema!==SEQUENCE_SCHEMA||!Array.isArray(raw.rounds)||raw.rounds.length>12)fail('Supply an explicit bounded rounds array.');
 const initial=createReferenceSequence(raw.input),input=initial.input,rounds=[],reports=[],ids=new Set();
 for(const r of raw.rounds){
  keys(r,['id','offer','prospectiveDeclaration','prefix','outcomes']);
  if(ids.has(r.id))fail('Round IDs must be distinct.');ids.add(r.id);
  if(!Array.isArray(r.outcomes))fail('Each round needs an explicit outcomes array.');
  if(rounds.length&&!rounds.at(-1).outcomes.length)fail('Receive actual evidence before freezing another round.');
  if(input.study.runs.length+rounds.reduce((n,x)=>n+x.outcomes.length,0)>=12)fail('No acquisition capacity remains.');
  if(r.prefix!==binding(input,rounds))fail('Frozen round does not match the complete normalized prior-evidence prefix.');
  const offer=normalizedOffer(input,r.offer,r.id,r.prospectiveDeclaration);
  const planned=compare(input,rounds,[offer]);
  const received=receiveReferenceRequest(freezeReferenceRequest(input,offer,{id:r.id,prospectiveDeclaration:true}),r.outcomes);
  const next={id:r.id,offer,prospectiveDeclaration:true,prefix:r.prefix,outcomes:received.source.outcomes};
  // Re-admit the complete original record set to enforce identities, global
  // capacity and joint shared coefficients across every round.
  const joint=analyzeReferenceModels(allInput(input,[...rounds,next]));
  rounds.push(next);reports.push({id:r.id,planned,qualification:received.qualification,analysis:joint});
 }
 const account={schema:SEQUENCE_SCHEMA,input,rounds};size(account);
 return {account:freeze(account),rounds:reports,analysis:analyzeReferenceModels(allInput(input,rounds))};
}
export function compareNextReferenceOffers(raw,offers){const a=analyzeReferenceSequence(raw);return compare(a.account.input,a.account.rounds,offers);}
export function freezeNextReferenceRound(raw,offer,{id,prospectiveDeclaration}={}){
 const {account}=analyzeReferenceSequence(raw),r={id,offer,prospectiveDeclaration,prefix:binding(account.input,account.rounds),outcomes:[]};
 return analyzeReferenceSequence({...account,rounds:[...account.rounds,r]}).account;
}
export function referenceRoundRequest(raw){
 const {account}=analyzeReferenceSequence(raw),r=account.rounds.at(-1);if(!r)fail('Freeze a round first.');
 return freeze({schema:'worldlaw.reference-sequence-request/v1',id:r.id,offer:copy(r.offer),prefix:r.prefix});
}
export function receiveReferenceSequence(raw,envelope){
 size(envelope);keys(envelope,['schema','request','runs']);if(envelope.schema!=='worldlaw.reference-sequence-acquisition/v1'||!Array.isArray(envelope.runs)||!envelope.runs.length)fail('Supply an explicit nonempty original runs array.');
 const {account}=analyzeReferenceSequence(raw),request=referenceRoundRequest(account);
 if(JSON.stringify(envelope.request)!==JSON.stringify(request))fail('Acquisition request must match the complete frozen source prefix and offer.');
 const rounds=copy(account.rounds),last=rounds.at(-1);last.outcomes.push(...envelope.runs);
 return analyzeReferenceSequence({...account,rounds}).account;
}
export function exportReferenceSequence(raw){return size(analyzeReferenceSequence(raw).account);}
export function importReferenceSequence(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_SEQUENCE_BYTES)fail('Complete account exceeds 4 MB.');return analyzeReferenceSequence(JSON.parse(text)).account;}
