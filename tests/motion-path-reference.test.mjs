import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createNotebook, validateNotebook, deriveAngles, exportAngular, exportStudio, calibrateNotebook} from '../src/motion/measurement.mjs';
import {proposePathReference, applyPathReference, pathReferenceCourses} from '../src/motion/path-reference.mjs';

function notebook(points, {times, width = 640, height = 480} = {}) {
  const nb = createNotebook({source: {kind: 'user-supplied', label: 'Independent authored image coordinates', width, height, duration: 20}});
  nb.measurements = points.map((point, i) => ({time: times?.[i] ?? i * .04,
    status: point ? 'accepted' : 'missing', point, timeBasis: 'user-supplied'}));
  return validateNotebook(nb);
}
function arc({cx = 280, cy = 170, radius = 95, start = -.9, span = 1.8, count = 41, noise = 0} = {}) {
  return Array.from({length: count}, (_, i) => {
    const a = start + span * i / (count - 1);
    return {x: cx + radius * Math.sin(a) + noise * Math.sin(i * 2.17),
      y: cy + radius * Math.cos(a) + noise * Math.cos(i * 1.71)};
  });
}
test('unchanged maintained MECHANISM source is pinned by the actual Git blob digest', async () => {
  const source = await readFile(new URL('../src/motion/vendor/mechanism-core.mjs', import.meta.url));
  assert.equal(createHash('sha1').update(Buffer.from('blob ' + source.length + '\0')).update(source).digest('hex'),
    '792f876916b5323510c2e8d7ce1f0a2377515afe');
});
test('a marker-only notebook offers the observed center and uses it in actual angular export', () => {
  const nb = notebook(arc()), original = structuredClone(nb), preview = proposePathReference(nb);
  assert.equal(nb.calibration, null); assert.equal(preview.status, 'candidate');
  assert.ok(Math.hypot(preview.pivot.x - 280, preview.pivot.y - 170) < 1e-9);
  const calibrated = applyPathReference(nb, preview);
  assert.deepEqual(nb, original);
  assert.deepEqual(calibrated.measurements, original.measurements);
  const angles = deriveAngles(calibrated);
  angles.samples.forEach((row, i) => assert.ok(Math.abs(row.position - (-.9 + 1.8 * i / 40)) < 1e-12));
  const saved = validateNotebook(JSON.parse(JSON.stringify(calibrated)));
  assert.deepEqual(saved, calibrated);
  const exported = exportAngular(saved);
  assert.equal(exported.samples.length, 41);
  assert.equal(exported.source.metadata.referenceConditioning.fitPrecedesDownstreamSplit, true);
  const studio = exportStudio(saved, {inertia: 1, command: 0, confirmKnownDynamics: true});
  assert.ok(studio.heldOut.length > 0);
  assert.deepEqual(studio.source.metadata.referenceConditioning, exported.source.metadata.referenceConditioning);
  assert.equal(exported.source.metadata.referenceHistory.at(-1).type, 'path-reference');
  assert.deepEqual(exported.source.metadata.referenceHistory.at(-1).sourceObservations.map(x => x.sourceIndex),
    preview.course.sourceIndices);
});
test('unfamiliar independent arcs and modest pixel noise preserve source-specific references', () => {
  for (let i = 0; i < 20; i++) {
    const cx = 180 + i * 6, cy = 100 + i * 3, radius = 50 + i * 3;
    const nb = notebook(arc({cx, cy, radius, start: -.8 - i * .01, span: 1.7 + i * .02, noise: .12}));
    const result = proposePathReference(nb, {maxResidualPixels: .5});
    assert.equal(result.status, 'candidate', 'case ' + i);
    assert.ok(Math.hypot(result.pivot.x - cx, result.pivot.y - cy) < .3);
  }
});
test('straight, stationary and short-arc paths never become supported pivot calibration', () => {
  const cases = [
    Array.from({length: 32}, (_, i) => ({x: 100 + i * 3, y: 100 + i * 2})),
    Array.from({length: 32}, () => ({x: 120, y: 100})),
    arc({span: .2, start: -.1})
  ];
  for (const points of cases) {
    const nb = notebook(points), preview = proposePathReference(nb);
    assert.equal(preview.status, 'unresolved');
    assert.throws(() => applyPathReference(nb, preview), /does not support/);
    assert.equal(nb.calibration, null);
  }
});
test('the complete original-pixel discrepancy control rejects one displaced check observation', () => {
  const points = arc(); points[7].y += 5;
  const nb = notebook(points), preview = proposePathReference(nb, {maxResidualPixels: 1});
  assert.equal(preview.status, 'unresolved');
  assert.equal(preview.reason, 'radial_discrepancy_exceeds_declaration');
  assert.ok(preview.maximumResidualPixels > 4);
  assert.throws(() => applyPathReference(nb, preview), /does not support/);
});
test('a noncircular elliptical path cannot pass a strict original-pixel bound', () => {
  const points = Array.from({length: 41}, (_, i) => {
    const a = -1.4 + 2.8 * i / 40; return {x: 280 + 100 * Math.sin(a), y: 170 + 50 * Math.cos(a)};
  });
  const result = proposePathReference(notebook(points), {maxResidualPixels: .5});
  assert.equal(result.status, 'unresolved');
});
test('rejections and timestamp gaps require explicit course selection and never bridge', () => {
  const points = [...arc({count: 20}), null, ...arc({cx: 340, count: 20})];
  const nb = notebook(points);
  assert.equal(pathReferenceCourses(nb).length, 2);
  assert.throws(() => proposePathReference(nb), /Choose one/);
  const preview = proposePathReference(nb, {courseId: 1});
  assert.equal(preview.status, 'candidate');
  assert.ok(preview.course.sourceIndices.every(i => i > 20));
  assert.equal(applyPathReference(nb, preview).measurements[20].status, 'missing');
  const gap = notebook(arc(), {times: Array.from({length: 41}, (_, i) => i * .04 + (i > 19 ? 1 : 0))});
  assert.equal(pathReferenceCourses(gap).length, 2);
});
test('source/evidence/calibration mutation invalidates a preview before any state changes', () => {
  const nb = notebook(arc()), preview = proposePathReference(nb);
  for (const changed of [
    {...nb, source: {...nb.source, label: 'Different original'}},
    {...nb, measurements: nb.measurements.map((row, i) => i === 0 ? {...row, point: {...row.point, x: row.point.x + 1}} : row)},
    calibrateNotebook(nb, {pivot: {x: 300, y: 180}})
  ]) assert.throws(() => applyPathReference(changed, preview), /changed/);
});
test('forged cached pivot is ignored and the maintained source inference is recomputed', () => {
  const nb = notebook(arc()), preview = proposePathReference(nb);
  preview.pivot = {x: 1, y: 1}; preview.radius = 1;
  const result = applyPathReference(nb, preview, {pivot: {x: 2, y: 2}, pivotMode: 'tracked'});
  assert.ok(Math.hypot(result.calibration.pivot.x - 280, result.calibration.pivot.y - 170) < 1e-9);
  assert.equal(result.calibration.pivotMode, 'fixed');
});
test('an out-of-image inferred center, unobserved course and invalid declarations refuse', () => {
  const outside = notebook(arc({cx: -60, cy: 170, radius: 200, start: .5, span: 1.3}));
  assert.equal(proposePathReference(outside).reason, 'inferred_reference_outside_image');
  const nb = notebook(arc());
  for (const options of [{maxResidualPixels: -1}, {maxGapSeconds: 0}, {courseId: -1}, {courseId: 99}])
    assert.throws(() => proposePathReference(nb, options));
  const tracked = calibrateNotebook(nb, {pivot: {x: 280, y: 170}, pivotMode: 'tracked'});
  assert.throws(() => proposePathReference(tracked), /fixed camera/);
});
