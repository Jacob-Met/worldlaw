// Browser-only custody for the ordinary WORLDLAW scalar notebook.
// A damaged original is never silently replaced by the fallback virtual example.
export const NOTEBOOK_KEY = 'worldlaw.notebook.v1';
export const RECOVERY_PREFIX = 'worldlaw.notebook.recovery.v1.';
export const MAX_RECOVERY_SLOTS = 16;

const failure = (reason, error) => ({ ok: false, reason, ...(error ? { error } : {}) });

export function createNotebookStorage(getStorage, { key = NOTEBOOK_KEY, prefix = RECOVERY_PREFIX } = {}) {
  let protectedOriginal = null;
  let blocked = false;
  let readDenied = false;
  let hasBaseline = false;
  let acknowledgedText = null;
  let sourceChanged = false;

  function readInitial() {
    try {
      const text = getStorage().getItem(key);
      // A repeated inspection must not authorize saving an older in-memory notebook.
      if (!hasBaseline) {
        acknowledgedText = text;
        hasBaseline = true;
      }
      return { ok: true, text };
    } catch (error) {
      blocked = true;
      readDenied = true;
      return failure('read-denied', error);
    }
  }

  function protectUnreadable(text) {
    if (typeof text !== 'string') throw new TypeError('The unreadable notebook must be its original string.');
    protectedOriginal = text;
    blocked = true;
  }

  function saveCurrent(text) {
    if (blocked) return failure(readDenied ? 'read-denied' : 'protected');
    if (sourceChanged) return failure('active-source-changed');
    if (!hasBaseline) return failure('initial-read-required');
    let storage, currentText;
    try {
      storage = getStorage();
      currentText = storage.getItem(key);
    } catch (error) {
      return failure('read-denied', error);
    }
    // Detect an already completed external change; this is not an atomic lock.
    if (currentText !== acknowledgedText) {
      sourceChanged = true;
      return failure('active-source-changed');
    }
    try {
      storage.setItem(key, text);
      acknowledgedText = text;
      return { ok: true };
    } catch (error) {
      return failure('save-failed', error);
    }
  }

  function archives() {
    try {
      const storage = getStorage();
      const entries = [];
      for (let slot = 1; slot <= MAX_RECOVERY_SLOTS; slot++) {
        const text = storage.getItem(prefix + slot);
        if (text !== null) entries.push({ slot, text });
      }
      return { ok: true, entries };
    } catch (error) {
      return failure('archive-read-failed', error);
    }
  }

  function archiveAndReplace(nextText) {
    if (!blocked || protectedOriginal === null || readDenied) return failure('no-protected-original');
    try {
      const storage = getStorage();
      if (storage.getItem(key) !== protectedOriginal) return failure('active-source-changed');
      let matchingSlot = null, firstVacant = null;
      for (let slot = 1; slot <= MAX_RECOVERY_SLOTS; slot++) {
        const previous = storage.getItem(prefix + slot);
        if (previous === protectedOriginal) matchingSlot = slot;
        else if (previous === null && firstVacant === null) firstVacant = slot;
      }
      const slot = matchingSlot ?? firstVacant;
      if (slot === null) return failure('archive-full');
      if (matchingSlot === null) {
        // A parallel tab may have filled a slot since the initial scan.
        if (storage.getItem(prefix + slot) !== null) return failure('archive-slot-changed');
        storage.setItem(prefix + slot, protectedOriginal);
      }
      if (storage.getItem(prefix + slot) !== protectedOriginal) return failure('archive-readback-failed');
      // This is a best-effort last check, not a cross-tab atomic lock.
      if (storage.getItem(key) !== protectedOriginal) return failure('active-source-changed');
      storage.setItem(key, nextText);
      if (storage.getItem(key) !== nextText) return failure('replacement-readback-failed');
      acknowledgedText = nextText;
      hasBaseline = true;
      sourceChanged = false;
      protectedOriginal = null;
      blocked = false;
      return { ok: true, slot };
    } catch (error) {
      return failure('storage-error', error);
    }
  }

  return {
    readInitial, protectUnreadable, saveCurrent, archives, archiveAndReplace,
    get blocked() { return blocked; },
    get readDenied() { return readDenied; },
    get protectedOriginal() { return protectedOriginal; },
  };
}

