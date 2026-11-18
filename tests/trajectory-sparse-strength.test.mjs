import test from 'node:test';
import assert from 'node:assert/strict';
import {planSparseStrength, fitSparseStrength, acquireStrengthStudy, replayStrengthStudy} from '../src/trajectory/sparse-strength.mjs';

const model={schema:'worldlaw.torque-model/v1',id:'gravity+rate',terms:[{id:'gravity',coefficient:-2.2},{id:'rate',coefficient:-.24}],
  units:{command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'}};
test('eight prospective measurements revise only the shared scale and survive source replay',()=>{
  const first=structuredClone(model), result=acquireStrengthStudy(model,.012,[6001,6002]);
  assert.deepEqual(model,first);
  assert.equal(result.fit.selectedScale,1);
  assert.deepEqual(result.records.map(r=>r.readings.length),[4,4]);
  assert.equal(result.fit.profile.length,5);
  assert.deepEqual(replayStrengthStudy(JSON.parse(JSON.stringify(result)),model),result);
  const altered=structuredClone(result);altered.fit.selectedScale=.75;
  assert.throws(()=>replayStrengthStudy(altered,model),/replay/);
  assert.throws(()=>replayStrengthStudy(result,{...model,id:'different'}),/replay/);
});
test('fit reads observations only and rejects altered plans, budgets, units and repeating provenance',()=>{
  const {plan,records}=acquireStrengthStudy(model,.012,[1022,3367]);
  for(const record of records)Object.defineProperty(record.source,'oracle',{get(){throw Error('oracle accessed');}});
  assert.equal(fitSparseStrength(plan,records).readings,8);
  assert.equal(fitSparseStrength(plan,records.slice(0,1)).readings,4);
  assert.throws(()=>fitSparseStrength(structuredClone(plan),records),/planned/);
  for(const mutate of [r=>r.units.time='ms',r=>r.readings[0].time=0,r=>r.readings.pop(),
    r=>r.source.noise.noiseStreamId=records[0].source.noise.noiseStreamId,
    r=>r.source.instrumentId='other',r=>r.source.recordingId=records[0].source.recordingId]){
    const changed={...records[1],units:{...records[1].units},readings:structuredClone(records[1].readings),
      source:Object.assign(Object.create(records[1].source),{noise:{...records[1].source.noise}})};
    mutate(changed);
    assert.throws(()=>fitSparseStrength(plan,[records[0],changed]));
  }
  const rejected=records.map(r=>({...r,readings:r.readings.map(s=>({...s,position:s.position+10}))}));
  assert.equal(fitSparseStrength(plan,rejected).selectedScale,null);
  assert.throws(()=>planSparseStrength({...model,terms:[]}),/indistinguishable/);
});
