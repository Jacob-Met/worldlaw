import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCommandDeadzones,evaluateDeadzone,predictDeadzone,simulateDeadzone,checkedWidths,exportDeadzoneInputs,restoreDeadzoneInputs} from '../src/science/command-deadzone.mjs';
import {discover,evaluate,simulate} from '../src/science/torque-discovery.mjs';
import {createSession,exportSession} from '../src/session.mjs';

// Independent oracle: separate branches, not the implementation's transform.
const response=(u,w)=>u>w?u-w:u< -w?u+w:0;
function course(width,count=80,phase=0,asymmetric=false){return Array.from({length:count},(_,i)=>{
  const command=2.4*Math.sin(i*1.371+phase),position=.8*Math.cos(i*2.139+phase),rate=1.5*Math.sin(i*.917+phase);
  return {command,position,rate,jointTorque:1.43*response(command,asymmetric&&command<0?width*2:width)-2.11*position-.173*rate};
});}
const options={terms:['command','spring','rate','bias'],maxTerms:4,noiseSigma:.001};
test('unfamiliar declared widths recover independent receiving laws through maintained discovery',()=>{
  for(const width of [.137,.419,.863,1.071]){
    const training=course(width),receiving=course(width,47,.618);
    const fit=compareCommandDeadzones(training,[0,width*.5,width,width*1.4],options);
    assert.equal(fit.selected.width,width);
    assert.ok(evaluateDeadzone(fit.selected,receiving).rmse<1e-12);
    assert.ok(evaluateDeadzone(fit.candidates[0],receiving).rmse>.02);
  }
});
test('zero mapping is exact ordinary baseline; original rows retain commands',()=>{
  const training=course(.6),receiving=course(.6,31,.31),before=JSON.stringify(training);
  const fit=compareCommandDeadzones(training,[0,.6],options),ordinary=discover(training,options);
  assert.deepEqual(fit.candidates[0].model,ordinary.selected);
  const got=evaluateDeadzone(fit.candidates[0],receiving),expected=evaluate(ordinary.selected,receiving);
  assert.equal(got.rmse,expected.rmse);
  assert.deepEqual(got.rows.map(({mappedCommand,...r})=>r),expected.rows);
  const received=evaluateDeadzone(fit.selected,receiving);
  assert.deepEqual(received.rows.map(r=>r.command),receiving.map(r=>r.command));
  assert.equal(JSON.stringify(training),before);
  assert.deepEqual(fit.training,training);
});
test('receiving mutations cannot influence selected width, model or ranking',()=>{
  const fit=compareCommandDeadzones(course(.419),[0,.2,.419,.8],options),before=JSON.stringify(fit);
  const clean=evaluateDeadzone(fit.selected,course(.419,40,.72));
  const wrong=evaluateDeadzone(fit.selected,course(.419,40,.72).map(r=>({...r,jointTorque:r.jointTorque+10})));
  assert.ok(clean.rmse<1e-12);assert.ok(wrong.rmse>9.99);assert.equal(JSON.stringify(fit),before);
});
test('wrong symmetric family retains asymmetric failure and unsupported command ambiguity',()=>{
  const fit=compareCommandDeadzones(course(.4,100,0,true),[0,.2,.4,.6,.8],options);
  assert.ok(fit.candidates.every(c=>c.diagnostics.adequacy==='residual_mismatch'));
  assert.ok(evaluateDeadzone(fit.selected,course(.4,41,.7,true)).rmse>.03);
  const repeated=Array.from({length:16},()=>({command:2,position:0,rate:0,jointTorque:3}));
  const ambiguous=compareCommandDeadzones(repeated,[0,.5,1],{terms:['command'],maxTerms:1});
  assert.equal(ambiguous.competitiveWidths.length,3);
  assert.ok(ambiguous.candidates.every(c=>c.mappedCommandSupport===1));
  const noCommand=compareCommandDeadzones(repeated.map(r=>({...r,command:0,jointTorque:0})),[0,.5],options);
  assert.equal(noCommand.competitiveWidths.length,2);
});
test('complete resource reservation refuses atomically at the exact boundary',()=>{
  const training=course(.4),fit=compareCommandDeadzones(training,[0,.4],options);
  assert.deepEqual(compareCommandDeadzones(training,[0,.4],options,{maxWork:fit.work.reserved}).selected,fit.selected);
  assert.throws(()=>compareCommandDeadzones(training,[0,.4],options,{maxWork:fit.work.reserved-1}),/work limit/);
  assert.throws(()=>compareCommandDeadzones(training,[0,.4],options,{maxWork:0}),/work limit/);
  for(const w of [[.4],[0,0],[0,-1],[0,Infinity],Array.from({length:17},(_,i)=>i)])assert.throws(()=>checkedWidths(w));
});
test('original notebook plus declarations reopens by recomputation; result envelopes refuse',()=>{
  const session=createSession({observations:course(.4),heldOut:course(.4,31,.51),source:{label:'Independent authored control'}},{});
  const text=exportDeadzoneInputs(session,[0,.4,.8]),restored=restoreDeadzoneInputs(text);
  assert.equal(exportSession(restored.session),exportSession(session));
  const compare=s=>compareCommandDeadzones(s.discovery.observations,[0,.4,.8],s.discovery.options);
  assert.deepEqual(compare(restored.session),compare(session));
  assert.throws(()=>restoreDeadzoneInputs(JSON.stringify({...JSON.parse(text),selectedWidth:.4})),/derived results/);
  const corrupt=JSON.parse(text);corrupt.notebook.base.observations[0].command='bad';assert.throws(()=>restoreDeadzoneInputs(JSON.stringify(corrupt)));
});
test('conditional predictions execute in the maintained constant-command solver',()=>{
  const fit=compareCommandDeadzones(course(.419),[0,.419],options),candidate=fit.selected;
  const init={position:.3,rate:-.2},settings={command:.8,duration:.3,dt:.01,inertia:1.2};
  const trajectory=simulateDeadzone(candidate,init,settings);
  const expected=simulate(candidate.model,init,{...settings,command:response(settings.command,.419)});
  assert.deepEqual(trajectory,expected);
  for(const point of trajectory)assert.equal(point.jointTorque,predictDeadzone(candidate,{...point,command:.8}));
  assert.throws(()=>predictDeadzone(candidate,{command:NaN,position:0,rate:0}));
});
