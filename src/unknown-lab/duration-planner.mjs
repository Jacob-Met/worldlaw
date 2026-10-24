import {screenIntervalPairs,selectSeparatingCandidate} from '../experiment-design/interval-separation.mjs';
// Complete prediction-set separation under declared measurement/cost assumptions.
import {fitDurationModels,validateDurationStudy,DURATION_SCHEMA} from './duration-response.mjs';
export const DURATION_PLAN_SCHEMA='worldlaw.duration-plan/v1';
const fail=m=>{throw Error(m);};
const finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
function interval(c,t){
 const x=c.family==='memoryless'?0:c.family==='constant'?1:-Math.expm1(-t/c.tau);
 return c.amplitudeInterval.map(a=>a*x);
}
export function planDurationAcquisition(training,input){
 if(!input||!Array.isArray(input.durations)||!input.durations.length||input.durations.length>32||
  input.durations.some(t=>!finite(t,0,30))||new Set(input.durations).size!==input.durations.length)
  fail('Offer 1–32 distinct conditioning durations from 0 to 30 seconds.');
 if(!finite(input.contrastRadius,1e-8,1000))fail('Declare future contrast screening radius above zero, at most 1000 N·m.');
 if(!Number.isInteger(input.pairs)||input.pairs<8||input.pairs>128||input.pairs%2)fail('Plan an even count of 8–128 pairs.');
 if(!finite(input.overheadPerPair,0,3600)||!finite(input.budgetSeconds,0,86400))fail('Declare bounded pair overhead and total acquisition budget.');
 const study=validateDurationStudy({schema:DURATION_SCHEMA,runs:training});
 const fit=fitDurationModels(study.runs),models=fit.candidates.filter(c=>c.compatible);
 const settings={durations:[...input.durations],contrastRadius:input.contrastRadius,pairs:input.pairs,
  overheadPerPair:input.overheadPerPair,budgetSeconds:input.budgetSeconds};
 const base={schema:DURATION_PLAN_SCHEMA,settings,training:study,fitStatus:fit.status,candidates:[],selected:null,status:'unavailable',reason:null};
 if(models.length<2)return {...base,reason:fit.status==='insufficient-training'?'Collect qualified training across at least three durations first.':models.length?'Only one offered hypothesis survives; there are no competitors to separate.':'No offered training hypothesis survives.'};
 const minTraining=Math.min(...study.runs.map(r=>r.duration)),maxTraining=Math.max(...study.runs.map(r=>r.duration));
 const candidates=settings.durations.map(duration=>{
  const costSeconds=settings.pairs*(duration+settings.overheadPerPair);
  const predictions=models.map(model=>({id:model.id,interval:interval(model,duration)}));
  const pairs=screenIntervalPairs(predictions,settings.contrastRadius);
  const separated=pairs.filter(p=>p.separable).length;
  return {duration,costSeconds,withinBudget:costSeconds<=settings.budgetSeconds,predictions,pairs,
   separated,total:pairs.length,allSeparated:separated===pairs.length,extrapolation:duration<minTraining||duration>maxTraining};
 });
 const selected=selectSeparatingCandidate(candidates,'duration');
 return {...base,candidates,selected,status:selected?(selected.allSeparated?'all-pairs-separated':'partial-separation'):'no-informative-duration',
  reason:selected?'Separation depends on the declared future contrast radius and finite offered hypotheses.':
   candidates.some(c=>c.withinBudget)?'Every affordable duration leaves all prediction sets overlapping within the declared screen radius.':'No offered duration fits the declared time budget.'};
}
export function exportDurationPlan(training,settings){
 const plan=planDurationAcquisition(training,settings);
 if(!plan.selected)fail('No informative duration is available to export.');
 return JSON.stringify(plan,null,2)+'\n';
}
