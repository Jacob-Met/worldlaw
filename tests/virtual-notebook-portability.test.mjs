import assert from 'node:assert/strict';
import test from 'node:test';
import {newVirtualSession,runVirtualExperiment,exportSession,restoreSession} from '../src/session.mjs';

// Captured from an actual Chrome 155.0.8059.84 notebook download. Node 24.19.0
// regenerated four different held-out scalars, with max absolute error 2^-52.
// All 64 fitting rows and every other held-out scalar were identical.
const chromeHeldOutScalars=[
  {row:7,field:'command',value:0.40532430827279287},
  {row:7,field:'rate',value:0.22712985455717755},
  {row:23,field:'command',value:-0.23255343879859894},
  {row:23,field:'jointTorque',value:0.9476413432861367},
];
const rawNotebook=()=>JSON.parse(exportSession(newVirtualSession(17)));

test('captured Chrome seed rounding reopens in Node without rewriting supplied evidence',()=>{
  const state=runVirtualExperiment(newVirtualSession(17),{command:0,position:2.4,rate:0});
  const raw=JSON.parse(exportSession(state));
  for(const {row,field,value} of chromeHeldOutScalars)raw.base.heldOut[row][field]=value;
  const reopened=restoreSession(JSON.stringify(raw));
  assert.deepEqual(reopened.base.observations,raw.base.observations);
  assert.deepEqual(reopened.base.heldOut,raw.base.heldOut);
  assert.deepEqual(JSON.parse(exportSession(reopened)),raw);
  assert.equal(reopened.discovery.selected.id,'command+rate+gravity+bias');
  assert.ok(reopened.history.at(-1).heldOutRMSE<.002);
});

test('roundoff bound applies to every numeric field in both baseline arrays',()=>{
  for(const group of ['observations','heldOut'])for(const field of ['command','position','rate','jointTorque']){
    const within=rawNotebook(),value=within.base[group][0][field];
    within.base[group][0][field]+=4*Number.EPSILON*Math.max(1,Math.abs(value));
    assert.equal(restoreSession(JSON.stringify(within)).base[group][0][field],within.base[group][0][field]);
    const changed=rawNotebook();changed.base[group][0][field]+=1e-8;
    assert.throws(()=>restoreSession(JSON.stringify(changed)),/does not match its declared seed/);
  }
  const boundary=rawNotebook();boundary.base.heldOut[7].command+=16*Number.EPSILON;
  assert.equal(restoreSession(JSON.stringify(boundary)).base.heldOut[7].command,boundary.base.heldOut[7].command);
  const outside=rawNotebook();outside.base.heldOut[7].command+=17*Number.EPSILON;
  assert.throws(()=>restoreSession(JSON.stringify(outside)),/does not match its declared seed/);
});

test('numeric compatibility does not relax row identity, seed, schema or finiteness',()=>{
  const shortened=rawNotebook();shortened.base.heldOut.pop();assert.throws(()=>restoreSession(JSON.stringify(shortened)),/does not match/);
  const reordered=rawNotebook();[reordered.base.heldOut[7],reordered.base.heldOut[8]]=[reordered.base.heldOut[8],reordered.base.heldOut[7]];assert.throws(()=>restoreSession(JSON.stringify(reordered)),/does not match/);
  const seed=rawNotebook();seed.lab.seed=18;assert.throws(()=>restoreSession(JSON.stringify(seed)),/does not match/);
  const schema=rawNotebook();schema.schema='worldlaw.session/v3';assert.throws(()=>restoreSession(JSON.stringify(schema)),/Unsupported/);
  const observationSchema=rawNotebook();observationSchema.base.schema='worldlaw.observations/v2';assert.throws(()=>restoreSession(JSON.stringify(observationSchema)),/Unsupported observation schema/);
  const fractional=rawNotebook();fractional.lab.seed=17.000000000000004;assert.throws(()=>restoreSession(JSON.stringify(fractional)),/Invalid virtual instrument seed/);
  const invalid=rawNotebook();invalid.base.heldOut[7].command=null;assert.throws(()=>restoreSession(JSON.stringify(invalid)),/finite number/);
  const imported=rawNotebook();imported.lab=null;imported.base.observations[0].jointTorque+=.5;
  assert.equal(restoreSession(JSON.stringify(imported)).base.observations[0].jointTorque,imported.base.observations[0].jointTorque);
});
