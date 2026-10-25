import test from 'node:test';
import assert from 'node:assert/strict';
import {course, CAMERAS, project} from './helpers/metric-plane-course.mjs';
import {createNotebook, validateNotebook, deriveAngles, exportAngular} from '../src/motion/measurement.mjs';
import {proposePathReference} from '../src/motion/path-reference.mjs';
import {proposePlanePathReference, applyPlanePathReference, PLANE_PATH_REFERENCE_METHOD} from '../src/motion/plane-path-reference.mjs';

const clone = value => structuredClone(value);
function unreferenced(options = {}) {
  const original = course(options);
  return {...original, notebook: {...createNotebook({source: original.notebook.source}),
    measurements: clone(original.notebook.measurements).map(({pivotMeasurement, ...row}) => row)}};
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rms = a => Math.sqrt(a.reduce((sum, x) => sum + x * x, 0) / a.length);

test('four independently specified cameras recover hidden references without a placeholder calibration', () => {
  const failures = [];
  for (const camera of CAMERAS) {
    const c = unreferenced({camera}), before = clone(c.notebook);
    const p = proposePlanePathReference(c.notebook, c.declaration);
    assert.equal(p.status, 'candidate');
    assert.ok(distance(p.pivot, project(camera, {x: 0, y: 0})) < 1e-8);
    assert.ok(p.maximumResidualPixels < 1e-8);
    assert.equal(p.projectedPath.length, 129);
    const baseline = proposePathReference(c.notebook, {maxResidualPixels: 100});
    if (baseline.comparison.circle?.center) failures.push(distance(baseline.comparison.circle.center, project(camera, {x: 0, y: 0})));
    const accepted = applyPlanePathReference(c.notebook, c.declaration, p, {pixelSigma: .3});
    assert.equal(accepted.schema, 'worldlaw.motion-notebook/v3');
    assert.equal(accepted.revisions.at(-1).method, PLANE_PATH_REFERENCE_METHOD);
    assert.deepEqual(accepted.measurements, before.measurements);
    assert.deepEqual(c.notebook, before);
    const angles = deriveAngles(accepted).samples.map(row => row.position);
    assert.ok(rms(angles.map((x, i) => x - c.truth[i])) < 1e-9);
  }
  assert.equal(failures.length, 4);
  assert.ok(Math.min(...failures) > 25);
});

test('independently seeded original-pixel perturbations retain their residuals', () => {
  for (let i = 0; i < CAMERAS.length; i++) {
    const c = unreferenced({camera: CAMERAS[i]});
    let seed = 817 + i;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    for (const row of c.notebook.measurements) {
      row.point.x += .3 * (2 * random() - 1);
      row.point.y += .3 * (2 * random() - 1);
    }
    const p = proposePlanePathReference(c.notebook, c.declaration);
    assert.equal(p.status, 'candidate');
    assert.ok(distance(p.pivot, project(c.camera, {x: 0, y: 0})) < .3);
    assert.ok(p.maximumResidualPixels > .1 && p.maximumResidualPixels < .7);
    assert.equal(proposePlanePathReference(c.notebook, c.declaration, {maxResidualPixels: .05}).reason,
      'radial_discrepancy_exceeds_declaration');
  }
});

test('common units and rigid plane-axis changes preserve the inferred source point', () => {
  const c = unreferenced(), original = proposePlanePathReference(c.notebook, c.declaration);
  for (const scale of [.001, 1, 1000]) for (const angle of [0, .71, -1.2]) {
    const d = clone(c.declaration);
    d.coordinateUnit = 'declared transformed unit';
    d.pairs.forEach(p => {
      const {x, y} = p.plane;
      p.plane = {x: scale * (Math.cos(angle) * x - Math.sin(angle) * y + 2),
        y: scale * (Math.sin(angle) * x + Math.cos(angle) * y - 1)};
    });
    const p = proposePlanePathReference(c.notebook, d);
    assert.equal(p.status, original.status);
    assert.ok(distance(p.pivot, original.pivot) < 1e-7);
    assert.deepEqual(p.trainingSourceIndices, original.trainingSourceIndices);
    assert.deepEqual(p.checkSourceIndices, original.checkSourceIndices);
    assert.ok(Math.abs(p.normalization.scale * scale - original.normalization.scale) < 1e-6);
  }
});

test('short, straight and translating-center courses remain noncandidates', () => {
  const short = unreferenced({amplitude: .1});
  assert.equal(proposePlanePathReference(short.notebook, short.declaration).reason, 'short_arc');
  const linear = unreferenced();
  linear.notebook.measurements.forEach((row, i) => { row.point = project(linear.camera, {x: -.6 + 1.2 * i / 80, y: .8}); });
  assert.equal(proposePlanePathReference(linear.notebook, linear.declaration).reason, 'linear_path');
  const moving = unreferenced({moving: true});
  assert.equal(proposePlanePathReference(moving.notebook, moving.declaration).status, 'unresolved');
  const few = unreferenced(); few.notebook.measurements.length = 7;
  assert.equal(proposePlanePathReference(few.notebook, few.declaration).reason, 'insufficient_points');
});

test('gate-boundary noisy evidence is invariant to plane axes and reference-pair ordering', () => {
  const c = unreferenced(); let seed = 817;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const row of c.notebook.measurements) {
    row.point.x += 13.2 * (2 * random() - 1); row.point.y += 13.2 * (2 * random() - 1);
  }
  const original = proposePlanePathReference(c.notebook, c.declaration, {maxResidualPixels: 100});
  for (const order of [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0]]) for (const angle of [0, 1.2, -2.1]) {
    const d = clone(c.declaration);
    d.pairs = order.map(i => d.pairs[i]);
    for (const pair of d.pairs) { const {x, y} = pair.plane;
      pair.plane = {x: Math.cos(angle) * x - Math.sin(angle) * y, y: Math.sin(angle) * x + Math.cos(angle) * y}; }
    const p = proposePlanePathReference(c.notebook, d, {maxResidualPixels: 100});
    assert.equal(p.status, original.status); assert.equal(p.reason, original.reason);
    assert.ok(Math.abs(p.comparison.circle.validationRmse - original.comparison.circle.validationRmse) < 1e-7);
    if (p.status === 'candidate') assert.ok(distance(p.pivot, original.pivot) < 1e-7);
  }
});

test('a wrong metric aspect ratio can retain low residuals and a wrong reference', () => {
  const c = unreferenced(), d = clone(c.declaration);
  d.pairs.forEach(p => { p.plane.x *= 1.1; });
  const p = proposePlanePathReference(c.notebook, d);
  assert.equal(p.status, 'candidate');
  assert.ok(p.maximumResidualPixels < .3);
  assert.ok(distance(p.pivot, project(c.camera, {x: 0, y: 0})) > 20);
  // This non-win prevents interpreting an admitted circle as calibration proof.
  const accepted = applyPlanePathReference(c.notebook, d, p);
  assert.ok(rms(deriveAngles(accepted).samples.map((r, i) => r.position - c.truth[i])) > .03);
});

test('one selected original continuous course is fitted without bridging missing rows', () => {
  const c = unreferenced();
  c.notebook.measurements[40] = {...c.notebook.measurements[40], status: 'missing', point: null};
  assert.throws(() => proposePlanePathReference(c.notebook, c.declaration), /Choose one continuous/);
  const p = proposePlanePathReference(c.notebook, c.declaration, {courseId: 0});
  assert.ok(p.course.sourceIndices.every(i => i < 40));
  assert.ok(p.trainingSourceIndices.every(i => i < 40));
  assert.ok(p.checkSourceIndices.every(i => i < 40));
  assert.equal(c.notebook.measurements[40].point, null);
});

test('acceptance recomputes original data and refuses stale source or plane declarations', () => {
  const c = unreferenced(), p = proposePlanePathReference(c.notebook, c.declaration);
  const poison = {...clone(p), pivot: {x: 12, y: 13}, planeCircle: {center: {x: 0, y: 0}, radius: 999}};
  const accepted = applyPlanePathReference(c.notebook, c.declaration, poison);
  assert.ok(distance(accepted.calibration.pivot, p.pivot) < 1e-10);
  const changed = clone(c.notebook); changed.measurements[0].point.x += 1;
  assert.throws(() => applyPlanePathReference(changed, c.declaration, p), /changed/);
  const declaration = clone(c.declaration); declaration.basis += ' revised';
  assert.throws(() => applyPlanePathReference(c.notebook, declaration, p), /changed/);
  declaration.source.sha256 = 'f'.repeat(64);
  assert.throws(() => proposePlanePathReference(c.notebook, declaration), /different source/);
  const tracked = course({moving: true});
  assert.throws(() => proposePlanePathReference(tracked.notebook, tracked.declaration), /tracked pivot/);
});

test('save/reopen retains original conditioning and recomputes angles instead of cached results', () => {
  const c = unreferenced(), p = proposePlanePathReference(c.notebook, c.declaration);
  const accepted = applyPlanePathReference(c.notebook, c.declaration, p, {pixelSigma: .5});
  const original = deriveAngles(accepted);
  const saved = JSON.parse(JSON.stringify({...accepted, derived: {samples: [{position: 1000}]}}));
  const reopened = validateNotebook(saved), angles = deriveAngles(reopened);
  assert.deepEqual(angles, original);
  assert.ok(angles.diagnostics.warnings.includes('fixed_reference_fitted_from_same_marker_observations'));
  const exported = exportAngular(reopened);
  assert.equal(exported.source.metadata.originalSource.sha256, c.notebook.source.sha256);
  assert.equal(exported.source.metadata.referenceHistory.at(-1).method, PLANE_PATH_REFERENCE_METHOD);
  assert.equal(exported.source.metadata.referenceHistory.at(-1).sourceObservations.length, c.notebook.measurements.length);
});
