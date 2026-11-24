import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {forecastStateTrajectory} from '../src/science/state-trajectory.mjs';
const run=(id,phase)=>({schema:'worldlaw.state-trajectory/v1',id,kind:'oscillator',samples:Array.from({length:161},(_,j)=>{const t=j*.025;return {time:t,state:[Math.cos(t+phase),-Math.sin(t+phase)],command:0};})});
const model={schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',terms:[{tree:'position',weight:-1}]};
test('symbolic shooting predictions are invariant to every withheld state',()=>{
  const a=run('prefix',.8),b=structuredClone(a);
  for(let j=0;j<17;j++)a.samples[j].state=a.samples[j].state.map((x,k)=>x+.01*Math.sin(2.3*j+k));
  b.samples=structuredClone(a.samples);
  for(let j=17;j<b.samples.length;j++)b.samples[j].state=[70+j,80-j];
  const f=forecastStateTrajectory(model,a,{initialization:'prefix-shooting'}),g=forecastStateTrajectory(model,b,{initialization:'prefix-shooting'});
  assert.equal(f.status,'forecast');assert.equal(f.startIndex,16);assert.equal(f.firstScored,17);
  assert.deepEqual(f.prefix,g.prefix);assert.deepEqual(f.states,g.states);
  assert.notEqual(f.rmse,g.rmse);assert.ok(f.rmse<.003);
  assert.throws(()=>forecastStateTrajectory(model,a,{initialization:'prefix-shooting',prefixPoints:161}),/prefix/);
});
test('launched discovery API and public forecast share the explicit shooting option',async()=>{
  const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    const selection=run('selection-prefix',.8);
    selection.samples[0].state[0]+=.1;
    const payload={training:[run('train-a',.1),run('train-b',1.4)],selection:[selection],
      options:{maxTerms:1,beam:2,grammar:{degree:1,unary:[],rational:false},forecastInitialization:'prefix-shooting',prefixPoints:17}};
    const response=await fetch(url+'/api/trajectory/operator-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.match(result.diagnostics.initialization,/fixed 17-sample trajectory fit/);
    const replay=forecastStateTrajectory(result.model,selection,{initialization:'prefix-shooting',prefixPoints:17});
    assert.equal(replay.status,'forecast');
    assert.ok(Math.abs(result.selection.selectionRmse-replay.rmse)<1e-12);
    const held=forecastStateTrajectory(result.model,run('unseen-test',2.3),{initialization:'prefix-shooting'});
    assert.ok(held.rmse<.001);
    payload.options.prefixPoints=99;
    const refused=await fetch(url+'/api/trajectory/operator-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(refused.status,400);assert.match((await refused.json()).error,/prefix/);
    assert.equal((await fetch(url+'/health')).status,200);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
