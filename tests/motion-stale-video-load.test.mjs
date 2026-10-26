import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/motion/app.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function openVideo(file, attach) {');
const end = source.indexOf('\nasync function openNotebook(', start);
assert.ok(start >= 0 && end > start, 'locate production Motion video admission wrapper');
const productionOpenVideo = source.slice(start, end);
function receiver() {
  const errors = [], admitted = [], retired = [], notices = [];
  const state = {epoch:0, controller:null, source:null};
  const context = {
    state, AbortController,
    stopWork() {state.epoch++; state.controller?.abort();},
    render() {}, notice(x) { notices.push(x); },
    loadVideo: (file) => file.load(),
    async installSource(source) { admitted.push(source.name); state.source?.dispose(); state.source = source; },
    showError(error) {if(error.name !== 'AbortError') errors.push(error.message || String(error));},
  };
  vm.createContext(context);
  vm.runInContext(productionOpenVideo + '\nglobalThis.openVideo = openVideo;\nglobalThis.safe = action => async event => {try{await action(event);}catch(error){showError(error);}}',context);
  const invoke = f => context.safe(context.openVideo)(f, false);
  const success = name => ({load:async () => ({name,dispose(){retired.push(name);}})});
  const failing = msg => ({load:async () => {throw new Error(msg);}});
  return {errors,admitted,retired,notices,state,invoke,success,failing};
}

test('obsolete decoder failure cannot overpaint a newer accepted video',async()=>{
  const r=receiver(); let reject;
  const older=r.invoke({load:()=>new Promise((resolve,error)=>{reject=error;})});
  await r.invoke(r.success('NEWER'));
  reject(new Error('Old video decoder rejected'));
  await older;
  assert.deepEqual(r.admitted,['NEWER']);
  assert.equal(r.state.source?.name,'NEWER');
  assert.deepEqual(r.errors,[]);
});

test('current failed video import still reports decoder error',async()=>{
  const r=receiver();
  await r.invoke(r.success('CURRENT'));
  await r.invoke(r.failing('Decode failed for current video'));
  assert.deepEqual(r.errors,['Decode failed for current video']);
  assert.equal(r.state.source.name,'CURRENT');
});

test('superseded successful video load releases obsolete candidate without admission',async()=>{
  const r=receiver(); let resolve;
  const older=r.invoke({load:()=>new Promise(yes=>{resolve=yes;})});
  await r.invoke(r.success('NEWER'));
  resolve({name:'OLDER',dispose(){r.retired.push('OLDER');}});
  await older;
  assert.deepEqual(r.admitted,['NEWER']);
  assert.deepEqual(r.retired,['OLDER']);
  assert.deepEqual(r.errors,[]);
});

test('latest successful source can replace an earlier completed source',async()=>{
  const r=receiver();
  await r.invoke(r.success('FIRST'));
  await r.invoke(r.success('SECOND'));
  assert.deepEqual(r.admitted,['FIRST','SECOND']);
  assert.deepEqual(r.retired,['FIRST']);
  assert.equal(r.state.source.name,'SECOND');
});
