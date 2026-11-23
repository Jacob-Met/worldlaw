import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rollout, TrajectoryRolloutError} from '../src/trajectory/forward.mjs';
import {forecastDistances, planForecastDiameter} from '../src/experiment-design/forecast-diameter.mjs';

const file = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const protocol = file('./fixtures/continuous-forecast-diameter-protocol.json');
const rosters = file('../experiments/continuous-rival-separation/development-rosters.json');
const options = protocol.settings, sigma=options.sigma;
const times=Array.from({length:201}, (_,i)=>i*options.interval);
const masks=[[.95,.95,.95,.95],[1/Math.sqrt(3),1,1,1],[1,1,1,1/Math.sqrt(3)]];
const designs=[], stress=[];
for(let signs=0;signs<16;signs++) for(const mask of masks) {
  const amps=mask.map((a,i)=>signs&(1<<i)?a:-a);
  designs.push(times.map((_,i)=>amps[Math.min(3,Math.floor(i/50))]));
}
for(const cycles of [.5,1,2]) for(const phase of [0,Math.PI/2,Math.PI,3*Math.PI/2]) {
  stress.push(times.map(t=>Math.sin(2*Math.PI*cycles*t/options.horizon+phase)));
}
function traces(models, targets, maxStep) {
  const run={id:'course', label:'forecast probe',kind:'unknown',source:{label:'command rule'},
    inertia:1,initialRate:0,samples:times.map((time,i)=>({time,position:.25,command:targets[i]}))};
  try {
    const rows=models.map(m=>rollout(m,run,{maxStep,maxSteps:2000,positionDomain:[-12,12],
      commandTiming:{beforeStart:0,responseTimeSeconds:.25}}).rows);
    if(rows.some(trace=>trace.some(r=>Math.abs(r.rate)>12)))return null;
    return rows.map(trace=>trace.slice(1).map(r=>r.predicted));
  } catch(e) {
    if(e instanceof TrajectoryRolloutError && ['position_domain','runaway_state','numerical_failure'].includes(e.code))return null;
    throw e;
  }
}
function summarize(plan, tested, ids, pairs) {
  let largest=0,witness=null;
  for(const k of plan.ambiguous) for(let i=0;i<tested.length;i++) {
    if(tested[i] && tested[i][k]>largest){largest=tested[i][k];witness={pair:pairs[k],stressIndex:i};}
  }
  return {designIndices:plan.indices.map(i=>ids[i]),planningDiameterSigma:plan.diameter,
    stressDiameterSigma:largest,witness,ambiguousPairs:plan.ambiguous.map(k=>pairs[k])};
}
for(const {id,models:raw} of rosters){
  const models=raw.map(m=>({schema:'worldlaw.torque-model/v1',id:m.id,
    terms:Object.entries(m.terms).map(([id,coefficient])=>({id,coefficient}))}));
  const pairs=[];for(let i=0;i<models.length;i++)for(let j=i+1;j<models.length;j++)pairs.push([i,j]);
  let coarse, previous, maxTraceChange=0, domainChanges=0;
  const estimates=[];
  for(const h of options.rk4Steps) {
    const bank=designs.map(t=>traces(models,t,h));
    const ids=bank.flatMap((v,i)=>v?[i]:[]);
    const probe=ids.map(i=>forecastDistances(bank[i]).map(x=>x/sigma));
    const result=planForecastDiameter(probe,options.boundedRecordRadiusSigma);
    // Held command histories only enter after the plan is fixed.
    const tests=stress.map(t=>traces(models,t,h));
    const tested=tests.map(tr=>tr && forecastDistances(tr).map(x=>x/sigma));
    const all=bank.concat(tests);
    if(previous) for(let i=0;i<all.length;i++){
      const a=previous[i], b=all[i];
      if(!!a!==!!b)domainChanges++;
      if(a&&b)for(let m=0;m<a.length;m++)for(let t=0;t<a[m].length;t++)maxTraceChange=Math.max(maxTraceChange,Math.abs(a[m][t]-b[m][t]));
    }
    const entry={h,admissibleDesigns:ids.length,admissibleStress:tested.filter(Boolean).length,
      planCount:result.planCount,minExperiments:result.minimumExperiments,
      best:summarize(result.best,tested,ids,pairs),maximin:summarize(result.maximin,tested,ids,pairs),
      randomMeanPlanningDiameterSigma:result.uniformMeanDiameter,
      actionablePairs:result.envelope.filter(x=>x>3).length,pairCount:pairs.length,
      closestSeparationMarginSigma:Math.min(...probe.flatMap(row=>row.map(x=>Math.abs(x-3))))};
    estimates.push(entry);
    previous=all;
  }
  assert.equal(domainChanges,0);
  console.log(JSON.stringify({id,modelIds:models.map(m=>m.id),estimates,maxTraceChange,domainChanges}));
}
