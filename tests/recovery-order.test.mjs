import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryFixture, recoveryRecording} from '../src/unknown-lab/recovery-fixture.mjs';
import {inspectRecoveryOrder} from '../src/unknown-lab/recovery-order.mjs';

test('real notebook carries only planned counterbalanced training contrasts into the three-read screen',()=>{
  const notebook=recoveryFixture('two-mode');
  const result=inspectRecoveryOrder(notebook);
  assert.equal(result.status,'positive-curvature');
  assert.deepEqual(result.plan.waits,[0,2,4]);
  assert.deepEqual(result.observations.map(r=>r.recordingId),notebook.training.map(r=>r.recordingId));
  assert.deepEqual(inspectRecoveryOrder({...notebook,challenges:null}),result);
  const [a,b]=result.observations;
  const retention=(b.difference/a.difference)**(1/b.wait);
  assert.ok(retention>0 && retention<1);
  assert.ok(Math.abs(a.difference*retention**b.wait-b.difference)<1e-12);
});

test('missing, duplicated and overly noisy planned readings retain ambiguity',()=>{
  const notebook=recoveryFixture('two-mode');
  assert.equal(inspectRecoveryOrder(recoveryFixture()).reason,'await-training');
  notebook.training.push(recoveryRecording('two-mode',11,2,{noiseSigma:.0001}));
  assert.equal(inspectRecoveryOrder(notebook).reason,'duplicate-delay');
  notebook.training.pop();
  notebook.training[0]=recoveryRecording('two-mode',12,0,{noiseSigma:.1});
  assert.equal(inspectRecoveryOrder(notebook).reason,'screen-exceeds-budget');
});

test('single relaxation on exactly the selected waits survives the same observation boundary',()=>{
  const notebook=recoveryFixture('two-mode');
  notebook.training=notebook.training.map((r,i)=>recoveryRecording('decay',i+1,r.delaySeconds,{noiseSigma:.0001}));
  assert.equal(inspectRecoveryOrder(notebook).status,'unresolved');
});
