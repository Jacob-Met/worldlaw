// Prospective joint qualification: one exact noise request, separate drift criterion.
import {inspectCorrelationBand} from './correlation-band.mjs';
import {compareSmoothDrift} from './smooth-drift.mjs';
const require=(ok,message)=>{if(!ok)throw Error(message);};
export function qualifyOfferedPlans(raw){
 require(raw?.schema==='worldlaw.joint-plan-qualification/v1','Expected explicit offered-plan qualification declaration.');
 require(Object.keys(raw).every(k=>['schema','correlation','drift','maximumBias'].includes(k)),'Retain original inputs only.');
 require(typeof raw.maximumBias==='number'&&Number.isFinite(raw.maximumBias)&&raw.maximumBias>=0&&raw.maximumBias<=1e9,'Declare a finite nonnegative drift bias budget.');
 // One existing exact request preserves its whole-course work and bit limits.
 const exact=inspectCorrelationBand(raw.correlation);
 const drift=compareSmoothDrift({schema:'worldlaw.smooth-drift/v1',orders:exact.inputs.comparison,drift:raw.drift});
 const rows=exact.rows.map((r,i)=>{
  const d=drift.rows[i];require(d.id===r.id,'Source order mismatch between independent criteria.');
  const driftStatus=drift.inputs.drift.curvatureBound===0?'zero-curvature':d.worstBias<raw.maximumBias-d.engineeringAllowance?'within':d.worstBias>raw.maximumBias+d.engineeringAllowance?'outside':'boundary';
  const noiseAdmitted=r.status==='below-budget-entire-band'||r.status==='exact-budget-boundary';
  const admitted=noiseAdmitted&&['within','zero-curvature'].includes(driftStatus);
  return {id:r.id,admitted,noiseStatus:r.status,driftStatus,continuousNoise:r,drift:d,maximumGain:Math.max(...r.artifacts.map(a=>a.gain))};
 });
 const admitted=rows.filter(r=>r.admitted),bestGain=admitted.length?Math.min(...admitted.map(r=>r.maximumGain)):null,gainTolerance=1e-10;
 return {inputs:{schema:raw.schema,correlation:exact.inputs,drift:drift.inputs.drift,maximumBias:raw.maximumBias},rows,bestGain,bestIds:bestGain===null?[]:admitted.filter(r=>r.maximumGain<=bestGain+gainTolerance).map(r=>r.id),gainTolerance,
 interpretation:'Explicit offered plans only. Exact noise qualification is conditional on the declared mathematical AR(1) band, with equality to its budget retained as a distinct admitted status. Drift qualification uses a separate physical-unit budget and noncertified engineering allowance. Unresolved exact noise or drift boundaries are not admitted. No combined score, inferred curvature, continuous-frequency protection or complete generated-family optimum is claimed.'};
}

export function reopenJointQualification(text){require(typeof text==='string'&&text.length<=1048576,'Use at most 1 MiB of raw declarations.');return qualifyOfferedPlans(JSON.parse(text));}
export function serializeJointQualification(raw){return JSON.stringify(qualifyOfferedPlans(raw).inputs,null,2)+'\n';}
export function selectedJointDrift(raw,ids){const r=qualifyOfferedPlans(raw);require(Array.isArray(ids)&&ids.length>=2&&ids.length<=16&&Array.from({length:ids.length},(_,i)=>Object.hasOwn(ids,i)).every(Boolean)&&new Set(ids).size===ids.length,'Explicitly select 2–16 distinct offered plans.');const plans=ids.map(id=>{const p=r.inputs.correlation.comparison.plans.find(p=>p.id===id);require(p,'Unknown offered plan.');return p;});return compareSmoothDrift({schema:'worldlaw.smooth-drift/v1',orders:{...r.inputs.correlation.comparison,plans},drift:r.inputs.drift}).inputs;}
