import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredContrast} from './response-contrast-fixture.mjs';
import {inspectCoupledResponseRegions} from '../src/coupling/response-region.mjs';
import {inspectResponseContrast,serializeResponseContrastInputs,reopenResponseContrastInputs} from '../src/coupling/response-contrast.mjs';
import {discoverCoupling,predictCoupling} from '../src/coupling/science.mjs';
const receive=c=>inspectCoupledResponseRegions(c.notebook,c.path,c.radius);
test('separately attainable rows conflict under the same bounded training change',()=>{
 const c=authoredContrast(),report=receive(c),before=JSON.stringify(report),result=inspectResponseContrast(report,'reciprocal',[0,1]);
 assert.ok(report.candidates.find(c=>c.modelId==='reciprocal').rows.every(r=>r.status==='not-excluded'));
 assert.equal(result.status,'outside');assert.ok(result.witness.gap>.09);assert.equal(JSON.stringify(report),before);
 const reverse=inspectResponseContrast(report,'reciprocal',[1,0]);assert.equal(reverse.status,result.status);assert.ok(Math.abs(reverse.witness.gap-result.witness.gap)<1e-12);
 assert.deepEqual(reverse.observed,result.observed.map(v=>-v));assert.ok(result.independentTrainingSupport>result.sharedTrainingSupport);
});
test('one actual shared perturbation and broad receiving bounds remove the contrast',()=>{
 const c=authoredContrast();
 const shifted=c.analysis.discovery.observations.map((r,i)=>({...r,torque:r.torque.map((v,a)=>v+c.radius*c.signs[0][2*i+a])}));
 const common=discoverCoupling(shifted,c.notebook.options).candidates.find(m=>m.id==='reciprocal');
 c.path.samples.forEach(s=>s.torque=predictCoupling(common,s.q));assert.equal(inspectResponseContrast(receive(c),'reciprocal',[0,1]).status,'not-excluded');
 const broad=authoredContrast();broad.path.samples.forEach(s=>s.torqueRadius=[.1,.1]);assert.equal(inspectResponseContrast(receive(broad),'reciprocal',[0,1]).status,'not-excluded');
});
test('source-only replay preserves selected original order and rejects cached results and invalid rows',()=>{
 const c=authoredContrast(),report=receive(c),text=serializeResponseContrastInputs(report,'reciprocal',[1,0]),reopened=reopenResponseContrastInputs(text);
 assert.equal(reopened.contrast.status,'outside');assert.deepEqual(reopened.contrast.rowIndices,[1,0]);assert.equal(reopened.report.path.source.label,c.path.source.label);
 const cached=JSON.parse(text);cached.verdict='outside';assert.throws(()=>reopenResponseContrastInputs(JSON.stringify(cached)),/stored verdicts/);
 for(const indices of [[0,0],[-1,0],[0,500],[0,.5]])assert.throws(()=>inspectResponseContrast(report,'reciprocal',indices),/distinct original/);
 assert.throws(()=>inspectResponseContrast(report,'missing',[0,1]),/unavailable/);
});
test('maintained separator preserves distinct output radii and zero training-radius receiving',async()=>{
 const {checkLinearEnvelopeSeparator}=await import('../src/science/shared-training-check.mjs');
 const rows=[{influence:[1,-2],observedTorque:2,refittedPrediction:0,independentCoefficientBoxRadius:3,numericalTolerance:0},{influence:[1,2],observedTorque:-2,refittedPrediction:0,independentCoefficientBoxRadius:3,numericalTolerance:0}];
 const checked=checkLinearEnvelopeSeparator(rows,[1,-.5],.1,[.01,.2]);
 assert.deepEqual(checked.trainingProjection,[.5,-3]);assert.equal(checked.trainingSupport,.35000000000000003);assert.equal(checked.receivingSupport,.11);assert.equal(checked.discrepancy,3);assert.equal(checked.status,'verified-separation');
 const c=authoredContrast();c.radius=0;const report=receive(c);assert.equal(inspectResponseContrast(report,'reciprocal',[0,1]).status,'outside');
 const good=authoredContrast();good.radius=0;good.path.samples.forEach(s=>s.torque=predictCoupling(good.model,s.q));assert.equal(inspectResponseContrast(receive(good),'reciprocal',[0,1]).status,'not-excluded');
 assert.throws(()=>checkLinearEnvelopeSeparator(rows,[1,-.5],.1,[.01]),/radii/);
});
