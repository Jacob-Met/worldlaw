import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createActiveNotebook,receiveActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {coupledDemoReadings} from '../src/active/instrument.mjs';
const text=await readFile(new URL('../examples/active-intervention-coupled-kinematics.json',import.meta.url),'utf8');

test('separate synthetic instrument matches frozen hand-derived position values',async()=>{
  const book=await createActiveNotebook(text);
  for(const [profile,values,expected] of [
    ['unit',[3,1,0],'unit_coupling'],['double',[3,-1,-3],'double_coupling'],
    ['outside',[3,-7,-12],null],['partial',[3],undefined],
  ]){
    const raw=coupledDemoReadings(book.plan,profile);
    assert.deepEqual(raw.readings.map(r=>r.value),values);
    const received=await receiveActiveNotebook(book,JSON.stringify(raw));
    const result=received.readouts[0].result;
    assert.deepEqual(result.consistentHypothesisIds,expected===undefined?['unit_coupling','double_coupling']:expected?[expected]:[]);
    assert.equal(result.physicalActionsPerformed,false);assert.equal(result.acquisition,'synthetic');
    assert.equal(book.readouts.length,0);
  }
});
test('synthetic instrument refuses unattached sources, uncertified plans and unknown profiles',async()=>{
  const book=await createActiveNotebook(text);
  assert.throws(()=>coupledDemoReadings({...book.plan,sourceSHA256:'0'.repeat(64)}),/attached only/);
  assert.throws(()=>coupledDemoReadings({...book.plan,status:'search_inconclusive'}),/attached only/);
  assert.throws(()=>coupledDemoReadings(book.plan,'invented'),/declared/);
});
