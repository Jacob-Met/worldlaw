import {inspectGainClockExperiment} from './gain-clock-experiment.mjs';
// Format dispatch for the SAME affine instrument. Every format keeps its own
// original-input notebook schema; tick evidence never silently downgrades.
import {inspectAffineClocks,exportAffineClockInvestigation,reopenAffineClockInvestigation} from './clock-affine.mjs';
import {inspectClockTickEvidence,exportClockTickInvestigation,reopenClockTickInvestigation} from './clock-ticks.mjs';
export function inspectClockEvidence(model,input){
 if(input?.schema==='worldlaw.gain-clock-input/v1')return {result:inspectGainClockExperiment(model,input),conversion:null};
 if(input?.schema==='worldlaw.clock-tick-input/v1')return inspectClockTickEvidence(model,input);
 return {result:inspectAffineClocks(model,input),conversion:null};
}
export function exportClockEvidence(model,input){
 if(input?.schema==='worldlaw.gain-clock-input/v1'){inspectGainClockExperiment(model,input);const text=JSON.stringify({schema:'worldlaw.gain-clock-investigation/v1',model,input},null,2);if(new TextEncoder().encode(text).length>2_000_000)throw Error('Investigation must be at most 2 MB.');return text;}
 return input?.schema==='worldlaw.clock-tick-input/v1'?exportClockTickInvestigation(model,input):exportAffineClockInvestigation(model,input);
}
export function reopenClockEvidence(text){
 if(typeof text!=='string'||text.length>2_000_000)throw Error('Investigation must be at most 2 MB.');
 const raw=JSON.parse(text),schema=raw?.schema;
 if(schema==='worldlaw.gain-clock-investigation/v1'){if(new TextEncoder().encode(text).length>2_000_000)throw Error('Investigation must be at most 2 MB.');return {model:raw.model,input:raw.input,result:inspectGainClockExperiment(raw.model,raw.input),conversion:null};}
 if(schema==='worldlaw.clock-tick-investigation/v1')return reopenClockTickInvestigation(text);
 return {...reopenAffineClockInvestigation(text),conversion:null};
}
export const isClockInvestigation=schema=>['worldlaw.gain-clock-investigation/v1','worldlaw.clock-affine-investigation/v1','worldlaw.clock-tick-investigation/v1'].includes(schema);
