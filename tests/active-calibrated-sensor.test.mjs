import test from 'node:test';
import assert from 'node:assert/strict';
import {designActiveLinearFamily, replayActiveLinearFamily, evaluateActiveLinearReadings} from '../src/science/active-linear-family.mjs';

function family(mult=5){
  return {schema:'worldlaw.active-linear-affine-sensor/v1',source:'Synthetic exact common-within-course calibration.',
    sensorGain:['1/2',2],hypotheses:[{id:'large',A:[[0]],B:[[mult]],C:[1]},{id:'small',A:[[0]],B:[[1]],C:[1]}],
    controls:[[0],[1],[2],[1]],offeredTicks:[1,2,3,4],maxReadings:4,noiseBound:0};
}
test('scaled traces and gain endpoints admit a common measured history',()=>{
  for(const n of [2,4]){
    const q=family(n),p=designActiveLinearFamily(q);
    assert.equal(p.status,'calibration_overlap_on_offered_course');
    assert.equal(p.proof[0].status,'overlap');
    assert.ok(p.proof[0].gainWitness.length===2);
    assert.equal(designActiveLinearFamily({...q,schema:'worldlaw.active-linear-family/v1'}).status,'optimal_certified_schedule');
  }
});
test('noise and a common offset differ from independent offsets on every tick',()=>{
  const q=family(),p=designActiveLinearFamily(q);
  assert.equal(p.status,'optimal_certified_schedule');
  assert.equal(p.numReadings,2);
  assert.equal(designActiveLinearFamily({...q,noiseBound:'1/2'}).status,'calibration_overlap_on_offered_course');
  const readings=p.selection.map(({tick})=>({tick,value:23+q.controls[tick-1][0]*5}));
  const result=evaluateActiveLinearReadings(q,p,{schema:'worldlaw.active-linear-readings/v1',source:'Synthetic shifted large-law trace.',acquisition:'synthetic',readings});
  assert.deepEqual(result.consistentHypothesisIds,['large']);
  assert.equal(result.physicalProvenanceVerified,false);
});
test('one reading has unrestricted constant offset; disjoint shapes need a schedule',()=>{
  assert.equal(designActiveLinearFamily({...family(),maxReadings:1}).status,'insufficient_reading_budget');
  const q=family();q.hypotheses[0].A=[[1]];q.controls=[[0],[1],[-1],[2]];
  assert.equal(designActiveLinearFamily(q).status,'optimal_certified_schedule');
});
test('replay, closed positive interval and finite work refusal',()=>{
  const q=family(),p=designActiveLinearFamily(q);
  assert.equal(replayActiveLinearFamily(q,p).valid,true);
  assert.throws(()=>replayActiveLinearFamily(q,{...p,totalCost:10}),/replay/);
  for(const bounds of [[0,1],[2,1],[-1,1]])assert.throws(()=>designActiveLinearFamily({...q,sensorGain:bounds}),/gain/);
  assert.throws(()=>designActiveLinearFamily({...q,workLimit:1}),/workLimit/);
  const longer={...q,hypotheses:[...q.hypotheses,{...q.hypotheses[0],id:"third",B:[[30]]}],controls:[[0],[1],[2],[1],[3],[2],[1],[0],[3],[1]],offeredTicks:[1,2,3,4,5,6,7,8,9,10],workLimit:100};
  assert.equal(designActiveLinearFamily(longer).status,'search_inconclusive');
});
test('fixed gain and a single repeated reading respect a shared offset',()=>{
  const q={...family(),sensorGain:['3/2','3/2']};
  const plan=designActiveLinearFamily(q),rows=plan.selection.map(({tick})=>({tick,value:(21+15*q.controls[tick-1][0])+'/2'}));
  const sample=readings=>evaluateActiveLinearReadings(q,plan,{schema:'worldlaw.active-linear-readings/v1',source:'Synthetic fixed rational gain and offset.',acquisition:'synthetic',readings});
  assert.deepEqual(sample(rows).consistentHypothesisIds,['large']);
  assert.deepEqual(sample(rows.slice(0,1)).consistentHypothesisIds,['large','small']);
  assert.deepEqual(sample(rows.map(row=>({...row,value:0}))).consistentHypothesisIds,[]);
});
test('portable notebook replays the frozen source and synthetic readings',async()=>{
  const {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook}=await import('../src/science/active-experiment-record.mjs');
  const q=family(),book=await createActiveNotebook(JSON.stringify(q));
  const {sourceSHA256,planSHA256}=book.plan;
  const sample={schema:'worldlaw.active-linear-readings/v1',source:'Synthetic shifted readings from the large law.',acquisition:'synthetic',
    sourceSHA256,planSHA256,readings:book.plan.selection.map(({tick})=>({tick,value:7+5*q.controls[tick-1][0]}))};
  const recorded=await receiveActiveNotebook(JSON.stringify(book),JSON.stringify(sample));
  const replay=await replayActiveNotebook(JSON.stringify(recorded));
  assert.deepEqual(replay.readouts[0].result.consistentHypothesisIds,['large']);
  assert.equal(replay.readouts[0].result.physicalProvenanceVerified,false);
  await assert.rejects(receiveActiveNotebook(JSON.stringify(book),JSON.stringify({...sample,planSHA256:'0'.repeat(64)})),/digest/);
});
