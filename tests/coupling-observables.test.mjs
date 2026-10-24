import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectObservables} from '../src/coupling/observable-receiving.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook} from '../src/coupling/notebook.mjs';
import {predictCoupling} from '../src/coupling/science.mjs';
import {circulationExample,exportCirculation,importCirculation} from '../src/coupling/circulation.mjs';
function fixture(){const notebook=createCouplingCourse(),path=circulationExample(notebook.assumptions.coordinateConvention),model=analyzeCouplingNotebook(notebook).discovery.candidates.find(m=>m.id==='independent');path.source.label='Authored fixed-independent-law control, not measured evidence';path.samples.forEach(s=>{s.torque=predictCoupling(model,s.q);s.torqueRadius=[.01,.01];});return {notebook,path};}
test('an actual response-field contradiction survives cancellation in integrated work',()=>{
 const {notebook,path}=fixture(),r=inspectObservables(notebook,path),a=r.candidates.find(c=>c.modelId==='independent'),b=r.candidates.find(c=>c.modelId==='reciprocal');
 assert.equal(a.responseStatus,'not-separated');assert.equal(a.workUnresolvedResponseContradicted,false);
 assert.equal(b.workStatus,'not-separated');assert.equal(b.responseStatus,'incompatible');assert.equal(b.workUnresolvedResponseContradicted,true);assert.equal(b.contradictingComponents,6);
 assert.equal(b.witness.sampleIndex,2);assert.equal(b.witness.axis,0);assert.equal(b.witness.extrapolated,true);assert.ok(Math.abs(b.witness.residual)>1.04);assert.ok(b.witness.excess>1.03);
 assert.deepEqual(r.workBlindPairs,[['independent','reciprocal']]);assert.equal(r.pointProposal.status,'proposed');assert.ok(r.pointProposal.selected.disagreement>1.4);
});
test('wide supplied bounds stop response discrimination without changing training-only experiment choices',()=>{
 const {notebook,path}=fixture(),before=structuredClone({notebook,path}),r=inspectObservables(notebook,path);assert.deepEqual({notebook,path},before);
 path.samples.forEach(s=>s.torqueRadius=[10,10]);const wide=inspectObservables(notebook,path);assert.ok(wide.candidates.every(c=>c.responseStatus==='not-separated'&&c.witness===null));
 path.samples[1].torque[0]+=100;const changed=inspectObservables(notebook,path);assert.deepEqual(changed.pointProposal,r.pointProposal);assert.deepEqual(wide.pointProposal,r.pointProposal);assert.deepEqual(changed.workBlindPairs,r.workBlindPairs);
});
test('existing input-only circulation save/reopen deterministically reconstructs the new observable inspection',()=>{
 const {notebook,path}=fixture(),r=inspectObservables(notebook,path),reopened=importCirculation(exportCirculation(notebook,path));
 assert.deepEqual(inspectObservables(reopened.notebook,reopened.observed.input),r);
});
test('geometry/source refusal remains atomic, and omitted directional work does not disappear into a response pass',()=>{
 const {notebook,path}=fixture(),bad=structuredClone(path);bad.samples.pop();assert.throws(()=>inspectObservables(notebook,bad),/return to both/);
 const mismatch=structuredClone(path);mismatch.source.coordinateConvention+=' changed';assert.throws(()=>inspectObservables(notebook,mismatch),/conventions/);
 const directional=inspectObservables(notebook,circulationExample(notebook.assumptions.coordinateConvention));assert.ok(directional.candidates.every(c=>c.workStatus==='incompatible'));assert.ok(directional.candidates.every(c=>c.responseStatus==='incompatible'));
});

test('a broad work allowance causes nonseparation without implying exact residual cancellation',()=>{
 const {notebook}=fixture(),p=circulationExample(notebook.assumptions.coordinateConvention);p.integrationAllowance=100;const r=inspectObservables(notebook,p),c=r.candidates.find(m=>m.modelId==='reciprocal');
 assert.equal(r.work.observed.work,2);assert.equal(r.work.candidates.find(m=>m.modelId==='reciprocal').work,0);assert.equal(c.workUnresolvedResponseContradicted,true);assert.equal(c.workStatus,'not-separated');assert.equal(c.responseStatus,'incompatible');
});
