import test from 'node:test';import assert from 'node:assert/strict';
import {sharedCourseFixture} from './coupling-shared-course-fixture.mjs';
import {searchCoupledSharedCourse,checkCoupledCourseCertificate,serializeCoupledCourseCertificate,reopenCoupledCourseCertificate} from '../src/coupling/shared-course.mjs';
import {inspectCoupledResponseRegions} from '../src/coupling/response-region.mjs';
import {inspectResponseContrast} from '../src/coupling/response-contrast.mjs';
import {discoverCoupling,predictCoupling} from '../src/coupling/science.mjs';
const search=(f,options={},radius=1)=>searchCoupledSharedCourse(f.notebook,f.path,radius,'reciprocal',options);
function compatible(){const f=sharedCourseFixture(),shifted=f.analysis.discovery.observations.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+.03*Math.sin(i+a))})),m=discoverCoupling(shifted,f.notebook.options).candidates.find(m=>m.id==='reciprocal');f.path.source.label='Authored common training-offset course; no physical data';f.path.samples.forEach(r=>{r.torque=predictCoupling(m,r.q);r.torqueRadius=[.001,.002];});return f;}
test('complete-output separator finds a contradiction missed by every row and selected-row difference',()=>{
 const f=sharedCourseFixture(),before=JSON.stringify(f),report=inspectCoupledResponseRegions(f.notebook,f.path,1),candidate=report.candidates.find(c=>c.modelId==='reciprocal');assert.ok(candidate.rows.every(r=>r.status==='not-excluded'));
 for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)assert.notEqual(inspectResponseContrast(report,'reciprocal',[a,b]).status,'outside');
 const result=search(f);assert.equal(result.status,'verified-separation');assert.equal(result.receivingCoordinateCount,12);assert.ok(result.check.gap>result.check.numericalTolerance);assert.equal(result.certificate.values.length,12);assert.deepEqual(checkCoupledCourseCertificate(result.source,result.certificate),result.check);assert.equal(JSON.stringify(f),before);
});
test('one checked common offset receives every original output under independent coupled refit',()=>{
 const f=compatible(),result=search(f);assert.equal(result.status,'verified-interior-witness');assert.equal(result.check.rows.length,12);assert.ok(result.check.rows.every(r=>r.strictInterior));assert.equal(result.check.physicalOffsets.length,64);
 const shifted=f.analysis.discovery.observations.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+result.check.physicalOffsets[2*i+a])})),m=discoverCoupling(shifted,f.notebook.options).candidates.find(m=>m.id==='reciprocal');const predictions=f.path.samples.flatMap(r=>predictCoupling(m,r.q));predictions.forEach((v,i)=>assert.equal(v,result.check.rows[i].refittedPrediction));
});
test('zero radii, budgets and invalid complete-course options stay honest',()=>{
 const f=sharedCourseFixture();f.path.samples.forEach(r=>r.torque=predictCoupling(f.model,r.q));assert.equal(search(f,{},0).status,'verified-interior-witness');f.path.samples.forEach(r=>r.torqueRadius=[0,0]);assert.equal(search(f,{},0).status,'unresolved');
 const bad=sharedCourseFixture();assert.equal(search(bad,{maxIterations:0}).reason,'iteration-budget');assert.equal(search(bad,{maxProducts:0}).reason,'matrix-work-budget');assert.throws(()=>search(bad,{maxIterations:4097}),/budgets/);assert.throws(()=>search(bad,{truncate:1}),/only/);
});
test('replay checks source and candidate afresh and rejects stale or forged evidence',()=>{
 const f=sharedCourseFixture(),r=search(f),text=serializeCoupledCourseCertificate(r.source,r.certificate),opened=reopenCoupledCourseCertificate(text);assert.deepEqual(opened.check,r.check);
 for(const edit of [x=>x.verdict='verified',x=>x.certificate.claimedStatus='verified',x=>x.source.path.samples.reverse(),x=>x.source.trainingRadius=.5,x=>x.source.modelId='directional',x=>x.certificate.values[0]=2]){const raw=JSON.parse(text);edit(raw);assert.throws(()=>reopenCoupledCourseCertificate(JSON.stringify(raw)));}
 const tampered=JSON.parse(text);tampered.certificate.values=Array(12).fill(0);assert.throws(()=>reopenCoupledCourseCertificate(JSON.stringify(tampered)),/nonzero/);
 const w=search(compatible());assert.equal(reopenCoupledCourseCertificate(serializeCoupledCourseCertificate(w.source,w.certificate)).check.status,'verified-interior-witness');
});
