import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProbeStudy,fitProbeModels,validateProbeStudy,exportProbeStudy,importProbeStudy} from '../src/unknown-lab/probe-response.mjs';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
const clone=x=>structuredClone(x);
for(const id of ['offset','drag','restoring'])test(id+' transfers with one coefficient to signed separate probes',()=>{
 const r=analyzeProbeStudy(probeExample(id));assert.deepEqual(r.fit.candidates.filter(c=>c.compatible).map(c=>c.id),[id]);
 assert.equal(r.jointChallenges[0].status,'compatible');assert.ok(r.challenges.every(c=>c.predictions[0].interval[0]<=c.predictions[0].interval[1]));
});
test('omitted mixed response contradicts every offered family',()=>{assert.equal(analyzeProbeStudy(probeExample('mixed')).fit.status,'none-compatible');});
test('small correlated training states preserve alternatives; reversed probe distinguishes',()=>{
 const r=analyzeProbeStudy(probeExample('ambiguous'));assert.ok(r.fit.candidates.filter(c=>c.compatible).length>=2);assert.equal(r.jointChallenges.find(c=>c.id==='drag').status,'compatible');assert.equal(r.jointChallenges.find(c=>c.id==='restoring').status,'contradicted');
});
test('challenge values cannot change fit or frozen prediction intervals',()=>{
 const x=probeExample(),before=analyzeProbeStudy(x);for(const r of x.runs.filter(r=>r.role==='challenge'))for(const t of r.notebook.trials)if(t.history==='conditioned')t.jointTorque+=3;
 const after=analyzeProbeStudy(x);assert.deepEqual(before.fit,after.fit);assert.deepEqual(before.challenges.map(c=>c.predictions.map(p=>p.interval)),after.challenges.map(c=>c.predictions.map(p=>p.interval)));assert.equal(after.jointChallenges[0].status,'contradicted');
});
test('zero-rate unexcited drag remains ambiguous rather than identified',()=>{
 const x=probeExample();x.runs=x.runs.slice(0,3);for(const r of x.runs){r.probe.rate=0;for(const t of r.notebook.trials){t.rate=0;t.jointTorque=t.sampleIndex*.001;}}
 const r=analyzeProbeStudy(x);assert.equal(r.fit.status,'ambiguous');assert.equal(r.fit.candidates.find(c=>c.id==='drag').excited,false);assert.deepEqual(r.fit.candidates.find(c=>c.id==='drag').coefficientInterval,[-100,100]);
});
test('unqualified challenge cannot erase a qualified contradiction',()=>{
 const x=probeExample();for(const t of x.runs[3].notebook.trials)if(t.history==='conditioned')t.jointTorque+=3;
 for(const t of x.runs[4].notebook.trials)delete t.sampleIndex;
 const r=analyzeProbeStudy(x);assert.equal(r.challenges[1].predictions[0].status,'order-confounded');assert.equal(r.jointChallenges[0].status,'contradicted');
});
test('one coherent coefficient must explain all challenges',()=>{
 const x=probeExample();for(const r of x.runs.slice(0,3))r.notebook.noiseSigma=.2;
 for(const [i,r]of x.runs.slice(3).entries()){const desired=(i===0?-.4:-1)*r.probe.rate;for(const t of r.notebook.trials)if(t.history==='conditioned')t.jointTorque+=desired+.7*r.probe.rate;}
 const r=analyzeProbeStudy(x);assert.ok(r.challenges.every(c=>c.predictions.find(p=>p.id==='drag').status==='compatible'));assert.equal(r.jointChallenges.find(c=>c.id==='drag').status,'contradicted');
});
test('input-only replay recomputes; invalid scope/source/state/reuse rejected',()=>{
 const x=probeExample();assert.deepEqual(analyzeProbeStudy(importProbeStudy(exportProbeStudy(x))),analyzeProbeStudy(x));
 for(const mutate of [y=>y.runs[0].preparation={...y.preparation,recovery:1},y=>y.runs[0].notebook.source='measured',y=>y.runs[0].notebook.trials[0].rate+=.001,y=>{y.runs[1]=clone(y.runs[0]);y.runs[1].id='copy';for(const t of y.runs[1].notebook.trials)t.sampleIndex+=100;},y=>y.runs[0].probe.rate=NaN]){const y=clone(x);mutate(y);assert.throws(()=>validateProbeStudy(y));}
 assert.throws(()=>fitProbeModels(x),/training runs only/);assert.throws(()=>importProbeStudy('{'),/Invalid/);
});
test('unrecorded training order is insufficient, not a fitted effect',()=>{const x=probeExample();for(const t of x.runs[0].notebook.trials)delete t.sampleIndex;assert.equal(analyzeProbeStudy(x).fit.status,'insufficient-training');});
test('training subset and partially overlapping challenge evidence are rejected despite renamed pairs and order',()=>{
 for(const partial of [false,true]){const x=probeExample(),c=clone(x.runs[0]);c.id='copied-subset';c.role='challenge';c.notebook.trials=c.notebook.trials.slice(0,16);for(const t of c.notebook.trials){t.pairId='renamed-'+t.pairId;t.sampleIndex+=100;}
 if(partial)for(const t of c.notebook.trials.slice(4))t.jointTorque+=.0001;
 x.runs.push(c);assert.throws(()=>analyzeProbeStudy(x),/overlaps/);}
});
