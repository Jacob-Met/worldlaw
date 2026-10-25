import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRecoverySupport} from '../src/unknown-lab/recovery-support.mjs';
import {recoverySupportExample} from '../src/unknown-lab/recovery-support-example.mjs';
import {evaluateRecoveryPairs,exportRecovery,importRecovery} from '../src/unknown-lab/recovery-response.mjs';
const candidate=(r,id)=>r.fit.candidates.find(c=>c.id===id);
const selected=r=>r.recordings.map(x=>[x.recordingId,x.selected]);
test('maintained baseline admits false decay; common source support rejects that decay and retains persistence',()=>{
 const raw=recoverySupportExample(),before=JSON.stringify(raw),r=compareRecoverySupport(raw);
 assert.equal(candidate(r.baseline,'decay:1').status,'compatible');
 assert.equal(candidate(r.baseline,'persistent').status,'training_contradiction');
 assert.equal(candidate(r.comparison,'decay:1').status,'training_contradiction');
 assert.equal(candidate(r.comparison,'persistent').status,'compatible');
 assert.equal(r.comparison.tests.find(x=>x.id==='persistent').status,'compatible');
 assert.equal(candidate(r.comparison,'decay:2').status,'compatible','ambiguity must remain visible');
 assert.deepEqual(r.comparison.fit.training.map(r=>r.estimate),[.5,.5]);
 assert.deepEqual(r.counts,{'reference-first':16,'conditioned-first':16});
 assert.equal(JSON.stringify(raw),before);
});
test('every original identity is in exactly one retained/excluded ledger, bounded by original evidence',()=>{
 const raw=recoverySupportExample(),r=compareRecoverySupport(raw),runs=[...raw.training,...raw.challenges];
 for(const [i,row]of r.recordings.entries()){
  const ids=[...row.selected,...row.excluded.map(p=>p.pairId)];assert.equal(new Set(ids).size,row.total);assert.equal(ids.length,row.total);
  assert.deepEqual(new Set(ids),new Set(runs[i].evidence.trials.map(t=>t.pairId)));
 }
});
test('source array permutations and outcome changes do not select different original pairs',()=>{
 const raw=recoverySupportExample(),r=compareRecoverySupport(raw);
 for(const run of [...raw.training,...raw.challenges]){run.evidence.trials.reverse();for(const t of run.evidence.trials)t.jointTorque=(t.sampleIndex%7)*.17;}
 const changed=compareRecoverySupport(raw);assert.deepEqual(selected(changed),selected(r));assert.deepEqual(changed.strata,r.strata);
});
test('challenge state/count/outcome changes cannot change frozen training fit or population',()=>{
 const raw=recoverySupportExample(),r=compareRecoverySupport(raw);for(const t of raw.challenges[0].evidence.trials){t.rate=2;t.jointTorque+=t.history==='conditioned'?10:0;}
 const changed=compareRecoverySupport(raw);assert.deepEqual(changed.comparison.fit,r.comparison.fit);assert.deepEqual(changed.strata,r.strata);
 assert.equal(changed.recordings.at(-1).status,'missing-frozen-support');assert.deepEqual(changed.recordings.at(-1).selected,[]);
 assert.equal(changed.comparison.tests.find(x=>x.id==='persistent').status,'incomplete');assert.deepEqual(changed.comparison.tests[0].rows,[]);
});
test('no rounding, mismatched pair coordinates or unrecorded order can supply exact support',()=>{
 for(const mutate of [r=>{for(const t of r.evidence.trials)t.rate+=1e-12;},r=>{for(const t of r.evidence.trials)if(t.history==='conditioned')t.rate+=.0001;},r=>{for(const t of r.evidence.trials)delete t.sampleIndex;}]){
  const raw=recoverySupportExample();mutate(raw.training[1]);const r=compareRecoverySupport(raw);assert.equal(r.status,'insufficient-training-support');assert.equal(r.comparison,null);assert.ok(r.recordings.every(x=>x.selected.length===0));
 }
});
test('each selected acquisition order needs at least four original pairs',()=>{
 const raw=recoverySupportExample();for(const run of raw.training)run.evidence.trials=run.evidence.trials.filter(t=>t.sampleIndex<128||t.sampleIndex<134);
 const r=compareRecoverySupport(raw);assert.equal(r.status,'insufficient-training-support');
});
test('fixed support preserves actual authored exponential recovery and negative receiving control',()=>{
 const raw=recoverySupportExample();
 for(const [index,run]of [...raw.training,...raw.challenges].entries())for(const t of run.evidence.trials){t.rate=0;t.jointTorque=index*.013+(t.history==='conditioned'?.6*Math.exp(-run.delaySeconds):0);}
 const r=compareRecoverySupport(raw);assert.equal(candidate(r.comparison,'decay:1').status,'compatible');assert.equal(candidate(r.comparison,'persistent').status,'training_contradiction');
 assert.equal(r.comparison.tests.find(t=>t.id==='decay:1').status,'compatible');
 const frozen=r.comparison.fit;for(const t of raw.challenges[0].evidence.trials)if(t.history==='conditioned')t.jointTorque+=.5;
 const bad=compareRecoverySupport(raw);assert.deepEqual(bad.comparison.fit,frozen);assert.equal(bad.comparison.tests.find(t=>t.id==='decay:1').status,'challenged');
});
test('input-only original replay recomputes comparison; fabricated derived report is ignored',()=>{
 const raw=recoverySupportExample(),r=compareRecoverySupport(raw);raw.comparison={status:'success'};
 assert.deepEqual(compareRecoverySupport(importRecovery(exportRecovery(raw))),r);
});
test('selection API refuses missing/duplicated/forged pair identities and still validates original custody',()=>{
 const raw=recoverySupportExample(),r=compareRecoverySupport(raw),s=Object.fromEntries(selected(r));
 for(const bad of [{...s,early:['forged',...s.early.slice(1)]},{...s,early:[s.early[0],...s.early.slice(0,-1)]},{early:s.early}])assert.throws(()=>evaluateRecoveryPairs(raw,bad));
 raw.challenges[0]={...structuredClone(raw.training[0]),recordingId:'future'};
 assert.throws(()=>evaluateRecoveryPairs(raw,s),/reused/);
});
test('unseen deterministic state mixtures retain full per-case failures without claiming unique recovery',()=>{
 for(const [hi,lo]of [[52,12],[48,16],[60,4],[50,10],[54,6]]){
  const raw=recoverySupportExample();raw.training[1].delaySeconds=Math.log(hi/lo);raw.challenges[0].delaySeconds=Math.log(hi/32);
  for(const [run,high]of [[raw.training[0],hi],[raw.training[1],lo],[raw.challenges[0],32]])for(const t of run.evidence.trials){const local=Number(t.pairId.split('-')[2]);t.rate=local<high?1:0;t.jointTorque=t.history==='conditioned'?t.rate:0;}
  const r=compareRecoverySupport(raw);assert.equal(candidate(r.baseline,'decay:1').status,'compatible');assert.equal(candidate(r.comparison,'persistent').status,'compatible');
  assert.equal(r.comparison.fit.training[0].estimate,r.comparison.fit.training[1].estimate);
 }
});
