import {constructOrders} from './order-construction.mjs';
import {compareSmoothDrift} from './smooth-drift.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export const DRIFT_CONSTRUCTION_SCHEMA='worldlaw.drift-construction/v1';
export function constructDriftOrders(raw){
 check(raw?.schema===DRIFT_CONSTRUCTION_SCHEMA,'Expected drift-constrained construction inputs v1.');
 check(Object.keys(raw).every(k=>['schema','construction','drift','maximumBias'].includes(k)),'Retain original declarations only, without cached results.');
 check(typeof raw.maximumBias==='number'&&Number.isFinite(raw.maximumBias)&&raw.maximumBias>=0&&raw.maximumBias<=1e9,'Declare a finite drift-bias budget from 0 to 1e9 N·m.');
 const original=constructOrders(raw.construction),rows=[];let drift;
 for(let i=0;i<original.plans.length;i+=30){
  const evaluated=compareSmoothDrift({schema:'worldlaw.smooth-drift/v1',orders:{schema:'worldlaw.serial-orders/v2',sourceNote:original.inputs.sourceNote,rhos:original.inputs.rhos,periodic:original.inputs.periodic,plans:original.plans.slice(i,i+30)},drift:raw.drift});
  drift=evaluated.inputs.drift;
  for(const r of evaluated.rows){
   const base=original.rows[rows.length];check(base.id===r.id,'Construction order identity mismatch.');
   const driftStatus=drift.curvatureBound===0?'zero-curvature':r.worstBias<raw.maximumBias-r.engineeringAllowance?'within':r.worstBias>raw.maximumBias+r.engineeringAllowance?'outside':'boundary';
   rows.push({...r,maximumGain:base.maximumGain,noiseStatus:base.budgetStatus,driftStatus,admitted:base.budgetStatus==='within'&&['within','zero-curvature'].includes(driftStatus)});
  }
 }
 const admitted=rows.filter(r=>r.admitted),bestGain=admitted.length?Math.min(...admitted.map(r=>r.maximumGain)):null;
 return {inputs:{schema:DRIFT_CONSTRUCTION_SCHEMA,construction:original.inputs,drift,maximumBias:raw.maximumBias},plans:original.plans,rows,count:rows.length,noiseWithin:original.within,jointWithin:admitted.length,boundary:rows.filter(r=>r.noiseStatus==='boundary'||r.driftStatus==='boundary').length,bestGain,bestIds:bestGain===null?[]:admitted.filter(r=>r.maximumGain<=bestGain+original.gainTolerance).map(r=>r.id),originalBestIds:original.bestIds,originalBestGain:original.bestGain,gainTolerance:original.gainTolerance,interpretation:'Complete balanced contiguous orders only. Noise variance and torque drift bias have separate unchanged budgets. Finite periodic gain ranks only jointly admitted orders; all numerical ties remain. Engineering drift allowances and noise margins leave boundary cases unresolved, not physically infeasible. Zero declared curvature gives exactly zero contrast drift under the affine-cancellation assumption. No physical curvature, sensor noise, elapsed-time bound or continuous-frequency/correlation protection is inferred.'};
}
export function selectDriftOrders(raw,ids){
 const r=constructDriftOrders(raw);
 check(Array.isArray(ids)&&ids.length>=2&&ids.length<=32&&Array.from({length:ids.length},(_,i)=>Object.hasOwn(ids,i)).every(Boolean)&&new Set(ids).size===ids.length,'Explicitly select 2–32 distinct constructed orders.');
 const plans=ids.map(id=>{const p=r.plans.find(p=>p.id===id);check(p,'Unknown constructed order.');return p;});
 return compareSmoothDrift({schema:'worldlaw.smooth-drift/v1',orders:{schema:'worldlaw.serial-orders/v2',sourceNote:r.inputs.construction.sourceNote,rhos:r.inputs.construction.rhos,periodic:r.inputs.construction.periodic,plans},drift:r.inputs.drift}).inputs;
}
export function reopenDriftConstruction(text){check(typeof text==='string'&&text.length<=1048576,'Construction input exceeds 1 MiB.');return constructDriftOrders(JSON.parse(text));}
export function serializeDriftConstruction(raw){return JSON.stringify(constructDriftOrders(raw).inputs,null,2)+'\n';}
