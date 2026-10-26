import test from 'node:test';
import assert from 'node:assert/strict';
import {compareAsymmetricCommandDeadzones as fit,evaluateAsymmetricDeadzone as receive,mapAsymmetricDeadzone as map,simulateAsymmetricDeadzone as motion} from '../src/science/asymmetric-command-deadzone.mjs';
import {compareCommandDeadzones as symmetric,evaluateDeadzone,predictDeadzone} from '../src/science/command-deadzone.mjs';
import {simulate} from '../src/science/torque-discovery.mjs';
const options={terms:['command','spring','rate','bias'],maxTerms:4,noiseSigma:.001};
function course(n,p,count=97,phase=0){return Array.from({length:count},(_,i)=>{
 const command=2.7*Math.sin(1.719*i+phase),position=.7*Math.cos(2.139*i+phase),rate=1.2*Math.sin(.811*i-phase);
 const response=command< -n?command+n:command>p?command-p:0;
 return {command,position,rate,jointTorque:1.61*response-1.37*position-.231*rate+.17};
});}
test('independent asymmetric receiving repairs the preserved symmetric-family failure',()=>{
 for(const [n,p] of [[.71,.23],[.19,.83]]){
  const training=course(n,p),held=course(n,p,83,.713),widths=[0,n,p],before=JSON.stringify(training);
  const old=symmetric(training,widths,options),r=fit(training,widths,options);
  assert.deepEqual([r.selected.negative,r.selected.positive],[n,p]);
  assert.ok(receive(r.selected,held).rmse<1e-11);
  assert.ok(evaluateDeadzone(old.selected,held).rmse>.01);
  assert.equal(r.candidates.length,9);assert.equal(JSON.stringify(training),before);
  for(const c of old.candidates)assert.deepEqual(r.candidates.find(x=>x.negative===c.width&&x.positive===c.width).model,c.model);
 }
});
test('changed held outcomes cannot refit mapping; original source commands retained',()=>{
 const r=fit(course(.71,.23),[0,.23,.71],options),before=JSON.stringify(r),held=course(.71,.23,31,.9);
 const result=receive(r.selected,held.map(x=>({...x,jointTorque:x.jointTorque+7})));
 assert.ok(result.rmse>6.99);assert.equal(JSON.stringify(r),before);assert.deepEqual(result.rows.map(x=>x.command),held.map(x=>x.command));
});
test('full Cartesian work refuses atomically; memoryless mapping has independent branch thresholds',()=>{
 const rows=course(.71,.23),r=fit(rows,[0,.23,.71],options);
 assert.throws(()=>fit(rows,[0,.23,.71],options,{maxWork:r.work.reserved-1}),/work limit/);
 assert.deepEqual(fit(rows,[0,.23,.71],options,{maxWork:r.work.reserved}).selected,r.selected);
 assert.deepEqual([-.9,-.71,-.1,0,.1,.23,.9].map(u=>map(u,.71,.23)),[-.19000000000000006,0,0,0,0,0,.67]);
 const settings={command:-.9,duration:.1,dt:.01,inertia:1},initial={position:.1,rate:.2};
 assert.deepEqual(motion(r.selected,initial,settings),simulate(r.selected.model,initial,{...settings,command:map(settings.command,.71,.23)}));
});
test('omitted nonlinear command response remains a failure despite larger threshold family',()=>{
 const rows=course(.71,.23).map(x=>({...x,jointTorque:x.jointTorque+.4*x.command*x.command}));
 const r=fit(rows,[0,.23,.71],options);
 assert.ok(r.candidates.every(c=>c.diagnostics.adequacy==='residual_mismatch'));
});
test('source-only asymmetric envelope replays originals and rejects cached conclusions',async()=>{
 const {createSession,exportSession}=await import('../src/session.mjs');
 const {exportAsymmetricDeadzoneInputs:save,restoreAsymmetricDeadzoneInputs:open}=await import('../src/science/asymmetric-command-deadzone.mjs');
 const session=createSession({observations:course(.71,.23),heldOut:course(.71,.23,31,.8)},{});
 const text=save(session,[0,.23,.71]),restored=open(text);
 assert.equal(exportSession(restored.session),exportSession(session));assert.deepEqual(restored.widths,[0,.23,.71]);
 assert.throws(()=>open(JSON.stringify({...JSON.parse(text),winner:{negative:.71,positive:.23}})),/derived results/);
 const again=fit(restored.session.discovery.observations,restored.widths,options);
 assert.deepEqual([again.selected.negative,again.selected.positive],[.71,.23]);
});

test('asymmetric candidates cannot silently enter the symmetric predictor',()=>{
 const r=fit(course(.71,.23),[0,.23,.71],options);
 assert.ok(r.candidates.every(c=>!Object.hasOwn(c,'width')));
 assert.throws(()=>predictDeadzone(r.selected,{command:-1,position:0,rate:0}),/half-width/);
});
