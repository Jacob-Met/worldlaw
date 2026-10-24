import {discover,evaluate} from './torque-discovery.mjs';
const MAX_STATES=32, MAX_ROW_MODELS=1_000_000;
/** Diagnostic conditional on the supplied structure, never a structure selector. */
export function diagnoseStateSupport(model,observations){
 const original=evaluate(model,observations), groups=new Map();
 for(let i=0;i<original.rows.length;i++){
  const r=original.rows[i],key=JSON.stringify([r.command,r.position,r.rate]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 const terms=model.terms.map(t=>t.id), structures=terms.length?2**terms.length:1;
 const rowModels=[...groups.values()].reduce((sum,g)=>sum+(original.count-g.length)*structures,0);
 const base={count:original.count,uniqueStates:groups.size,terms:[...terms],rowModels,
  limits:{states:MAX_STATES,rowModels:MAX_ROW_MODELS}};
 if(groups.size>MAX_STATES||rowModels>MAX_ROW_MODELS)return {...base,status:'work-limit',results:[]};
 const results=[];
 for(const indices of groups.values()){
  const excluded=new Set(indices),first=original.rows[indices[0]],kept=observations.filter((_,i)=>!excluded.has(i));
  const entry={state:{command:first.command,position:first.position,rate:first.rate},removed:indices.length,remaining:kept.length};
  if(kept.length<8){results.push({...entry,status:'insufficient-rows'});continue;}
  let fitted=model;
  if(terms.length){
   // Reuse the maintained scalar fitter. Ignore its ranking and take only the
   // candidate with exactly the already-inspected structure.
   const discovery=discover(kept,{terms,maxTerms:terms.length});
   fitted=discovery.candidates.find(candidate=>candidate.terms.length===terms.length);
   if(!fitted){results.push({...entry,status:'structure-unavailable'});continue;}
  }
  const prediction=evaluate(fitted,observations);
  const shifts=prediction.rows.map((r,i)=>r.prediction-original.rows[i].prediction);
  results.push({...entry,status:'fitted',coefficients:fitted.terms.map(t=>({id:t.id,value:t.coefficient,
   change:t.coefficient-model.terms.find(o=>o.id===t.id).coefficient})),
   predictionShiftRMS:Math.hypot(...shifts)/Math.sqrt(original.count),
   maxPredictionShift:Math.max(...shifts.map(Math.abs))});
 }
 return {...base,status:original.count?'computed':'no-observations',results,
  fittedCount:results.filter(r=>r.status==='fitted').length,
  unavailableCount:results.filter(r=>r.status!=='fitted').length};
}
