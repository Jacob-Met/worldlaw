import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCoupledResponseRegions,responseRegionVertices} from '../src/coupling/response-region.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook} from '../src/coupling/notebook.mjs';
import {predictCoupling,discoverCoupling} from '../src/coupling/science.mjs';
import {circulationExample} from '../src/coupling/circulation.mjs';
function control(){
 const notebook=createCouplingCourse(),model=analyzeCouplingNotebook(notebook).discovery.candidates.find(m=>m.id==='reciprocal'),path=circulationExample(notebook.assumptions.coordinateConvention);
 path.source.label='Authored shared-training-error contradiction; not measured';
 path.samples=[[-1,-1],[0,-1],[0,0],[-1,0],[-1,-1]].map(q=>({q,torque:predictCoupling(model,q),torqueRadius:[.01,.01]}));
 path.samples[0].torque[0]+=3.779538032717862;path.samples[0].torque[1]-=3.779538032717862;
 return {notebook,model,path};
}
test('joint response rejects a supplied pair despite both marginal sensitivity bands overlapping',()=>{
 const {notebook,path}=control(),before=JSON.stringify({notebook,path}),report=inspectCoupledResponseRegions(notebook,path,.05),candidate=report.candidates.find(m=>m.modelId==='reciprocal'),row=candidate.rows[0];
 assert.equal(candidate.status,'computed');assert.deepEqual(row.marginalStatus,['not-excluded','not-excluded']);assert.equal(row.status,'outside');assert.equal(row.jointOnlyContradiction,true);assert.ok(row.witness.gap>1.45);assert.ok(row.witness.gap<1.46);assert.deepEqual(row.extrapolatedAxes,[0,1]);
 assert.equal(JSON.stringify({notebook,path}),before);assert.equal(report.candidates.length,3);
 const wide=structuredClone(path);wide.samples.forEach(s=>s.torqueRadius=[10,10]);const wideRow=inspectCoupledResponseRegions(notebook,wide,.05).candidates.find(m=>m.modelId==='reciprocal').rows[0];assert.equal(wideRow.status,'not-excluded');
});
test('separating-direction witness is attainable by one bounded training perturbation in the maintained fitter',()=>{
 const {notebook,path}=control(),report=inspectCoupledResponseRegions(notebook,path,.05),row=report.candidates.find(m=>m.modelId==='reciprocal').rows[0],training=analyzeCouplingNotebook(notebook).discovery.observations;
 const shifted=training.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+.05*row.witness.trainingSigns[2*i+a])}));
 const model=discoverCoupling(shifted,notebook.options).candidates.find(m=>m.id==='reciprocal'),prediction=predictCoupling(model,row.q),normal=row.witness.normal;
 const achieved=prediction.reduce((s,v,a)=>s+normal[a]*(v-row.center[a]),0)+row.readingRadius.reduce((s,r,a)=>s+r*Math.abs(normal[a]),0);
 assert.ok(Math.abs(achieved-row.witness.support)<1e-10);
 const vertices=responseRegionVertices(row.center,row.generators),maxProjection=Math.max(...vertices.map(v=>v.reduce((s,x,a)=>s+normal[a]*(x-row.center[a]),0)));
 assert.ok(Math.abs(maxProjection-(row.witness.support-row.readingRadius.reduce((s,r,a)=>s+r*Math.abs(normal[a]),0)))<1e-10);
});
test('zero training radius collapses to fixed-model receiving and unchanged observations remain admitted',()=>{
 const {notebook,path,model}=control();path.samples.forEach(s=>s.torque=predictCoupling(model,s.q));
 const report=inspectCoupledResponseRegions(notebook,path,0),candidate=report.candidates.find(m=>m.modelId==='reciprocal');assert.ok(candidate.rows.every(r=>r.status==='not-excluded'));assert.deepEqual(responseRegionVertices(candidate.rows[0].center,candidate.rows[0].generators),[candidate.rows[0].center]);
 path.samples[0].torque[0]+=1;assert.equal(inspectCoupledResponseRegions(notebook,path,0).candidates.find(m=>m.modelId==='reciprocal').rows[0].status,'outside');
});
test('whole-course input and work admission refuse rather than truncate',()=>{
 const {notebook,path}=control();assert.throws(()=>inspectCoupledResponseRegions(notebook,path,-1),/nonnegative/);assert.throws(()=>inspectCoupledResponseRegions(notebook,path,NaN),/finite/);
 const long=structuredClone(path);long.samples=Array.from({length:129},()=>structuredClone(path.samples[0]));long.samples[1]=structuredClone(path.samples[1]);long.samples[2]=structuredClone(path.samples[2]);assert.throws(()=>inspectCoupledResponseRegions(notebook,long,.05),/128/);
 const bigNotebook=structuredClone(notebook);bigNotebook.training=Array.from({length:128},(_,i)=>({...structuredClone(notebook.training[i%notebook.training.length]),id:'budget-'+i}));const bigPath=structuredClone(long);bigPath.samples.pop();assert.throws(()=>inspectCoupledResponseRegions(bigNotebook,bigPath,.05),/work-unit budget/);
 const malformed=structuredClone(path);malformed.samples[0].torqueRadius=[NaN,.01];assert.throws(()=>inspectCoupledResponseRegions(notebook,malformed,.05));
});
test('point and line receiving regions preserve off-line refusal and exact numerical boundary',()=>{
 const {notebook,path,model}=control();path.samples.forEach(s=>{s.torque=predictCoupling(model,s.q);s.torqueRadius=[0,0];});
 const row=()=>inspectCoupledResponseRegions(notebook,path,0).candidates.find(m=>m.modelId==='reciprocal').rows[0];
 assert.equal(row().status,'numerical-boundary');
 path.samples[0].torqueRadius=[1,0];path.samples[0].torque[0]+=.2;path.samples[0].torque[1]+=.3;assert.equal(row().status,'outside');
 path.samples[0].torque=predictCoupling(model,path.samples[0].q);path.samples[0].torque[0]+=1;assert.equal(row().status,'numerical-boundary');
 path.samples[0].torque[0]-=.5;assert.equal(row().status,'numerical-boundary','A point on a line region remains a boundary, not an interior proof.');
});
test('input-only region replay preserves original source and setting and refuses cached verdicts',async()=>{
 const {serializeResponseRegionInputs,reopenResponseRegionInputs}=await import('../src/coupling/response-region-inputs.mjs');
 const {notebook,path}=control(),saved=serializeResponseRegionInputs(notebook,path,.05),raw=JSON.parse(saved);
 assert.deepEqual(Object.keys(raw).sort(),['notebook','path','schema','trainingRadius']);assert.equal(raw.trainingRadius,.05);
 const reopened=reopenResponseRegionInputs(saved);assert.equal(reopened.path.source.label,path.source.label);assert.equal(reopened.candidates.find(m=>m.modelId==='reciprocal').rows[0].jointOnlyContradiction,true);
 raw.candidates=[];assert.throws(()=>reopenResponseRegionInputs(JSON.stringify(raw)),/stored verdicts/);
 assert.throws(()=>reopenResponseRegionInputs('{bad'),/valid JSON/);assert.throws(()=>reopenResponseRegionInputs(' '.repeat(4*1024*1024+1)),/4 MiB/);
 const wrong=JSON.parse(saved);wrong.path.source.coordinateConvention+=' altered';assert.throws(()=>reopenResponseRegionInputs(JSON.stringify(wrong)),/conventions/);
});
