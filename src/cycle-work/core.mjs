/** Signed work along an ordered polygon. No full-state closure claim. */
export class CycleWorkError extends Error { constructor(message) { super(message); this.name='CycleWorkError'; } }
const check=(ok,message)=>{if(!ok)throw new CycleWorkError(message);};
const finite=(x,bound=1e12)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=bound;
export function normalizeCycle(input) {
 check(input?.schema==='worldlaw.cycle-work/v1','Expected worldlaw.cycle-work/v1.');
 check(input.units?.position==='rad'&&input.units?.jointTorque==='N·m','Declare rad and N·m units.');
 check(input.angleAssumption==='exact-declared','Explicitly declare angleAssumption: exact-declared; angular uncertainty is unsupported.');
 check(typeof input.source==='string'&&input.source.trim().length>0&&input.source.length<=2000,'Declare a source (1–2000 characters).');
 check(input.interpolation==='piecewise-linear','Declare piecewise-linear torque versus angle on each ordered segment.');
 check(input.gaps==='none-declared','Confirm no unobserved gaps; split incomplete paths instead.');
 check(Array.isArray(input.samples)&&input.samples.length>=3&&input.samples.length<=4096,'Supply 3–4096 ordered samples.');
 check(finite(input.integrationAllowance)&&input.integrationAllowance>=0,'Declare a nonnegative integration allowance in joules.');
 const samples=input.samples.map((s,i)=>{
  check(s&&finite(s.position,1e6)&&finite(s.jointTorque)&&finite(s.torqueRadius)&&s.torqueRadius>=0,'Sample '+i+' needs finite position, torque, and nonnegative torqueRadius.');
  check(!s.gapBefore&&!s.gapAfter,'Unobserved gaps cannot be bridged.');
  return {position:s.position,jointTorque:s.jointTorque,torqueRadius:s.torqueRadius};
 });
 check(samples[0].position===samples.at(-1).position,'Return to exactly the initial declared angle; no closing segment is invented.');
 check(samples.some(s=>s.position!==samples[0].position),'A constant-angle record cannot test cyclic work.');
 return {schema:input.schema,source:input.source.trim(),units:{position:'rad',jointTorque:'N·m'},angleAssumption:input.angleAssumption,interpolation:input.interpolation,gaps:input.gaps,integrationAllowance:input.integrationAllowance,samples};
}
export function evaluateCycle(input) {
 const normalized=normalizeCycle(input),rows=normalized.samples;
 const segments=[];
 // Form shared coefficients directly. Summing adjacent rounded half-deltas
 // can erase a small coefficient when a path reverses near a large angle.
 const weightErrors=[];
 const weights=rows.map((row,i)=>{
  const left=i===0?row.position:rows[i-1].position;
  const right=i===rows.length-1?row.position:rows[i+1].position;
  const w=(right-left)/2;
  weightErrors.push(Number.EPSILON*((Math.abs(right)+Math.abs(left))/2+Math.abs(w))+Number.MIN_VALUE);
  return w;
 });
 let segmentWork=0,travel=0;
 for(let i=0;i<rows.length-1;i++){
  const a=rows[i],b=rows[i+1],delta=b.position-a.position;
  const contribution=delta*(a.jointTorque+b.jointTorque)/2;
  segmentWork+=contribution;travel+=Math.abs(delta);
  segments.push({from:i,to:i+1,delta,work:contribution});
 }
 // The shared-weight expression defines the result. Keep the segment ledger
 // diagnostic: separately rounded segment arithmetic need not sum identically.
 let work=0,torqueBound=0,weightedMagnitude=0,weightWorkError=0,weightBoundError=0;
 weights.forEach((w,i)=>{
  const product=w*rows[i].jointTorque;
  work+=product;weightedMagnitude+=Math.abs(product);
  torqueBound+=Math.abs(w)*rows[i].torqueRadius;
  weightWorkError+=weightErrors[i]*Math.abs(rows[i].jointTorque);
  weightBoundError+=weightErrors[i]*rows[i].torqueRadius;
 });
 // EPSILON is twice unit roundoff. gamma covers product + sequential sum
 // errors using uncancelled magnitudes. Weight subtraction errors affect both
 // the nominal work and its torque bound. A further guard encloses arithmetic
 // used to assemble these nonnegative bounds, including subnormal/final sums.
 const operations=rows.length+2;
 const gamma=operations*Number.EPSILON/(1-operations*Number.EPSILON);
 const productSumError=gamma*(weightedMagnitude+torqueBound);
 const boundAssemblyGuard=64*Number.EPSILON*rows.length*Math.max(1,weightedMagnitude,torqueBound,weightWorkError,weightBoundError,normalized.integrationAllowance);
 const roundingGuard=weightWorkError+weightBoundError+productSumError+boundAssemblyGuard;
 const radius=torqueBound+normalized.integrationAllowance+roundingGuard;
 const interval=[work-radius,work+radius];
 return {input:normalized,work,interval,torqueBound,integrationAllowance:normalized.integrationAllowance,roundingGuard,
 arithmetic:{weightWorkError,weightBoundError,productSumError,boundAssemblyGuard,weightedMagnitude},
 segmentWork,segmentRoundingDifference:segmentWork-work,travel,weights,segments,
 conclusion:interval[0]>0?'positive-work':interval[1]<0?'negative-work':'zero-compatible',
 scope:'Ordered polygonal work with exact declared angles and bounded torque errors. Returning angle does not establish full-state closure. Nonzero polygonal work does not by itself identify continuous-path work, dissipation, energy production, or a mechanism.'};
}
export function exportCycle(input) { return JSON.stringify(normalizeCycle(input),null,2); }
export function importCycle(text) {
 check(typeof text==='string'&&new TextEncoder().encode(text).byteLength<=2000000,'Cycle JSON must be at most 2 MB of UTF-8.');
 return normalizeCycle(JSON.parse(text));
}
export function cycleExample(kind='loop') {
 check(['loop','conservative','uncertain','quadrature'].includes(kind),'Unknown example.');
 const position=kind==='quadrature'?[0,1,2,.5,0]:[0,1,2,2,1,0];
 const torque=kind==='quadrature'?position.map(x=>x*x):kind==='conservative'?position.map(x=>2*x+3):[1,3,5,3,1,-1];
 return {schema:'worldlaw.cycle-work/v1',source:kind==='quadrature'?'Authored conservative torque = angle squared; unequal sampling creates polygonal artifact':'Authored polygon control; not a physical acquisition',units:{position:'rad',jointTorque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance:0,
 samples:position.map((x,i)=>({position:x,jointTorque:torque[i],torqueRadius:kind==='uncertain'?2:kind==='quadrature'?0:.02}))};
}
