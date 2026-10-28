import {validateReferenceModels,compareReferenceExperiments,analyzeReferenceModels} from './reference-models.mjs';
import {analyzeReferenceStudy} from './reference-channel.mjs';
const REQUEST='worldlaw.reference-model-request/v1',STUDY='worldlaw.reference-model-receiving/v1';
const fail=m=>{throw Error(m);};
function frozen(x){if(x&&typeof x==='object'){for(const v of Object.values(x))frozen(v);Object.freeze(x);}return x;}
function keys(x,allowed){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k)))fail('Source-only request/receiving record required.');}
export function freezeReferenceRequest(input,offer,{id,prospectiveDeclaration}={}){
 if(prospectiveDeclaration!==true)fail('Declare that the request is frozen before its outcomes are supplied.');
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,54}$/.test(id))fail('Use a bounded request identifier.');
 keys(offer,['id','duration','referenceInterval','radius']);
 if(typeof offer.duration!=='number'||!Number.isFinite(offer.duration)||offer.duration<=0||offer.duration>30)fail('Requested acquisition duration must be positive and at most 30 seconds, matching the maintained receiver.');
 const source=validateReferenceModels(input);
 if(source.study.runs.some(r=>r.role!=='training'))fail('Freeze an explicitly training-only source; do not silently relabel previous challenges.');
 if(source.study.runs.length>=12)fail('Leave capacity for at least one separate acquisition.');
 const comparison=compareReferenceExperiments(source,[offer]);
 if(!comparison.analysis.models.some(m=>m.training.status==='compatible'))fail('At least one training-compatible explanation is required.');
 const c=comparison.comparisons[0];
 return frozen({schema:REQUEST,id,prospectiveDeclaration:true,input:source,offer:{id:c.id,duration:c.duration,referenceInterval:c.referenceInterval,radius:c.radius}});
}
export function importReferenceRequest(raw){
 keys(raw,['schema','id','prospectiveDeclaration','input','offer']);
 if(raw.schema!==REQUEST)fail('Unsupported frozen request.');
 return freezeReferenceRequest(raw.input,raw.offer,raw);
}
export function receiveReferenceRequest(rawRequest,outcomes=[]){
 const request=importReferenceRequest(rawRequest);
 if(!Array.isArray(outcomes)||outcomes.length+request.input.study.runs.length>12)fail('Complete source and outcomes must fit the maintained 12-run limit.');
 for(const r of outcomes)if(r?.role!=='challenge'||r.duration!==request.offer.duration)fail('Every actual acquisition must be a challenge at the requested duration.');
 const input=validateReferenceModels({...request.input,study:{...request.input.study,runs:[...request.input.study.runs,...outcomes]}});
 const actual=input.study.runs.slice(request.input.study.runs.length);
 const points=analyzeReferenceStudy(input.study).points.filter(p=>p.role==='challenge');
 const qualification=points.map(p=>{
  const referenceAchieved=p.reference.interval[0]>=request.offer.referenceInterval[0]&&p.reference.interval[1]<=request.offer.referenceInterval[1];
  const mainRadius=(p.main.interval[1]-p.main.interval[0])/2;
  const precisionAchieved=mainRadius<=request.offer.radius;
  return {id:p.id,orderQualified:p.qualified,referenceAchieved,precisionAchieved,mainRadius,offeredConditionAchieved:p.qualified&&referenceAchieved&&precisionAchieved};
 });
 return {source:{schema:STUDY,request,outcomes:actual},frozenComparison:compareReferenceExperiments(request.input,[request.offer]),analysis:analyzeReferenceModels(input),qualification,
  interpretation:'Actual qualified channels constrain the same originally admitted gain/amplitude hypotheses jointly even if the offered reference range or precision was not achieved. Offer failure is separate from model incompatibility. Unqualified order evidence is retained but does not constrain hypotheses. Source identities and prospective timing are declarations, not authenticated acquisition; binary64 screening and original channel assumptions remain unchanged.'};
}
export function exportReferenceReceiving(request,outcomes){return JSON.stringify(receiveReferenceRequest(request,outcomes).source,null,2)+'\n';}
export function importReferenceReceiving(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4000000)fail('Receiving source exceeds 4 MB.');
 const raw=JSON.parse(text);keys(raw,['schema','request','outcomes']);if(raw.schema!==STUDY||!Object.hasOwn(raw,'outcomes')||!Array.isArray(raw.outcomes))fail('Receiving study requires an explicit original outcomes array.');
 return receiveReferenceRequest(raw.request,raw.outcomes);
}
