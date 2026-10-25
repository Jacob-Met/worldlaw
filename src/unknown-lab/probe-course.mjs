// Simultaneous prediction-set comparison: each law keeps ONE coefficient
// throughout all offered states. Exact over supplied binary64 features/bounds.
import {rational, mul, neg, clip, serial} from './chronos-exact-halfplanes.mjs';
import {PROBE_MODELS} from './probe-response.mjs';
export function compareProbeCourse(models, probes, radius, work={count:0,limit:200000}) {
 if(!Array.isArray(models)||models.length>4||!Array.isArray(probes)||probes.length<1||probes.length>2||!Number.isFinite(radius)||radius<1e-8||radius>1000)throw Error('Use at most four models and one or two offered states with a bounded positive radius.');
 const prepared=models.map(c=>{
  const model=PROBE_MODELS.find(m=>m.id===c.id),range=c.coefficientInterval;
  if(!model||!Array.isArray(range)||range.length!==2||!range.every(x=>Number.isFinite(x)&&Math.abs(x)<=100)||range[0]>range[1])throw Error('Use admitted bounded coefficient intervals.');
  const features=probes.map(p=>{if(!p||!['position','rate'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=1e6))throw Error('Use bounded offered states.');return rational(model.feature(p));});
  return {id:c.id,range:range.map(rational),features};
 });
 if(new Set(prepared.map(c=>c.id)).size!==prepared.length)throw Error('Use distinct model identities.');
 const pairs=[],tolerance=mul(rational(radius),rational(2));
 for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
  const a=prepared[i],b=prepared[j];
  let polygon=[[a.range[0],b.range[0]],[a.range[1],b.range[0]],[a.range[1],b.range[1]],[a.range[0],b.range[1]]];
  for(let k=0;k<probes.length;k++){
   polygon=clip(polygon,a.features[k],neg(b.features[k]),tolerance,work);
   polygon=clip(polygon,neg(a.features[k]),b.features[k],tolerance,work);
  }
  pairs.push({hypotheses:[a.id,b.id],separable:polygon.length===0,overlapWitness:polygon.length?polygon[0].map(serial):null});
 }
 return pairs;
}

import {planProbeAcquisition} from './probe-planner.mjs';
export const PROBE_COURSE_SCHEMA='worldlaw.probe-course/v1';
export function planProbeCourses(training,input) {
 if(!Array.isArray(input?.probes)||input.probes.length>8)throw Error('Offer at most eight states for complete two-state comparison.');
 const single=planProbeAcquisition(training,input);
 const models=single.models,work={count:0,limit:200000};
 const base={schema:PROBE_COURSE_SCHEMA,training:single.training,settings:single.settings,courses:[],selected:null,status:'unavailable',
  qualification:'Each law keeps one training-admitted coefficient across both readouts. Exact separation is conditional on the supplied binary64 coefficients and features, inherited heuristic training screens and declared future radius. Neither physical feasibility nor calibrated coverage is established.'};
 if(models.length<2)return {...base,reason:single.reason};
 const courses=[];
 for(let i=0;i<single.candidates.length;i++)for(let j=i+1;j<single.candidates.length;j++){
  const states=[single.candidates[i],single.candidates[j]],cost=states[0].cost+states[1].cost;
  const comparisons=compareProbeCourse(models,states.map(p=>p.probe),single.settings.contrastRadius,work);
  const separated=comparisons.filter(p=>p.separable).length;
  courses.push({ids:states.map(p=>p.id),states,cost,withinBudget:cost<=single.settings.budget,comparisons,separated,total:comparisons.length,allSeparated:separated===comparisons.length,
   jointOnly:comparisons.filter(p=>p.separable&&states.every(s=>!s.comparisons.find(x=>x.hypotheses.join('/')===p.hypotheses.join('/')).separable)).map(p=>p.hypotheses)});
 }
 const selected=courses.filter(c=>c.withinBudget&&c.separated>0).sort((a,b)=>Number(b.allSeparated)-Number(a.allSeparated)||b.separated-a.separated||a.cost-b.cost||a.ids.join('/').localeCompare(b.ids.join('/')))[0]??null;
 return {...base,courses,selected,work:work.count,status:selected?(selected.allSeparated?'all-pairs-separated':'partial-separation'):'no-informative-course',
  reason:selected?'Best affordable two-state separation count, then lowest declared total effort. Individual probes remain available in the original chooser.':'No affordable offered two-state course separates a surviving pair.'};
}
export function exportProbeCourses(training,input){
 const plan=planProbeCourses(training,input);
 return JSON.stringify({schema:PROBE_COURSE_SCHEMA,training:plan.training,settings:plan.settings},null,2)+'\n';
}
export function importProbeCourses(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>4000000)throw Error('Use a course request below 4 MB.');
 const raw=JSON.parse(text);if(raw?.schema!==PROBE_COURSE_SCHEMA)throw Error('Expected a probe-course request.');
 return planProbeCourses(raw.training,raw.settings);
}
