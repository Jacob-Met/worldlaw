/** Conditional static command mappings. Original measurements never become mapped evidence. */
import {discover, evaluate, predict, simulate, DEFAULT_TERMS, TERMS} from './torque-discovery.mjs';
import {validateRows, MAX_TEXT_LENGTH} from '../data.mjs';
import {exportSession, restoreSession} from '../session.mjs';

export const DEADZONE_SCHEMA = 'worldlaw.command-deadzone-inputs/v1';
export const MAX_DEADZONE_WORK = 25_000_000;
export function checkedWidths(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 16 ||
      values.some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 1e6) ||
      new Set(values).size !== values.length || !values.includes(0))
    throw Error('Declare 1–16 unique dead-zone half-widths in [0, 1000000] N·m, including zero.');
  return [...values].sort((a,b)=>a-b);
}
export function mapDeadzone(command, width) {
  if (!Number.isFinite(command) || Math.abs(command)>1e6 || !Number.isFinite(width) || width<0 || width>1e6)
    throw Error('Invalid command or dead-zone half-width.');
  return width === 0 ? command : Math.sign(command)*Math.max(0,Math.abs(command)-width);
}
const mapped = (rows,width) => rows.map(row=>({...row,command:mapDeadzone(row.command,width)}));

export function compareCommandDeadzones(training, widths, options, {maxWork=MAX_DEADZONE_WORK}={}) {
  const original=validateRows(training); widths=checkedWidths(widths);
  // Reserve the complete library before invoking its fitter. Counting every
  // subset is conservative when maxTerms excludes some. Invalid options still
  // go through the maintained admission, never a second option normalizer.
  const n=options?.terms?.length??DEFAULT_TERMS.length;
  if(!Number.isInteger(n)||n<1||n>TERMS.length)throw Error('Invalid discovery feature-library size.');
  let perRow=n*n; // Full-library rank is computed even for small maxTerms.
  for(let mask=0;mask<2**n;mask++) {
    let k=0;for(let bit=0;bit<n;bit++)if(mask&(1<<bit))k++;
    perRow+=1+k+k*k;
  }
  const reservedWork=widths.length*original.length*perRow;
  if(!Number.isSafeInteger(maxWork)||maxWork<1||maxWork>MAX_DEADZONE_WORK||reservedWork>maxWork)
    throw Error('Complete dead-zone comparison exceeds the declared work limit; no partial family accepted.');
  const candidates=widths.map(width=>{
    const result=discover(mapped(original,width),options);
    return {width,model:result.selected,diagnostics:result.diagnostics,options:result.options,
      competitiveModels:result.competitive,
      mappedCommandSupport:new Set(original.map(r=>mapDeadzone(r.command,width))).size,
      originalCommandRange:{min:Math.min(...original.map(r=>r.command)),max:Math.max(...original.map(r=>r.command))}};
  });
  const admitted=candidates[0].options;
  const ranked=[...candidates].sort((a,b)=>a.model.metrics.score-b.model.metrics.score || a.width-b.width);
  const selected=ranked[0];
  const competitiveWidths=ranked.filter(c=>c.model.metrics.score-selected.model.metrics.score<=admitted.ambiguityDelta).map(c=>c.width);
  return {candidates,selected,competitiveWidths,options:admitted,training:original,
    work:{reserved:reservedWork,limit:maxWork},
    interpretation:'Training-only finite-grid comparison of symmetric, memoryless command mappings. Width and gain may be confounded. Score differences are heuristic, not confidence or physical actuator identification. Every selected structure is conditional on its mapping; held-out observations do not choose widths or terms.'};
}
export function predictDeadzone(candidate,row) {
  checkedWidths(candidate.width===0?[0]:[0,candidate.width]);
  return predict(candidate.model,{...row,command:mapDeadzone(row.command,candidate.width)});
}
export function evaluateDeadzone(candidate, observations) {
  const original=validateRows(observations,{allowEmpty:true});
  const result=evaluate(candidate.model,mapped(original,candidate.width));
  return {...result,rows:result.rows.map((r,i)=>({...r,command:original[i].command,mappedCommand:r.command}))};
}
export function simulateDeadzone(candidate,initial,settings={}) {
  return simulate(candidate.model,initial,{...settings,command:mapDeadzone(settings.command??0,candidate.width)});
}
export function exportDeadzoneInputs(session,widths) {
  const text=JSON.stringify({schema:DEADZONE_SCHEMA,notebook:JSON.parse(exportSession(session)),widths:checkedWidths(widths)},null,2);
  if(new TextEncoder().encode(text).length>MAX_TEXT_LENGTH)throw Error('Comparison inputs exceed 2 MB.');
  return text;
}
export function restoreDeadzoneInputs(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_TEXT_LENGTH)throw Error('Comparison inputs must be JSON smaller than 2 MB.');
  const raw=JSON.parse(text);
  if(raw?.schema!==DEADZONE_SCHEMA||Object.keys(raw).sort().join(',')!=='notebook,schema,widths')throw Error('Unsupported comparison input envelope; derived results are not accepted.');
  const widths=checkedWidths(raw.widths),session=restoreSession(JSON.stringify(raw.notebook));
  return {session,widths};
}
