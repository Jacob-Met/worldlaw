import assert from 'node:assert/strict';
import test from 'node:test';
import {MAX_TEXT_LENGTH,parseObservationText} from '../src/data.mjs';
import {newVirtualSession,createSession,appendMeasurements,exportSession,restoreSession} from '../src/session.mjs';
import {MAX_LEGACY_NOTEBOOK_TEXT_LENGTH,compactLegacyNotebookText,restoreNotebook} from '../src/notebook-input.mjs';
import {metadataInput,unicodeInput} from './support/notebook-size.mjs';

const padded=text=>' '.repeat(MAX_TEXT_LENGTH+1-text.length)+text;
const legacy=state=>JSON.stringify(JSON.parse(exportSession(state)),null,2);
const sameReplay=(actual,expected)=>{
  for(const key of ['base','lab','initialOptions','events','options','history'])
    assert.deepEqual(actual[key],expected[key],key);
};

test('current notebook text and its validation path remain unchanged',()=>{
  const state=newVirtualSession(),text=exportSession(state);
  assert.equal(compactLegacyNotebookText(text),text);
  sameReplay(restoreNotebook(text),restoreSession(text));
  assert.throws(()=>restoreNotebook(null),/JSON text/);
});

test('legacy metadata formatting is recovered through the unchanged core replay',()=>{
  const state=createSession(parseObservationText(metadataInput())),text=legacy(state);
  assert.ok(text.length>MAX_TEXT_LENGTH);
  assert.throws(()=>restoreSession(text),/smaller than 2 MB/);
  sameReplay(restoreNotebook(text),state);
  assert.equal(restoreNotebook(text).base.source.metadata.capture.diagnostics.qualityFlags.length,120000);
});

test('legacy Unicode and measurement history survive recovery exactly',()=>{
  let state=createSession(parseObservationText(unicodeInput()),{maxTerms:1});
  state=appendMeasurements(state,[{command:0,position:0,rate:0,jointTorque:0,torqueNoiseRatio:1}]);
  const text=legacy(state);
  assert.ok(text.length>MAX_TEXT_LENGTH);
  assert.ok(Buffer.byteLength(text)<6_000_000);
  sameReplay(restoreNotebook(text),state);
  assert.equal(compactLegacyNotebookText(text),JSON.stringify(JSON.parse(text)));
});

test('quoted whitespace, punctuation, escape parity and numeric lexemes are retained',()=>{
  const values=Array.from({length:8},(_,n)=>'\\'.repeat(n)+'" {},[]: \t\n'+'\\'.repeat(7-n));
  const compact='{"values":'+JSON.stringify(values)+',"numbers":[1.0000,1e-7,-0]}';
  const recovered=compactLegacyNotebookText(padded(compact));
  assert.equal(recovered,compact);
  assert.deepEqual(JSON.parse(recovered),JSON.parse(compact));
  const formatted=' \t{\r\n "x" \t: [ 1.0000 , 1e-7 , -0 ] \n} ';
  assert.equal(compactLegacyNotebookText(padded(formatted)),'{"x":[1.0000,1e-7,-0]}');
});

test('invalid primitive boundaries and string controls are never repaired',()=>{
  const invalid=['{"x":1 2}','{"x":- 1}','{"x":1 e2}','{"x":tru e}','{"x":1 .2}',
    '{"x":1e +2}','{"x":false null}','["a" "b"]','{"x":"raw\nnewline"}',
    '{"x":"raw\ttab"}','{"x":"unterminated}',String.raw`{"x":"bad\q"}`];
  for(const text of invalid){
    const recovered=compactLegacyNotebookText(padded(text));
    assert.throws(()=>JSON.parse(recovered),SyntaxError,text);
    assert.throws(()=>restoreNotebook(padded(text)),/could not be read/,text);
  }
});

test('non-JSON whitespace and unsupported envelopes retain their refusals',()=>{
  for(const marker of ['\u00a0','\ufeff','\u2028']){
    const recovered=compactLegacyNotebookText(padded(marker+'{}'));
    assert.ok(recovered.includes(marker));
    assert.throws(()=>JSON.parse(recovered),SyntaxError);
  }
  assert.throws(()=>restoreNotebook(' '.repeat(MAX_TEXT_LENGTH+1)),/could not be read/);
  assert.throws(()=>restoreNotebook(padded('{"schema":"unmaintained","events":[]}')),/Unsupported/);
});

test('scan and retained-content budgets refuse without changing a valid notebook',()=>{
  const state=newVirtualSession(),before=exportSession(state);
  assert.equal(compactLegacyNotebookText(' '.repeat(MAX_LEGACY_NOTEBOOK_TEXT_LENGTH-2)+'{}'),'{}');
  const exact='"'+'x'.repeat(MAX_TEXT_LENGTH-2)+'"';
  assert.equal(compactLegacyNotebookText(' '+exact),exact);
  assert.throws(()=>compactLegacyNotebookText('"'+'x'.repeat(MAX_TEXT_LENGTH-1)+'"'),/content exceeds the supported text size/);
  assert.throws(()=>restoreNotebook(' '.repeat(MAX_LEGACY_NOTEBOOK_TEXT_LENGTH+1)),/legacy recovery size limit/);
  assert.throws(()=>restoreNotebook('{"value":"'+ 'x'.repeat(MAX_TEXT_LENGTH)+'"}'),/content exceeds the supported text size/);
  assert.equal(exportSession(state),before);
});

test('core history recomputation and event limits still govern recovered input',()=>{
  const state=newVirtualSession(),raw=JSON.parse(exportSession(state));
  raw.history=[{selected:{id:'forged',score:-1}}];
  sameReplay(restoreNotebook(padded(JSON.stringify(raw))),state);
  raw.events=Array.from({length:129},()=>({kind:'options',options:raw.initialOptions}));
  assert.throws(()=>restoreNotebook(padded(JSON.stringify(raw))),/Unsupported/);
});
