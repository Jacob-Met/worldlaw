import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNotebook, validateNotebook} from '../src/motion/measurement.mjs';
import {MAX_MOTION_NOTEBOOK_FILE_BYTES, serializeMotionNotebook} from '../src/motion/notebook-output.mjs';

const bytes = text => new TextEncoder().encode(text).byteLength;
const digest = text => createHash('sha256').update(text).digest('hex');
const notebook = label => createNotebook({source:{kind:'user-supplied',label,
  width:128,height:128,duration:1}});

test('ordinary saved notebooks keep the readable snapshot and every validated field', () => {
  const input = notebook('Authored short notebook; not physical evidence');
  input.measurements = [{time:0,status:'lost',point:null,reason:'No source observation',
    quality:{diagnostics:{flags:[0,1]}}}];
  input.revisions = [{type:'authored-control',note:'Keep the complete event'}];
  input.retainedDeclaration = {unknown:true,note:'An admitted extension is retained'};
  const before = JSON.stringify(input), validated = validateNotebook(input);
  const text = serializeMotionNotebook(input);
  assert.equal(MAX_MOTION_NOTEBOOK_FILE_BYTES, 8 * 1024 * 1024);
  assert.equal(text, JSON.stringify(validated,null,2)+'\n');
  assert.deepEqual(validateNotebook(JSON.parse(text)), validated);
  assert.equal(serializeMotionNotebook(input), text, 'The same snapshot has deterministic bytes');
  assert.equal(JSON.stringify(input), before, 'Saving must not mutate original evidence');
});

test('the exact #343 1000-row 750-flag source saves within the unchanged reader limit', () => {
  const input = notebook('Authored Motion notebook formatting control; not physical evidence');
  input.measurements = Array.from({length:1000},(_,i)=>({time:i/1000,status:'lost',point:null,
    quality:{diagnostics:{flags:Array(750).fill(0)}}}));
  const before = JSON.stringify(input), validated = validateNotebook(input);
  const originalCompact = JSON.stringify(validated);
  assert.equal(bytes(originalCompact), 1_582_179);
  assert.equal(digest(originalCompact), '65e1a048546c6bd0127a7902ccce49d536c852869c30ee843a2456038ee04dcf');
  const originalReadable = JSON.stringify(validated,null,2)+'\n';
  assert.equal(bytes(originalReadable), 11_423_262);
  assert.ok(bytes(originalReadable) > MAX_MOTION_NOTEBOOK_FILE_BYTES);

  const text = serializeMotionNotebook(input);
  assert.equal(text, originalCompact+'\n');
  assert.equal(bytes(text), 1_582_180);
  assert.ok(bytes(text) <= MAX_MOTION_NOTEBOOK_FILE_BYTES);
  const reopened = validateNotebook(JSON.parse(text));
  assert.deepEqual(reopened, validated);
  assert.equal(reopened.measurements.length,1000);
  assert.ok(reopened.measurements.every(row=>row.quality.diagnostics.flags.length===750));
  assert.equal(JSON.stringify(input), before, 'Formatting fallback must not delete or modify ledger entries');
});

test('UTF-8 notebook output preserves Unicode and measures bytes rather than characters', () => {
  const input = notebook('測定ノート — authored 🧪 control');
  input.source.metadata = {declaration:'原記録を保持する 🧭',escaped:'line one\nline two\t"quoted"'};
  input.revisions = [{type:'authored-control',note:'角度 θ / 🧪 / café'}];
  const before = JSON.stringify(input), text = serializeMotionNotebook(input);
  assert.ok(bytes(text) > text.length, 'The control distinguishes UTF-8 bytes from string length');
  assert.ok(bytes(text) <= MAX_MOTION_NOTEBOOK_FILE_BYTES);
  assert.equal(text, JSON.stringify(validateNotebook(input),null,2)+'\n');
  assert.deepEqual(JSON.parse(text),validateNotebook(input));
  assert.equal(JSON.stringify(input),before);

  const unicodeCourse = notebook('Authored Unicode byte-limit control');
  unicodeCourse.measurements = Array.from({length:1000},(_,i)=>({time:i/1000,status:'lost',point:null,
    quality:{diagnostics:{flags:Array(450).fill('漢')}}}));
  const original = JSON.stringify(unicodeCourse), validated = validateNotebook(unicodeCourse);
  const readable = JSON.stringify(validated,null,2)+'\n';
  assert.ok(readable.length < MAX_MOTION_NOTEBOOK_FILE_BYTES, 'Character count alone would admit this output');
  assert.ok(bytes(readable) > MAX_MOTION_NOTEBOOK_FILE_BYTES, 'Its actual UTF-8 file exceeds the reader cap');
  const saved = serializeMotionNotebook(unicodeCourse);
  assert.equal(saved,JSON.stringify(validated)+'\n');
  assert.ok(bytes(saved) <= MAX_MOTION_NOTEBOOK_FILE_BYTES);
  assert.deepEqual(validateNotebook(JSON.parse(saved)),validated);
  assert.equal(JSON.stringify(unicodeCourse),original);
});

test('invalid and over-limit notebooks are refused without mutation or partial output', () => {
  const invalid = notebook('Authored invalid-status control');
  invalid.measurements = [{time:0,status:'invented',point:null}];
  const tooMany = notebook('Authored row-limit control');
  tooMany.measurements = Array.from({length:4001},(_,i)=>({time:i/5000,status:'lost',point:null}));
  const tooLarge = notebook('Authored portable-size control');
  tooLarge.retainedDeclaration = 'x'.repeat(2_000_000);
  for (const [input,message] of [[invalid,/unsupported tracking status/],
    [tooMany,/at most 4000 measurements/],[tooLarge,/portable JSON limit/]]) {
    const before = JSON.stringify(input);
    assert.throws(()=>serializeMotionNotebook(input),message);
    assert.equal(JSON.stringify(input),before);
  }
});
