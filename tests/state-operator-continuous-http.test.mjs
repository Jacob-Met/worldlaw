import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {rollout,command,DT,N,GRID} from '../src/trajectory/field-law-dictionary.mjs';
import {rankObserved} from '../src/trajectory/noisy-field-intervention.mjs';
import {activeContinuousFieldDesign,fieldInputFromSchedule} from '../src/trajectory/continuous-field-excitation.mjs';
import {compileBurstSchedule} from '../src/science/continuous-input.mjs';

const waveform={schema:'worldlaw.hann-bursts/v1',duration:DT*N,cycles:[2.7,4.1,6.3],phases:[.2,-.4,.7],energyShares:[.25,.35,.4],rms:.03,peak:.3};
test('all three field geometries consume exact continuous commands and preserve interval slicing',()=>{
  for(const [layout,law,initial] of [
    ['oscillator','pendulum',[.3,-.2]],['kinetic','lotka-volterra',[.8,.6]],
    ['periodic','burgers',Array.from({length:GRID},(_,j)=>.6+.1*Math.cos(2*Math.PI*j/GRID))]]){
    const drive=fieldInputFromSchedule(layout,waveform),path=rollout(law,[1.1,.9],initial,drive);
    assert.equal(path.length,N+1);assert.ok(path.flat().every(Number.isFinite));
    assert.deepEqual(rollout(law,[1.1,.9],path[17],drive,{start:17,steps:N-17}),path.slice(17));
    const run={layout,drive,values:path,sigma:Array(initial.length).fill(.01)};
    assert.ok(rankObserved([run]).every(x=>Number.isFinite(x.loss)));
    const scalar=compileBurstSchedule(waveform).at(.137),applied=command(layout,drive,.137);
    if(layout==='oscillator')assert.deepEqual(applied,[0,scalar]);
    if(layout==='kinetic')assert.deepEqual(applied,[scalar,0]);
    if(layout==='periodic')assert.ok(applied.every((v,j)=>v===scalar*drive.profile[j]));
  }
});
test('pilot-only field design searches a continuous family with a fixed evaluation budget',()=>{
  const initial=[.3,-.2],pilot={layout:'oscillator',drive:-1,values:rollout('pendulum',[1.1,.9],initial,-1),sigma:[.01,.01]};
  const design=activeContinuousFieldDesign(pilot,{rms:.1,peak:.5,maxEvaluations:7});
  assert.equal(design.evaluations.length,7);assert.equal(design.committee.length,4);
  assert.equal(design.drive.schema,'worldlaw.continuous-input/v1');
  assert.deepEqual(design.initialEstimate,pilot.values[0]);
});

const run=(id,phase)=>({schema:'worldlaw.state-trajectory/v1',id,kind:'oscillator',
  samples:Array.from({length:161},(_,j)=>{const t=j*.025;return {time:t,state:[Math.cos(t+phase),-Math.sin(t+phase)],command:0};})});
test('launched product returns an executable continuous experiment and refuses invalid requests',async()=>{
  const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try{
    const payload={training:[run('fit-a',.1),run('fit-b',1.4)],selection:[run('selection',.8)],
      options:{maxTerms:1,beam:2,grammar:{degree:1,unary:[],rational:false}},
      continuousPlan:{initialEstimate:[.2,.1],step:.025,steps:128,search:{rms:.1,peak:.5,maxEvaluations:7,seed:8719}}};
    const send=()=>fetch(url+'/api/trajectory/operator-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const response=await send();assert.equal(response.status,200);
    const result=await response.json(),design=result.experiment;
    assert.equal(design.structuralIdentification,false);assert.equal(design.evaluations.length,7);
    assert.equal(design.continuousInput.waveform.schema,'worldlaw.hann-bursts/v1');
    assert.ok(Math.abs(design.scalarEnergy-.1**2*3.2)<1e-14);
    payload.continuousPlan.step=0;
    const refused=await send();assert.equal(refused.status,400);assert.match((await refused.json()).error,/grid/);
    payload.continuousPlan.step=.025;payload.plans=[{}];
    const mixed=await send();assert.equal(mixed.status,400);
    assert.equal((await fetch(url+'/health')).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
