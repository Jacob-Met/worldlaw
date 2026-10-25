import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {calibrateNotebook, calibratePlaneNotebook, validateNotebook, deriveAngles, exportAngular,
  exportStudio, MOTION_SCHEMA, MOTION_TRACKED_SCHEMA, MOTION_PLANE_SCHEMA} from '../src/motion/measurement.mjs';
import {admitMetricPlane, metricPair, metricPlaneTemplate} from '../src/motion/metric-plane.mjs';
import {proposePathReference} from '../src/motion/path-reference.mjs';
import {inspectMotionRecording, createMotionAngularBundle} from '../src/trajectory/motion-intake.mjs';
import {createChallenge, exportChallenge, restoreChallenge} from '../src/trajectory/session.mjs';
import {CAMERAS, course, project} from './helpers/metric-plane-course.mjs';

const rms = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
const error = (result, truth) => rms(result.samples.map((row, i) => row.position - truth[i]));
const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

test('four different known cameras remove projective angle distortion without altering source pixels', () => {
  for (const camera of CAMERAS) for (const moving of [false, true]) {
    const {notebook, declaration, truth} = course({camera, moving});
    const frozen = JSON.stringify(notebook), before = deriveAngles(notebook);
    const rectified = calibratePlaneNotebook(notebook, declaration), after = deriveAngles(rectified);
    assert.ok(error(before, truth) > .04, 'unchanged image interpretation must expose this camera');
    assert.ok(error(after, truth) < 1e-12);
    assert.equal(after.segments.length, 1);
    assert.ok(Math.abs(after.diagnostics.radiusRatio - 1) < 1e-12);
    assert.deepEqual(rectified.measurements, notebook.measurements);
    assert.equal(JSON.stringify(notebook), frozen);
    assert.equal(rectified.schema, MOTION_PLANE_SCHEMA);
    assert.equal(after.diagnostics.metricPlane.radiusUnit, 'm');
  }
});

test('a uniform length-unit change preserves angles and their pixel-error propagation', () => {
  const {notebook, declaration} = course({noise: .2, moving: true});
  const meters = deriveAngles(calibratePlaneNotebook(notebook, declaration));
  const cm = structuredClone(declaration); cm.coordinateUnit = 'cm';
  for (const pair of cm.pairs) { pair.plane.x *= 100; pair.plane.y *= 100; }
  const changed = deriveAngles(calibratePlaneNotebook(notebook, cm));
  changed.samples.forEach((sample, i) => {
    assert.ok(Math.abs(sample.position - meters.samples[i].position) < 1e-12);
    assert.ok(Math.abs(sample.positionSigma - meters.samples[i].positionSigma) < 1e-12);
  });
  const reference = calibrateNotebook(calibratePlaneNotebook(notebook, cm), {
    ...calibratePlaneNotebook(notebook, cm).calibration, zeroAngle: .23, direction: -1});
  deriveAngles(reference).samples.forEach((row, i) => assert.ok(Math.abs(row.position - (.23 - meters.samples[i].position)) < 1e-12));
});

test('Jacobian angle-noise propagation agrees with independent central pixel perturbations', () => {
  const {notebook, declaration} = course({moving: true, noise: .3});
  const plane = admitMetricPlane(declaration, notebook.source), row = notebook.measurements[27];
  const h = 1e-3, angle = (marker, pivot) => metricPair(plane, marker, pivot, 0).rawAngle;
  const sensitivity = (which, axis) => {
    const marker = {...row.point}, pivot = {...row.pivotMeasurement.point};
    const point = which === 'marker' ? marker : pivot;
    point[axis] += h; const high = angle(marker, pivot);
    point[axis] -= 2 * h; const low = angle(marker, pivot);
    return wrapped(high - low) / (2 * h);
  };
  const numeric = Math.hypot(.3 * sensitivity('marker', 'x'), .3 * sensitivity('marker', 'y'),
    .6 * sensitivity('pivot', 'x'), .6 * sensitivity('pivot', 'y'));
  const actual = deriveAngles(calibratePlaneNotebook(notebook, declaration)).samples[27].positionSigma;
  assert.ok(Math.abs(actual - numeric) < 1e-10, JSON.stringify({actual, numeric}));
});

test('an incorrect metric aspect ratio fits its four references yet remains an incorrect angle model', () => {
  const {notebook, declaration, truth} = course();
  declaration.pairs.forEach(pair => { pair.plane.x *= 1.6; });
  const accepted = admitMetricPlane(declaration, notebook.source);
  assert.ok(accepted.referenceResidual.maximum < 1e-12);
  const result = deriveAngles(calibratePlaneNotebook(notebook, declaration));
  assert.ok(error(result, truth) > .1);
  assert.match(result.diagnostics.metricPlane.qualification, /do not independently verify/);
  assert.ok(result.diagnostics.warnings.includes('metric_plane_is_caller_declared'));
});

test('gaps and missing same-frame pivots remain gaps; exports require a retained course', () => {
  const {notebook, declaration} = course({moving: true});
  notebook.measurements[20].pivotMeasurement = {status: 'lost', point: null, candidatePoint: {x: 200, y: 100}};
  notebook.measurements[40] = {...notebook.measurements[40], status: 'missing', point: null};
  const next = calibratePlaneNotebook(notebook, declaration), result = deriveAngles(next);
  assert.equal(result.samples[20].position, null); assert.equal(result.samples[40].position, null);
  assert.equal(result.segments.length, 3);
  assert.throws(() => exportAngular(next), /Select one continuous segment/);
  const output = exportAngular(next, {segmentId: 1});
  assert.equal(output.samples.length, 19);
  assert.deepEqual(output.source.metadata.calibration.plane, declaration);
  assert.equal(output.source.metadata.excludedSegments.length, 2);
  assert.throws(() => exportStudio(next, {segmentId: 1, inertia: .8, command: 0, confirmKnownDynamics: true}), /Tracked-pivot/);
});

test('source identity, assumptions, incomplete templates and unsupported old schemas fail before mutation', () => {
  const {notebook, declaration} = course(), original = JSON.stringify(notebook);
  const bad = [];
  for (const key of ['samePlane', 'fixedCamera', 'metricCoordinates', 'negligibleLensDistortion']) {
    const item = structuredClone(declaration); item.assumptions[key] = false; bad.push(item);
  }
  const wrongSource = structuredClone(declaration); wrongSource.source.sha256 = 'b'.repeat(64); bad.push(wrongSource);
  const wrongRaster = structuredClone(declaration); wrongRaster.source.width++; bad.push(wrongRaster);
  const missing = structuredClone(declaration); missing.pairs.pop(); bad.push(missing);
  const offRaster = structuredClone(declaration); offRaster.pairs[0].image.x = -1; bad.push(offRaster);
  const late = structuredClone(declaration); late.referenceTime = 5; bad.push(late);
  bad.push(metricPlaneTemplate(notebook.source));
  for (const candidate of bad) assert.throws(() => calibratePlaneNotebook(notebook, candidate));
  assert.equal(JSON.stringify(notebook), original);
  const next = calibratePlaneNotebook(notebook, declaration);
  for (const schema of [MOTION_SCHEMA, MOTION_TRACKED_SCHEMA])
    assert.throws(() => validateNotebook({...next, schema}), /v3 motion notebook/);
});

test('singular references and a projective horizon through the raster are refused', () => {
  const {notebook, declaration} = course();
  const collapsed = structuredClone(declaration); collapsed.pairs.forEach(pair => { pair.plane.y = 1; });
  assert.throws(() => calibratePlaneNotebook(notebook, collapsed), /Degenerate|Singular/);
  const horizon = structuredClone(declaration), inverse = [1, 0, 0, 0, 1, 0, .01, 0, -2];
  horizon.pairs = [{x: 50, y: 30}, {x: 450, y: 30}, {x: 450, y: 300}, {x: 50, y: 300}]
    .map(image => ({image, plane: project(inverse, image)}));
  assert.throws(() => calibratePlaneNotebook(notebook, horizon), /horizon/);
});

test('reopen recomputes from raw declarations and removal retains the calibration history', () => {
  const {notebook, declaration} = course();
  const next = calibratePlaneNotebook(notebook, declaration), serialized = JSON.stringify(next);
  const altered = JSON.parse(serialized); altered.calibration.plane.matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const read = validateNotebook(altered);
  assert.deepEqual(deriveAngles(read), deriveAngles(next));
  assert.equal(Object.hasOwn(read.calibration.plane, 'matrix'), false);
  assert.throws(() => proposePathReference(next), /does not correct perspective/);
  const restored = calibratePlaneNotebook(read, null);
  assert.deepEqual(deriveAngles(restored), deriveAngles(notebook));
  assert.ok(restored.revisions.some(event => event.value?.plane?.schema === declaration.schema));
  assert.equal(JSON.stringify(next), serialized);
});

test('plane-corrected recordings reach the maintained law consumer, source lineage and input-only reopen', async () => {
  const one = course({duration: 8, count: 161}), two = course({camera: CAMERAS[1], sha: 'b', amplitude: 1.05, duration: 8, count: 161});
  const prepared = [one, two].map(c => calibratePlaneNotebook(c.notebook, c.declaration));
  const make = nb => ({input: JSON.stringify(nb), kind: 'synthetic', initialRate: -.08 * (nb === prepared[0] ? .75 : 1.05),
    initialRateBasis: 'Known independently authored oscillator initial derivative.'});
  const bundle = await createMotionAngularBundle({training: make(prepared[0]), challenge: make(prepared[1]),
    assumptions: {unforcedScalarRotation: true, sharedAngleFrame: true, basis: 'Known authored metric coordinates and oscillator dynamics; distinct source fixtures.'}});
  assert.equal(bundle.trainingRuns[0].source.motion.notebookSchema, MOTION_PLANE_SCHEMA);
  assert.deepEqual(bundle.trainingRuns[0].source.motion.calibration.plane, one.declaration);
  assert.deepEqual(bundle.trainingRuns[0].samples.map(row => row.position), exportAngular(prepared[0]).samples.map(row => row.position));
  const result = createChallenge(bundle, {noiseSigma: .001, maxTerms: 3});
  assert.ok(result.summary.selectedPositionRMSE < .02, JSON.stringify(result.summary));
  const reopened = restoreChallenge(exportChallenge(result));
  assert.deepEqual(reopened.bundle, bundle); assert.deepEqual(reopened.results, result.results);
  await assert.rejects(inspectMotionRecording(JSON.stringify(calibratePlaneNotebook(course({moving: true}).notebook, one.declaration))), /fixed image reference/);
});

test('the reused maintained homography remains byte-identical to its source owner', () => {
  const bytes = readFileSync(new URL('../src/motion/vendor/plane-homography.mjs', import.meta.url));
  const sha = createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex');
  assert.equal(sha, '5f9ee62ce8e1511c882774303511a7850b535f65');
});
