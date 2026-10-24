import {compareOrderArtifacts} from './periodic-order.mjs';
import {serialOrderWeights} from './serial-order.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export const SMOOTH_DRIFT_SCHEMA='worldlaw.smooth-drift/v1';
/** Conditional prospective response. No observed readings are fitted. */
export function compareSmoothDrift(raw){
 check(raw?.schema===SMOOTH_DRIFT_SCHEMA,'Expected prospective smooth-drift inputs v1.');
 check(Object.keys(raw).every(k=>['schema','orders','drift'].includes(k)),'Save original inputs only, without cached results.');
 check(raw.orders?.schema==='worldlaw.serial-orders/v2','Retain a v2 order comparison with its noise and finite periodic declarations.');
 const d=raw.drift;
 check(d&&Object.keys(d).every(k=>['curvatureBound','sourceNote'].includes(k)),'Declare only the curvature bound and its basis.');
 check(typeof d.curvatureBound==='number'&&Number.isFinite(d.curvatureBound)&&d.curvatureBound>=0&&d.curvatureBound<=1000,'Declare curvature from 0 to 1000 N·m per acquisition-index².');
 check(typeof d.sourceNote==='string'&&d.sourceNote.trim()&&d.sourceNote.length<=2000,'Supply a curvature assumption or source (up to 2000 characters).');
 const baseline=compareOrderArtifacts(raw.orders);
 const rows=baseline.rows.map((row,index)=>{
  const plan=baseline.inputs.plans[index],weights=serialOrderWeights(plan.pairs).sort((a,b)=>a.sampleIndex-b.sampleIndex);
  const ab=plan.pairs.filter(p=>p.reference<p.conditioned).length,ba=plan.pairs.length-ab,denominator=2*ab*ba;
  // Exact integer numerators preserve affine cancellation before any divisions.
  // Admitted counts ≤128 and span ≤1e6 keep every integer sum safely below 2^53.
  const coefficients=new Map();
  for(const p of plan.pairs){const numerator=p.reference<p.conditioned?ba:ab;coefficients.set(p.reference,-numerator);coefficients.set(p.conditioned,numerator);}
  const origin=weights[0].sampleIndex,points=weights.map(w=>({index:w.sampleIndex,offset:w.sampleIndex-origin,weight:w.weight,numerator:coefficients.get(w.sampleIndex)}));
  check(points.reduce((s,p)=>s+p.numerator,0)===0&&points.reduce((s,p)=>s+p.numerator*p.offset,0)===0,'This order does not cancel an arbitrary affine baseline.');
  const kernel=t=>points.reduce((s,p)=>s+p.numerator*Math.max(0,p.offset-t),0);
  const cells=[];let coefficient=0;
  for(let i=1;i<points.length;i++){
   const from=points[i-1].offset,to=points[i].offset,u=kernel(from),v=kernel(to),width=to-from;
   const split=u*v<0?from+width*Math.abs(u)/(Math.abs(u)+Math.abs(v)):null;
   const area=width*(split===null?(Math.abs(u)+Math.abs(v))/2:(u*u+v*v)/(2*(Math.abs(u)+Math.abs(v))))/denominator;
   coefficient+=area;
   cells.push({from,to,kernelFrom:u/denominator,kernelTo:v/denominator,split,area});
  }
  let value=0,slope=0;const segments=[],samples=[{sampleIndex:origin,offset:0,value:0,weight:points[0].weight}];
  for(let i=0;i<cells.length;i++){
   const cell=cells[i],cuts=cell.split===null?[cell.from,cell.to]:[cell.from,cell.split,cell.to];
   for(let j=1;j<cuts.length;j++){
    const from=cuts[j-1],to=cuts[j],mid=(from+to)/2;
    const k=cell.kernelFrom+(cell.kernelTo-cell.kernelFrom)*(mid-cell.from)/(cell.to-cell.from);
    const curvature=Math.sign(k)*d.curvatureBound,dt=to-from;
    segments.push({from,to,value,slope,curvature});value+=slope*dt+.5*curvature*dt*dt;slope+=curvature*dt;
   }
   samples.push({sampleIndex:origin+cell.to,offset:cell.to,value,weight:points[i+1].weight});
  }
  const worstBias=coefficient*d.curvatureBound,witnessContrast=samples.reduce((s,p)=>s+p.weight*p.value,0);
  const arithmeticScale=Math.max(1,Math.abs(worstBias),...samples.map(p=>Math.abs(p.weight*p.value))),engineeringAllowance=4096*Number.EPSILON*points.length*arithmeticScale;
  check([coefficient,worstBias,witnessContrast,engineeringAllowance,...samples.map(p=>p.value)].every(Number.isFinite),'Smooth-drift arithmetic became nonfinite.');
  return {...row,curvatureCoefficient:coefficient,worstBias,witnessContrast,witnessResidual:witnessContrast-worstBias,engineeringAllowance,
   witnessStatus:Math.abs(witnessContrast-worstBias)<=engineeringAllowance?'numerically-received':'unresolved-arithmetic',origin,cells,segments,samples};
 });
 return {inputs:{schema:SMOOTH_DRIFT_SCHEMA,orders:baseline.inputs,drift:{curvatureBound:d.curvatureBound,sourceNote:d.sourceNote}},rows,
  interpretation:'Conditional on an absolutely continuous baseline derivative with |second derivative| bounded almost everywhere in acquisition-index coordinates. Arbitrary affine baselines cancel. The piecewise-quadratic displayed drift attains the exact-real kernel bound; its floating-point receiving residual and engineering allowance are not certified bounds. No elapsed-time bound, sensor calibration, observed correction, probability or combined noise/artifact score is inferred.'};
}
export function reopenSmoothDrift(text){check(typeof text==='string'&&text.length<=1024*1024,'Smooth-drift inputs exceed 1 MiB.');let raw;try{raw=JSON.parse(text);}catch{throw Error('Smooth-drift input must be valid JSON.');}return compareSmoothDrift(raw);}
export function serializeSmoothDrift(raw){return JSON.stringify(compareSmoothDrift(raw).inputs,null,2)+'\n';}
export function driftValue(row,offset){check(typeof offset==='number'&&Number.isFinite(offset)&&offset>=0&&offset<=row.acquisitionSpan,'Inspect within the declared acquisition span.');const s=row.segments.find(s=>offset>=s.from&&offset<=s.to);check(s,'No drift segment at this position.');const dt=offset-s.from;return s.value+s.slope*dt+.5*s.curvature*dt*dt;}
