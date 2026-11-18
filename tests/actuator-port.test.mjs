import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulePortObservations,readRealAIGymCsv,comparePortObservation,replayActuatorPort} from '../src/coupling/actuator-port.mjs';

const header='time,pos_meas1,pos_meas2,vel_meas1,vel_meas2,tau_con1,tau_con2';
const table=(swap=false)=>[header,...Array.from({length:90},(_,i)=>[i*.005,0,0,0,0,...(swap?[0,2]:[2,0])].join(','))].join('\n');

test('channel exchange leaves all anonymous drive forecasts unchanged',()=>{
  const one=readRealAIGymCsv(table()),two=readRealAIGymCsv(table(true));
  assert.deepEqual(one,two);
  const result=replayActuatorPort(one);
  assert.ok(result.thresholdReached);
  assert.ok(result.results.active.elapsed<result.results.fixed100.elapsed);
  assert.ok(result.results.fixed100.elapsed>=.1);
  const check=result.results.active;
  assert.equal(comparePortObservation(check,check.shoulder).winner,'shoulder');
  assert.equal(comparePortObservation(check,check.elbow).winner,'elbow');
});
test('future measurements cannot change the locked clock',()=>{
  const x=readRealAIGymCsv(table());
  const before=replayActuatorPort(x);
  x.states.slice(1).forEach(s=>{s[0]=2.1;s[1]=-1.7;});
  const after=replayActuatorPort(x);
  assert.deepEqual(before.predictions,after.predictions);
  assert.equal(before.results.active.index,after.results.active.index);
  assert.notDeepEqual(before.results.active.observed,after.results.active.observed);
});
test('zero drive cannot distinguish physically identical predictions',()=>{
  const x=readRealAIGymCsv(table());x.drive.forEach(p=>{p.torque=0});
  assert.throws(()=>replayActuatorPort(x),/No anonymous/);
  const p=schedulePortObservations(x.drive,0,[0,0,0,0]).clocks.active;
  assert.equal(p.separation,0);
  assert.equal(comparePortObservation(p,[0,0]).winner,'unresolved');
});
test('missing, repeated clocks, non-finite readings and absent channels fail visibly',()=>{
  assert.throws(()=>readRealAIGymCsv(table().replace('tau_con1','unavailable')),/Missing/);
  assert.throws(()=>readRealAIGymCsv(header+'\n0,0,0,0,0,0,0\n0,0,0,0,0,1,0'),/increase/);
  assert.throws(()=>readRealAIGymCsv(header+'\n0,,0,0,0,0,0\n1,0,0,0,0,1,0'),/non-finite/);
});
