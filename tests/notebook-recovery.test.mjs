import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotebookStorage, NOTEBOOK_KEY, RECOVERY_PREFIX, MAX_RECOVERY_SLOTS } from '../src/notebook-recovery.mjs';

function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  const fail = { read: false, write: false, mutateBackup: false, failKey: null };
  const storage = {
    getItem(key) {
      if (fail.read) throw new DOMException('Denied', 'SecurityError');
      if (fail.mutateBackup && String(key).startsWith(RECOVERY_PREFIX)) return 'mismatch';
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (fail.write || key === fail.failKey) throw new DOMException('Full', 'QuotaExceededError');
      data.set(key, value);
    },
  };
  return { storage, fail, data };
}

test('original unreadable UTF-8/CRLF text survives ordinary virtual edits', () => {
  const raw = '{\r\n  "label": "café / 日本語",\r\n malformed: ]';
  const { storage, data } = fakeStorage({ [NOTEBOOK_KEY]: raw });
  const notebook = createNotebookStorage(() => storage);
  assert.equal(notebook.readInitial().text, raw);
  notebook.protectUnreadable(raw);
  assert.equal(notebook.saveCurrent('new virtual experiment').reason, 'protected');
  assert.equal(data.get(NOTEBOOK_KEY), raw);
  assert.equal(notebook.protectedOriginal, raw);
});

test('verified archive precedes explicit replacement and survives new visits', () => {
  const raw = '{invalid original}\r\n';
  const { storage, data } = fakeStorage({ [NOTEBOOK_KEY]: raw });
  const notebook = createNotebookStorage(() => storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  assert.deepEqual(notebook.archiveAndReplace('{"valid":true}'), { ok: true, slot: 1 });
  assert.equal(data.get(RECOVERY_PREFIX + '1'), raw);
  assert.equal(data.get(NOTEBOOK_KEY), '{"valid":true}');
  assert.equal(notebook.blocked, false);
  const later = createNotebookStorage(() => storage);
  assert.equal(later.readInitial().text, '{"valid":true}');
  assert.deepEqual(later.archives().entries, [{ slot: 1, text: raw }]);
});

test('storage quota on archive never overwrites the original', () => {
  const raw = '{broken}';
  const { storage, fail, data } = fakeStorage({ [NOTEBOOK_KEY]: raw });
  const notebook = createNotebookStorage(() => storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  fail.failKey = RECOVERY_PREFIX + '1';
  assert.equal(notebook.archiveAndReplace('{}').reason, 'storage-error');
  assert.equal(data.get(NOTEBOOK_KEY), raw);
  assert.equal(notebook.blocked, true);
});

test('read denial at first visit never permits autosave or replacement', () => {
  const { storage, fail, data } = fakeStorage({ [NOTEBOOK_KEY]: '{broken}' });
  fail.read = true;
  const notebook = createNotebookStorage(() => storage);
  assert.equal(notebook.readInitial().reason, 'read-denied');
  fail.read = false;
  assert.equal(notebook.saveCurrent('virtual').reason, 'read-denied');
  assert.equal(notebook.archiveAndReplace('virtual').reason, 'no-protected-original');
  assert.equal(data.get(NOTEBOOK_KEY), '{broken}');
});

test('a prior different archive remains intact and new original receives the next slot', () => {
  const { storage, data } = fakeStorage({ [NOTEBOOK_KEY]: 'new damaged', [RECOVERY_PREFIX+'1']: 'older damaged' });
  const notebook = createNotebookStorage(() => storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  assert.deepEqual(notebook.archiveAndReplace('valid'), { ok: true, slot: 2 });
  assert.equal(data.get(RECOVERY_PREFIX+'1'), 'older damaged');
  assert.equal(data.get(RECOVERY_PREFIX+'2'), 'new damaged');
});

test('changed active source (such as another tab) cannot be knowingly overwritten', () => {
  const { storage, data } = fakeStorage({ [NOTEBOOK_KEY]: 'old corrupt' });
  const notebook = createNotebookStorage(() => storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  data.set(NOTEBOOK_KEY, 'newer source');
  assert.equal(notebook.archiveAndReplace('virtual').reason, 'active-source-changed');
  assert.equal(data.get(NOTEBOOK_KEY), 'newer source');
});

test('backup readback failure prevents replacement', () => {
  const { storage, fail, data } = fakeStorage({ [NOTEBOOK_KEY]: 'old corrupt' });
  const notebook = createNotebookStorage(() => storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  fail.mutateBackup = true;
  assert.equal(notebook.archiveAndReplace('virtual').reason, 'archive-full');
  assert.equal(data.get(NOTEBOOK_KEY), 'old corrupt');
});

test('failed active write after verified archive keeps original and retained archive', () => {
  const { storage, fail, data } = fakeStorage({ [NOTEBOOK_KEY]: 'old corrupt' });
  const notebook = createNotebookStorage(() => storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  fail.failKey = NOTEBOOK_KEY;
  assert.equal(notebook.archiveAndReplace('virtual').reason, 'storage-error');
  assert.equal(data.get(NOTEBOOK_KEY), 'old corrupt');
  assert.equal(data.get(RECOVERY_PREFIX+'1'), 'old corrupt');
});

test('valid/empty notebooks can save and archive listing is bounded', () => {
  const { storage, data } = fakeStorage();
  const notebook = createNotebookStorage(() => storage);
  assert.deepEqual(notebook.readInitial(), { ok: true, text: null });
  assert.deepEqual(notebook.saveCurrent('original'), { ok: true });
  assert.equal(data.get(NOTEBOOK_KEY), 'original');
  assert.equal(notebook.archives().entries.length, 0);
});

test('archive exhaustion refuses destruction and archive read errors are explicit', () => {
  const seed = { [NOTEBOOK_KEY]: 'new bad' };
  for (let i=1; i<=MAX_RECOVERY_SLOTS; i++) seed[RECOVERY_PREFIX+i]='older'+i;
  const { storage, data, fail }=fakeStorage(seed);
  const notebook=createNotebookStorage(()=>storage);
  notebook.protectUnreadable(notebook.readInitial().text);
  assert.equal(notebook.archiveAndReplace('new valid').reason,'archive-full');
  assert.equal(data.get(NOTEBOOK_KEY),'new bad');
  fail.read=true;
  assert.equal(notebook.archives().reason,'archive-read-failed');
});

