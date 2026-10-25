import test from 'node:test';import assert from 'node:assert/strict';
import{fitSaturationProfile,analyzeSaturationProfile,exportSaturationInvestigation,importSaturationInvestigation}from'../src/unknown-lab/saturation-profile.mjs';
import{saturatedProbeExample}from'../src/unknown-lab/probe-saturation-fixture.mjs';
const training=s=>({...s,runs:s.runs.filter(r=>r.role==='training')});
test('off-grid original finite failure becomes bounded continuous support',()=>{
 const s=training(saturatedProbeExample(.28)),r=fitSaturationProfile(s);
 assert.equal(r.finiteBaseline.status,'none-compatible');assert.equal(r.status,'covered-scale-intervals');
 assert(r.boxes.some(b=>b.covered&&b.scale.outer[0]<=.28&&b.scale.outer[1]>=.28));
 assert(Math.min(...r.boxes.map(b=>b.scale.outer[0]))>.27);assert(Math.max(...r.boxes.map(b=>b.scale.outer[1]))<.29);
 assert(r.evaluations<=512);assert(r.visited<=128);
});
function change(s,kind){for(const run of s.runs){const previous=-.4*Math.tanh(run.probe.rate/.28),rate=kind==='zero'?run.probe.rate:Math.sign(run.probe.rate)*100,response=kind==='zero'?0:-.4*Math.sign(rate);run.probe.rate=rate;for(const t of run.notebook.trials){t.rate=rate;if(t.history==='conditioned')t.jointTorque+=response-previous;}}return s;}
test('fully saturated and zero controls retain the whole declared domain',()=>{
 for(const kind of ['highrate','zero']){const r=fitSaturationProfile(change(training(saturatedProbeExample(.28)),kind));assert.equal(r.boxes.length,1);assert(r.boxes[0].covered);assert(r.boxes[0].scale.outer[0]<=.05);assert(r.boxes[0].scale.outer[1]>=1);if(kind==='zero')assert.equal(r.status,'zero-response-unidentified');}
});
test('both work caps preserve a complete unresolved outer partition',()=>{
 for(const settings of [{maxEvaluations:1},{maxBoxes:1}]){const r=fitSaturationProfile(training(saturatedProbeExample(.28)),settings);assert.equal(r.status,'budget-exhausted');assert.equal(r.excluded,0);assert(r.boxes[0].scale.outer[0]<=.05);assert(r.boxes.at(-1).scale.outer[1]>=1);for(let i=1;i<r.boxes.length;i++)assert.equal(r.boxes[i-1].scale.exact[1],r.boxes[i].scale.exact[0]);}
});
test('challenge mutation cannot select the training witness or fit',()=>{
 const s=saturatedProbeExample(.28),a=analyzeSaturationProfile(s);const bad=structuredClone(s);
 for(const run of bad.runs.filter(r=>r.role==='challenge'))for(const t of run.notebook.trials)if(t.history==='conditioned')t.jointTorque+=2;
 const b=analyzeSaturationProfile(bad);assert.deepEqual(a.fit,b.fit);assert.deepEqual(a.frozenWitness,b.frozenWitness);
 assert(a.challenges.every(r=>r.status==='outer-overlap-only'));assert(b.challenges.every(r=>r.status==='family-excluded'));assert(b.challenges.every(r=>r.witnessStatus==='contradicted'));
});
test('source replay ignores forged derived caches and insufficient training stays explicit',()=>{
 const s=saturatedProbeExample(.28),raw=JSON.parse(exportSaturationInvestigation(s));raw.result={status:'identified'};raw.frozenWitness={scale:'.28',amplitude:'-.4'};
 const reopened=importSaturationInvestigation(JSON.stringify(raw));assert.deepEqual(reopened.study,s);assert.equal(reopened.result,undefined);
 const small={...s,runs:s.runs.slice(0,1)};assert.equal(analyzeSaturationProfile(small).fit.status,'insufficient-training');
 assert.throws(()=>fitSaturationProfile(training(s),{scaleMin:0}));assert.throws(()=>fitSaturationProfile(training(s),{maxBoxes:257}));
});
test('training sign reversal preserves scale family and reverses amplitude',()=>{
 const s=training(saturatedProbeExample(.28)),reverse=structuredClone(s);
 for(const run of reverse.runs){run.probe.rate=-run.probe.rate;for(const t of run.notebook.trials)t.rate=run.probe.rate;}
 const a=fitSaturationProfile(s),b=fitSaturationProfile(reverse);
 assert.deepEqual(a.boxes.map(x=>x.scale),b.boxes.map(x=>x.scale));assert.equal(a.boxes.length,b.boxes.length);
 for(let i=0;i<a.boxes.length;i++){assert.equal(a.boxes[i].amplitudeOuter.outer[0],-b.boxes[i].amplitudeOuter.outer[1]);assert.equal(a.boxes[i].amplitudeOuter.outer[1],-b.boxes[i].amplitudeOuter.outer[0]);}
});

test('challenge exhaustion makes no prefix-based family claim',()=>{
 const s=saturatedProbeExample(.28),fit=fitSaturationProfile(training(s)),r=analyzeSaturationProfile(s,{maxEvaluations:fit.evaluations});
 assert.deepEqual(r.fit.boxes,fit.boxes);assert(r.challenges.some(c=>c.status==='budget-unresolved'));
 for(const c of r.challenges.filter(c=>c.status==='budget-unresolved')){assert.equal(c.outerBands,undefined);assert.equal(c.witnessStatus,undefined);}
});
test('unqualified challenge order and unsupported tiny rate remain explicit',()=>{
 const s=saturatedProbeExample(.28),c=s.runs.find(r=>r.role==='challenge');c.probe.rate=1e-10;for(const t of c.notebook.trials)t.rate=1e-10;
 const r=analyzeSaturationProfile(s);assert.equal(r.challenges.find(x=>x.id===c.id).status,'unsupported-rate');
});
