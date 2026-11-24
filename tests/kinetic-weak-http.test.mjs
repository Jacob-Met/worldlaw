import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {forecastStateTrajectory} from '../src/science/state-trajectory.mjs';
const run=(id,x,y)=>({schema:'worldlaw.state-trajectory/v1',id,kind:'kinetic',samples:Array.from({length:129},(_,i)=>{const t=i*.025;return {time:t,state:[x*Math.exp(-.3*t),y*Math.exp(-.7*t)],command:[0,0]};})});
test('launched HTTP worker fits genuinely free kinetic outputs and retains refusal boundaries',async()=>{
  const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try{
    const payload={training:[run('fit-a',1,2),run('fit-b',2,.7)],selection:[run('selection',.8,1.4)],options:{
      estimator:'free-stlsq',windowPoints:33,stride:8,grammar:{degree:1,unary:[],rational:false,flux:false},thresholds:[.001,.05],ridges:[1e-8]}};
    const post=body=>fetch(url+'/api/trajectory/operator-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await post(payload);assert.equal(response.status,200);
    const result=await response.json();assert.equal(result.diagnostics.freeSupport,true);
    assert.equal(result.diagnostics.supportCap,null);assert.equal(result.diagnostics.outputChannels,2);
    assert.equal(result.structuralIdentification,false);assert.equal(result.candidates.length,2);
    const held=forecastStateTrajectory(result.model,run('test-only',1.3,.9));assert.ok(held.rmse<3e-5);
    const beamResponse=await post({...payload,options:{...payload.options,estimator:'beam',maxTerms:2,beam:4}});
    assert.equal(beamResponse.status,200);
    const beam=await beamResponse.json();assert.equal(beam.status,'predictive_candidate');
    assert.deepEqual(beam.model.terms.map(t=>[t.channel,t.tree]),[[0,'state0'],[1,'state1']]);
    assert.ok(Math.abs(beam.model.terms[0].weight+.3)<2e-5);assert.ok(Math.abs(beam.model.terms[1].weight+.7)<2e-5);
    assert.ok(forecastStateTrajectory(beam.model,run('beam-test-only',1.3,.9)).rmse<3e-5);
    payload.options.maxWorkPerRow=0;
    const refused=await post(payload);assert.equal(refused.status,400);assert.match((await refused.json()).error,/work budget/);
    payload.options.maxWorkPerRow=50000000;payload.training[0].samples[3].command=0;
    assert.equal((await post(payload)).status,400);
    assert.equal((await fetch(url+'/health')).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
