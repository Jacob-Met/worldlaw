import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/motion/app.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function openNotebook(file) {');
const end = source.indexOf('\nasync function seek(', start);
assert.ok(start >= 0 && end > start, 'find production openNotebook implementation');
const implementation = source.slice(start, end);

function receiver() {
  const errors = [], notifications = [], state = {epoch: 0, notebook: null, source: null, frame: null, selectedTime: null};
  const nodes = {'track-until': {value: '', max: ''}};
  const context = {
    state, $: id => nodes[id] || (nodes[id] = {}),
    MAX_MOTION_NOTEBOOK_FILE_BYTES: 8 * 1024 * 1024,
    stopWork: () => { state.epoch++; }, render() {},
    validateNotebook: x => { if (!x || x.type !== 'valid') throw Error('invalid notebook'); return x; },
    createDemoSource() { throw Error('unexpected synthetic source'); },
    planePanel: {reset() {}}, invalidateStudioExport() {},
    commitNotebook: notebook => {state.notebook = notebook;},
    restoreReferenceInputs() {}, restoreTrackingAppearance() {},
    notice: message => notifications.push(message),
    clearError() {}, showError: error => errors.push(error.message || String(error)),
  };
  vm.createContext(context);
  vm.runInContext(implementation + '\nglobalThis.openNotebook = openNotebook;\nglobalThis.safe = action => async event => { try { await action(event); } catch(error) { showError(error); } };', context);
  const valid = (label) => ({size: 300, text: async () => JSON.stringify({type:'valid',label,source:{kind:'video',duration:3}, measurements:[{time:0}]})});
  const malformed = () => ({size: 1, text: async () => '{'});
  const rejected = () => ({size: 3, text: async () => { throw new Error('Cannot read file'); }});
  const invoke = f => context.safe(context.openNotebook)(f);
  return {errors, notifications, state, valid, malformed, rejected, invoke};
}

for (const [label, oldFile] of [['malformed stale JSON', r => ({size: 1, text: () => r.promise})], ['rejected stale file read', r => ({size: 3, text: () => r.promise})]]) {
  test(label + ' does not hide newer successfully reopened notebook', async () => {
    const r = receiver();
    let accept, reject;
    const promise = new Promise((resolve, error) => { accept = resolve; reject = error; });
    const first = r.invoke(oldFile({promise}));
    await r.invoke(r.valid('NEWER'));
    if (label.startsWith('malformed')) accept('{'); else reject(new Error('Older disk read failed'));
    await first;
    assert.equal(r.state.notebook.label, 'NEWER');
    assert.deepEqual(r.errors, [], 'obsolete read should not publish an error');
  });
}

test('malformed current notebook still reports an error', async () => {
  const r = receiver(); await r.invoke(r.malformed());
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /JSON|property|position/i);
});

test('current unreadable file still reports its error', async () => {
  const r = receiver(); await r.invoke(r.rejected());
  assert.deepEqual(r.errors, ['Cannot read file']);
});

test('older valid late read does not replace newer accepted source', async () => {
  const r = receiver(); let complete;
  const first = r.invoke({size: 99,text: () => new Promise(resolve => {complete=resolve;})});
  await r.invoke(r.valid('NEWER'));
  complete(JSON.stringify({type:'valid',label:'OLDER',source:{kind:'video',duration:3},measurements:[]}));
  await first;
  assert.equal(r.state.notebook.label, 'NEWER');
  assert.deepEqual(r.errors, []);
});

test('invalid current selection does not overwrite existing accepted source', async () => {
  const r = receiver(); await r.invoke(r.valid('READY')); await r.invoke(r.malformed());
  assert.equal(r.state.notebook.label, 'READY');
  assert.equal(r.errors.length, 1);
});
