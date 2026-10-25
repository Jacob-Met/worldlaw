import test from'node:test';import assert from'node:assert/strict';
import {analyzeSaturationProfile,screenSaturationChallenges}from'../src/unknown-lab/saturation-profile.mjs';
import {incompatibleSaturationChallenges}from'../src/unknown-lab/saturation-joint-fixture.mjs';
import {saturatedProbeExample}from'../src/unknown-lab/probe-saturation-fixture.mjs';
test('individually compatible challenges reject a shared continuous family jointly',()=>{
 const s=incompatibleSaturationChallenges(),before=JSON.stringify(s),training=analyzeSaturationProfile(s);
 assert(training.challenges.every(c=>c.status==='outer-overlap-only'));
 for(const chosen of s.runs.filter(r=>r.role==='challenge')){const single=screenSaturationChallenges({...s,runs:s.runs.filter(r=>r.role==='training'||r.id===chosen.id)});assert.equal(single.status,'joint-witness');}
 const joint=screenSaturationChallenges(s);assert.equal(joint.status,'jointly-excluded');assert.equal(joint.boxes.length,0);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(analyzeSaturationProfile(s),training);
});
test('consistent controls retain a joint witness without changing frozen training',()=>{
 const s=saturatedProbeExample(.28),before=analyzeSaturationProfile(s),r=screenSaturationChallenges(s);
 assert.equal(r.status,'joint-witness');assert(r.boxes.some(b=>b.consistencyWitness));assert.deepEqual(analyzeSaturationProfile(s),before);
 assert.deepEqual(r.trainingRunIds,s.runs.filter(x=>x.role==='training').map(x=>x.id));assert.deepEqual(r.challengeRunIds,s.runs.filter(x=>x.role==='challenge').map(x=>x.id));
});
test('budget exhaustion cannot reject the challenge family',()=>{
 const s=incompatibleSaturationChallenges(),r=screenSaturationChallenges(s,{maxEvaluations:1});
 assert.equal(r.status,'budget-unresolved');assert(r.budgetExhausted);assert(r.boxes[0].scale.outer[0]<=.05);assert(r.boxes.at(-1).scale.outer[1]>=1);
});
test('no challenges and unsupported challenges make no joint exclusion claim',()=>{
 const s=saturatedProbeExample(.28);assert.equal(screenSaturationChallenges({...s,runs:s.runs.filter(r=>r.role==='training')}).status,'untested');
 const c=s.runs.find(r=>r.role==='challenge');c.probe.rate=1e-10;for(const t of c.notebook.trials)t.rate=1e-10;
 assert.equal(screenSaturationChallenges(s).status,'unsupported-challenges');
});

test('unqualified challenge orders and insufficient training refuse the joint inference',()=>{
 const s=saturatedProbeExample(.28),c=s.runs.find(r=>r.role==='challenge');
 for(const row of c.notebook.trials){const index=Number(row.pairId.split('-')[1]);row.sampleIndex=2*index+(row.history==='conditioned'?1:0);}
 assert.equal(screenSaturationChallenges(s).status,'unqualified-challenges');
 assert.equal(screenSaturationChallenges({...s,runs:s.runs.filter(r=>r.role==='challenge'||r.id===s.runs[0].id)}).status,'insufficient-training');
});
