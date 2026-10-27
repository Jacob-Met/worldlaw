import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebookStorage,NOTEBOOK_KEY,RECOVERY_PREFIX} from '../src/notebook-recovery.mjs';

function sharedStorage(initial=null){
  const data=new Map(initial===null?[]:[[NOTEBOOK_KEY,initial]]);
  const fail={read:false,write:false};let writes=0;
  const storage={
    getItem(key){if(fail.read)throw Error('read denied');return data.get(key)??null;},
    setItem(key,value){if(fail.write)throw Error('quota exceeded');writes++;data.set(key,value);},
  };
  const open=()=>{const notebook=createNotebookStorage(()=>storage);assert.equal(notebook.readInitial().ok,true);return notebook;};
  return {data,fail,storage,open,get writes(){return writes;}};
}

test('an older tab cannot overwrite already saved experiment evidence',()=>{
  const shared=sharedStorage('original notebook'),first=shared.open(),older=shared.open();
  assert.deepEqual(first.saveCurrent('original plus acquired reading'),{ok:true});
  assert.equal(older.saveCurrent('original plus refit').reason,'active-source-changed');
  assert.equal(shared.data.get(NOTEBOOK_KEY),'original plus acquired reading');
  assert.equal(older.saveCurrent('another stale refit').reason,'active-source-changed');
  assert.equal(shared.data.get(NOTEBOOK_KEY),'original plus acquired reading');
  assert.equal(shared.writes,1);
});

test('a detected conflict stays refused after another read or restored old bytes',()=>{
  const shared=sharedStorage('original'),older=shared.open();
  shared.data.set(NOTEBOOK_KEY,'new evidence');
  assert.equal(older.readInitial().text,'new evidence');
  assert.equal(older.saveCurrent('stale state').reason,'active-source-changed');
  shared.data.set(NOTEBOOK_KEY,'original');
  assert.equal(older.saveCurrent('stale state').reason,'active-source-changed');
  assert.equal(shared.writes,0);
});

test('own successful saves advance the baseline; an identical external write is harmless',()=>{
  const shared=sharedStorage('original'),notebook=shared.open();
  assert.deepEqual(notebook.saveCurrent('first acquisition'),{ok:true});
  shared.data.set(NOTEBOOK_KEY,'first acquisition');
  assert.deepEqual(notebook.saveCurrent('second acquisition'),{ok:true});
  assert.equal(shared.data.get(NOTEBOOK_KEY),'second acquisition');
});

test('external creation, deletion and damaged source are retained exactly',()=>{
  for(const [initial,replacement]of [[null,'new notebook'],['old',null],['old','{\r\n"source":"café / 日本語",broken: ]']]){
    const shared=sharedStorage(initial),notebook=shared.open();
    if(replacement===null)shared.data.delete(NOTEBOOK_KEY);else shared.data.set(NOTEBOOK_KEY,replacement);
    assert.equal(notebook.saveCurrent('stale notebook').reason,'active-source-changed');
    assert.equal(shared.storage.getItem(NOTEBOOK_KEY),replacement);
    assert.equal(shared.writes,0);
  }
});

test('an instance that has not read its source cannot authorize a save',()=>{
  const shared=sharedStorage('unread evidence'),notebook=createNotebookStorage(()=>shared.storage);
  assert.equal(notebook.saveCurrent('replacement').reason,'initial-read-required');
  assert.equal(shared.data.get(NOTEBOOK_KEY),'unread evidence');
  assert.equal(shared.writes,0);
});

test('failed comparison reads never write and a later unchanged-source retry works',()=>{
  const shared=sharedStorage('original'),notebook=shared.open();
  shared.fail.read=true;
  assert.equal(notebook.saveCurrent('new acquisition').reason,'read-denied');
  assert.equal(shared.writes,0);
  shared.fail.read=false;
  assert.deepEqual(notebook.saveCurrent('new acquisition'),{ok:true});
  assert.equal(shared.data.get(NOTEBOOK_KEY),'new acquisition');
});

test('failed writes retain the baseline and later external evidence still wins',()=>{
  const shared=sharedStorage('original'),notebook=shared.open();
  shared.fail.write=true;
  assert.equal(notebook.saveCurrent('failed acquisition').reason,'save-failed');
  shared.fail.write=false;
  assert.deepEqual(notebook.saveCurrent('successful acquisition'),{ok:true});
  shared.fail.write=true;
  assert.equal(notebook.saveCurrent('failed refit').reason,'save-failed');
  shared.fail.write=false;
  shared.data.set(NOTEBOOK_KEY,'other tab evidence');
  assert.equal(notebook.saveCurrent('retry refit').reason,'active-source-changed');
  assert.equal(shared.data.get(NOTEBOOK_KEY),'other tab evidence');
});

test('verified unreadable-source replacement establishes the next save baseline',()=>{
  const original='{damaged original}\r\n',shared=sharedStorage(original),notebook=shared.open();
  notebook.protectUnreadable(original);
  assert.deepEqual(notebook.archiveAndReplace('accepted replacement'),{ok:true,slot:1});
  assert.deepEqual(notebook.saveCurrent('replacement plus acquisition'),{ok:true});
  assert.equal(shared.data.get(NOTEBOOK_KEY),'replacement plus acquisition');
  assert.equal(shared.data.get(RECOVERY_PREFIX+'1'),original);
});

test('failed explicit replacement keeps ordinary autosave protected',()=>{
  const shared=sharedStorage('damaged'),notebook=shared.open();
  notebook.protectUnreadable('damaged');shared.fail.write=true;
  assert.equal(notebook.archiveAndReplace('replacement').reason,'storage-error');
  shared.fail.write=false;
  assert.equal(notebook.saveCurrent('replacement').reason,'protected');
  assert.equal(shared.data.get(NOTEBOOK_KEY),'damaged');
});
