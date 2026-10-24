import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCycle as run,cycleExample as example,normalizeCycle,exportCycle,importCycle} from '../src/cycle-work/core.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('authored loop, conservative and uncertainty controls',()=>{const a=run(example());close(a.work,4);close(a.torqueBound,.08);assert.equal(a.conclusion,'positive-work');assert.equal(run(example('conservative')).conclusion,'zero-compatible');assert.equal(run(example('uncertain')).conclusion,'zero-compatible');});
test('ordering reverses work and common torque bias cancels',()=>{const x=example();x.samples.reverse();close(run(x).work,-4);assert.equal(run(x).conclusion,'negative-work');for(const s of x.samples)s.jointTorque+=900;close(run(x).work,-4);});
test('exact box corners agree with shared-observation bound',()=>{const x=example(),a=run(x);let lo=Infinity,hi=-Infinity;for(let mask=0;mask<64;mask++){const y=structuredClone(x);y.samples.forEach((s,i)=>s.jointTorque+=((mask>>i)&1?1:-1)*s.torqueRadius);const w=run(y).work;lo=Math.min(lo,w);hi=Math.max(hi,w);}close(lo,a.work-a.torqueBound);close(hi,a.work+a.torqueBound);});
test('turning observation weights cancel before bounding',()=>{const x=example();x.samples=[{position:0,jointTorque:0,torqueRadius:0},{position:1,jointTorque:9,torqueRadius:100},{position:0,jointTorque:0,torqueRadius:0}];const a=run(x);close(a.work,0);close(a.torqueBound,0);assert.deepEqual(a.weights,[.5,0,-.5]);});
test('integration allowance can remove exclusion; input replay recomputes',()=>{const x=example();x.integrationAllowance=5;assert.equal(run(x).conclusion,'zero-compatible');assert.deepEqual(run(importCycle(exportCycle(x))),run(x));x.work=100;assert.equal(importCycle(exportCycle(x)).work,undefined);});
test('refuses implied closure, units, missing assumptions and unobserved gaps',()=>{for(const mutate of [x=>x.samples.at(-1).position=.01,x=>x.units.position='deg',x=>delete x.integrationAllowance,x=>delete x.angleAssumption,x=>x.angleAssumption='measured',x=>x.integrationAllowance=-1,x=>x.gaps='present',x=>x.samples[1].gapBefore=true,x=>x.samples[2].torqueRadius=NaN,x=>x.samples.forEach(s=>s.position=0),x=>x.samples=Array(4097).fill(x.samples[0])]){const x=example();mutate(x);assert.throws(()=>normalizeCycle(x));}});
test('conservative nonlinear continuous law can produce nonzero polygonal work',()=>{const x=example('quadrature');close(run(x).work,-.25);assert.equal(run(x).conclusion,'negative-work');x.integrationAllowance=.25;assert.equal(run(x).conclusion,'zero-compatible');});
test('UTF-8 cap counts bytes rather than characters',()=>{const text=exportCycle(example());assert.throws(()=>importCycle(text+' '.repeat(2000000)),/UTF-8/);const multibyte=JSON.stringify({...example(),ignored:'é'.repeat(1000000)});assert.ok(multibyte.length<2000000);assert.throws(()=>importCycle(multibyte),/UTF-8/);});
test('direct neighboring-position weight preserves tiny reversal coefficient',()=>{
 const x=example();x.samples=[{position:0,jointTorque:0,torqueRadius:0},{position:1e6,jointTorque:0,torqueRadius:1e12},{position:1e-11,jointTorque:0,torqueRadius:0},{position:0,jointTorque:-2e11,torqueRadius:0}];
 const r=run(x);close(r.work,1);close(r.weights[1],5e-12);close(r.torqueBound,5);assert.ok(r.interval[0]<=-4&&r.interval[1]>=6);assert.equal(r.conclusion,'zero-compatible');
});
test('total uses shared expression and exposes independently rounded ledger discrepancy',()=>{
 const x=example();x.samples=[{position:0,jointTorque:0,torqueRadius:0},{position:1e6,jointTorque:1e12,torqueRadius:0},{position:1e-11,jointTorque:0,torqueRadius:0},{position:0,jointTorque:0,torqueRadius:0}];
 const r=run(x);close(r.work,5);close(r.segmentWork,0);close(r.segmentRoundingDifference,-5);assert.equal(r.conclusion,'positive-work');
});
test('cancelling large weighted torques retain an uncancelled arithmetic guard',()=>{
 const x=example();x.samples=[{position:0,jointTorque:1e12,torqueRadius:0},{position:1e6,jointTorque:0,torqueRadius:0},{position:1e-11,jointTorque:1e12,torqueRadius:0},{position:0,jointTorque:-2e11,torqueRadius:0}];
 const r=run(x);assert.ok(r.arithmetic.weightedMagnitude>=1e18);assert.ok(r.roundingGuard>1);assert.equal(r.conclusion,'zero-compatible');assert.ok(r.interval[0]<=1&&r.interval[1]>=1);
});
test('integer oracle checks enclosure across large alternating weighted sums',()=>{
 let seed=93;const next=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};
 for(let trial=0;trial<80;trial++){
  const x=example();x.samples=Array.from({length:20},()=>({position:(next()%2000001)-1000000,jointTorque:(next()%2000001-1000000)*1000000,torqueRadius:next()%1000001}));x.samples.at(-1).position=x.samples[0].position;
  let twiceWork=0n,twiceBound=0n;const a=x.samples;
  for(let i=0;i<a.length;i++){const d=BigInt(a[Math.min(i+1,a.length-1)].position)-BigInt(a[Math.max(i-1,0)].position);twiceWork+=d*BigInt(a[i].jointTorque);twiceBound+=(d<0n?-d:d)*BigInt(a[i].torqueRadius);}
  const r=run(x),lo=Number(twiceWork-twiceBound)/2,hi=Number(twiceWork+twiceBound)/2;assert.ok(r.interval[0]<=lo);assert.ok(r.interval[1]>=hi);
 }
});
