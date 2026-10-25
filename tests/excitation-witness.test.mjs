import test from 'node:test';import assert from 'node:assert/strict';
import {EXCITATION_SCHEMA,inspectExcitation,exportExcitation,importExcitation} from '../src/coupling/excitation-witness.mjs';
import {createCouplingCourse,observeVirtualCoupling} from '../src/coupling/virtual-instrument.mjs';
import {addCouplingObservation} from '../src/coupling/notebook.mjs';
import {predictCoupling,evaluateCoupling} from '../src/coupling/science.mjs';
const fixed=x=>{assert.ok(Number.isInteger(x*2**128));return BigInt(x*2**128);};
const rationalResponse=(m,q)=>m.matrix.map((r,i)=>r.reduce((s,v,j)=>s+fixed(v)*fixed(q[j]),fixed(m.bias[i])*(1n<<128n)));
const fixture=()=>({schema:EXCITATION_SCHEMA,notebook:createCouplingCourse('collinear'),amplitude:1,amplitudeUnits:'N·m/rad'});
test('maintained collinear course has two admitted unequal response hypotheses with identical fitting predictions',()=>{
 const r=inspectExcitation(fixture());assert.equal(r.status,'exact-support-witnesses');assert.equal(r.base.id,'independent');assert.equal(r.witnesses.length,2);
 for(const w of r.witnesses){assert.notDeepEqual(w.model.matrix,r.base.matrix);assert.equal(evaluateCoupling(w.model,r.input.notebook.training).count,32);assert.equal(w.exactEqualFittingRows,32);for(const row of r.input.notebook.training)assert.deepEqual(rationalResponse(w.model,row.q),rationalResponse(r.base,row.q));assert.equal(w.contrasts.filter(c=>c.separates).length,6);for(const c of w.contrasts)assert.equal(c.separates,c.q[0]!==c.q[1]);}
 assert.equal(r.witnesses[0].model.matrix[0][1],r.witnesses[0].model.matrix[1][0]);assert.notEqual(r.witnesses[1].model.matrix[0][1],r.witnesses[1].model.matrix[1][0]);
});
test('separate checks cannot choose or change witnesses and input-only replay retains their provenance',()=>{
 const raw=fixture(),before=structuredClone(raw),a=inspectExcitation(raw);raw.notebook.challenges.forEach(r=>r.torque=[123,-456]);const b=inspectExcitation(raw);assert.deepEqual(a.witnesses,b.witnesses);assert.deepEqual(a.support,b.support);
 const saved=JSON.parse(exportExcitation({...raw,witnesses:[{forged:true}],status:'identified'}));assert.equal(saved.witnesses,undefined);assert.equal(saved.status,undefined);assert.deepEqual(saved.notebook.challenges,raw.notebook.challenges);assert.deepEqual(inspectExcitation(importExcitation(JSON.stringify(saved))).witnesses,b.witnesses);assert.deepEqual(a.input,before);
});
test('only a separately acquired off-support coordinate removes the exhibited null direction',()=>{
 const raw=fixture();raw.notebook=addCouplingObservation(raw.notebook,4,observeVirtualCoupling([0,0],{kind:'collinear',index:1000}));assert.equal(inspectExcitation(raw).status,'exact-support-witnesses');
 raw.notebook=addCouplingObservation(raw.notebook,2,observeVirtualCoupling([-1,1],{kind:'collinear',index:1001}));const r=inspectExcitation(raw);assert.equal(r.status,'no-rank-refusal');assert.equal(r.witnesses.length,0);assert.equal(r.fittingIds.length,34);assert.equal(r.input.notebook.revisions.length,2);
});
test('near-collinear numerical rank refusal is not promoted to exact support equality',()=>{
 const raw=fixture();raw.notebook.training[5].q[1]+=1e-16;const r=inspectExcitation(raw);assert.ok(r.refused.some(x=>x.reason==='insufficient_excitation'));assert.equal(r.status,'no-exact-line-certificate');assert.equal(r.witnesses.length,0);
});
test('actual materialized coefficient rounding must pass, even when symbolic construction vanishes',()=>{
 const raw=fixture();raw.amplitude=.1;const r=inspectExcitation(raw);assert.equal(r.status,'materialization-refused');assert.ok(r.rejected.every(x=>x.reason==='materialized-coefficients-break-exact-equality'));assert.equal(r.witnesses.length,0);
 raw.amplitude=1e-30;const tiny=inspectExcitation(raw);assert.equal(tiny.witnesses.length,0);
});
test('full excitation, invalid amplitude, absent coordinate support and work limit refuse claims',()=>{
 const raw=fixture();raw.notebook=createCouplingCourse('reciprocal');assert.equal(inspectExcitation(raw).status,'no-rank-refusal');
 for(const amplitude of [0,NaN,Infinity,1001])assert.throws(()=>inspectExcitation({...fixture(),amplitude}));assert.throws(()=>inspectExcitation({...fixture(),amplitudeUnits:'rad'}));
 const one=fixture();one.notebook.training.forEach(r=>r.q=[0,0]);assert.equal(inspectExcitation(one).witnesses.length,0);
 const large=fixture();large.notebook.training=Array.from({length:257},(_,i)=>({...large.notebook.training[i%32],id:`many-${i}`}));assert.throws(()=>inspectExcitation(large),/256/);
});
