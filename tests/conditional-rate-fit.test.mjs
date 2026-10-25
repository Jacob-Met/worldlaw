import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionalRateFit} from '../src/science/conditional-rate-fit.mjs';
import {predict,evaluate} from '../src/science/torque-discovery.mjs';
const model=(c,extra=[])=>({schema:'worldlaw.torque-model/v1',id:'authored',terms:[...extra,...['coulomb','rate','quadratic'].map((id,i)=>({id,coefficient:c[i]}))]});
const rows=(m,n=60,scale=1)=>Array.from({length:n},(_,i)=>{const row={command:Math.sin(i*.7),position:Math.cos(i*.9),rate:scale*(-1+2*(i+.5)/n)};return {...row,jointTorque:predict(m,row)};});
test('retains mixed-sign dissipative law instead of clipping coefficients',()=>{
 const m=model([-1,3,-3]),r=conditionalRateFit(m,rows(m),1);
 assert.ok(r.model.terms.find(t=>t.id==='rate').coefficient>2.99);
 assert.ok(r.training.revised.rmse<1e-12);assert.equal(r.screen.witness,null);
});
test('false assumption visibly harms an active law and preserves original',()=>{
 const m=model([-1,8,-8]),before=JSON.stringify(m),training=rows(m),r=conditionalRateFit(m,training,1);
 assert.ok(r.training.revised.rmse>.6);assert.equal(r.training.original.rmse,0);
 assert.equal(JSON.stringify(m),before);assert.equal(r.screen.witness,null);
});
test('preserves fixed non-rate terms and leaves input observations unchanged',()=>{
 const extra=[{id:'command',coefficient:1.3},{id:'spring',coefficient:-2},{id:'bias',coefficient:.2},{id:'command_position',coefficient:.4}];
 const m=model([-1,3,-3],extra),training=rows(m),before=JSON.stringify(training),r=conditionalRateFit(m,training,1);
 assert.deepEqual(r.model.terms.slice(0,4),extra);assert.ok(r.training.revised.rmse<1e-12);assert.equal(JSON.stringify(training),before);
});
test('boundary fit returns exact feasibility after noisy numerical fitting',()=>{
 const m=model([-1,4,-4]),training=rows(m).map((r,i)=>({...r,jointTorque:r.jointTorque+.08*Math.sin(i*1.47+3)}));
 const r=conditionalRateFit(m,training,1);assert.equal(r.screen.witness,null);assert.ok(r.diagnostics.coulombCorrection>0);assert.ok(r.diagnostics.rounds<=24);assert.ok(r.diagnostics.work<=r.diagnostics.workLimit);
});
test('changing declaration changes the admitted revision',()=>{
 const m=model([-.1,1,-1]),training=rows(m),small=conditionalRateFit(m,training,.05),large=conditionalRateFit(m,training,1);
 assert.ok(small.training.revised.rmse<1e-12);assert.ok(large.training.revised.rmse>.05);assert.notDeepEqual(small.model.terms,large.model.terms);
});
test('speed normalization preserves scaled physical laws',()=>{
 for(const V of [.001,1000]){
  const m=model([-1,3/V,-3/V/V]),r=conditionalRateFit(m,rows(m,60,V),V);
  assert.ok(r.training.revised.rmse<1e-11);assert.equal(r.screen.witness,null);
 }
});
test('refuses rank-deficient and invalid declarations rather than fabricate fit',()=>{
 const m=model([-1,3,-3]),training=rows(m);
 for(const speed of [0,-1,NaN,Infinity,1e7])assert.throws(()=>conditionalRateFit(m,training,speed));
 assert.throws(()=>conditionalRateFit(m,training.slice(0,7),1));
 assert.throws(()=>conditionalRateFit(m,training.map(r=>({...r,rate:.5})),1),/rank deficient/);
});
test('held-out mutation cannot change training-only revision',()=>{
 const m=model([-1,8,-8]),training=rows(m),r=conditionalRateFit(m,training,1),snapshot=JSON.stringify(r.model);
 const challenge=rows(m,20);evaluate(r.model,challenge);evaluate(r.model,challenge.map(x=>({...x,jointTorque:x.jointTorque+100})));
 assert.equal(JSON.stringify(r.model),snapshot);assert.deepEqual(conditionalRateFit(m,training,1),r);
});

test('preserves original Coulomb sign when normalized nonzero rate underflows',()=>{
 const m=model([-1,-.2,-.1]),training=rows(m);
 const tiny={command:0,position:0,rate:Number.MIN_VALUE};training.push({...tiny,jointTorque:predict(m,tiny)});
 assert.equal(tiny.rate/1e6,0);
 const r=conditionalRateFit(m,training,1e6);
 assert.ok(r.training.revised.rmse<1e-12);assert.ok(Math.abs(predict(r.model,tiny)+1)<1e-12);
});
