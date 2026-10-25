// Source-only manual request/receipt workflow, using the maintained probe admission.
import {compareSaturationRates} from './saturation-profile.mjs';
import {validateProbeStudy} from './probe-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
import {rational,cmp} from './chronos-exact-halfplanes.mjs';
export const RATE_REQUEST_SCHEMA='worldlaw.saturation-rate-request/v1';
export const RATE_RECEIPT_SCHEMA='worldlaw.saturation-rate-acquisition/v1';
const fail=m=>{throw Error(m);};
export const canonicalSaturationSource=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const same=(a,b)=>canonicalSaturationSource(a)===canonicalSaturationSource(b);
function freeze(raw,settings,input){
 const study=validateProbeStudy(raw);
 if(study.runs.length>=24)fail('A new acquisition requires a free probe run slot.');
 const plan=compareSaturationRates(study,settings),selected=plan.courses.find(c=>c.id===plan.selected);
 if(!selected)fail('A certified affordable rate discriminator is required before freezing.');
 if(!input||typeof input.runId!=='string'||!/^[a-zA-Z0-9_:-]{1,64}$/.test(input.runId)||study.runs.some(r=>r.id===input.runId))fail('Declare a distinct future run identifier.');
 if(typeof input.arrangement!=='string'||!input.arrangement.trim()||input.arrangement.length>240)fail('Describe the preparation and measurement arrangement in 1–240 characters.');
 if(!Number.isSafeInteger(input.pairs)||input.pairs<8||input.pairs>128)fail('Declare 8–128 matched pairs, with at least four in each acquisition order.');
 const protocol={runId:input.runId,arrangement:input.arrangement.trim(),pairs:input.pairs,
  preparation:{...study.preparation},probe:{...selected.probe},source:plan.source,offerId:selected.id};
 return {request:{schema:RATE_REQUEST_SCHEMA,study,settings:plan.settings,protocol},plan};
}
export function freezeSaturationRateRequest(study,settings,protocol){return freeze(study,settings,protocol).request;}
function validate(raw){
 if(raw?.schema!==RATE_REQUEST_SCHEMA)fail('Expected a frozen saturation rate request.');
 const work=freeze(raw.study,raw.settings,raw.protocol);
 if(!same(raw.protocol,work.request.protocol))fail('Frozen full probe protocol differs from the original training and offered inputs.');
 return work;
}
export function validateSaturationRateRequest(raw){return validate(raw).request;}
const exact=q=>{const [n,d]=q.split('/').map(BigInt);return [n,d];};
export function receiveSaturationRateAcquisition(raw,observation,currentStudy=raw?.study){
 const {request,plan}=validate(raw);
 if(!same(validateProbeStudy(currentStudy),request.study))fail('The probe study changed after this request; freeze a new acquisition.');
 if(!observation||!same(observation.protocol,request.protocol))fail('Observation protocol does not match the frozen request.');
 const run=observation.run;
 if(!run||run.id!==request.protocol.runId||run.role!=='challenge'||!same(run.preparation,request.protocol.preparation)||!same(run.probe,request.protocol.probe))fail('Received identity, challenge role, fixed preparation or full probe state differs from the request.');
 const study=validateProbeStudy({...request.study,runs:[...request.study.runs,run]});
 const received=study.runs.at(-1),observed=evaluateHistory(received.notebook),reasons=[];
 if(observed.count!==request.protocol.pairs)fail('Received pair count differs from the frozen protocol.');
 if(observed.order.status!=='counterbalanced')reasons.push('At least four pairs in each acquisition order are required.');
 if(observed.boundary>request.settings.contrastRadius)reasons.push('Observed screening radius exceeds the frozen prospective radius.');
 const selected=plan.courses.find(c=>c.id===plan.selected),bounds=observed.interval.map(rational);
 const windows=selected.forecasts.map((bands,index)=>({index,window:[...plan.windows[index]],
  status:reasons.length?'not-evaluated':bands.every(b=>cmp(exact(b.exact[0]),bounds[1])>0||cmp(exact(b.exact[1]),bounds[0])<0)?'excluded':'outer-overlap-only'}));
 return {request,plan,observation:{protocol:request.protocol,run:received},study,
  observed:{difference:observed.decisionDifference,interval:observed.interval,pairs:observed.count,order:observed.order.status},
  qualification:{status:reasons.length?'unqualified':'within-declared-plan',reasons,actualRadius:observed.boundary,plannedRadius:request.settings.contrastRadius},
  windows,uncomparedScaleRanges:plan.uncomparedScaleRanges,
  interpretation:'Separate original measurements screen both frozen offered windows before any explicit study revision. Outer overlap is not a parameter witness. Excluding both windows does not exclude intervening scales or other response laws. Source and protocol declarations do not authenticate physical independence or calibrate uncertainty.'};
}
export function exportSaturationRateAcquisition(raw,observation=null){
 const request=validateSaturationRateRequest(raw),received=observation?receiveSaturationRateAcquisition(request,observation):null;
 return JSON.stringify({schema:RATE_RECEIPT_SCHEMA,request,observation:received?.observation??null},null,2)+'\n';
}
export function importSaturationRateAcquisition(text){
 if(typeof text!=='string'||text.length>5000000)fail('Use an acquisition JSON below 5 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid saturation acquisition JSON.');}
 if(raw?.schema!==RATE_RECEIPT_SCHEMA)fail('Expected a saturation acquisition request or receipt.');
 if(raw.observation===null)return {request:validateSaturationRateRequest(raw.request),result:null};
 const result=receiveSaturationRateAcquisition(raw.request,raw.observation);
 return {request:result.request,result};
}
