import {screenIntervalPairs,selectSeparatingCandidate} from '../experiment-design/interval-separation.mjs';
import {validateRecovery,fitRecovery,predictRecovery,evaluateRecovery} from './recovery-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
export const RECOVERY_PLAN_SCHEMA='worldlaw.recovery-plan/v1';
const fail=m=>{throw Error(m);};
const finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
function settingsOf(input){
 if(!input||!Array.isArray(input.delays)||!input.delays.length||input.delays.length>32||input.delays.some(t=>!finite(t,0,60))||new Set(input.delays).size!==input.delays.length)fail('Offer 1–32 distinct recovery delays from 0 to 60 seconds.');
 if(!finite(input.contrastRadius,1e-8,1000))fail('Declare a future contrast screening radius above zero, at most 1000 N·m.');
 if(!Number.isInteger(input.pairs)||input.pairs<8||input.pairs>128||input.pairs%2)fail('Plan an even count of 8–128 pairs.');
 if(!finite(input.overheadPerPair,0,3600)||!finite(input.budgetSeconds,0,86400))fail('Declare bounded pair overhead and total acquisition budget.');
 return {delays:[...input.delays],contrastRadius:input.contrastRadius,pairs:input.pairs,overheadPerPair:input.overheadPerPair,budgetSeconds:input.budgetSeconds};
}
export function planRecoveryAcquisition(raw,input){
 // Future challenges are deliberately not read by the planner or saved plan.
 const training=validateRecovery({...raw,challenges:[]}),fit=fitRecovery(training);
 return planRecoveryReadouts(training,fit,input);
}
// Shared finite-delay policy; callers provide an already admitted training fit.
export function planRecoveryReadouts(training,fit,input){
 const settings=settingsOf(input);
 const models=fit.candidates.filter(c=>c.status==='compatible');
 const base={schema:RECOVERY_PLAN_SCHEMA,training,settings,fitStatus:fit.status,candidates:[],selected:null,status:'unavailable',reason:null};
 if(models.length<2)return {...base,reason:models.length?'Only one offered hypothesis survives; there are no competitors to separate.':'No qualified training hypothesis survives.'};
 const forecasts=predictRecovery(fit,settings.delays).filter(c=>c.status==='compatible');
 const low=Math.min(...training.training.map(r=>r.delaySeconds)),high=Math.max(...training.training.map(r=>r.delaySeconds));
 const candidates=settings.delays.map((delaySeconds,index)=>{
  const predictions=forecasts.map(c=>({id:c.id,interval:c.points[index].range}));
  const pairs=screenIntervalPairs(predictions,settings.contrastRadius),separated=pairs.filter(p=>p.separable).length;
  // Both members of each pair receive the declared waiting delay. The declared
  // overhead includes preparation, reset and readout for the complete pair.
  const costSeconds=settings.pairs*(2*delaySeconds+settings.overheadPerPair);
  return {delaySeconds,costSeconds,withinBudget:costSeconds<=settings.budgetSeconds,predictions,pairs,separated,total:pairs.length,allSeparated:separated===pairs.length,extrapolation:delaySeconds<low||delaySeconds>high};
 });
 const selected=selectSeparatingCandidate(candidates,'delaySeconds');
 return {...base,candidates,selected,status:selected?(selected.allSeparated?'all-pairs-separated':'partial-separation'):'no-informative-delay',reason:selected?'Complete interval separation depends on the declared future contrast radius; actual acquisition must check that width.':candidates.some(c=>c.withinBudget)?'Every affordable delay leaves all prediction sets overlapping within the declared screen radius.':'No offered delay fits the declared paired waiting budget.'};
}
function samePlan(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function receiveRecoveryAcquisition(current,plan,recording,currentSettings=plan?.settings){
 const fresh=planRecoveryAcquisition(current,currentSettings);
 if(!samePlan(fresh,plan))fail('The recovery plan is stale or modified; recompute it from current training and settings.');
 if(!fresh.selected)fail('No informative recovery acquisition was selected.');
 if(!recording||recording.delaySeconds!==fresh.selected.delaySeconds)fail('Acquired recovery delay must match the selected request.');
 const normalized=validateRecovery(current);
 const notebook=validateRecovery({...normalized,challenges:[...normalized.challenges,recording]});
 const observation=evaluateHistory(notebook.challenges.at(-1).evidence),reasons=[];
 if(observation.order.status!=='counterbalanced')reasons.push('measurement_order_unqualified');
 if(observation.count!==fresh.settings.pairs)reasons.push('pair_count_differs');
 if(observation.boundary>fresh.settings.contrastRadius+1e-12)reasons.push('observed_screen_exceeds_planned_radius');
 return {notebook,report:evaluateRecovery(notebook),acquisition:{recordingId:recording.recordingId,delaySeconds:recording.delaySeconds,actualPairs:observation.count,plannedPairs:fresh.settings.pairs,observedRadius:observation.boundary,plannedRadius:fresh.settings.contrastRadius,qualified:reasons.length===0,reasons}};
}
export function exportRecoveryPlan(raw,settings){
 const p=planRecoveryAcquisition(raw,settings);
 const text=JSON.stringify({schema:RECOVERY_PLAN_SCHEMA,training:p.training,settings:p.settings});
 if(new TextEncoder().encode(text+'\n').length>2000000)fail('The recovery request exceeds the 2 MB UTF-8 export limit.');
 return text+'\n';
}
export function importRecoveryPlan(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>2000000)fail('Use a recovery request under 2 MB.');
 const n=JSON.parse(text);if(!n||n.schema!==RECOVERY_PLAN_SCHEMA)fail('Expected a recovery acquisition request.');
 return planRecoveryAcquisition(n.training,n.settings);
}
