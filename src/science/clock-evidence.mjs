// Format dispatch for the SAME affine instrument. Every format keeps its own
// original-input notebook schema; tick evidence never silently downgrades.
import {inspectAffineClocks,exportAffineClockInvestigation,reopenAffineClockInvestigation} from './clock-affine.mjs';
import {inspectClockTickEvidence,exportClockTickInvestigation,reopenClockTickInvestigation} from './clock-ticks.mjs';
export function inspectClockEvidence(model,input){
 if(input?.schema==='worldlaw.clock-tick-input/v1')return inspectClockTickEvidence(model,input);
 return {result:inspectAffineClocks(model,input),conversion:null};
}
export function exportClockEvidence(model,input){
 return input?.schema==='worldlaw.clock-tick-input/v1'?exportClockTickInvestigation(model,input):exportAffineClockInvestigation(model,input);
}
export function reopenClockEvidence(text){
 if(typeof text!=='string'||text.length>2_000_000)throw Error('Investigation must be at most 2 MB.');
 const schema=JSON.parse(text)?.schema;
 if(schema==='worldlaw.clock-tick-investigation/v1')return reopenClockTickInvestigation(text);
 return {...reopenAffineClockInvestigation(text),conversion:null};
}
export const isClockInvestigation=schema=>['worldlaw.clock-affine-investigation/v1','worldlaw.clock-tick-investigation/v1'].includes(schema);
