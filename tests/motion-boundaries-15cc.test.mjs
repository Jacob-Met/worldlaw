import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVideo } from '../src/motion/video.mjs';
import { createNotebook, validateNotebook, upsertMeasurement } from '../src/motion/measurement.mjs';

/**
 * Deterministic event-order UNIT double. This does not run a browser or decode
 * media and cannot qualify real codec or compositor behavior. It reproduces
 * the adapter's handling of an old presentation callback before seeked.
 */
class EventOrderVideo extends EventTarget {
  constructor({ staleCallback = true, callbacks = true, earlyTarget = false, postSeekCallback = true } = {}) {
    super();
    this.style = {};
    this.duration = 2;
    this.videoWidth = 10;
    this.videoHeight = 10;
    this.readyState = 2;
    this.seeking = false;
    this.visibleTime = 0;
    this.time = 0;
    this.generation = 0;
    this.callbackId = 0;
    this.callbacks = new Map();
    this.staleCallback = staleCallback;
    this.earlyTarget = earlyTarget;
    this.postSeekCallback = postSeekCallback;
    if (!callbacks) this.requestVideoFrameCallback = undefined;
  }
  setAttribute() {}
  removeAttribute() {}
  pause() {}
  remove() { this.generation += 1; }
  load() { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  requestVideoFrameCallback(callback) {
    const id = ++this.callbackId;
    this.callbacks.set(id, callback);
    return id;
  }
  cancelVideoFrameCallback(id) { this.callbacks.delete(id); }
  emitFrame(mediaTime, presentedFrames) {
    // A callback registered by a callback belongs to the NEXT presentation.
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(performance.now(), { mediaTime, presentedFrames });
  }
  set currentTime(value) {
    const generation = ++this.generation;
    const oldTime = this.visibleTime;
    this.time = value;
    this.seeking = true;
    if (this.staleCallback) setTimeout(() => {
      if (generation === this.generation) this.emitFrame(oldTime, generation * 2);
    }, 0);
    if (this.earlyTarget) setTimeout(() => {
      if (generation !== this.generation) return;
      this.visibleTime = value;
      this.emitFrame(value, generation * 2);
    }, 0);
    setTimeout(() => {
      if (generation !== this.generation) return;
      this.visibleTime = value;
      this.seeking = false;
      this.dispatchEvent(new Event('seeked'));
      if (this.postSeekCallback) setTimeout(() => {
        if (generation === this.generation) this.emitFrame(value, generation * 2 + 1);
      }, 0);
    }, 5);
  }
  get currentTime() { return this.time; }
}

async function withEventOrderSource(options, run) {
  const originalDocument = globalThis.document;
  const video = new EventOrderVideo(options);
  let drawnTime = 0;
  globalThis.document = {
    body: { append() {} },
    createElement(name) {
      if (name === 'video') return video;
      assert.equal(name, 'canvas');
      return { getContext() {
        return {
          drawImage(source) { drawnTime = source.visibleTime; },
          getImageData() {
            const data = new Uint8ClampedArray(10 * 10 * 4);
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.round(drawnTime * 100);
              data[i + 3] = 255;
            }
            return { data };
          },
        };
      } };
    },
  };
  let source;
  try {
    const file = new Blob(['Event-order unit input; deliberately not encoded media.']);
    file.name = 'event-order-unit.webm';
    source = await loadVideo(file);
    await run(source, video);
  } finally {
    source?.dispose();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

test('unit event ordering: a pre-seek presentation stamp cannot label post-seek pixels', async () => {
  await withEventOrderSource({ staleCallback: true }, async source => {
    const frame = await source.frameAt(1);
    assert.equal(frame.timeBasis, 'decoded-media-time');
    assert.equal(frame.time, 1, 'the old time 0 callback must be ignored and re-armed');
    assert.equal(frame.data[0], 100, 'pixel identity must agree with the accepted time 1 stamp');
  });
});

test('unit event ordering: cancellation removes callbacks and permits a new seek', async () => {
  await withEventOrderSource({ staleCallback: false }, async (source, video) => {
    const controller = new AbortController();
    const pending = source.frameAt(0.5, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(video.callbacks.size, 0);
    const next = await source.frameAt(1);
    assert.equal(next.time, 1);
    assert.equal(next.data[0], 100);
    assert.equal(video.callbacks.size, 0);
  });
});

test('unit event ordering: a valid target callback before seeked retains decoded timing', async () => {
  await withEventOrderSource({ staleCallback: false, earlyTarget: true, postSeekCallback: false }, async source => {
    const frame = await source.frameAt(1);
    assert.equal(frame.timeBasis, 'decoded-media-time', 'a real target frame may reach the compositor before seeked');
    assert.equal(frame.time, 1);
    assert.equal(frame.data[0], 100);
  });
});

test('unit event ordering: absent frame callback support remains explicit nominal timing', async () => {
  await withEventOrderSource({ callbacks: false }, async source => {
    const frame = await source.frameAt(1);
    assert.equal(frame.timeBasis, 'requested-seek-time');
    assert.equal(frame.time, 1);
    assert.equal(frame.data[0], 100);
  });
});

test('notebook size overflow refuses an append atomically before returning invalid evidence', () => {
  let notebook = createNotebook({ source: {
    kind: 'synthetic', label: 'Portable-size boundary unit input', width: 100, height: 100, duration: 4000,
  } });
  notebook.measurements = Array.from({ length: 1000 }, (_, index) => ({
    time: index, status: 'accepted', point: { x: 55, y: 70 }, reason: 'x'.repeat(1800),
  }));
  while (JSON.stringify(notebook).length < 1_997_000) {
    notebook.measurements.push({ time: notebook.measurements.length, status: 'accepted',
      point: { x: 55, y: 70 }, reason: 'x'.repeat(1800) });
  }
  notebook = validateNotebook(notebook);
  const before = JSON.stringify(notebook);
  assert.ok(before.length < 2_000_000);
  const added = { time: notebook.measurements.length, status: 'accepted',
    point: { x: 55, y: 70 }, reason: 'y'.repeat(3500) };
  assert.ok(JSON.stringify({ ...notebook, measurements: [...notebook.measurements, added] }).length > 2_000_000);
  assert.throws(() => upsertMeasurement(notebook, added), /portable JSON limit/);
  assert.equal(JSON.stringify(notebook), before, 'the original notebook must remain portable and unchanged');
  assert.doesNotThrow(() => validateNotebook(notebook));
});
