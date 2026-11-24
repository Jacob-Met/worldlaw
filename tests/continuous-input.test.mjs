import test from 'node:test';
import assert from 'node:assert/strict';
import {burstEnergyIntegral,compileBurstSchedule,compileContinuousInput} from '../src/science/continuous-input.mjs';
import {searchContinuousExcitation,drawContinuousSchedule} from '../src/science/continuous-excitation-search.mjs';
import {simulateStateModel,forecastStateTrajectory,validateStateTrajectory,prepareStateTrajectory} from '../src/science/state-trajectory.mjs';

import {observeWithActuator} from '../scripts/continuous-input-adapter.mjs';

const schedule=()=>({schema:'worldlaw.hann-bursts/v1',duration:3.2,cycles:[2.7,4.1,6.3],
  phases:[.2,-.4,.7],energyShares:[.25,.35,.4],rms:.1,peak:.5});
const input=()=>({schema:'worldlaw.continuous-input/v1',startTime:0,waveform:schedule()});
test('analytic burst energies agree with exact resonances and independent quadrature',()=>{
  const L=1.7;
  for(const phi of [-Math.PI,-.7,0,.4,Math.PI]){
    for(const [cycles,expected] of [[.5,L*(3/16+Math.cos(2*phi)/8)],[1,L*(3/16-Math.cos(2*phi)/32)],[2,3*L/16],[3,3*L/16]]){
      assert.ok(Math.abs(burstEnergyIntegral(cycles/L,phi,L)-expected)<1e-13);
    }
    for(const cycles of [.17,.51,.999,1.3,5.7]){
      const f=cycles/L,N=10000,h=L/N;let sum=0;
      for(let i=0;i<=N;i++){const t=i*h;sum+=(i===0||i===N?1:i%2?4:2)*Math.sin(Math.PI*t/L)**4*Math.sin(2*Math.PI*f*t+phi)**2*h/3;}
      assert.ok(Math.abs(sum-burstEnergyIntegral(f,phi,L))<1e-12);
    }
  }
});
test('complete waveform has declared energy, smooth joins, and an honest common peak bound',()=>{
  const s=schedule(),w=compileBurstSchedule(s),N=48000,h=s.duration/N;let energy=0,peak=0;
  for(let i=0;i<=N;i++){const y=w.at(i*h);energy+=(i===0||i===N?1:i%2?4:2)*y*y*h/3;peak=Math.max(peak,Math.abs(y));}
  assert.ok(Math.abs(energy-s.rms**2*s.duration)<1e-12);
  assert.ok(peak<=w.peakBound&&w.peakBound<=s.peak);
  for(const at of [0,s.duration/3,2*s.duration/3,s.duration])assert.equal(w.at(at),0);
  for(const at of [s.duration/3,2*s.duration/3])assert.ok(Math.abs((w.at(at+1e-6)-w.at(at-1e-6))/2e-6)<1e-5);
  const field=compileContinuousInput({...input(),profile:Array.from({length:32},(_,j)=>Math.cos(2*Math.PI*j/32))},'periodic',32);
  assert.ok(Math.abs(field.profileMeanSquare-.5)<1e-15);
  assert.throws(()=>compileBurstSchedule({...s,peak:.01}),/peak bound/);
  assert.throws(()=>compileBurstSchedule({...s,energyShares:[0,.5,.5]}),/energy shares/);
  assert.throws(()=>w.at(4),/interval/);
});
test('search is bounded, deterministic, continuous, and retains failed candidates',()=>{
  const options={duration:3.2,rms:.1,peak:.5,maxEvaluations:37,seed:8719};
  const score=s=>s.cycles.reduce((a,b)=>a+b,0);
  const a=searchContinuousExcitation(score,options),b=searchContinuousExcitation(score,options);
  assert.deepEqual(a,b);assert.equal(a.evaluations.length,37);assert.ok(a.score>a.evaluations[0].score);
  assert.equal(a.selected.schema,'worldlaw.hann-bursts/v1');
  assert.deepEqual(drawContinuousSchedule(options),drawContinuousSchedule(options));
  const refused=searchContinuousExcitation(()=>Infinity,{...options,maxEvaluations:7});
  assert.equal(refused.selected,null);assert.equal(refused.evaluations.filter(x=>x.status==='excluded').length,7);
  assert.equal(drawContinuousSchedule({...options,peak:.001}).status,'refused');
  assert.throws(()=>searchContinuousExcitation(()=>{throw new TypeError('bug');},options),TypeError);
  assert.throws(()=>searchContinuousExcitation(score,{...options,maxEvaluations:100}),/budget/);
});
function exactPath(s,step,steps) {
  const amplitudes=compileBurstSchedule(s).amplitudes,L=s.duration/3;
  function response(w,phi,t){
    if(Math.abs(w)<1e-12)return [Math.sin(phi)*t*t/2,Math.sin(phi)*t];
    return [(w*t*Math.cos(phi)-Math.sin(w*t+phi)+Math.sin(phi))/(w*w),(Math.cos(phi)-Math.cos(w*t+phi))/w];
  }
  return Array.from({length:steps+1},(_,j)=>{
    let q=0,v=0,remaining=j*step;
    for(let i=0;i<3&&remaining>0;i++){
      const t=Math.min(L,remaining),w=2*Math.PI*s.cycles[i]/s.duration,k=2*Math.PI/L;
      const parts=[[w,.5],[w+k,-.25],[w-k,-.25]].map(([f,a])=>response(f,s.phases[i],t).map(x=>x*a*amplitudes[i]));
      q+=v*t+parts.reduce((z,x)=>z+x[0],0);v+=parts.reduce((z,x)=>z+x[1],0);remaining-=t;
    }
    return [q,v];
  });
}
test('stage-time input follows the independent analytic forced trajectory and preserves prefix causality',()=>{
  const model={schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',terms:[{tree:'command',weight:1}]};
  const s=schedule(),continuousInput=input(),step=.025,steps=128,truth=exactPath(s,step,steps);
  const path=simulateStateModel(model,{initialEstimate:[0,0],step,steps,continuousInput,substeps:4});
  assert.ok(Math.max(...path.flatMap((row,i)=>row.map((x,j)=>Math.abs(x-truth[i][j]))))<2e-8);
  const wave=compileContinuousInput(continuousInput,'oscillator',2);
  const run={schema:'worldlaw.state-trajectory/v1',id:'analytic-input',kind:'oscillator',continuousInput,
    samples:truth.map((state,i)=>({time:i*step,state,command:wave.at(i*step)}))};
  validateStateTrajectory(run);
  const f=forecastStateTrajectory(model,run,{initialization:'prefix-shooting',substeps:4});
  assert.equal(f.status,'forecast');assert.ok(f.rmse<2e-8);assert.match(f.inputInterpolation,/every integration stage/);
  const changed=structuredClone(run);for(let i=17;i<changed.samples.length;i++)changed.samples[i].state=[40+i,-30-i];
  const g=forecastStateTrajectory(model,changed,{initialization:'prefix-shooting',substeps:4});
  assert.deepEqual(f.prefix,g.prefix);assert.deepEqual(f.states,g.states);
  const bad=structuredClone(run);bad.samples[33].command+=.001;
  assert.throws(()=>validateStateTrajectory(bad),/disagree/);
  const unresolved={...input(),waveform:{...s,cycles:[100,110,120]}};
  assert.throws(()=>simulateStateModel(model,{initialEstimate:[0,0],step,steps,continuousInput:unresolved}),/unresolved/);
});

test('compiled actuator is immutable and rejects metadata outside its declared schema',()=>{
  const descriptor=input(),compiled=compileContinuousInput(descriptor,'oscillator',2),before=compiled.at(.4);
  descriptor.startTime=1;descriptor.waveform.phases[0]=2;
  assert.equal(compiled.at(.4),before);
  assert.throws(()=>{compiled.amplitudes[0]=90;},TypeError);
  assert.throws(()=>compileContinuousInput({...input(),truth:'hidden'},'oscillator',2),/metadata/);
  assert.throws(()=>compileBurstSchedule({...schedule(),truth:'hidden'}),/metadata/);
});
test('adapter binds descriptor to actual midpoint commands and allocates identity without a law string',()=>{
  const descriptor=input(),compiled=compileContinuousInput(descriptor,'oscillator',2);
  const world={id:'secret-law',kind:'oscillator',rhs:(x,u)=>[x[1],u]};
  const plan={initial:[0,0],step:.025,steps:128};
  const producer={observeStateOperatorWorld:(w,p)=>{
    w.rhs(p.initial,0,undefined,.00625,()=>[0,0]);
    return {observation:{id:'secret-law:query',samples:[{time:0,state:[0,0],command:0}]},reference:{plan:p}};
  }};
  assert.throws(()=>observeWithActuator(producer,world,plan,25,1,t=>compiled.at(t)+.1*Math.sin(2*Math.PI*t/.025),
    {sequence:17,continuousInput:descriptor}),/stage command disagrees/);
  const received=observeWithActuator(producer,world,plan,25,1,compiled.at,{sequence:17,continuousInput:descriptor});
  assert.equal(received.observation.id,'acquisition-17');
  assert.throws(()=>observeWithActuator(producer,world,plan,25,1,compiled.at,{sequence:'secret-law'}),/sequence/);
});
test('forecast refuses foreign, changed, or fabricated prepared observations',()=>{
  const model={schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',terms:[{tree:'position',weight:-1}]};
  const a={schema:'worldlaw.state-trajectory/v1',id:'prepare-a',kind:'oscillator',
    samples:Array.from({length:65},(_,j)=>({time:j*.025,state:[Math.cos(j*.025),-Math.sin(j*.025)],command:0}))};
  const prepared=prepareStateTrajectory(a),b=structuredClone(a);
  assert.equal(forecastStateTrajectory(model,a,{prepared}).status,'forecast');
  assert.throws(()=>forecastStateTrajectory(model,b,{prepared}),/different or changed/);
  assert.throws(()=>forecastStateTrajectory(model,a,{prepared:{...prepared}}),/different or changed/);
  a.samples[20].state[0]+=.1;
  assert.throws(()=>forecastStateTrajectory(model,a,{prepared}),/different or changed/);
});
