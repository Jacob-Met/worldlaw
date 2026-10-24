// Input-only prospective duration receiving. Declarations are not authentication.
import {planDurationAcquisition} from './duration-planner.mjs';
import {validateDurationStudy,analyzeDurationStudy} from './duration-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
export const REQUEST_SCHEMA='worldlaw.duration-acquisition-request/v1';
export const RECEIPT_SCHEMA='worldlaw.duration-acquisition/v1';
const fail=m=>{throw Error(m);};
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
function protocolOf(input,study,plan){
 if(!input||typeof input.runId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(input.runId)||study.runs.some(r=>r.id===input.runId))fail('Declare a new distinct future run identifier.');
 if(typeof input.preparation!=='string'||!input.preparation.trim()||input.preparation.length>240)fail('Declare the preparation and measurement arrangement in 1–240 characters.');
 return {runId:input.runId,preparation:input.preparation.trim(),duration:plan.selected.duration,pairs:plan.settings.pairs,source:study.runs[0].notebook.source};
}
export function freezeDurationAcquisition(raw,settings,protocol){
 const study=validateDurationStudy(raw);
 if(study.runs.length>=24)fail('The duration study is full; a new acquisition requires a free run slot.');
 const plan=planDurationAcquisition(study.runs.filter(r=>r.role==='training'),settings);
 if(!plan.selected)fail('An informative duration plan is required before freezing.');
 return {schema:REQUEST_SCHEMA,study,settings:plan.settings,protocol:protocolOf(protocol,study,plan),forecast:plan.selected};
}
export function validateDurationRequest(raw){
 if(raw?.schema!==REQUEST_SCHEMA)fail('Expected a frozen duration acquisition request.');
 const request=freezeDurationAcquisition(raw.study,raw.settings,raw.protocol);
 if(canonical(raw.protocol)!==canonical(request.protocol)||canonical(raw.forecast)!==canonical(request.forecast))fail('Frozen protocol or forecasts differ from their original inputs.');
 return request;
}
export function receiveDurationAcquisition(raw,observation,currentStudy=raw?.study){
 const request=validateDurationRequest(raw);
 if(canonical(validateDurationStudy(currentStudy))!==canonical(request.study))fail('The study changed after this request; freeze a new acquisition.');
 if(!observation||canonical(observation.protocol)!==canonical(request.protocol))fail('Observation protocol does not match the frozen request.');
 const run=observation.run;
 if(!run||run.id!==request.protocol.runId||run.role!=='challenge'||run.duration!==request.protocol.duration)fail('Received run identity, role or duration differs from the request.');
 const study=validateDurationStudy({...request.study,runs:[...request.study.runs,run]});
 const received=study.runs.at(-1),observed=evaluateHistory(received.notebook);
 if(observed.count!==request.protocol.pairs)fail('Received paired count differs from the frozen protocol.');
 const analysis=analyzeDurationStudy(study),reasons=[];
 if(observed.order.status!=='counterbalanced')reasons.push('Acquisition order is not sufficiently counterbalanced.');
 if(observed.boundary>request.settings.contrastRadius)reasons.push('Observed contrast radius exceeds the frozen planning radius.');
 return {request,observation:{protocol:request.protocol,run:received},study,analysis,
  qualification:{status:reasons.length?'unqualified':'within-declared-plan',reasons,actualRadius:observed.boundary,plannedRadius:request.settings.contrastRadius},
  challenge:analysis.challenges.find(c=>c.id===received.id)};
}
export function exportDurationAcquisition(raw,observation=null){
 const request=validateDurationRequest(raw);
 const result=observation?receiveDurationAcquisition(request,observation):null;
 return JSON.stringify({schema:RECEIPT_SCHEMA,request,observation:result?.observation??null},null,2)+'\n';
}
export function importDurationAcquisition(text){
 if(typeof text!=='string'||text.length>5000000)fail('Use an acquisition JSON below 5 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid acquisition JSON.');}
 if(raw?.schema!==RECEIPT_SCHEMA)fail('Unsupported duration acquisition schema.');
 const request=validateDurationRequest(raw.request);
 return {request,result:raw.observation===null?null:receiveDurationAcquisition(request,raw.observation)};
}
