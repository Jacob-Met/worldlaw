import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rollout, TrajectoryRolloutError} from '../../src/trajectory/forward.mjs';

const data=JSON.parse(readFileSync(new URL('./development-rosters.json',import.meta.url)));
const times=Array.from({length:201},(_,i)=>i*.04);
const masks=[[.95,.95,.95,.95],[1/Math.sqrt(3),1,1,1],[1,1,1,1/Math.sqrt(3)]];
const outcomes=[];
function forecasts(models,amplitudes,maxStep){
  const samples=times.map((time,i)=>({time,position:.25,command:amplitudes[Math.min(3,Math.floor(i/50))]}));
  const run={id:'probe',label:'Signed continuous development probe',kind:'unknown',source:{label:'Design only'},inertia:1,initialRate:0,samples};
  try {
    const rows=models.map(model=>rollout(model,run,{maxStep,maxSteps:2000,positionDomain:[-12,12]}).rows);
    if(rows.some(trace=>trace.some(x=>Math.abs(x.rate)>12)))return null;
    return rows.map(trace=>trace.slice(1).map(row=>row.predicted));
  }catch(e){
    if(e instanceof TrajectoryRolloutError && ['position_domain','runaway_state','numerical_failure'].includes(e.code))return null;
    throw e;
  }
}
function worstPair(traces){
  let score=Infinity,pair;
  for(let i=1;i<traces.length;i++)for(let j=0;j<i;j++){
    const rms=Math.sqrt(traces[i].reduce((a,x,t)=>a+(x-traces[j][t])**2,0)/200)/.002;
    if(rms<score){score=rms;pair=[j,i];}
  }
  return {score,pair};
}
for(const {id,models:raw} of data){
  const models=raw.map(m=>({schema:'worldlaw.torque-model/v1',id:m.id,terms:Object.entries(m.terms).map(([id,coefficient])=>({id,coefficient}))}));
  let best=null;
  for(let signs=0;signs<16;signs++)for(const mask of masks){
    const amplitudes=mask.map((m,j)=>signs&(1<<j)?m:-m);
    const traces=forecasts(models,amplitudes,.02);
    if(!traces)continue;
    const {score}=worstPair(traces);
    if(!best || score>best.score)best={score,traces,amplitudes};
  }
  assert(best);
  const fine=forecasts(models,best.amplitudes,.01);
  assert(fine);
  const error=Math.max(...fine.map((t,i)=>Math.max(...t.map((x,j)=>Math.abs(x-best.traces[i][j])))));
  assert(error<.0001);
  const {score,pair}=worstPair(fine);
  const entry={id,amplitudes:best.amplitudes,noiseUnits:score,limitingPair:pair.map(i=>models[i].id),refinementError:error};
  if(id<=1004){
    const base=raw[0].terms;
    const k=Math.abs(base.spring??base.gravity);
    const forceBound=base.spring===undefined?12:1;
    // Duhamel comparison for matched nonnegative damping, identical input,
    // restoring Lipschitz constant k and an added nonzero 1e-9 term.
    const bound=1e-9*forceBound*(Math.cosh(Math.sqrt(k)*8)-1)/k;
    entry.nestedClassUniformBoundInNoiseUnits=bound/.002;
    assert(bound/.002<.01);
  }
  outcomes.push(entry);
}
assert.deepEqual(outcomes.map(x=>x.noiseUnits>=3),[false,false,false,false,true,true]);
console.log(JSON.stringify(outcomes,null,2));
