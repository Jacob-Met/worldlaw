import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectAffineReads, planAffineReads} from '../src/unknown-lab/affine-order.mjs';
import {affineDomain, inspectAffineRecoveryOrder, inspectOffsetRecoveryOrder} from '../src/unknown-lab/recovery-order.mjs';
import {recoveryFixture, recoveryRecording} from '../src/unknown-lab/recovery-fixture.mjs';

test('a fifth matched delay excludes a single mode with linear readout drift', () => {
  const single = recoveryFixture('one-mode-affine'), double = recoveryFixture('two-mode-affine');
  assert.equal(inspectOffsetRecoveryOrder(single).status, 'offset-invariant-curvature');
  assert.equal(inspectAffineRecoveryOrder(single).status, 'unresolved');
  const result = inspectAffineRecoveryOrder(double);
  assert.equal(result.status, 'affine-invariant-curvature');
  assert.deepEqual(result.plan.waits, [0,2,4,6,8]);
  assert.deepEqual(inspectAffineRecoveryOrder({...double, challenges:null}), result);
  assert.equal(inspectAffineRecoveryOrder({...double, training:double.training.slice(0,4)}).reason, 'await-training');
  const repeated = {...double.training[0],recordingId:'repeat-wait-0'};
  assert.throws(()=>inspectAffineRecoveryOrder({...double, training:[...double.training,repeated]}),/cannot be reused/);
  const duplicate = recoveryRecording('two-mode-affine',99,0,{noiseSigma:.000005});
  assert.equal(inspectAffineRecoveryOrder({...double, training:[...double.training,duplicate]}).reason,'duplicate-delay');
});

test('uncertain designs, malformed delays, and the positive-mode boundary', () => {
  for (const change of [{amplitude:[0,1]}, {error:0.9}, {fast:[.6,.8]}]) {
    assert.equal(planAffineReads({...affineDomain, ...change}).status, 'unresolved');
  }
  const values = [0,1,2,3,4].map(wait => ({wait,difference:10-2*wait}));
  assert.equal(inspectAffineReads(values,0).status,'unresolved');
  assert.equal(inspectAffineReads(values.slice(0,4),0).status,'unresolved');
  assert.throws(() => inspectAffineReads([...values,{wait:5,difference:0}],0));
  assert.throws(() => inspectAffineReads(values.map((row,i) => i===4?{...row,wait:7}:row),0));
  assert.throws(() => inspectAffineReads([{wait:0,difference:NaN}],0));
  assert.throws(() => inspectAffineReads(values,-1));
});
