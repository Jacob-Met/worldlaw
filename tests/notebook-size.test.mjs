import assert from 'node:assert/strict';
import test from 'node:test';
import {MAX_TEXT_LENGTH,parseObservationText} from '../src/data.mjs';
import {newVirtualSession,createSession,appendMeasurements,refitSession,exportSession,restoreSession} from '../src/session.mjs';
import {metadataInput,unicodeInput} from './support/notebook-size.mjs';

test('ordinary notebooks retain readable formatting and complete replay',()=>{
  const state=newVirtualSession();
  const text=exportSession(state);
  assert.match(text,/\n  "schema":/);
  assert.deepEqual(restoreSession(text).history,state.history);
});

test('accepted metadata stays reopenable after measurement and library revisions',()=>{
  const input=metadataInput();
  assert.ok(input.length<MAX_TEXT_LENGTH);
  let state=createSession(parseObservationText(input));
  state=appendMeasurements(state,[{command:0,position:0,rate:0,jointTorque:0}],'Authored outcome');
  state=refitSession(state,{additionalTerms:['cubic'],noiseSigma:.1});
  const text=exportSession(state);
  assert.ok(text.length<=MAX_TEXT_LENGTH,`export has ${text.length} code units`);
  const restored=restoreSession(text);
  assert.deepEqual(restored.base,state.base);
  assert.deepEqual(restored.events,state.events);
  assert.deepEqual(restored.initialOptions,state.initialOptions);
  assert.deepEqual(restored.options,state.options);
  assert.deepEqual(restored.history,state.history);
  assert.equal(JSON.parse(text).schema,'worldlaw.session/v5');
});

test('a source below the raw byte limit can produce a valid Unicode notebook above it',()=>{
  const input=unicodeInput();
  assert.ok(Buffer.byteLength(input)<2_000_000);
  let state=createSession(parseObservationText(input),{maxTerms:1});
  state=appendMeasurements(state,[{command:0,position:0,rate:0,jointTorque:0,torqueNoiseRatio:1}]);
  const text=exportSession(state);
  assert.ok(text.length<=MAX_TEXT_LENGTH);
  assert.ok(Buffer.byteLength(text)>2_000_000);
  assert.ok(Buffer.byteLength(text)<=3*MAX_TEXT_LENGTH);
  const restored=restoreSession(text);
  assert.deepEqual(restored.base,state.base);
  assert.deepEqual(restored.events,state.events);
  assert.deepEqual(restored.history,state.history);
  assert.equal(restored.base.source.metadata.notes,'\u0800'.repeat(170000));
  assert.equal(JSON.parse(text).schema,'worldlaw.session/v4');
});

test('text size refusal remains explicit for imports and unsupported exports',()=>{
  const state=newVirtualSession(),before=exportSession(state);
  assert.throws(()=>restoreSession(before.padEnd(MAX_TEXT_LENGTH+1,' ')),/smaller than 2 MB/);
  const unsupported={...state,base:{...state.base,source:{...state.base.source,metadata:{notes:'x'.repeat(MAX_TEXT_LENGTH)}}}};
  assert.throws(()=>exportSession(unsupported),/exceeds the supported text size/);
  assert.equal(exportSession(state),before);
});
