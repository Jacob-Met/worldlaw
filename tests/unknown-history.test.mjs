import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,syntheticChallenge,evaluateHistory,validateNotebook,exportNotebook,importNotebook} from '../src/unknown-lab/paired-history.mjs';

test('independent hidden-history synthetic oracle challenges current-state-only torque',()=>{
  const n=syntheticChallenge({effect:.7,duration:2.4,noiseSigma:.02,count:16});
  const r=evaluateHistory(n);
  assert.equal(r.source,'synthetic');assert.equal(r.count,16);
  assert.equal(r.verdict,'challenged');
  assert.ok(r.meanDifference>.45 && r.interval[0]>.35);
  for (const pair of r.pairs) for(const k of ['command','position','rate'])
    assert.equal(pair.reference[k],pair.conditioned[k]);
});
test('memoryless oracle is NOT misdiagnosed by noise alone',()=>{
  for(const seed of [1,2,3,4,13,41,103]) {
    const r=evaluateHistory(syntheticChallenge({seed,effect:0,noiseSigma:.04,count:16}));
    assert.equal(r.verdict,'inconclusive','seed '+seed);
  }
});
test('preconditioning duration zero cannot create a hidden state effect',()=>{
  assert.equal(evaluateHistory(syntheticChallenge({duration:0,effect:3})).verdict,'inconclusive');
});
test('negative change direction remains detectable',()=>{
  const r=evaluateHistory(syntheticChallenge({effect:-.9,noiseSigma:.02}));
  assert.equal(r.verdict,'challenged');assert.ok(r.meanDifference<0);
});
test('export/import retain original measured samples, source and assumptions',()=>{
  const original=syntheticChallenge({effect:.4});
  const measured={...original,source:'measured',sourceNote:'user supplied, not independently authenticated'};
  const transfer=importNotebook(exportNotebook(measured));
  assert.equal(transfer.source,'measured');
  assert.equal(transfer.sourceNote,measured.sourceNote);
  assert.deepEqual(transfer.trials,measured.trials);
  assert.deepEqual(evaluateHistory(transfer),evaluateHistory(measured));
});
test('wrong observed state rejects apparent history correlation',()=>{
  const notebook=syntheticChallenge();
  notebook.trials[1].rate+=.02;
  assert.throws(()=>evaluateHistory(notebook),/not matched on rate/);
});
test('missing, duplicates, nonfinite and mixed histories reject rather than invent pair',()=>{
  const base=syntheticChallenge();
  for(const mutation of [
    n=>{n.trials.pop();},
    n=>{n.trials[1].history='reference';},
    n=>{n.trials[0].jointTorque=NaN;},
    n=>{n.trials[0].pairId='bad/id';},
    n=>{n.trials[0].pairId=n.trials[2].pairId;},
  ]){const n=structuredClone(base);mutation(n);assert.throws(()=>validateNotebook(n));}
});
test('import refuses wrong schema, oversized payload, or untrusted source type',()=>{
  const n=syntheticChallenge();
  assert.throws(()=>importNotebook(JSON.stringify({...n,schema:'other'})));
  assert.throws(()=>importNotebook(' '.repeat(200001)),/200 KB/);
  assert.throws(()=>importNotebook(JSON.stringify({...n,source:'mystery'})));
  assert.throws(()=>syntheticChallenge({count:129}),/count/);
});
test('screen is explicitly inconclusive at insufficient effect-to-noise ratio',()=>{
  const r=evaluateHistory(syntheticChallenge({effect:.001,noiseSigma:.2,count:6}));
  assert.equal(r.verdict,'inconclusive');
});
