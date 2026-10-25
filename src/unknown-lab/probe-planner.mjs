import {screenIntervalPairs,selectSeparatingCandidate} from '../experiment-design/interval-separation.mjs';
// Bounded manual acquisition choice; no physical control or calibrated information gain.
import {fitProbeModels,validateProbeStudy,probeModelsFor} from './probe-response.mjs';
export const PROBE_PLAN_SCHEMA='worldlaw.probe-plan/v1';
const fail=m=>{throw Error(m);};
const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
function settings(raw){
 if(!raw||!Array.isArray(raw.probes)||raw.probes.length<1||raw.probes.length>32)fail('Offer 1–32 candidate probe states.');
 if(!finite(raw.contrastRadius,1e-8,1000))fail('Declare a future contrast screening radius from 1e-8 to 1000 N·m.');
 if(!finite(raw.budget,0,1e6))fail('Declare a nonnegative effort budget at most 1e6.');
 const ids=new Set(),states=new Set();
 const probes=raw.probes.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id)||ids.has(p.id))fail('Candidate identifiers must be distinct short safe strings.');ids.add(p.id);
  if(!finite(p.position,-1e6,1e6)||!finite(p.rate,-1e6,1e6)||!finite(p.cost,0,1e6))fail('Declare bounded probe angle, rate and nonnegative effort cost.');
  const key=JSON.stringify([p.position,p.rate]);if(states.has(key))fail('Offer each angle/rate state only once.');states.add(key);
  return {id:p.id,position:p.position,rate:p.rate,cost:p.cost};
 });
 return {probes,contrastRadius:raw.contrastRadius,budget:raw.budget};
}
export function planProbeAcquisition(training,input){
 const config=settings(input),study=validateProbeStudy(training),fit=fitProbeModels(study);
 const models=fit.candidates.filter(c=>c.compatible);
 const base={schema:PROBE_PLAN_SCHEMA,settings:config,training:study,fitStatus:fit.status,models:models.map(c=>({id:c.id,coefficientInterval:[...c.coefficientInterval],units:c.units,excited:c.excited,...(c.rateSaturationScale===undefined?{}:{rateSaturationScale:c.rateSaturationScale})})),
  candidates:[],selected:null,status:'unavailable',reason:null,
  assumptions:['Only the offered probe states are considered; feasibility and effort costs are investigator declarations, not physical qualification.',
   'Prediction sets include complete surviving coefficient intervals. A separating gap must exceed twice the declared future contrast radius; that radius is an assumption, not predicted sensor performance.',
   'Measurements must retain the same preparation, recovery and command. A recommendation contains predictions, not acquired evidence.',
   'The finite one-term hypotheses can all be wrong. Replanning requires separate actual evidence; no future outcomes are used.']};
 if(models.length<2)return {...base,reason:fit.status==='insufficient-training'?'Collect qualified cross-probe training first.':models.length?'Only one offered hypothesis survives; there are no competing predictions to separate.':'No offered hypothesis survives training; revisit the model family or evidence.'};
 const command=study.runs[0].probe.command;
 const range=field=>[Math.min(...study.runs.map(r=>r.probe[field])),Math.max(...study.runs.map(r=>r.probe[field]))];
 const angleRange=range('position'),rateRange=range('rate');
 const candidates=config.probes.map(p=>{
  const probe={command,position:p.position,rate:p.rate};
  const predictions=models.map(c=>{const value=probeModelsFor(study).find(m=>m.id===c.id).feature(probe);return {id:c.id,interval:c.coefficientInterval.map(a=>a*value).sort((a,b)=>a-b)};});
  const comparisons=screenIntervalPairs(predictions,config.contrastRadius);
  const separated=comparisons.filter(c=>c.separable).length;
  return {id:p.id,probe,cost:p.cost,withinBudget:p.cost<=config.budget,predictions,comparisons,separated,total:comparisons.length,allSeparated:separated===comparisons.length,
   extrapolation:{position:p.position<angleRange[0]||p.position>angleRange[1],rate:p.rate<rateRange[0]||p.rate>rateRange[1]}};
 });
 // Complete separation first; otherwise maximize separated pairs, minimizing
 // declared cost at the same separation count. All candidates remain visible.
 const ids=config.probes.map(p=>p.id).sort();
 const choice=selectSeparatingCandidate(candidates.map(c=>({...c,order:ids.indexOf(c.id)})),'order','cost');
 const selected=choice?candidates.find(c=>c.id===choice.id):null;
 return {...base,candidates,selected,status:selected?(selected.allSeparated?'all-pairs-separated':'partial-separation'):'no-informative-probe',
  reason:selected?'Cheapest offered probe at the best affordable separation count; conditional on the declared contrast radius.':candidates.some(c=>c.withinBudget)?'Every affordable probe leaves all surviving prediction sets overlapping within the declared radius.':'No offered probe fits the declared effort budget.'};
}
export function exportProbePlan(training,input){
 const plan=planProbeAcquisition(training,input);
 if(!plan.selected)fail('No informative probe is available to export.');
 return JSON.stringify(plan,null,2)+'\n';
}
export function importProbePlan(text){
 if(typeof text!=='string'||text.length>4000000)fail('Use a probe request below 4 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid probe request JSON.');}
 if(!raw||raw.schema!==PROBE_PLAN_SCHEMA)fail('Expected a WORLDLAW probe request.');
 // Supplied selections/results are never trusted; replay from actual inputs.
 return planProbeAcquisition(raw.training,raw.settings);
}
