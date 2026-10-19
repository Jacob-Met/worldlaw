import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseObservationText,observationsCSV,validateDataset} from '../src/data.mjs';
import {newVirtualSession,createSession,sessionPlan,runVirtualExperiment,appendMeasurements,refitSession,exportSession,restoreSession,undoSession} from '../src/session.mjs';

test('virtual evidence revises the model and notebook replay recomputes its history',()=>{
  const start=newVirtualSession();const next=runVirtualExperiment(start,sessionPlan(start).selected.input);
  assert.match(start.discovery.selected.id,/spring/);assert.match(next.discovery.selected.id,/gravity/);
  assert.ok(next.history[1].heldOutRMSE<start.history[0].heldOutRMSE/100);
  assert.equal(start.discovery.observations.length,64);assert.equal(next.discovery.observations.length,65);
  assert.deepEqual(restoreSession(exportSession(next)).history,next.history);
  assert.deepEqual(undoSession(next).history,start.history);
});
test('actual imported drag fixture changes structure and preserves held-out separation',()=>{
  const dataset=parseObservationText(readFileSync(new URL('../examples/synthetic-quadratic-drag.json',import.meta.url),'utf8'),'drag.json');
  const state=createSession(dataset);assert.equal(state.discovery.selected.id,'command+spring+quadratic');assert.equal(state.base.heldOut.length,31);
  assert.equal(state.lab,null);assert.throws(()=>runVirtualExperiment(state,{command:0,position:0,rate:0}),/only/);
  const altered={...dataset,heldOut:dataset.heldOut.map(r=>({...r,jointTorque:r.jointTorque+100}))};
  assert.deepEqual(createSession(altered).discovery.selected.terms,state.discovery.selected.terms);
  const next=appendMeasurements(state,[{command:0,position:0,rate:0,jointTorque:0}]);assert.equal(next.discovery.observations.length,65);
  assert.deepEqual(restoreSession(exportSession(next)).history,next.history);
});
test('CSV accepts quoted fields and refuses incomplete or nonnumeric observations',()=>{
  const state=newVirtualSession();const csv=observationsCSV(state.base.observations);
  assert.deepEqual(parseObservationText(csv).observations,state.base.observations);
  assert.deepEqual(parseObservationText(csv.replace('command','"command"')).observations,state.base.observations);
  assert.throws(()=>parseObservationText(csv.replace('command','position')),/unique headers/);
  assert.throws(()=>parseObservationText(csv.split('\n').slice(0,7).join('\n')),/8–4096/);
  assert.throws(()=>parseObservationText(csv.replace(/\n[^,]+,/, '\nNaN,')),/decimal/);
  assert.throws(()=>validateDataset({observations:state.base.observations,units:{position:'deg'}}),/Unit/);
});
test('invalid session and conflicting virtual evidence refuse without changing the current object',()=>{
  const state=newVirtualSession(),before=exportSession(state);const tampered=JSON.parse(before);tampered.base.observations[0].jointTorque+=1;
  assert.throws(()=>restoreSession(JSON.stringify(tampered)),/does not match/);
  assert.throws(()=>restoreSession('{'),/could not be read/);
  assert.throws(()=>refitSession(state,{noiseSigma:0}),/sensor noise/);
  assert.throws(()=>appendMeasurements(state,[{command:0,position:0,rate:0,jointTorque:0}]),/virtual/);
  assert.equal(exportSession(state),before);
});
test('noise revisions and undo preserve the measured evidence',()=>{
  const start=newVirtualSession(),next=refitSession(start,{noiseSigma:.1});
  assert.deepEqual(next.discovery.observations,start.discovery.observations);assert.equal(next.options.noiseSigma,.1);
  assert.deepEqual(undoSession(next).history,start.history);assert.equal(restoreSession(exportSession(next)).options.noiseSigma,.1);
});
test('all unit declarations agree and source derivation metadata survives notebook replay',()=>{
  const state=newVirtualSession();const units={command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'};
  assert.throws(()=>validateDataset({observations:state.base.observations,units,source:{units:{...units,position:'deg'}}}),/Unit declarations/);
  const derived=JSON.parse(readFileSync(new URL('../evidence/derived-telemetry-observations.json',import.meta.url),'utf8'));
  const imported=createSession(parseObservationText(JSON.stringify(derived),'derived.json'));
  const reopened=restoreSession(exportSession(imported));
  assert.equal(reopened.base.source.metadata.inputSha256,derived.source.inputSha256);
  assert.deepEqual(reopened.base.source.metadata.derivation,derived.source.derivation);
  assert.equal(reopened.base.source.declaredKind,'derived_from_angular_position');
});
test('every accepted virtual seed can export and reopen; oversized seeds refuse at creation',()=>{
  assert.throws(()=>newVirtualSession(1e10),/Invalid virtual instrument seed/);
  for(const seed of [-1e9,0,1e9])assert.deepEqual(restoreSession(exportSession(newVirtualSession(seed))).history,newVirtualSession(seed).history);
});
