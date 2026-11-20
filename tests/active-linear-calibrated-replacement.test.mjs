import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';

const source=await readFile(new URL('../examples/active-linear-calibrated-replacement.json',import.meta.url),'utf8');

test('one shared calibration and one unmarked reading survive sealed replay',async()=>{
  const book=await createActiveNotebook(source);
  assert.deepEqual(book.plan.selection.map(row=>row.tick),[0,1,2,4]);
  assert.equal(book.plan.proof.length,6);
  const readings=[[0,5],[1,7],[2,-17],[4,13]].map(([tick,value])=>({tick,value}));
  const received=await receiveActiveNotebook(book,JSON.stringify({
    schema:'worldlaw.active-linear-readings/v1',source:'Synthetic gain-two ramp.',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,readings
  }));
  const result=received.readouts[0].result;
  assert.deepEqual(result.consistentHypothesisIds,['right']);
  const compatible=result.checks.find(row=>row.hypothesis==='right').omissions.filter(row=>row.status==='consistent');
  assert.deepEqual(compatible.map(row=>row.ignoredTick),[2]);
  assert.deepEqual(await replayActiveNotebook(JSON.stringify(received)),received);
  const altered=structuredClone(received);
  altered.plan.proof[0].excludedTicks.reverse();
  await assert.rejects(replayActiveNotebook(JSON.stringify(altered)));
});

test('proportional slopes and touching noise bounds cannot certify separation',async()=>{
  const request=JSON.parse(source);
  request.hypotheses[0].B=[[1]];request.hypotheses[1].B=[[2]];
  assert.equal((await createActiveNotebook(JSON.stringify(request))).plan.selection,null);
  const boundary={...JSON.parse(source),noiseBound:'1/8'};
  assert.equal((await createActiveNotebook(JSON.stringify(boundary))).plan.selection,null);
});
