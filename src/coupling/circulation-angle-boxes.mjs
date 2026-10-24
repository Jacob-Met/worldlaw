/** Coupled work over independent coordinate boxes, composed from the maintained exact scalar solver. */
import {normalizeCirculation,evaluateCirculation} from './circulation.mjs';
import {requireThat} from './science.mjs';
import {analyzeAngleBoxes,ANGLE_BOX_SCHEMA,ANGLE_BOX_ASSUMPTION} from '../cycle-work/angle-boxes.mjs';
export const CIRCULATION_BOX_SCHEMA='worldlaw.coupling-circulation-angle-boxes/v1';
export const CIRCULATION_BOX_ASSUMPTION='independent-coordinate-row-boxes-with-shared-first-last-angles';
const zero=()=>({integer:'0',powerOfTwo:0});
export function addExactWork(a,b){
 const e=Math.min(a.powerOfTwo,b.powerOfTwo);
 return {integer:((BigInt(a.integer)<<BigInt(a.powerOfTwo-e))+(BigInt(b.integer)<<BigInt(b.powerOfTwo-e))).toString(),powerOfTwo:e};
}
export function normalizeCirculationBoxes(raw){
 requireThat(raw?.schema===CIRCULATION_BOX_SCHEMA,'Expected '+CIRCULATION_BOX_SCHEMA+'.');
 requireThat(raw.assumption===CIRCULATION_BOX_ASSUMPTION,'Declare independent coordinate/row boxes with shared first/last angles.');
 const path=normalizeCirculation(raw.path);
 requireThat(typeof raw.radiusSource==='string'&&raw.radiusSource.trim().length>0&&raw.radiusSource.length<=2000,'Declare the source of coordinate radii (1–2000 characters).');
 requireThat(Array.isArray(raw.positionRadii)&&raw.positionRadii.length===path.samples.length,'Supply paired angular radii for every original row.');
 const positionRadii=raw.positionRadii.map((r,i)=>{
  requireThat(Array.isArray(r)&&r.length===2&&r.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e6),'Row '+(i+1)+' requires two finite nonnegative angular radii, at most 1e6 rad.');return [...r];
 });
 requireThat(positionRadii[0].every((v,a)=>v===positionRadii.at(-1)[a]),'Shared first/last angles require matching endpoint radii on both axes.');
 for(let a=0;a<2;a++)if(path.samples.every(s=>s.q[a]===path.samples[0].q[a]))
  requireThat(positionRadii.every(r=>r[a]===0),'A constant nominal coordinate with nonzero radii is not yet supported by the maintained scalar solver.');
 return {schema:CIRCULATION_BOX_SCHEMA,assumption:CIRCULATION_BOX_ASSUMPTION,radiusSource:raw.radiusSource.trim(),path,positionRadii};
}
export function analyzeCirculationBoxes(raw){
 const bundle=normalizeCirculationBoxes(raw),{path}=bundle;
 const firstVariable=[0,1].find(a=>path.samples.some(s=>s.q[a]!==path.samples[0].q[a]));
 const axes=[0,1].map(axis=>{
  if(path.samples.every(s=>s.q[axis]===path.samples[0].q[axis]))return {axis,status:'exact-constant',minimum:{work:zero(),corners:null},maximum:{work:zero(),corners:null},interval:[zero(),zero()]};
  const scalar=analyzeAngleBoxes({schema:ANGLE_BOX_SCHEMA,assumption:ANGLE_BOX_ASSUMPTION,radiusSource:bundle.radiusSource,
   positionRadii:bundle.positionRadii.map(r=>r[axis]),cycle:{schema:'worldlaw.cycle-work/v1',source:path.source.label,units:{position:'rad',jointTorque:'N·m'},angleAssumption:'exact-declared',interpolation:path.interpolation,gaps:path.gaps,
    integrationAllowance:axis===firstVariable?path.integrationAllowance:0,
    samples:path.samples.map(s=>({position:s.q[axis],jointTorque:s.torque[axis],torqueRadius:s.torqueRadius[axis]}))}});
  return {axis,status:'bounded',...scalar};
 });
 const interval=[0,1].map(i=>addExactWork(axes[0].interval[i],axes[1].interval[i]));
 const extremum=name=>({work:addExactWork(axes[0][name].work,axes[1][name].work),axisCorners:axes.map(a=>a[name].corners)});
 return {bundle,nominal:evaluateCirculation(path),axes,minimum:extremum('minimum'),maximum:extremum('maximum'),interval,
  conclusion:BigInt(interval[0].integer)>0n?'positive-work':BigInt(interval[1].integer)<0n?'negative-work':'zero-compatible',
  scope:'Exact extrema of the supplied polygon over independent coordinate/torque boxes. Axis witnesses can be attained simultaneously under this explicit independence assumption. First/last angles are shared; torque readings remain separate. Integration allowance is added once. No fitted-law receiving, continuous-path work, physical closure, dissipation or calibrated confidence is established.'};
}
export const exportCirculationBoxes=raw=>JSON.stringify(normalizeCirculationBoxes(raw),null,2);
export function importCirculationBoxes(text){
 requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=4*1024*1024,'Bounded circulation input must be at most 4 MiB.');
 return normalizeCirculationBoxes(JSON.parse(text));
}
