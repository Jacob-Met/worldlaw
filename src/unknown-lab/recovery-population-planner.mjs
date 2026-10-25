import {compareRecoveryTransport,validateRecoveryTransport} from './recovery-transport.mjs';
import {planRecoveryReadouts} from './recovery-planner.mjs';
import {validateRecovery} from './recovery-response.mjs';
import {validateNotebook,evaluateHistory} from './paired-history.mjs';
export const POPULATION_PLAN_SCHEMA='worldlaw.recovery-population-plan/v1';
const fail=m=>{throw Error(m);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function planRecoveryPopulation(raw,settings){
 const input=validateRecoveryTransport({...raw,study:{...raw?.study,challenges:[]}});
 const report=compareRecoveryTransport(input);
 if(!report.comparison)fail('Original training populations must admit the declared sensitivity comparison.');
 const reference=input.study.training.find(r=>r.recordingId===input.settings.referenceRecordingId);
 const target=validateNotebook(reference.evidence).pairs.map(p=>({
  targetPairId:p.id,order:p.reference.sampleIndex<p.conditioned.sampleIndex?'reference-first':'conditioned-first',
  firstIndex:Math.min(p.reference.sampleIndex,p.conditioned.sampleIndex),
  command:p.reference.command,position:p.reference.position,rate:p.reference.rate,
 })).sort((a,b)=>a.firstIndex-b.firstIndex);
 if(settings?.pairs!==target.length)fail('Requested pair count must match the frozen reference population.');
 const decision=planRecoveryReadouts(input.study,report.comparison.fit,settings);
 return {schema:POPULATION_PLAN_SCHEMA,input,target,decision,
  qualification:'The requested radius is an assumption, not an observed width. Target states are a manual acquisition request. Original sensitivity limits and finite response family remain conditional; no physical execution or achievable precision is established.'};
}
export function receiveRecoveryPopulation(current,plan,recording,settings=plan?.decision.settings){
 const fresh=planRecoveryPopulation(current,settings);
 if(!same(fresh,plan))fail('The population request is stale or modified; recompute from current training and settings.');
 if(!fresh.decision.selected)fail('No informative population acquisition was selected.');
 if(recording?.delaySeconds!==fresh.decision.selected.delaySeconds)fail('Acquired recovery delay must match the selected request.');
 const input=validateRecoveryTransport(current);
 const study=validateRecovery({...input.study,challenges:[...input.study.challenges,recording]});
 const next={...input,study},report=compareRecoveryTransport(next),row=report.recordings.at(-1);
 const observed=evaluateHistory(study.challenges.at(-1).evidence),reasons=[];
 if(observed.order.status!=='counterbalanced')reasons.push('measurement_order_unqualified');
 if(observed.count!==fresh.decision.settings.pairs)reasons.push('pair_count_differs');
 if(row.status!=='bounded')reasons.push('population_comparison_unavailable');
 // No numerical tolerance can turn an observed excess into requested precision.
 else if(row.combinedScreen>fresh.decision.settings.contrastRadius)reasons.push('observed_combined_screen_exceeds_planned_radius');
 return {input:next,report,acquisition:{recordingId:recording.recordingId,delaySeconds:recording.delaySeconds,
  actualPairs:observed.count,plannedPairs:fresh.decision.settings.pairs,originalRadius:observed.boundary,
  populationAllowance:row.allowance,observedRadius:row.combinedScreen??null,
  plannedRadius:fresh.decision.settings.contrastRadius,qualified:reasons.length===0,reasons}};
}
export function exportRecoveryPopulationPlan(raw,settings){
 const plan=planRecoveryPopulation(raw,settings),text=JSON.stringify({schema:POPULATION_PLAN_SCHEMA,input:plan.input,settings:plan.decision.settings})+'\n';
 if(new TextEncoder().encode(text).length>2100000)fail('Use a population request below 2.1 MB.');
 return text;
}
export function importRecoveryPopulationPlan(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>2100000)fail('Use a population request below 2.1 MB.');
 const raw=JSON.parse(text);if(raw?.schema!==POPULATION_PLAN_SCHEMA)fail('Expected a recovery population request.');
 return planRecoveryPopulation(raw.input,raw.settings);
}
