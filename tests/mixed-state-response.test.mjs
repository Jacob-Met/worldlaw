import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {MIXED_SCHEMA,fitMixedResponse,analyzeMixedStudy,exportMixedStudy,importMixedStudy} from '../src/unknown-lab/mixed-state-response.mjs';
function course(seed,law,{drift=.03,count=64}={}){
 const n=syntheticChallenge({seed,count,noiseSigma:.002,effect:0});delete n.simulation;
 for(let i=0;i<count;i++){
  const a=n.trials[i*2],b=n.trials[i*2+1],state={command:Math.sin((i+seed)*1.327),position:1.2*Math.sin((i+seed)*2.123),rate:1.5*Math.cos((i+seed)*.731)};
  Object.assign(a,state);Object.assign(b,state);a.jointTorque=.123+seed*.00017+Math.sin(i*.31);
  b.jointTorque=a.jointTorque+law(state)+drift*(b.sampleIndex-a.sampleIndex)+.0003*Math.sin(i*3.17+seed);
 }return n;
}
const study=(law=s=>.6*s.rate)=>({schema:MIXED_SCHEMA,protocol:'Identical fixed preparation and readout, authored controls.',training:course(811,law),challenge:course(1427,law)});
test('complete discovery forecasts separate sign-changing course better than constant',()=>{
 const r=analyzeMixedStudy(study());assert.equal(r.fit.candidates.length,16);assert.equal(r.fit.selected.id,'rate');
 const selected=r.tests.find(t=>t.id===r.fit.selected.id),constant=r.tests.find(t=>t.id==='offset');
 assert.ok(selected.rmse<.001);assert.ok(constant.rmse>.5);assert.ok(Math.abs(r.fit.selected.coefficients[0]-.6)<.0001);
});
test('unfamiliar mixed law and original source replay',()=>{
 const s=study(p=>.2+1.1*p.command-.8*Math.sin(p.position));const r=analyzeMixedStudy(s);
 assert.equal(r.fit.selected.id,'offset+command+restoring');assert.ok(r.tests.find(t=>t.id===r.fit.selected.id).rmse<.001);
 assert.deepEqual(analyzeMixedStudy(importMixedStudy(exportMixedStudy(s))),r);
});
test('challenge changes scores without changing fit; changed mechanism fails',()=>{
 const s=study(),a=analyzeMixedStudy(s);s.challenge=course(1427,p=>-.7*p.rate);
 const b=analyzeMixedStudy(s);assert.deepEqual(a.fit,b.fit);assert.ok(b.tests.find(t=>t.id==='rate').rmse>1);
});
test('omitted nonlinear response remains a loss, not discovery',()=>{
 const r=analyzeMixedStudy(study(p=>Math.sin(7*p.rate)));assert.ok(r.tests.find(t=>t.id===r.fit.selected.id).rmse>.4);assert.equal(r.fit.trainingScreen.status,'library-mismatch');
});
test('confounded state and order is retained as unresolved rank',()=>{
 const n=course(631,p=>p.rate);for(let i=0;i<n.trials.length;i+=2){const a=n.trials[i],b=n.trials[i+1];a.rate=b.rate=b.sampleIndex-a.sampleIndex;}
 const r=fitMixedResponse(n);assert.equal(r.candidates.find(c=>c.id==='rate').status,'rank-unresolved');
});
test('mismatch, missing order, reused source and provenance mix refuse',()=>{
 const s=study();s.training.trials[1].position+=.00001;assert.throws(()=>analyzeMixedStudy(s),/exactly matched/);
 const t=study();for(const row of t.training.trials)delete row.sampleIndex;assert.throws(()=>analyzeMixedStudy(t),/acquisition order/);
 const u=study();u.challenge=structuredClone(u.training);for(const row of u.challenge.trials)row.pairId+='x';assert.throws(()=>analyzeMixedStudy(u),/original training/);
 const v=study();v.challenge.source='measured';assert.throws(()=>analyzeMixedStudy(v),/sources separate/);
});
test('original paired mean can miss a deterministic antisymmetric response',()=>{
 const n=course(333,p=>.6*p.rate,{drift:0,count:32});for(let i=0;i<32;i++){const a=n.trials[2*i],b=n.trials[2*i+1];a.rate=b.rate=(i-15.5)/8;b.jointTorque=a.jointTorque+.6*b.rate;}
 const r=fitMixedResponse(n);assert.equal(r.original.verdict,'inconclusive');assert.equal(r.selected.id,'rate');
});
test('zero preparation and order drift do not require a response term',()=>{
 const r=analyzeMixedStudy(study(()=>0));assert.equal(r.fit.selected.id,'no-response');assert.ok(r.tests.find(t=>t.id==='no-response').rmse<.001);
});
test('a newly changed acquisition drift remains a frozen forecast loss',()=>{
 const s=study();s.challenge=course(1427,p=>.6*p.rate,{drift:1.5});
 const r=analyzeMixedStudy(s);assert.equal(r.fit.selected.id,'rate');assert.ok(r.tests.find(t=>t.id==='rate').rmse>1.4);
});
test('cached claimed conclusions cannot override original inputs',()=>{
 const s=study();const before=analyzeMixedStudy(s);s.fit={selected:{id:'invented',coefficients:[999]}};s.tests=[{id:'rate',rmse:0}];
 assert.deepEqual(analyzeMixedStudy(importMixedStudy(JSON.stringify(s))),before);
});
