import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplate, trackTemplate, TRACKER_VERSION } from '../src/motion/tracker.mjs';

function frame(width = 100, height = 80, pixel = () => 60) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const value = pixel(x, y);
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function patchValue(x, y) {
  const hash = Math.imul(x + 19, 374761393) ^ Math.imul(y + 23, 668265263);
  return 45 + ((hash ^ (hash >>> 13)) >>> 0) % 165;
}

function stamp(target, cx, cy, radius = 7, transform = value => value) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const i = ((cy + y) * target.width + cx + x) * 4;
      target.data[i] = target.data[i + 1] = target.data[i + 2] = transform(patchValue(x, y));
    }
  }
  return target;
}

function capture(target = stamp(frame(), 40, 35), point = { x: 40, y: 35 }, options) {
  const result = createTemplate(target, point, options);
  assert.equal(result.status, 'ready');
  return result.template;
}

function nearPoint(actual, expected, tolerance) {
  assert.ok(actual, 'an observed point should exist');
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) <= tolerance,
    `${JSON.stringify(actual)} should be within ${tolerance} pixels of ${JSON.stringify(expected)}`);
}

test('capture exposes fixed settings and freezes copied template samples', () => {
  const source = stamp(frame(), 40, 35);
  const template = capture(source);
  assert.equal(template.version, TRACKER_VERSION);
  assert.equal(template.size, 15);
  assert.equal(template.minTextureStd, 5);
  const original = [...template.normalizedValues];
  source.data.fill(0);
  assert.deepEqual(template.normalizedValues, original);
  assert.equal(Object.isFrozen(template), true);
  assert.equal(Object.isFrozen(template.normalizedValues), true);
});

test('integer translations and affine brightness changes are image observations', () => {
  const template = capture();
  for (const [dx, dy] of [[0, 0], [9, -6], [-12, 10]]) {
    const point = { x: 40 + dx, y: 35 + dy };
    const target = stamp(frame(), point.x, point.y, 7, value => 22 + value * 0.8);
    const result = trackTemplate(target, template, { x: 40, y: 35 });
    assert.equal(result.status, 'accepted', JSON.stringify(result));
    nearPoint(result.point, point, 0.05);
    assert.ok(result.score > 0.999);
    assert.ok(result.ambiguityMargin > 0.06);
    assert.equal(result.settings.searchRadius, 24);
  }
});

test('occlusion in textured noise is lost and never returns the prediction as an observation', () => {
  const target = frame(100, 80, (x, y) => patchValue(x + 121, y + 313));
  const prediction = { x: 43.125, y: 34.75 };
  const result = trackTemplate(target, capture(), prediction);
  assert.equal(result.status, 'lost');
  assert.equal(result.reason, 'score-below-threshold');
  assert.equal(result.point, null);
  assert.ok(result.candidatePoint);
  assert.ok(result.score < 0.75);
});

test('a flat or transparent capture and a blank search are explicit low-texture states', () => {
  assert.equal(createTemplate(frame(), { x: 40, y: 35 }).status, 'low-texture');
  const transparent = stamp(frame(), 40, 35);
  for (let i = 3; i < transparent.data.length; i += 4) transparent.data[i] = 0;
  assert.equal(createTemplate(transparent, { x: 40, y: 35 }).status, 'low-texture');
  const result = trackTemplate(frame(), capture(), { x: 40, y: 35 });
  assert.equal(result.status, 'low-texture');
  assert.equal(result.point, null);
  assert.equal(result.candidatePoint, null);
  assert.equal(result.score, null);
});

test('two identical displaced markers are ambiguous, including at zero configured margin', () => {
  const target = stamp(stamp(frame(), 34, 35), 58, 35);
  for (const minMargin of [0, 0.06]) {
    const result = trackTemplate(target, capture(), { x: 46, y: 35 }, { minMargin });
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.reason, 'competing-match');
    assert.equal(result.point, null);
    assert.ok(result.score > 0.9999);
    assert.ok(result.runnerUpScore > 0.9999);
    assert.ok(Math.abs(result.ambiguityMargin) < 1e-10);
  }
});

test('a strong match at the artificial search boundary is not silently accepted', () => {
  const result = trackTemplate(stamp(frame(), 52, 35), capture(), { x: 40, y: 35 }, { searchRadius: 12 });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.reason, 'search-boundary');
  assert.equal(result.searchBoundary, true);
  assert.equal(result.point, null);
  nearPoint(result.candidatePoint, { x: 52, y: 35 }, 0);
});

test('full-patch image edges are handled without padding or clamping observations', () => {
  assert.equal(createTemplate(frame(), { x: 5, y: 35 }).status, 'out-of-bounds');
  const template = capture();
  const result = trackTemplate(stamp(frame(), 7, 35), template, { x: 12, y: 35 }, { searchRadius: 12 });
  assert.equal(result.status, 'accepted', JSON.stringify(result));
  assert.equal(result.searchClipped, true);
  nearPoint(result.point, { x: 7, y: 35 }, 0);
  const outside = trackTemplate(frame(), template, { x: -100, y: -100 });
  assert.equal(outside.status, 'lost');
  assert.equal(outside.reason, 'search-outside-image');
  assert.equal(outside.point, null);
});

test('changed frame geometry cannot silently produce coordinates in a different space', () => {
  const result = trackTemplate(frame(102, 80), capture(), { x: 40, y: 35 });
  assert.equal(result.status, 'lost');
  assert.equal(result.reason, 'frame-size-changed');
  assert.equal(result.point, null);
});

test('an affine image ramp has contrast but no identifiable patch location', () => {
  const source = frame(100, 80, x => x * 2);
  const template = capture(source);
  const result = trackTemplate(source, template, { x: 40, y: 35 });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.point, null);
});

function smoothMarker(cx, cy) {
  return frame(100, 80, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return 35 + 155 * Math.exp(-((dx + 1.2) ** 2 / 6 + (dy - 0.7) ** 2 / 11))
      + 75 * Math.exp(-((dx - 3) ** 2 / 3 + (dy + 3) ** 2 / 4));
  });
}

test('subpixel refinement improves actual resampled NCC on smooth fractional translation', () => {
  const template = capture(smoothMarker(40, 35));
  for (const offset of [{ x: 0.35, y: -0.3 }, { x: -0.25, y: 0.4 }, { x: 5.45, y: 4.2 }]) {
    const expected = { x: 40 + offset.x, y: 35 + offset.y };
    const source = smoothMarker(expected.x, expected.y);
    const integer = trackTemplate(source, template, { x: 40, y: 35 }, { subpixel: false });
    const refined = trackTemplate(source, template, { x: 40, y: 35 });
    assert.equal(refined.status, 'accepted', JSON.stringify(refined));
    assert.equal(refined.subpixelRefined, true);
    assert.ok(refined.score > integer.score);
    nearPoint(refined.point, expected, 0.15);
  }
});

test('subpixel refinement can be disabled and fixed template does not adapt to target', () => {
  const template = capture(smoothMarker(40, 35));
  const before = JSON.stringify(template);
  const result = trackTemplate(smoothMarker(43.3, 36.4), template, { x: 40, y: 35 }, { subpixel: false });
  assert.equal(result.subpixelRefined, false);
  assert.equal(Number.isInteger(result.point.x), true);
  assert.equal(Number.isInteger(result.point.y), true);
  assert.equal(JSON.stringify(template), before);
});

test('a fractional user capture preserves its coordinate origin across subpixel phases', () => {
  const origin = { x: 40.35, y: 35.4 };
  const template = capture(smoothMarker(origin.x, origin.y), origin);
  for (const expected of [{ x: 43.05, y: 36.1 }, { x: 43.5, y: 36.4 }, { x: 43.95, y: 36.55 }]) {
    const result = trackTemplate(smoothMarker(expected.x, expected.y), template, origin);
    assert.equal(result.status, 'accepted', JSON.stringify(result));
    nearPoint(result.point, expected, 0.15);
  }
});

test('expensive option combinations are refused before the patch search', () => {
  const source = stamp(frame(320, 320), 160, 160, 24);
  const template = capture(source, { x: 160, y: 160 }, { patchRadius: 24 });
  assert.throws(() => trackTemplate(source, template, { x: 160, y: 160 }, { searchRadius: 128 }),
    /20 million patch sample comparisons/);
});

test('malformed inputs are rejected before image loops or unbounded allocations', () => {
  assert.throws(() => createTemplate({ width: Infinity, height: 2, data: [] }, { x: 0, y: 0 }), RangeError);
  assert.throws(() => createTemplate({ width: 100, height: 80, data: new Uint8ClampedArray(4) }, { x: 4, y: 4 }), TypeError);
  assert.throws(() => createTemplate(frame(), { x: NaN, y: 4 }), TypeError);
  assert.throws(() => createTemplate(frame(), { x: 40, y: 35 }, { patchRadius: 1 }), RangeError);
  assert.throws(() => trackTemplate(frame(), {}, { x: 40, y: 35 }), TypeError);
  const template = capture();
  for (const options of [{ searchRadius: 1000 }, { searchRadius: 2.4 }, { minScore: 2 },
    { exclusionRadius: 30 }, { minMargin: -1 }, { subpixel: 'yes' }]) {
    assert.throws(() => trackTemplate(frame(), template, { x: 40, y: 35 }, options));
  }
});
