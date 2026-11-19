import assert from 'node:assert/strict';
import test from 'node:test';
import {recoveryFixture} from '../src/unknown-lab/recovery-fixture.mjs';
import {inspectRecoveryOrder,inspectOffsetRecoveryOrder} from '../src/unknown-lab/recovery-order.mjs';

test('a real paired notebook containing a persistent offset distinguishes raw and offset-invariant screens',()=>{
  const single=recoveryFixture('one-mode-offset'),double=recoveryFixture('two-mode-offset');
  for(const notebook of [single,double]){
    assert.equal(inspectRecoveryOrder(notebook).status,'positive-curvature');
  }
  assert.equal(inspectOffsetRecoveryOrder(single).status,'unresolved');
  const positive=inspectOffsetRecoveryOrder(double);
  assert.equal(positive.status,'offset-invariant-curvature');
  assert.equal(positive.observations.length,4);
  assert.deepEqual(inspectOffsetRecoveryOrder({...double,challenges:null}),positive);
  assert.equal(inspectOffsetRecoveryOrder(recoveryFixture('two-mode')).reason,'await-training');
});
