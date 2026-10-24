// Compare two observables of the same retained readings; never refit on receiving.
import {compareCirculation} from './circulation.mjs';
import {analyzeCouplingNotebook} from './notebook.mjs';
import {evaluateCoupling} from './science.mjs';
export function inspectObservables(notebook,path){
 const work=compareCirculation(notebook,path),analysis=analyzeCouplingNotebook(work.notebook);
 const rows=work.observed.input.samples.map((s,i)=>({id:`loop-row-${i}`,q:s.q,torque:s.torque}));
 const candidates=analysis.discovery.candidates.map(model=>{
  const evaluation=evaluateCoupling(model,rows),circulation=work.candidates.find(m=>m.modelId===model.id);
  const components=evaluation.rows.flatMap((r,i)=>r.residual.map((residual,axis)=>{
   const coefficients=model.matrix[axis],predictionGuard=16*Number.EPSILON*(Math.abs(coefficients[0]*r.q[0])+Math.abs(coefficients[1]*r.q[1])+Math.abs(model.bias[axis]))+Number.MIN_VALUE;
   const subtractionGuard=4*Number.EPSILON*(Math.abs(r.torque[axis])+Math.abs(r.prediction[axis]));
   const allowance=work.observed.input.samples[i].torqueRadius[axis]+predictionGuard+subtractionGuard;
   return {sampleIndex:i,axis,extrapolated:circulation.extrapolatedRows.includes(i),q:r.q,observed:r.torque[axis],prediction:r.prediction[axis],residual,allowance,excess:Math.abs(residual)-allowance};
  }));
  const contradictions=components.filter(c=>c.excess>0),witness=contradictions.reduce((best,c)=>!best||c.excess>best.excess?c:best,null);
  return {modelId:model.id,label:model.label,workStatus:circulation.status,responseStatus:contradictions.length?'incompatible':'not-separated',contradictingComponents:contradictions.length,witness,
   workUnresolvedResponseContradicted:circulation.status==='not-separated'&&contradictions.length>0};
 });
 const conservative=analysis.discovery.competitive.filter(m=>m.matrix[0][1]===m.matrix[1][0]);
 const workBlindPairs=conservative.flatMap((a,i)=>conservative.slice(i+1).map(b=>[a.id,b.id]));
 return {work,candidates,workBlindPairs,pointProposal:analysis.plan,
  qualification:'Both observables reuse the same supplied rows; their evidence is not independent. Fitted coefficients are fixed, not uncertain parameters. Point proposals use training only and do not receive or execute hardware commands.'};
}
