import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRecordedAffineReads} from '../src/unknown-lab/recorded-affine-order.mjs';
import {inspectAffineRecoveryOrder} from '../src/unknown-lab/recovery-order.mjs';
import {recoveryFixture,recoveryRecording} from '../src/unknown-lab/recovery-fixture.mjs';

const waits=[.07,1.91,4.13,5.85,8.12];
function notebook(kind,times=waits){
 const data=recoveryFixture(kind);
 data.training=times.map((t,i)=>recoveryRecording(kind,20+i,t,{noiseSigma:.000005}));
 return data;
}

test('timestamp windows use the recorded times and preserve the sealed challenges',()=>{
 const positive=notebook('two-mode-affine'), reading=inspectAffineRecoveryOrder(positive);
 assert.equal(reading.status,'recorded-affine-exclusion');
 assert.deepEqual(reading.actualWaits, waits);
 assert.deepEqual(inspectAffineRecoveryOrder({...positive,challenges:null}),reading);
 assert.equal(inspectAffineRecoveryOrder(notebook('one-mode-affine')).status,'unresolved');
 assert.equal(inspectAffineRecoveryOrder(notebook('two-mode-affine',[.07,1.91,4.13,5.85,8.201])).reason,'await-training');
 const atEdge=inspectAffineRecoveryOrder(notebook('two-mode-affine',[.0,2.2,4.2,5.8,7.8]));
 assert.equal(atEdge.status,'recorded-affine-exclusion');
 positive.training.push(recoveryRecording('two-mode-affine',99,2,{noiseSigma:.000005}));
 assert.equal(inspectAffineRecoveryOrder(positive).reason,'duplicate-delay');
});

test('horizon, slope, rates and numerical ambiguity are conservative',()=>{
 const samples=f=>waits.map(wait=>({wait,difference:f(wait)}));
 for(const rate of [0,1e-8,.005,.1,.4,.95,10,100,1000]){
  const rows=samples(t=>1000-67*t+630*Math.exp(-rate*t));
  assert.equal(inspectRecordedAffineReads(rows,.00002).status,'unresolved','rate '+rate);
 }
 assert.equal(inspectRecordedAffineReads(samples(t=>5-t),0).status,'unresolved');
 assert.equal(inspectRecordedAffineReads(samples(t=>1+t).slice(0,4),0).status,'unresolved');
 assert.throws(()=>inspectRecordedAffineReads([{wait:0,difference:1},{wait:.049,difference:1}],0));
 assert.throws(()=>inspectRecordedAffineReads([{wait:0,difference:Infinity}],0));
 assert.throws(()=>inspectRecordedAffineReads(samples(t=>0),Number.NaN));
});
