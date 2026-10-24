import test from 'node:test';
import assert from 'node:assert/strict';
import {circulationExample,evaluateCirculation,compareCirculation,exportCirculation,importCirculation} from '../src/coupling/circulation.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
const input=kind=>circulationExample('same convention',kind);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('independent analytic vector fields: directional unit square gives +2, reciprocal gives zero',()=>{
 near(evaluateCirculation(input('directional')).work,2);near(evaluateCirculation(input('reciprocal')).work,0);
 assert.equal(evaluateCirculation(input('directional')).conclusion,'positive-work');
});
test('reversing path changes work sign; common torque offset cancels; shared reading bounds retain cancellation',()=>{
 const p=input('directional'),a=evaluateCirculation(p);p.samples.reverse();near(evaluateCirculation(p).work,-2);
 p.samples.forEach(s=>s.torque=s.torque.map(v=>v+17));near(evaluateCirculation(p).work,-2);
 assert.equal(evaluateCirculation(input('uncertain')).conclusion,'zero-compatible');
 assert.equal(a.torqueBound,0);
});
test('enumerating all 1024 vertex-axis error signs agrees with shared-weight radius',()=>{
 const p=input('directional');p.samples.forEach((s,i)=>s.torqueRadius=[.1*(i+1),.07]);const r=evaluateCirculation(p);let lo=Infinity,hi=-Infinity;
 for(let mask=0;mask<1024;mask++){const q=structuredClone(p);q.samples.forEach((s,i)=>s.torque=s.torque.map((v,a)=>v+((mask>>(2*i+a))&1?1:-1)*s.torqueRadius[a]));const w=evaluateCirculation(q).work;lo=Math.min(lo,w);hi=Math.max(hi,w);}
 near(lo,r.work-r.torqueBound);near(hi,r.work+r.torqueBound);assert.ok(r.interval[0]<=lo&&r.interval[1]>=hi);
});
test('nonlinear conservative gradient can have polygon artifact, explicitly enlarged by supplied allowance',()=>{
 const p=input('quadrature'),r=evaluateCirculation(p);assert.ok(Math.abs(r.work)>.1);p.integrationAllowance=Math.abs(r.work);assert.equal(evaluateCirculation(p).conclusion,'zero-compatible');
});
test('constant coordinate contributes exactly zero without refusing legitimate retraced path',()=>{
 const p=input('directional');p.samples=[[0,0],[1,0],[2,0],[0,0]].map((q,i)=>({q,torque:[i,99],torqueRadius:[0,8]}));const r=evaluateCirculation(p);assert.equal(r.axes[1].work,0);assert.equal(r.axes[1].torqueBound,0);
});
test('closed angle readings remain separate: final torque uncertainty does not alias first reading',()=>{
 const p=input('directional');p.samples.at(-1).torqueRadius=[0,2];near(evaluateCirculation(p).torqueBound,1);
});
test('receiving preserves all training/fitted models and input-only replay even when measurements change',()=>{
 const n=createCouplingCourse(),p=circulationExample(n.assumptions.coordinateConvention),before=structuredClone(n),r=compareCirculation(n,p);
 p.samples[1].torque[0]+=10;const changed=compareCirculation(n,p);assert.deepEqual(changed.candidates,r.candidates);assert.deepEqual(n,before);
 const reopened=importCirculation(exportCirculation(n,p));assert.deepEqual(reopened,changed);
 assert.ok(r.candidates.length);assert.ok(r.candidates.every(c=>c.extrapolatedRows.length));
});
test('bad units, unmatched convention, missing closure, gaps, negative bounds and work limit refuse',()=>{
 const n=createCouplingCourse();for(const change of [p=>p.units.torque='J',p=>p.samples.pop(),p=>p.samples[0].gapAfter=true,p=>p.samples[0].torqueRadius[0]=-1,p=>p.integrationAllowance=-1,p=>p.samples=Array(1025).fill(p.samples[0])]){const p=input('directional');change(p);assert.throws(()=>evaluateCirculation(p));}
 assert.throws(()=>compareCirculation(n,input('directional')),/conventions/);
});

test('a fitted response exceeding the receiving numeric bounds retains observed work and every failed candidate',()=>{
 const n=createCouplingCourse();n.training.forEach(s=>s.q=s.q.map(v=>v*1e-8));n.challenges=[];n.revisions=[];
 const p=circulationExample(n.assumptions.coordinateConvention);p.samples.forEach(s=>s.q=s.q.map(v=>v*1e6));
 const r=compareCirculation(n,p);assert.ok(Number.isFinite(r.observed.work));assert.equal(r.candidates.length,3);
 assert.ok(r.candidates.some(c=>c.status==='unexecutable'));assert.ok(r.candidates.filter(c=>c.status==='unexecutable').every(c=>c.work===null&&c.reason));
});
