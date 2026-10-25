import test from 'node:test';
import assert from 'node:assert/strict';
import {discover} from '../src/science/torque-discovery.mjs';
import {predictionContrasts} from '../src/science/prediction-contrast.mjs';
import {rateReversal} from '../src/science/rate-reversal.mjs';
const training=Array.from({length:40},(_,i)=>{const command=Math.sin(i*.8),position=Math.cos(i*.7),rate=Math.sin(i*1.3);return {command,position,rate,jointTorque:command-2*position-.2*rate}});
const model=discover(training,{terms:['command','spring','rate'],maxTerms:3,noiseSigma:.001}).selected;
const receiving=[{command:.2,position:.3,rate:.5,jointTorque:3.2},{command:.2,position:.3,rate:-.5,jointTorque:2.8}];
const report=(rows=receiving,radius=.01,fit=training)=>predictionContrasts(model,fit,rows,{trainingRadius:.01,receivingRadius:radius});
test('original reversal readings contradict the negative fitted odd response',()=>{
  const original=report(),bytes=JSON.stringify(original),result=rateReversal(original,0);
  assert.equal(result.status,'computed');assert.equal(result.observed.sign,'positive');assert.equal(result.predicted.sign,'negative');assert.equal(result.originalCompatibility,'outside');
  assert.ok(result.observed.display[0]>.094&&result.observed.display[1]<.106);
  assert.equal(JSON.stringify(original),bytes);
});
test('reversing source row order preserves physical orientation of the statistic',()=>{
  const forward=rateReversal(report(),0),reverse=rateReversal(report([...receiving].reverse()),0);
  assert.deepEqual(forward.observed,reverse.observed);assert.deepEqual(forward.predicted,reverse.predicted);
});
test('wider original reading boxes retain zero instead of forcing a sign',()=>{
  const result=rateReversal(report(receiving,.3),0);
  assert.equal(result.observed.sign,'includes_zero');assert.equal(result.originalCompatibility,'not-excluded');
});
test('an exactly touching observed reading box retains the zero boundary',()=>{
  const rows=[{...receiving[0],jointTorque:3.25},{...receiving[1],jointTorque:2.75}];
  const result=rateReversal(report(rows,.25),0);
  assert.equal(result.observed.sign,'includes_zero');assert.equal(result.observed.exact[0].numerator,'0');
});
test('tiny rate keeps exact positive sign even when its display interval starts at zero',()=>{
  const rows=[{...receiving[0],rate:Number.MIN_VALUE},{...receiving[1],rate:-Number.MIN_VALUE}];
  const result=rateReversal(report(rows),0);
  assert.equal(result.observed.sign,'positive');assert.equal(result.observed.display[0],0);
  assert.ok(BigInt(result.observed.exact[0].numerator)>0n);
});
test('nonmatching coordinates, rates and zero speed do not masquerade as reversals',()=>{
  for(const changed of [{command:.2+1e-12},{position:.3+1e-12},{rate:-.5+1e-12},{rate:.5}]){
    assert.equal(rateReversal(report([receiving[0],{...receiving[1],...changed}]),0).status,'not_matched_reversal');
  }
  assert.equal(rateReversal(report(receiving.map(r=>({...r,rate:0}))),0).status,'not_matched_reversal');
});
test('training changes cannot change original observed power bounds',()=>{
  const first=rateReversal(report(),0),changed=rateReversal(report(receiving,.01,training.map(r=>({...r,jointTorque:2*r.jointTorque}))),0);
  assert.deepEqual(first.observed,changed.observed);assert.notDeepEqual(first.predicted,changed.predicted);
});
test('a common exactly represented even-torque offset cancels from the source statistic',()=>{
  const rows=[{...receiving[0],jointTorque:3.25},{...receiving[1],jointTorque:2.75}];
  const shifted=rows.map(r=>({...r,jointTorque:r.jointTorque+8}));
  assert.deepEqual(rateReversal(report(rows),0).observed,rateReversal(report(shifted),0).observed);
});
test('every pair retains its original complete receiving-course indices',()=>{
  const rows=[{...receiving[0],position:5},...receiving],full=report(rows);
  assert.equal(full.pairs.length,3);
  assert.equal(rateReversal(full,0).status,'not_matched_reversal');
  const matched=rateReversal(full,2);assert.equal(matched.firstRow,1);assert.equal(matched.secondRow,2);
});
test('malformed report and pair index refuse',()=>{
  for(const index of [-1,1,.5,NaN])assert.throws(()=>rateReversal(report(),index));
  assert.throws(()=>rateReversal({schema:'saved-result'},0));
});
