// Independent virtual observations; matched paired acquisition budgets and seeds.
import {writeFileSync} from 'node:fs';
import {planRecoveryAcquisition} from '../src/unknown-lab/recovery-planner.mjs';
import {syntheticChallenge,evaluateHistory} from '../src/unknown-lab/paired-history.mjs';
import {RECOVERY_SCHEMA,fitRecovery,evaluateRecovery} from '../src/unknown-lab/recovery-response.mjs';
const delays=[.2,.5,1,1.5,2,3,4,6,10,20,60];
function recording({tau,amplitude,sigma,seed},delay,id){
 const evidence=syntheticChallenge({seed,count:32,effect:0,noiseSigma:sigma,driftPerReading:.01,orderStrategy:'shuffled'});delete evidence.simulation;
 let response=amplitude,time=0;while(time<delay){const dt=Math.min(.002,delay-time);response-=response/tau*dt;time+=dt;}
 for(const r of evidence.trials)if(r.history==='conditioned')r.jointTorque+=response;
 return {recordingId:id,protocolId:'fixed',delaySeconds:delay,evidence};
}
const outcomes=[];
for(const tau of [1,2,4])for(const amplitude of [.25,.6])for(const sigma of [.01,.03,.08])for(const seed of [11,37,103,251]){
 const setup={tau,amplitude,sigma,seed};
 const n={schema:RECOVERY_SCHEMA,source:'synthetic',protocolId:'fixed',protocolNote:'Fixed preparation followed by independent small-step Euler response and paired instrument readings.',amplitudeBounds:[-1,1],tauSeconds:[1,2,4],training:[recording(setup,0,'train-a'),recording({...setup,seed:seed+1},.1,'train-b')],challenges:[]};
 const p=planRecoveryAcquisition(n,{delays,contrastRadius:1.5*sigma,pairs:32,overheadPerPair:1,budgetSeconds:500});
 // Same finite offerings, complete paired cost budget and separation eligibility.
 // Baseline maximizes just its best pair, even if other competitors overlap.
 const largest=p.candidates.filter(c=>c.withinBudget&&c.separated>0).sort((a,b)=>Math.max(...b.pairs.map(p=>p.gap))-Math.max(...a.pairs.map(p=>p.gap))||a.costSeconds-b.costSeconds)[0]??null;
 const trials={};
 for(const [method,proposal]of [['shared_interval_policy',p.selected],['largest_pair',largest]]){
  if(!proposal){trials[method]={status:p.status};continue;}
  const challenge=recording({...setup,seed:seed+1000},proposal.delaySeconds,'challenge');
  const result=evaluateRecovery({...n,challenges:[challenge]});
  const observedRadius=evaluateHistory(challenge.evidence).boundary;
  const surviving=result.tests.filter(t=>t.status==='compatible').map(t=>t.id);
  trials[method]={status:'observed',delaySeconds:proposal.delaySeconds,costSeconds:proposal.costSeconds,allPairsSeparated:proposal.allSeparated,observedRadius,plannedRadius:p.settings.contrastRadius,radiusMet:observedRadius<=p.settings.contrastRadius+1e-12,surviving,trueRetained:surviving.includes('decay:'+tau),uniquelyCorrect:surviving.length===1&&surviving[0]==='decay:'+tau};
 }
 outcomes.push({...setup,trainingSurvivors:fitRecovery(n).candidates.filter(x=>x.status==='compatible').map(x=>x.id),trials});
}
const summary={};for(const method of ['shared_interval_policy','largest_pair']){const rows=outcomes.map(x=>x.trials[method]),observed=rows.filter(x=>x.status==='observed');summary[method]={offered:observed.length,refused:rows.length-observed.length,uniquelyCorrect:observed.filter(x=>x.uniquelyCorrect).length,trueExcluded:observed.filter(x=>!x.trueRetained).length,noCandidate:observed.filter(x=>x.surviving.length===0).length,radiusExceeded:observed.filter(x=>!x.radiusMet).length,meanWaitSeconds:observed.reduce((s,x)=>s+x.delaySeconds,0)/observed.length,meanSurviving:observed.reduce((s,x)=>s+x.surviving.length,0)/observed.length};}
const comparable=outcomes.filter(x=>Object.values(x.trials).every(t=>t.status==='observed'));
const paired={cases:comparable.length,sharedPolicyUnique:comparable.filter(x=>x.trials.shared_interval_policy.uniquelyCorrect).length,largestPairUnique:comparable.filter(x=>x.trials.largest_pair.uniquelyCorrect).length};
const result={qualification:'72 authored noisy Euler controls, not physical validation or calibrated uncertainty. Both methods share all waits, pair counts, 500-second complete paired budget, positive-separation eligibility and independent acquisition noise seed. Refusals retained; this finite course does not establish universal planner superiority.',settings:{delays,pairs:32,overheadPerPair:1,budgetSeconds:500,radius:'1.5 times authored per-reading noise sigma'},summary,paired,outcomes};
writeFileSync(new URL('../docs/RECOVERY_PLANNING_RESULTS.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({summary,paired},null,2));
