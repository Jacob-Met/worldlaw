/** Original command coordinates with separately declared negative/positive thresholds. */
import {checkedWidths,compareCommandDeadzones,reserveCommandMappingWork} from './command-deadzone.mjs';
import {predict,evaluate,simulate} from './torque-discovery.mjs';
import {validateRows,MAX_TEXT_LENGTH} from '../data.mjs';
import {exportSession,restoreSession} from '../session.mjs';
export const ASYMMETRIC_DEADZONE_SCHEMA='worldlaw.asymmetric-command-deadzone-inputs/v1';
export function mapAsymmetricDeadzone(command,negative,positive){
 if(typeof command!=='number'||!Number.isFinite(command)||Math.abs(command)>1e6)throw Error('Invalid original command.');
 for(const x of [negative,positive])if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>1e6)throw Error('Invalid command threshold.');
 return command>positive?command-positive:command< -negative?command+negative:0;
}
const mapped=(rows,n,p)=>rows.map(r=>({...r,command:mapAsymmetricDeadzone(r.command,n,p)}));
export function compareAsymmetricCommandDeadzones(training,widths,options,budget={}){
 const original=validateRows(training),axis=checkedWidths(widths);
 const work=reserveCommandMappingWork(original,axis.length**2,options,budget);
 const candidates=[];
 for(const negative of axis)for(const positive of axis){
  // Reuse the maintained full discovery and option admission, not a new fitter.
  const result=compareCommandDeadzones(mapped(original,negative,positive),[0],options);
  const {width:discardedSymmetricWidth,...c}=result.selected;
  candidates.push({...c,negative,positive,originalCommandRange:{min:Math.min(...original.map(r=>r.command)),max:Math.max(...original.map(r=>r.command))}});
 }
 const ranked=[...candidates].sort((a,b)=>a.model.metrics.score-b.model.metrics.score || Number(a.negative!==a.positive)-Number(b.negative!==b.positive) || a.negative+a.positive-b.negative-b.positive || a.negative-b.negative);
 const selected=ranked[0],admitted=selected.options;
 const symmetric=[...candidates.filter(c=>c.negative===c.positive)].sort((a,b)=>a.model.metrics.score-b.model.metrics.score||a.negative-b.negative);
 return {training:original,widths:axis,candidates,selected,symmetricSelected:symmetric[0],options:admitted,work,
  competitive:ranked.filter(c=>c.model.metrics.score-selected.model.metrics.score<=admitted.ambiguityDelta).map(c=>({negative:c.negative,positive:c.positive})),
  interpretation:'Complete finite Cartesian threshold comparison using training readings only. Scores condition on offered thresholds and do not penalize the threshold search or give calibrated probabilities. Equal scores prefer symmetric mappings, then smaller total threshold. Separate thresholds can be confounded with gain, bias and mechanical terms; they do not identify actuator asymmetry, hysteresis or physical causation. Original receiving readings never choose a mapping.'};
}
export function predictAsymmetricDeadzone(candidate,row){return predict(candidate.model,{...row,command:mapAsymmetricDeadzone(row.command,candidate.negative,candidate.positive)});}
export function evaluateAsymmetricDeadzone(candidate,rows){
 const original=validateRows(rows,{allowEmpty:true});
 const result=evaluate(candidate.model,mapped(original,candidate.negative,candidate.positive));
 return {...result,rows:result.rows.map((r,i)=>({...r,command:original[i].command,mappedCommand:r.command}))};
}
export function simulateAsymmetricDeadzone(candidate,initial,settings={}){return simulate(candidate.model,initial,{...settings,command:mapAsymmetricDeadzone(settings.command??0,candidate.negative,candidate.positive)});}
export function exportAsymmetricDeadzoneInputs(session,widths){
 const text=JSON.stringify({schema:ASYMMETRIC_DEADZONE_SCHEMA,notebook:JSON.parse(exportSession(session)),widths:checkedWidths(widths)},null,2);
 if(new TextEncoder().encode(text).length>MAX_TEXT_LENGTH)throw Error('Comparison inputs exceed 2 MB.');return text;
}
export function restoreAsymmetricDeadzoneInputs(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_TEXT_LENGTH)throw Error('Comparison inputs must be JSON smaller than 2 MB.');
 const raw=JSON.parse(text);if(raw?.schema!==ASYMMETRIC_DEADZONE_SCHEMA||Object.keys(raw).sort().join(',')!=='notebook,schema,widths')throw Error('Unsupported comparison envelope; derived results are not accepted.');
 return {session:restoreSession(JSON.stringify(raw.notebook)),widths:checkedWidths(raw.widths)};
}
