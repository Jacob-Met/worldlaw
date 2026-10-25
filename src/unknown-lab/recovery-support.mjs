import {validateRecovery,evaluateRecovery,evaluateRecoveryPairs} from './recovery-response.mjs';
import {validateNotebook} from './paired-history.mjs';

const coordinates=['command','position','rate'];
function indexRun(run){
 const pairs=validateNotebook(run.evidence).pairs;
 const strata=new Map(),excluded=[];
 for(const p of pairs){
  let reason=null;
  if(p.reference.sampleIndex===undefined)reason='order-not-recorded';
  else if(coordinates.some(k=>p.reference[k]!==p.conditioned[k]))reason='within-pair-coordinate-mismatch';
  if(reason){excluded.push({pairId:p.id,reason});continue;}
  const state=coordinates.map(k=>p.reference[k]),order=p.reference.sampleIndex<p.conditioned.sampleIndex?'reference-first':'conditioned-first';
  const key=JSON.stringify([...state,order]);
  if(!strata.has(key))strata.set(key,{key,state,order,pairs:[]});
  strata.get(key).pairs.push({pairId:p.id,firstIndex:Math.min(p.reference.sampleIndex,p.conditioned.sampleIndex)});
 }
 for(const s of strata.values())s.pairs.sort((a,b)=>a.firstIndex-b.firstIndex);
 return {recordingId:run.recordingId,total:pairs.length,strata,excluded};
}

// Training coordinates and chronology alone choose support; challenge values,
// coordinates and row counts never change this frozen comparison population.
export function compareRecoverySupport(raw){
 const original=validateRecovery(raw),baseline=evaluateRecovery(original);
 const training=original.training.map(indexRun),challenges=original.challenges.map(indexRun);
 const strata=[...training[0].strata.values()].map(s=>({key:s.key,state:s.state,order:s.order,
  count:Math.min(...training.map(r=>r.strata.get(s.key)?.pairs.length??0))})).filter(s=>s.count>0).sort((a,b)=>a.key.localeCompare(b.key));
 const counts={'reference-first':0,'conditioned-first':0};for(const s of strata)counts[s.order]+=s.count;
 const qualified=counts['reference-first']>=4&&counts['conditioned-first']>=4;
 const selections=Object.create(null);
 const recordings=[...training,...challenges].map((r,i)=>{
  const selected=[],excluded=[...r.excluded],missing=[];
  for(const s of strata){const available=r.strata.get(s.key)?.pairs??[];
   selected.push(...available.slice(0,s.count).map(p=>p.pairId));
   if(available.length<s.count)missing.push({key:s.key,required:s.count,available:available.length});
  }
  const keep=new Set(selected),keys=new Set(strata.map(s=>s.key));
  for(const s of r.strata.values())for(const p of s.pairs)if(!keep.has(p.pairId))excluded.push({pairId:p.pairId,reason:keys.has(s.key)?'surplus-in-frozen-stratum':'outside-training-support'});
  const status=!qualified?'insufficient-training-support':missing.length?'missing-frozen-support':'supported';
  if(status!=='supported'){for(const pairId of selected)excluded.push({pairId,reason:status});selected.length=0;}
  selections[r.recordingId]=selected;
  return {recordingId:r.recordingId,role:i<training.length?'training':'challenge',total:r.total,status,selected,excluded,missing};
 });
 return {schema:'worldlaw.recovery-support-result/v1',status:qualified?'compared':'insufficient-training-support',
  baseline,strata,counts,recordings,comparison:qualified?evaluateRecoveryPairs(original,selections):null,
  qualification:'Retrospective exact-coordinate population comparison, not causal adjustment. Earliest original pairs within each coordinate/order stratum are selected without torque outcomes. Training freezes support; missing challenge support is unavailable. Matching recorded coordinates does not establish true state, independence, stationary response or calibrated screens. Unobserved states are not represented.'};
}
