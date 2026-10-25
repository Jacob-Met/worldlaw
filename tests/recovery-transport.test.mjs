import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transportWitness} from '../src/unknown-lab/readout-transport.mjs';
import {compareRecoveryTransport,RECOVERY_TRANSPORT_SCHEMA,exportRecoveryTransport,importRecoveryTransport} from '../src/unknown-lab/recovery-transport.mjs';
import {recoverySupportExample} from '../src/unknown-lab/recovery-support-example.mjs';
import {recoveryFixture} from '../src/unknown-lab/recovery-fixture.mjs';
import {compareRecoverySupport} from '../src/unknown-lab/recovery-support.mjs';
const input=(study=recoverySupportExample(),sensitivity={command:0,position:0,rate:1})=>({schema:RECOVERY_TRANSPORT_SCHEMA,study,settings:{referenceRecordingId:study.training[0].recordingId,sensitivity}});
const model=(r,id)=>r.fit.candidates.find(c=>c.id===id);
test('independent complete SciPy/Fraction oracle covers80 previously generated joint populations',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/readout-assignment-oracle.json',import.meta.url)));
 for(const c of fixture.cases){const r=transportWitness(c.source,c.target,c.sensitivity);assert.deepEqual(r.exact,c.expected);assert.equal(new Set(r.assignment).size,c.source.length);}
});
test('identical coordinate marginals cannot erase joint-population response change',()=>{
 const r=transportWitness([[0,0,0],[1,1,0]],[[0,1,0],[1,0,0]],[1,1,0]);
 assert.deepEqual(r.bound,{lower:1,upper:1});assert.deepEqual(r.exact,{numerator:'1',denominator:'1'});
 // f(x,y)=abs(x-y) attains1 while separate coordinate marginal differences vanish.
});
test('positive subnormal exact cost is not turned into a zero allowance',()=>{
 const r=transportWitness([[0,0,0]],[[Number.MIN_VALUE,0,0]],[Number.MIN_VALUE,0,0]);
 assert.equal(r.exact.numerator,'1');assert.deepEqual(r.bound,{lower:0,upper:Number.MIN_VALUE});
});
test('actual persistent state-response control broadens apparent recovery without claiming identification',()=>{
 const r=compareRecoveryTransport(input());assert.equal(model(r.baseline,'persistent').status,'training_contradiction');
 assert.deepEqual(r.recordings.map(r=>r.allowance.upper),[0,.75,.375]);
 assert.equal(model(r.comparison,'persistent').status,'compatible');assert.ok(r.comparison.fit.candidates.filter(c=>c.status==='compatible').length>1);
 for(const row of r.recordings)for(const order of row.assignments){assert.equal(new Set(order.pairs.map(p=>p.originalPairId)).size,order.pairs.length);assert.equal(new Set(order.pairs.map(p=>p.targetPairId)).size,order.pairs.length);}
});
test('zero sensitivity transports at each same delay; it never bounds temporal change by zero',()=>{
 const x=input(recoveryFixture(),{command:0,position:0,rate:0}),r=compareRecoveryTransport(x);
 assert.ok(r.recordings.every(r=>r.allowance.upper===0));assert.ok(Math.abs(r.recordings[0].original.estimate-r.recordings[1].original.estimate)>.2);
 assert.equal(model(r.comparison,'decay:2').status,'compatible');assert.equal(model(r.comparison,'persistent').status,'training_contradiction');
});
test('continuous readout populations can be conditionally inspected when exact overlap is unavailable',()=>{
 const study=recoveryFixture();assert.equal(compareRecoverySupport(study).status,'insufficient-training-support');
 const r=compareRecoveryTransport(input(study,{command:.01,position:.01,rate:.01}));assert.equal(r.status,'conditional-comparison');assert.ok(r.recordings.every(r=>r.status==='bounded'));assert.equal(model(r.comparison,'decay:2').status,'compatible');
});
test('source/challenge changes cannot alter training population, assignments, fit or bounds',()=>{
 const x=input(),r=compareRecoveryTransport(x);
 for(const t of x.study.challenges[0].evidence.trials){t.rate+=.001;t.jointTorque+=t.history==='conditioned'?5:0;}
 const changed=compareRecoveryTransport(x);assert.deepEqual(changed.comparison.fit,r.comparison.fit);assert.deepEqual(changed.recordings.slice(0,2),r.recordings.slice(0,2));
});
test('missing challenge order or count stays unavailable, not successful partial matching',()=>{
 const x=input();x.study.challenges[0].evidence.trials=x.study.challenges[0].evidence.trials.filter(t=>t.pairId!=='p-0-0');
 const r=compareRecoveryTransport(x);assert.equal(r.recordings.at(-1).status,'unavailable');assert.deepEqual(r.recordings.at(-1).assignments,[]);
 assert.equal(r.comparison.tests.find(t=>t.id==='persistent').status,'incomplete');
});
test('unsupported training leaves no conditional fit while preserving original model result',()=>{
 for(const mutate of [r=>{for(const t of r.evidence.trials)delete t.sampleIndex;},r=>{for(const t of r.evidence.trials)if(t.history==='conditioned')t.rate+=.0001;},r=>{r.evidence.trials=r.evidence.trials.filter(t=>t.pairId!=='p-0-0');}]){
  const x=input();mutate(x.study.training[1]);const r=compareRecoveryTransport(x);assert.equal(r.status,'training-population-unavailable');assert.equal(r.comparison,null);assert.ok(r.baseline);
 }
});
test('negative receiving control survives explicit transport and cannot refit frozen coefficients',()=>{
 const x=input(recoveryFixture(),{command:0,position:0,rate:0}),before=compareRecoveryTransport(x);
 for(const t of x.study.challenges[0].evidence.trials)if(t.history==='conditioned')t.jointTorque+=.5;
 const after=compareRecoveryTransport(x);assert.deepEqual(after.comparison.fit,before.comparison.fit);assert.equal(after.comparison.tests.find(t=>t.id==='decay:2').status,'challenged');
});
test('original source-only case replays exactly; injected result fields are ignored',()=>{
 const x=input(),r=compareRecoveryTransport(x),before=JSON.stringify(x);x.result={status:'verified'};
 const reopened=importRecoveryTransport(exportRecoveryTransport(x));assert.equal(reopened.result,undefined);assert.deepEqual(compareRecoveryTransport(reopened),r);delete x.result;assert.equal(JSON.stringify(x),before);
});
test('invalid source, reference, sensitivity, sparse or oversized populations refuse',()=>{
 for(const mutate of [x=>x.settings.referenceRecordingId='future',x=>x.settings.sensitivity.rate=-1,x=>x.settings.sensitivity.rate=NaN,x=>delete x.settings.sensitivity.command,x=>x.study.challenges[0]={...structuredClone(x.study.training[0]),recordingId:'future'}]){const x=input();mutate(x);assert.throws(()=>compareRecoveryTransport(x));}
 for(const args of [[[[0,0,0]],[[0,0,0],[1,1,1]],[1,1,1]],[[[0,,0]],[[0,0,0]],[1,1,1]],[[[0,0,0]],[[0,0,0]],[1,,1]],[Array(129).fill([0,0,0]),Array(129).fill([0,0,0]),[1,1,1]]])assert.throws(()=>transportWitness(...args));
});
