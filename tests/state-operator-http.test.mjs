import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {forecastStateTrajectory} from '../src/science/state-trajectory.mjs';
const run=(id,phase)=>({schema:'worldlaw.state-trajectory/v1',id,kind:'oscillator',samples:Array.from({length:241},(_,j)=>{const t=j*.025;return {time:t,state:[Math.cos(t+phase),-Math.sin(t+phase)],command:0};})});
test('launched product learns from states, predicts a separate recording and refuses derivative-labelled input',async()=>{
  const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    assert.equal((await fetch(url+'/health')).status,200);
    const payload={training:[run('fit-a',.1),run('fit-b',1.4)],selection:[run('selection',.8)],options:{maxTerms:2,grammar:{degree:2,unary:[],rational:false},beam:4}};
    const response=await fetch(url+'/api/trajectory/operator-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.structuralIdentification,false);
    const held=forecastStateTrajectory(result.model,run('unread-test',2.3));
    assert.ok(held.rmse<.001,JSON.stringify(result.selection));
    payload.training[0].samples[1].change=10;
    const refused=await fetch(url+'/api/trajectory/operator-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(refused.status,400);assert.match((await refused.json()).error,/Derivative labels/);
    assert.equal((await fetch(url+'/health')).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
