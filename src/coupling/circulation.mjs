/** Two-coordinate closed-path receiving, reusing the maintained scalar work enclosure. */
import {evaluateCycle} from '../cycle-work/core.mjs';
import {pair, finite, requireThat, predictCoupling} from './science.mjs';
import {readCouplingNotebook, analyzeCouplingNotebook} from './notebook.mjs';
export const CIRCULATION_SCHEMA='worldlaw.coupling-circulation/v1';
const text=(v,name)=>{requireThat(typeof v==='string'&&v.trim().length>0&&v.length<=2000,`${name} needs 1–2000 characters.`);return v;};
export function normalizeCirculation(raw){
 requireThat(raw?.schema===CIRCULATION_SCHEMA,'Expected a coupled circulation input.');
 requireThat(raw.units?.position==='rad'&&raw.units?.torque==='N·m','Declare rad and N·m on both coordinates.');
 requireThat(raw.angleAssumption==='exact-declared'&&raw.interpolation==='piecewise-linear'&&raw.gaps==='none-declared','Declare exact angles, piecewise-linear torque on each segment and no unobserved gaps.');
 requireThat(['synthetic','measured'].includes(raw.source?.kind),'Declare measured or synthetic source.');
 const source={kind:raw.source.kind,label:text(raw.source.label,'Source'),coordinateConvention:text(raw.source.coordinateConvention,'Coordinate convention')};
 const integrationAllowance=finite(raw.integrationAllowance,'integrationAllowance',1e12);requireThat(integrationAllowance>=0,'Integration allowance must be nonnegative joules.');
 requireThat(Array.isArray(raw.samples)&&raw.samples.length>=4&&raw.samples.length<=1024,'Supply 4–1024 ordered readings including the closing reading.');
 const samples=raw.samples.map((s,i)=>{requireThat(!s?.gapBefore&&!s?.gapAfter,'Do not bridge missing observations.');const torqueRadius=pair(s?.torqueRadius,`samples[${i}].torqueRadius`,1e12);requireThat(torqueRadius.every(v=>v>=0),'Torque radii must be nonnegative.');return {q:pair(s?.q,`samples[${i}].q`),torque:pair(s?.torque,`samples[${i}].torque`,1e12).map(v=>v===0?0:v),torqueRadius};});
 requireThat(samples[0].q.every((v,a)=>v===samples.at(-1).q[a]),'The final reading must return to both initial coordinates; no closure is invented.');
 requireThat(samples.some(s=>s.q.some((v,a)=>v!==samples[0].q[a])),'A constant position cannot test circulation.');
 return {schema:CIRCULATION_SCHEMA,source,units:{position:'rad',torque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance,samples};
}
function axisWork(input,axis){
 const samples=input.samples.map(s=>({position:s.q[axis],jointTorque:s.torque[axis],torqueRadius:s.torqueRadius[axis]}));
 if(samples.every(s=>s.position===samples[0].position))return {work:0,torqueBound:0,roundingGuard:0,weights:samples.map(()=>0),segments:[]};
 return evaluateCycle({schema:'worldlaw.cycle-work/v1',source:input.source.label,units:{position:'rad',jointTorque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance:0,samples});
}
export function evaluateCirculation(raw){
 const input=normalizeCirculation(raw),axes=[axisWork(input,0),axisWork(input,1)],work=axes[0].work+axes[1].work;
 const torqueBound=axes.reduce((s,a)=>s+a.torqueBound,0);
 // Guard the additional two-axis summation and interval endpoint assembly.
 const roundingGuard=axes.reduce((s,a)=>s+a.roundingGuard,0)+32*Number.EPSILON*Math.max(1,...axes.map(a=>Math.abs(a.work)),torqueBound,input.integrationAllowance);
 const radius=torqueBound+roundingGuard+input.integrationAllowance,interval=[work-radius,work+radius];
 return {input,axes,work,torqueBound,roundingGuard,interval,conclusion:interval[0]>0?'positive-work':interval[1]<0?'negative-work':'zero-compatible'};
}
export function compareCirculation(rawNotebook,rawPath){
 const notebook=readCouplingNotebook(rawNotebook),observed=evaluateCirculation(rawPath);
 requireThat(observed.input.source.coordinateConvention===notebook.assumptions.coordinateConvention,'Loop and training coordinate conventions must match exactly.');
 const analysis=analyzeCouplingNotebook(notebook);
 const candidates=analysis.discovery.candidates.map(model=>{
  const extrapolatedRows=observed.input.samples.flatMap((s,i)=>s.q.some((v,a)=>v<model.domain[a].min||v>model.domain[a].max)?[i]:[]);
  try {
  const predicted=evaluateCirculation({...observed.input,integrationAllowance:0,samples:observed.input.samples.map(row=>({...row,torque:predictCoupling(model,row.q),torqueRadius:model.matrix.map((coeff,a)=>16*Number.EPSILON*(Math.abs(coeff[0]*row.q[0])+Math.abs(coeff[1]*row.q[1])+Math.abs(model.bias[a]))+Number.MIN_VALUE)}))});
  return {modelId:model.id,label:model.label,work:predicted.work,numericalInterval:predicted.interval,
   status:predicted.interval[1]<observed.interval[0]||predicted.interval[0]>observed.interval[1]?'incompatible':'not-separated',
   extrapolatedRows};
  }catch(error){return {modelId:model.id,label:model.label,work:null,numericalInterval:null,status:'unexecutable',reason:error.message,extrapolatedRows};}
 });
 return {notebook,observed,candidates,refused:analysis.discovery.refused,
  scope:'Signed two-coordinate polygonal work, not dissipation or proof of passivity. The final torque reading is a separate observation even at the same angles. Torque bounds apply to independently variable reading errors, not probabilities. The integration allowance is supplied, not estimated. Training coefficients are treated as fixed; their uncertainty is not propagated. Matching circulation alone does not receive the full response field. No acquisition time or physical source is authenticated.'};
}
export function exportCirculation(notebook,path){
 const result=compareCirculation(notebook,path);
 return JSON.stringify({schema:'worldlaw.coupling-circulation-notebook/v1',notebook:result.notebook,path:result.observed.input},null,2);
}
export function importCirculation(text){
 requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=4*1024*1024,'Circulation file must be at most 4 MiB.');
 const raw=JSON.parse(text);requireThat(raw?.schema==='worldlaw.coupling-circulation-notebook/v1','Expected an input-only circulation notebook.');
 return compareCirculation(raw.notebook,raw.path);
}
export function circulationExample(coordinateConvention,kind='directional'){
 requireThat(['directional','reciprocal','uncertain','quadrature'].includes(kind),'Unknown authored loop.');
 const q=kind==='quadrature'?[[0,0],[1,0],[1,2],[0,1],[0,0]]:[[0,0],[1,0],[1,1],[0,1],[0,0]];
 return {schema:CIRCULATION_SCHEMA,source:{kind:'synthetic',label:`Authored ${kind} loop; not measured apparatus`,coordinateConvention},units:{position:'rad',torque:'N·m'},angleAssumption:'exact-declared',interpolation:'piecewise-linear',gaps:'none-declared',integrationAllowance:0,
 samples:q.map(([x,y])=>({q:[x,y],torque:kind==='quadrature'?[2*x*y,x*x]:kind==='reciprocal'?[y,x]:[-y,x],torqueRadius:kind==='uncertain'?[2,2]:[0,0]}))};
}
