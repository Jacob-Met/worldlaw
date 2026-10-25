import {transportWitness} from './readout-transport.mjs';
import {validateRecovery,evaluateRecovery,evaluateRecoveryReadoutBounds} from './recovery-response.mjs';
import {validateNotebook} from './paired-history.mjs';
import {rational,add,div,enclosure} from './chronos-exact-halfplanes.mjs';
export const RECOVERY_TRANSPORT_SCHEMA='worldlaw.recovery-population-sensitivity/v1';
const fields=['command','position','rate'];
const fail=message=>{throw Error(message);};
export function validateRecoveryTransport(raw){
 if(!raw||raw.schema!==RECOVERY_TRANSPORT_SCHEMA)fail('Expected a recovery population-sensitivity case.');
 const study=validateRecovery(raw.study),settings=raw.settings;
 if(!settings||!study.training.some(r=>r.recordingId===settings.referenceRecordingId))fail('Choose an original training recording as the reference population.');
 const sensitivity={};for(const key of fields){const v=settings.sensitivity?.[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e6)fail('Declare nonnegative preparation-contrast sensitivities at most 1e6 for every coordinate.');sensitivity[key]=v;}
 return {schema:RECOVERY_TRANSPORT_SCHEMA,study,settings:{referenceRecordingId:settings.referenceRecordingId,sensitivity}};
}
function states(run){
 const pairs=validateNotebook(run.evidence).pairs,groups=[[],[]],reasons=[];
 for(const p of pairs){
  if(p.reference.sampleIndex===undefined){reasons.push({pairId:p.id,reason:'order-not-recorded'});continue;}
  if(fields.some(k=>p.reference[k]!==p.conditioned[k])){reasons.push({pairId:p.id,reason:'within-pair-coordinate-mismatch'});continue;}
  const order=+(p.reference.sampleIndex>p.conditioned.sampleIndex);
  groups[order].push({pairId:p.id,firstIndex:Math.min(p.reference.sampleIndex,p.conditioned.sampleIndex),state:fields.map(k=>p.reference[k])});
 }
 for(const group of groups)group.sort((a,b)=>a.firstIndex-b.firstIndex);
 if(groups.some(g=>g.length<4))reasons.push({reason:'at-least-four-pairs-per-order-required'});
 return {groups,reasons};
}
export function compareRecoveryTransport(raw){
 const input=validateRecoveryTransport(raw),{study,settings}=input,baseline=evaluateRecovery(study);
 const originals=[...study.training,...study.challenges],target=states(study.training.find(r=>r.recordingId===settings.referenceRecordingId));
 const originalRows=new Map([...baseline.fit.training,...baseline.tests[0].rows].map(r=>[r.recordingId,r]));
 const bounds=Object.create(null);
 const recordings=originals.map((run,index)=>{
  const source=states(run),reasons=[...source.reasons],observed=originalRows.get(run.recordingId);
  if(target.reasons.length)reasons.push({reason:'reference-population-unavailable'});
  if(source.groups.some((g,i)=>g.length!==target.groups[i].length))reasons.push({reason:'different-per-order-pair-counts',actual:source.groups.map(g=>g.length),required:target.groups.map(g=>g.length)});
  const common={recordingId:run.recordingId,role:index<study.training.length?'training':'challenge',delaySeconds:run.delaySeconds,original:observed,reasons};
  if(reasons.length){bounds[run.recordingId]=null;return {...common,status:'unavailable',assignments:[],allowance:null};}
  const assignments=source.groups.map((g,i)=>{
   const witness=transportWitness(g.map(p=>p.state),target.groups[i].map(p=>p.state),fields.map(k=>settings.sensitivity[k]));
   return {order:i?'conditioned-first':'reference-first',...witness,pairs:g.map((p,j)=>({originalPairId:p.pairId,targetPairId:target.groups[i][witness.assignment[j]].pairId,originalState:p.state,targetState:target.groups[i][witness.assignment[j]].state}))};
  });
  const costs=assignments.map(w=>[BigInt(w.exact.numerator),BigInt(w.exact.denominator)]),exact=div(add(costs[0],costs[1]),rational(2));
  const allowance=enclosure(exact),screen=enclosure(add(rational(observed.boundary),exact)).upper;
  bounds[run.recordingId]=screen;
  return {...common,status:'bounded',allowance,combinedScreen:screen,assignments};
 });
 const trainingAvailable=recordings.filter(r=>r.role==='training').every(r=>r.status==='bounded');
 return {schema:'worldlaw.recovery-population-sensitivity-result/v1',input,baseline,recordings,
  status:trainingAvailable?'conditional-comparison':'training-population-unavailable',comparison:trainingAvailable?evaluateRecoveryReadoutBounds(study,bounds):null,
  qualification:'Each allowance concerns the contrast at this recording’s delay on the reference state population, not the contrast in the reference recording at a different delay. Sensitivities are declared uniform limits on preparation contrast, not measured calibration. A complete original-state coupling certifies an upper bound; numerical optimality is not certified. Passing intervals means only not excluded by these bounds, not a jointly constructed response, calibrated confidence, causal adjustment or physical validation.'};
}
export function exportRecoveryTransport(raw){return JSON.stringify(validateRecoveryTransport(raw))+'\n';}
export function importRecoveryTransport(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2100000)fail('Use a population-sensitivity case below 2.1 MB.');return validateRecoveryTransport(JSON.parse(text));}
