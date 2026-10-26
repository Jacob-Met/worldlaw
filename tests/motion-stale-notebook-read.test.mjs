import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/motion/app.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function openNotebook(file) {');
const end = source.indexOf('\nasync function seek(', start);
assert.ok(start >= 0 && end > start, 'find production openNotebook implementation');
const implementation = source.slice(start, end);

function receiver({demoSource = null} = {}) {
  const errors = [], notifications = [], state = {epoch: 0, notebook: null, source: null, frame: null, selectedTime: null};
  const nodes = {'track-until': {value: '', max: ''}};
  const context = {
    state, $: id => nodes[id] || (nodes[id] = {}),
    MAX_MOTION_NOTEBOOK_FILE_BYTES: 8 * 1024 * 1024,
    stopWork: () => { state.epoch++; }, render() {},
    validateNotebook: x => { if (!x || x.type !== 'valid') throw Error('invalid notebook'); return x; },
    createDemoSource() { if (!demoSource) throw Error('unexpected synthetic source'); return demoSource; },
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

function syntheticCase(rejectLater = true) {
  let complete, fail, disposed = 0;
  const source = {kind:'synthetic-video', width:32,height:24,duration:3,
    metadata:{generator:'worldlaw.motion-demo/v1',framesPerSecond:30,occlusion:false,motion:'test',occlusionInterval:null}};
  const demoSource = {source, frameAt: () => new Promise((resolve, reject) => { complete=resolve; fail=reject; }), dispose() {disposed++;}};
  const notebook = {type:'valid',label:'OLD SYNTH',source,measurements:[{time:0}]};
  return {demoSource, notebook, finish:() => complete({time:0,width:32,height:24}),
    reject:() => fail(new Error('Obsolete synthetic frame decode failed')),
    disposed:() => disposed};
}

test('older synthetic preview decoding failure must not overwrite newer accepted notebook status', async () => {
  const s = syntheticCase(), r = receiver({demoSource:s.demoSource});
  const older = r.invoke({size:99,text: async () => JSON.stringify(s.notebook)});
  await new Promise(resolve => setImmediate(resolve));
  await r.invoke(r.valid('NEWER'));
  s.reject();
  await older;
  assert.equal(r.state.notebook.label, 'NEWER');
  assert.deepEqual(r.errors, [], 'obsolete synthetic preview must not report an error');
  assert.equal(s.disposed(), 1, 'retired preview resource must be released');
});

test('current synthetic preview decoding failure remains visible', async () => {
  const s = syntheticCase(), r = receiver({demoSource:s.demoSource});
  const current = r.invoke({size:99,text: async () => JSON.stringify(s.notebook)});
  await new Promise(resolve => setImmediate(resolve));
  s.reject();
  await current;
  assert.deepEqual(r.errors, ['Obsolete synthetic frame decode failed']);
  assert.equal(s.disposed(), 1, 'failed current preview releases its candidate');
});

test('current compatible synthetic preview remains connectable and is not disposed', async () => {
  const s = syntheticCase(), r = receiver({demoSource:s.demoSource});
  const current = r.invoke({size:99,text: async () => JSON.stringify(s.notebook)});
  await new Promise(resolve => setImmediate(resolve));
  s.finish();
  await current;
  assert.equal(r.state.notebook.label, 'OLD SYNTH');
  assert.equal(r.state.source, s.demoSource);
  assert.equal(s.disposed(), 0);
  assert.deepEqual(r.errors, []);
});

test('obsolete successful synthetic preview is disposed without replacing newer notebook', async () => {
  const s = syntheticCase(), r = receiver({demoSource:s.demoSource});
  const older = r.invoke({size:99,text: async () => JSON.stringify(s.notebook)});
  await new Promise(resolve => setImmediate(resolve));
  await r.invoke(r.valid('NEWER'));
  s.finish();
  await older;
  assert.equal(r.state.notebook.label, 'NEWER');
  assert.equal(s.disposed(), 1);
  assert.deepEqual(r.errors, []);
});
