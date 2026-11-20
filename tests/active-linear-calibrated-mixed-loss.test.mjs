import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';

const source=await readFile(new URL('../examples/active-linear-calibrated-mixed-loss.json',import.meta.url),'utf8');

test('reserve acquisition covers a missing and independently replaced reading',async()=>{
  const book=await createActiveNotebook(source);
  assert.deepEqual(book.plan.selection.map(row=>row.tick),[0,1,2,3,4]);
  assert.equal(book.plan.totalCost,15);
  assert.equal(book.plan.proof.length,10);
  assert.ok(book.plan.proof.every(row=>row.status==='separated'&&row.excludedTicks.length===3));
  const receive=rows=>receiveActiveNotebook(book,JSON.stringify({
    schema:'worldlaw.active-linear-readings/v1',source:'Synthetic missed acquisition and wrong value.',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    readings:rows.map(([tick,value])=>({tick,value}))
  }));
  const verified=await receive([[0,5],[1,7],[2,-17],[4,13]]);
  const result=verified.readouts[0].result;
  assert.deepEqual(result.missingTicks,[3]);
  assert.equal(result.withinDesignedErasureBudget,true);
  assert.deepEqual(result.consistentHypothesisIds,['right']);
  assert.deepEqual(result.checks[1].omissions.filter(r=>r.status==='consistent').map(r=>r.ignoredTick),[2]);
  assert.deepEqual(await replayActiveNotebook(JSON.stringify(verified)),verified);
  const ambiguous=(await receive([[1,5],[2,5],[4,8]])).readouts[0].result;
  assert.equal(ambiguous.withinDesignedErasureBudget,false);
  assert.deepEqual(ambiguous.missingTicks,[0,3]);
  assert.deepEqual(ambiguous.consistentHypothesisIds,['left','right']);
  const altered=structuredClone(verified);
  altered.plan.proof[0].excludedTicks.pop();
  await assert.rejects(replayActiveNotebook(JSON.stringify(altered)));
});

test('four clocks are insufficient and closed gain or noise overlaps remain unresolved',async()=>{
  const request=JSON.parse(source);
  const plan=async changes=>(await createActiveNotebook(JSON.stringify({...request,...changes}))).plan;
  assert.equal((await plan({maxReadings:4})).status,'insufficient_reading_budget');
  assert.equal((await plan({noiseBound:'1/8'})).selection,null);
  const alias=structuredClone(request.hypotheses);
  alias[0].B=[[1]];alias[1].B=[[2]];
  assert.equal((await plan({hypotheses:alias})).selection,null);
});
