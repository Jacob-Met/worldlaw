import {compareOrderArtifacts} from './periodic-order.mjs';
const check=(ok,m)=>{if(!ok)throw Error(m);};
export function constructOrders(raw){
 check(raw?.schema==='worldlaw.order-construction/v1','Expected balanced-order construction inputs.');
 check([8,10,12].includes(raw.pairCount),'Choose 8, 10 or 12 paired acquisitions.');
 check(typeof raw.maximumVariance==='number'&&Number.isFinite(raw.maximumVariance)&&raw.maximumVariance>=0&&raw.maximumVariance<=4,'Declare normalized variance budget from 0 to 4.');
 const plans=[];
 for(let mask=0;mask<2**raw.pairCount;mask++){
  if(mask.toString(2).replaceAll('0','').length!==raw.pairCount/2)continue;
  plans.push({id:'order-'+mask,pairs:Array.from({length:raw.pairCount},(_,i)=>({reference:2*i+1-(mask>>i&1),conditioned:2*i+(mask>>i&1)}))});
 }
 const course={schema:'worldlaw.serial-orders/v2',sourceNote:raw.sourceNote,rhos:raw.rhos,periodic:raw.periodic};
 const rows=[];let normalized;
 // Complete bounded enumeration, not sampled search or early-stopped ranking.
 for(let i=0;i<plans.length;i+=30){const r=compareOrderArtifacts({...course,plans:plans.slice(i,i+30)});normalized=r.inputs;rows.push(...r.rows);}
 const tolerance=1e-12,gainTolerance=1e-10;
 for(const row of rows){row.budgetStatus=row.worstVariance<raw.maximumVariance-tolerance?'within':row.worstVariance>raw.maximumVariance+tolerance?'outside':'boundary';row.maximumGain=Math.max(...row.artifacts.map(a=>a.gain));delete row.minimaxTie;delete row.dominatedBy;}
 const admitted=rows.filter(r=>r.budgetStatus==='within'),boundary=rows.filter(r=>r.budgetStatus==='boundary');
 const best=admitted.length?Math.min(...admitted.map(r=>r.maximumGain)):null;
 return {inputs:{schema:raw.schema,pairCount:raw.pairCount,maximumVariance:raw.maximumVariance,sourceNote:normalized.sourceNote,rhos:normalized.rhos,periodic:normalized.periodic},plans,rows,
  count:rows.length,within:admitted.length,boundary:boundary.length,bestGain:best,bestIds:best===null?[]:admitted.filter(r=>r.maximumGain<=best+gainTolerance).map(r=>r.id),
  tolerance,gainTolerance,interpretation:'Complete balanced orders over contiguous adjacent pairs only. Within-budget numerical results use a 1e-12 margin; boundary cases are unresolved, never selected as admitted winners. Gain ties use 1e-10. No physical calibration, certified error enclosure, continuous-frequency protection or globally optimal acquisition is established.'};
}
export function selectConstructedOrders(raw,ids){
 const r=constructOrders(raw);
 check(Array.isArray(ids)&&ids.length>=2&&ids.length<=32&&Array.from({length:ids.length},(_,i)=>Object.hasOwn(ids,i)).every(Boolean)&&new Set(ids).size===ids.length,'Explicitly select 2–32 distinct generated orders.');
 const plans=ids.map(id=>{const p=r.plans.find(p=>p.id===id);check(p,'Unknown generated order.');return p;});
 return compareOrderArtifacts({schema:'worldlaw.serial-orders/v2',sourceNote:r.inputs.sourceNote,rhos:r.inputs.rhos,periodic:r.inputs.periodic,plans}).inputs;
}
