import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createActiveNotebook,receiveActiveNotebook,recommendActiveFollowup,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
const source=JSON.parse(await readFile(new URL('../examples/active-linear-conditional-future.json',import.meta.url),'utf8'));

async function history(values,changes={}){
  const book=await createActiveNotebook(JSON.stringify({...source,...changes}));
  const input={schema:'worldlaw.active-linear-historical-readings/v1',source:'Synthetic same-trajectory history.',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    readings:values.map((value,tick)=>({tick,value}))};
  return receiveActiveNotebook(book,JSON.stringify(input));
}

test('conditioned acquisition retains the original calibration and outlier across both stages',async()=>{
  const book=await history([5,5,7]);
  const plan=await recommendActiveFollowup(book,0);
  assert.deepEqual(plan.selection,{ticks:[4],cost:1});
  assert.deepEqual(plan.eligibleTicks,[3,4]);
  for(const [value,ids,ignored] of [[5,['left'],2],[9,['right'],1],[-30,[],null]]){
    const input={schema:'worldlaw.active-linear-followup-readings/v1',source:'Synthetic future observation.',
      acquisition:'synthetic',sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,
      historySHA256:plan.historySHA256,followupSHA256:plan.followupSHA256,readings:[{tick:4,value}]};
    const next=await receiveActiveNotebook(book,JSON.stringify(input));
    const result=next.readouts[1].result;
    assert.deepEqual(result.consistentHypothesisIds,ids);
    if(ignored!==null){
      const match=result.checks.find(r=>r.status==='consistent');
      assert.deepEqual(match.omissions.filter(r=>r.status==='consistent').map(r=>r.ignoredTick),[ignored]);
    }
    assert.deepEqual(await replayActiveNotebook(JSON.stringify(next)),next);
    await assert.rejects(receiveActiveNotebook(book,JSON.stringify({...input,followupSHA256:'0'.repeat(64)})));
    await assert.rejects(receiveActiveNotebook(book,JSON.stringify({...input,readings:[{tick:3,value}]})));
    const altered=structuredClone(next);altered.readouts[0].readingsText+=' ';
    await assert.rejects(replayActiveNotebook(altered));
  }
});

test('a less informative history needs two future readings and a resolved one needs none',async()=>{
  const short=await history([5,5]);
  assert.deepEqual((await recommendActiveFollowup(short,0)).selection,{ticks:[2,4],cost:2});
  assert.equal((await recommendActiveFollowup(await history([5,7,9]),0)).status,'already_resolved');
  const alias=structuredClone(source.hypotheses);alias[0].B=[[1]];alias[1].B=[[2]];
  const aliased=await history([5,7,9],{hypotheses:alias});
  assert.equal(aliased.plan.selection,null);
  assert.equal((await recommendActiveFollowup(aliased,0)).status,'no_separating_future_schedule');
  const exhausted=await history([5,5],{workLimit:100});
  assert.equal((await recommendActiveFollowup(exhausted,0)).status,'search_inconclusive');
});
