/** Reopen the existing initial-state receipt's source, never its derived answer. */
import {normalizeAngularForecastRun} from './angular-discovery.mjs';
import {readoutBinding} from './interval-readout.mjs';
import {prepareInvariantInput} from './initial-energy-input.mjs';
import {confineDampedSine} from './initial-energy.mjs';
export const INITIAL_STATE_RECEIPT='worldlaw.initial-state-receipt/v1';
export const INITIAL_STATE_RECEIPT_LIMIT=3000000;
const insist=(ok,message)=>{if(!ok)throw Error(message);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function prepareInitialEnergyQuestion(model,rawRun,widths){
 const run=normalizeAngularForecastRun(rawRun);
 const options={positionHalfWidth:widths?.positionHalfWidth,rateHalfWidth:widths?.rateHalfWidth};
 const input=prepareInvariantInput(model,{kind:'supplied-point-state',runId:run.id,position:run.samples[0].position,rate:run.initialRate},options);
 const source={schema:INITIAL_STATE_RECEIPT,model:structuredClone(model),run,options};
 return {source,input,result:confineDampedSine(input)};
}
export function exportInitialEnergyQuestion(question){
 insist(question?.source?.schema===INITIAL_STATE_RECEIPT,'Check an original-start question before saving.');
 // Re-admit original inputs. Caller-supplied cached results are not serialized.
 const q=prepareInitialEnergyQuestion(question.source.model,question.source.run,question.source.options);
 const text=JSON.stringify(q.source);insist(new TextEncoder().encode(text).length<=INITIAL_STATE_RECEIPT_LIMIT,'Initial-state receipt exceeds 3 MB.');return text;
}
export async function reopenInitialEnergyQuestion(text,{model,run}){
 insist(typeof text==='string'&&text.length<=INITIAL_STATE_RECEIPT_LIMIT&&new TextEncoder().encode(text).length<=INITIAL_STATE_RECEIPT_LIMIT,'Open an initial-state JSON receipt smaller than 3 MB.');
 let raw;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('Initial-state receipt is not valid JSON.');}
 insist(object(raw)&&raw.schema===INITIAL_STATE_RECEIPT,'Open an original initial-state receipt; prelude notebooks are not original supplied-state questions.');
 insist(Object.keys(raw).every(k=>['schema','model','run','options','result'].includes(k)),'Unsupported initial-state receipt fields; prelude-derived state must remain separately attributed.');
 insist(object(raw.options)&&Object.keys(raw.options).every(k=>['positionHalfWidth','rateHalfWidth','maxStep','maxTotalSteps','numericalTolerance'].includes(k)),'Original sensitivity width/settings declarations are required; derived-state options are not supplied-state declarations.');
 // Legacy sampled-grid options and result are allowed, but cannot change this calculation.
 const question=prepareInitialEnergyQuestion(raw.model,raw.run,raw.options);
 const currentRun=normalizeAngularForecastRun(run);
 const [saved,current]=await Promise.all([readoutBinding(question.source.model,question.source.run),readoutBinding(model,currentRun)]);
 insist(JSON.stringify(saved)===JSON.stringify(current),'This question does not match the selected frozen law and complete original run. Select its original context before reopening; no model or starting state was replaced.');
 return question;
}
