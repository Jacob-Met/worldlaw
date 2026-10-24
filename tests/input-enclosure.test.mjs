import assert from 'node:assert/strict';import test from 'node:test';import {inspectInputEnclosures} from '../src/science/input-enclosure.mjs';
const model=terms=>({schema:'worldlaw.torque-model/v1',terms}),row=(position,rate,jointTorque)=>({command:0,position,rate,jointTorque}),zero={command:0,position:0,rate:0,jointTorque:0};
test('declared state uncertainty changes exclusion while model stays fixed',()=>{const m=model([{id:'spring',coefficient:100}]),before=structuredClone(m);assert.equal(inspectInputEnclosures(m,[row(1,0,101)],zero).excludedCount,1);assert.equal(inspectInputEnclosures(m,[row(1,0,101)],{...zero,position:.01}).excludedCount,0);assert.equal(inspectInputEnclosures(m,[row(1,0,103)],{...zero,position:.01}).excludedCount,1);assert.deepEqual(m,before);});
test('sign exact-zero, crossing and touching bounds remain distinct',()=>{for(const [w,radius,a,b]of[[0,0,0,0],[0,.1,-1,1],[-.1,.1,-1,0],[.1,.1,0,1]]){const p=inspectInputEnclosures(model([{id:'coulomb',coefficient:1}]),[row(0,w,0)],{...zero,rate:radius}).rows[0].prediction;assert.ok(p[0]<=a&&p[1]>=b&&p[0]>=a-1e-12&&p[1]<=b+1e-12);}});
test('dependency overbound does not establish an achievable torque',()=>{const m=model([{id:'spring',coefficient:1},{id:'gravity',coefficient:-1}]),r=inspectInputEnclosures(m,[row(0,0,.1)],{...zero,position:.1},{refinementSegments:0});assert.equal(r.excludedCount,0);assert.ok(.1-Math.sin(.1)<.001);assert.ok(r.rows[0].prediction[1]>.19);});
test('negative coefficients, sine extrema and polynomial intervals enclose sampled values',()=>{for(const[id,lo,hi]of[['gravity',1,2],['gravity',-2,-1],['gravity',-9,9],['cubic',-2,1],['quadratic',-2,1]]){const rate=id==='quadratic',c=(lo+hi)/2,r=(hi-lo)/2,p=inspectInputEnclosures(model([{id,coefficient:-3}]),[row(rate?0:c,rate?c:0,0)],{...zero,[rate?'rate':'position']:r}).rows[0].prediction;for(let i=0;i<=100;i++){const x=lo+(hi-lo)*i/100,y=-3*(id==='gravity'?Math.sin(x):id==='cubic'?x**3:x*Math.abs(x));assert.ok(y>=p[0]&&y<=p[1]);}}});
test('invalid declaration and domain overflow refuse; empty remains empty',()=>{const m=model([]);assert.equal(inspectInputEnclosures(m,[],zero).count,0);for(const value of[-1,NaN,Infinity,'1'])assert.throws(()=>inspectInputEnclosures(m,[row(0,0,0)],{...zero,rate:value}));assert.throws(()=>inspectInputEnclosures(m,[row(1e6,0,0)],{...zero,position:1}));});
test('enlarging a declared box cannot shrink these prediction enclosures',()=>{const m=model([{id:'spring',coefficient:2},{id:'gravity',coefficient:-3},{id:'cubic',coefficient:.1},{id:'quadratic',coefficient:-2},{id:'coulomb',coefficient:1}]);let prior=null;for(const r of[0,.01,.1,1,4]){const p=inspectInputEnclosures(m,[row(.4,-.2,0)],{...zero,position:r,rate:r}).rows[0].prediction;if(prior)assert.ok(p[0]<=prior[0]&&p[1]>=prior[1]);prior=p;}});
test('all admitted terms retain nominal zero-radius predictions at endpoint extremes',async()=>{
 const {predict}=await import('../src/science/torque-discovery.mjs');
 for(const id of['command','rate','coulomb','spring','gravity','quadratic','cubic','bias'])for(const coefficient of[-1e18,-1,0,1,1e18])for(const x of[-1e6,-Math.PI/2,-Number.MIN_VALUE,0,Number.MIN_VALUE,Math.PI/2,1e6]){
  const m=model([{id,coefficient}]),reading={command:x,position:x,rate:x,jointTorque:0},p=inspectInputEnclosures(m,[reading],zero).rows[0].prediction,y=predict(m,reading);
  assert.ok(Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]<=y&&y<=p[1]);
 }
 assert.throws(()=>inspectInputEnclosures(model([{id:'spring',coefficient:1e19}]),[row(0,0,0)],zero));
});
test('near-critical sine endpoint courses and increased radii retain containment',()=>{
 for(const k of[-100000,-1,0,1,100000])for(const delta of[-1e-10,0,1e-10]){
  const center=Math.PI/2+2*Math.PI*k+delta,m=model([{id:'gravity',coefficient:-1e18}]);let previous;
  for(const radius of[0,1e-12,1e-9,.01]){
   const p=inspectInputEnclosures(m,[row(center,0,0)],{...zero,position:radius}).rows[0].prediction;
   if(previous)assert.ok(p[0]<=previous[0]&&p[1]>=previous[1]);previous=p;
   for(const fraction of[-1,-.5,0,.5,1]){const y=-1e18*Math.sin(center+fraction*radius);assert.ok(y>=p[0]&&y<=p[1]);}
  }
 }
});
