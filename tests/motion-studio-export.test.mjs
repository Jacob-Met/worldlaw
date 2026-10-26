import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNotebook, calibrateNotebook, calibratePlaneNotebook, validateNotebook, exportAngular, exportStudio} from '../src/motion/measurement.mjs';
import {deriveTorqueObservations, splitTrajectoryEvidence} from '../src/science/trajectory-observations.mjs';
import {prepareStudioExport, replayStudioExport, verifyStudioExportSource, MOTION_STUDIO_SOURCE_SCHEMA, MAX_STUDIO_EXPORT_BYTES} from '../src/motion/studio-export.mjs';
import {serializeMotionNotebook} from '../src/motion/notebook-output.mjs';
import {parseObservationText, validateDataset} from '../src/data.mjs';

const options = {inertia: 1, command: 0, confirmKnownDynamics: true};
const clone = value => JSON.parse(JSON.stringify(value));
const hash = text => createHash('sha256').update(text).digest('hex');
// Authored points and tracker-shaped diagnostics; no acquired video is claimed.
function fixture(count = 100) {
  const point = time => { const angle = .4 * Math.cos(2 * time);
    return {x: 320 + 200 * Math.sin(angle), y: 90 + 200 * Math.cos(angle)}; };
  const notebook = calibrateNotebook(createNotebook({source: {kind: 'synthetic',
    label: 'Authored Motion export boundary', width: 640, height: 400, duration: 200,
    metadata: {provenance: 'Authored analytic points and diagnostic shapes; no video acquisition.'}}}),
  {pivot: {x: 320, y: 90}, maxGapSeconds: .08});
  notebook.measurements = Array.from({length: count}, (_, i) => ({time: i * .05,
    requestedTime: i * .05, timeBasis: 'synthetic-time', status: 'accepted', point: point(i * .05),
    quality: {score: .99, runnerUpScore: .75, ambiguityMargin: .24, textureStd: 40, searchClipped: false},
    tracker: {version: 'worldlaw.patch-ncc/v1', patchRadius: 12, searchRadius: 24, anchorTime: 0, anchorPoint: point(0)}}));
  return validateNotebook(notebook);
}

test('short legacy export stays synchronous and complete; compact handoff preserves exact scalar inputs', async () => {
  const notebook = fixture(), before = clone(notebook), legacy = exportStudio(notebook, options);
  assert.equal(typeof legacy.then, 'undefined');
  assert.deepEqual(legacy.source.metadata.measurements, notebook.measurements);
  assert.deepEqual(legacy.source.metadata.originalSource, notebook.source);
  const prepared = await prepareStudioExport(notebook, options), metadata = prepared.dataset.source.metadata;
  assert.equal(metadata.schema, MOTION_STUDIO_SOURCE_SCHEMA);
  assert.deepEqual(prepared.dataset.observations, legacy.observations);
  assert.deepEqual(prepared.dataset.heldOut, legacy.heldOut);
  assert.deepEqual(metadata.derivation.settings, legacy.source.metadata.derivation.settings);
  assert.deepEqual(metadata.derivation.split, legacy.source.metadata.derivation.split);
  assert.deepEqual(metadata.angularSamples.rows, exportAngular(notebook).samples.map(({time, position}) => [time, position]));
  assert.equal(prepared.notebookText, serializeMotionNotebook(notebook));
  assert.equal(prepared.notebookIdentity.sha256, hash(prepared.notebookText));
  assert.equal(prepared.notebookIdentity.byteLength, Buffer.byteLength(prepared.notebookText));
  assert.deepEqual(parseObservationText(prepared.text), prepared.dataset);
  assert.deepEqual(replayStudioExport(prepared.dataset).observations, legacy.observations);
  assert.match((await verifyStudioExportSource(prepared.dataset, prepared.notebookText)).qualification, /have not been verified/);
  assert.deepEqual(notebook, before);
});

for (const count of [1000, 4000]) test(`${count} original measurements reach Studio within unchanged limits and replay exactly`, async () => {
  const notebook = fixture(count), original = JSON.stringify(notebook);
  assert.throws(() => exportStudio(notebook, options), /Source metadata must be smaller than 250 KB/);
  const prepared = await prepareStudioExport(notebook, options), metadata = prepared.dataset.source.metadata;
  assert.equal(metadata.angularSamples.rows.length, count);
  assert.deepEqual(metadata.measurementRange, {start: 0, count});
  assert.ok(JSON.stringify(metadata).length <= 250_000);
  assert.ok(prepared.text.length <= 2_000_000);
  assert.ok(Buffer.byteLength(prepared.text) <= MAX_STUDIO_EXPORT_BYTES);
  const parsed = parseObservationText(prepared.text), replayed = replayStudioExport(parsed);
  assert.deepEqual(replayed.observations, parsed.observations);
  assert.deepEqual(replayed.heldOut, parsed.heldOut);
  await verifyStudioExportSource(parsed, prepared.notebookText);
  assert.equal(JSON.stringify(notebook), original);
});

test('later course retains original range, exact derivative windows and explicit noise override', async () => {
  const notebook = fixture(160);
  notebook.measurements[50] = {time: 2.5, status: 'missing', point: null, timeBasis: 'synthetic-time'};
  await assert.rejects(prepareStudioExport(notebook, options), /Select one continuous segment explicitly/);
  const prepared = await prepareStudioExport(notebook, {...options, segmentId: 1, positionSigma: .003});
  const metadata = prepared.dataset.source.metadata;
  assert.deepEqual(metadata.measurementRange, {start: 51, count: 109});
  assert.equal(metadata.excludedCourseCount, 1);
  assert.deepEqual(metadata.noise, {value: .003, origin: 'caller_override'});
  const angular = exportAngular(notebook, {segmentId: 1, command: 0});
  const independentlyDerived = splitTrajectoryEvidence(deriveTorqueObservations(angular.samples,
    {inertia: 1, positionSigma: .003, windowSize: 7}), {trainingFraction: .7});
  assert.deepEqual(prepared.dataset.observations, independentlyDerived.observations);
  assert.deepEqual(prepared.dataset.heldOut, independentlyDerived.heldOut);
  assert.deepEqual(metadata.derivation.split, independentlyDerived.split);
  await verifyStudioExportSource(prepared.dataset, prepared.notebookText);
});

test('metric-plane calibration and its angular interpretation survive source receiving', async () => {
  let notebook = fixture(); notebook.source.sha256 = 'a'.repeat(64);
  const corners = [{x: 0, y: 0}, {x: 639, y: 0}, {x: 639, y: 399}, {x: 0, y: 399}];
  notebook = calibratePlaneNotebook(notebook, {schema: 'worldlaw.metric-plane/v1',
    source: {sha256: notebook.source.sha256, width: 640, height: 400}, referenceTime: 0,
    coordinateUnit: 'authored-length', basis: 'Authored anisotropic mapping for software receiving only.',
    assumptions: {samePlane: true, fixedCamera: true, metricCoordinates: true, negligibleLensDistortion: true},
    pairs: corners.map(image => ({image, plane: {x: image.x / 100, y: image.y / 50}}))});
  const prepared = await prepareStudioExport(notebook, options);
  assert.deepEqual(prepared.dataset.source.metadata.calibration, notebook.calibration);
  assert.deepEqual(prepared.dataset.source.metadata.angularSamples.rows,
    exportAngular(notebook).samples.map(({time, position}) => [time, position]));
  await verifyStudioExportSource(prepared.dataset, prepared.notebookText);
});

test('verbose upstream evidence remains in the exact snapshot with reference conditioning retained', async () => {
  const notebook = fixture(1000);
  notebook.source.metadata.notes = 'Original source qualification. '.repeat(5000);
  notebook.revisions.push({type: 'path-reference', method: 'authored-reference-control',
    pivot: notebook.calibration.pivot, maximumResidualPixels: .2,
    sourceObservations: notebook.measurements.map(({time, point}) => ({time, point})),
    interpretation: 'Authored reference-history receiving control only.'});
  const prepared = await prepareStudioExport(notebook, options), metadata = prepared.dataset.source.metadata;
  assert.equal(metadata.reference.pathFitEventCount, 1);
  assert.equal(metadata.reference.conditioning.fitPrecedesDownstreamSplit, true);
  assert.equal(metadata.reference.activePathFit.originalObservationCount, 1000);
  assert.match(metadata.retention, /not embedded/);
  assert.equal(metadata.measurements, undefined);
  assert.equal(metadata.originalSource.metadata, undefined);
  assert.equal(metadata.reference.eventsSha256, hash(JSON.stringify(notebook.revisions)));
  assert.deepEqual(JSON.parse(prepared.notebookText), validateNotebook(notebook));
  await verifyStudioExportSource(prepared.dataset, prepared.notebookText);
  const changed = clone(notebook); changed.measurements[20].quality.score = .1;
  const another = await prepareStudioExport(changed, options);
  assert.notEqual(another.notebookIdentity.sha256, prepared.notebookIdentity.sha256);
  assert.deepEqual(another.dataset.observations, prepared.dataset.observations);
});

test('preparation captures a validated snapshot and dynamics before asynchronous hashing', async () => {
  const notebook = fixture(), supplied = {...options}, expected = serializeMotionNotebook(notebook);
  const pending = prepareStudioExport(notebook, supplied);
  notebook.measurements[10].point.x += 10; supplied.command = 3;
  const prepared = await pending;
  assert.equal(prepared.notebookText, expected);
  assert.equal(prepared.dataset.source.metadata.dynamics.command, 0);
  await verifyStudioExportSource(prepared.dataset, expected);
});

test('internal replay detects altered angles, output rows, splits and malformed lineage', async () => {
  const prepared = await prepareStudioExport(fixture(), options);
  for (const change of [
    value => { value.source.metadata.angularSamples.rows[5][1] += .02; },
    value => { value.observations[0].jointTorque += 1; },
    value => { value.heldOut[0].rate += 1; },
    value => { value.source.metadata.derivation.split.rawSourceCut++; },
    value => { value.source.metadata.measurementRange.count--; },
    value => { value.source.metadata.angularSamples.units.position = 'deg'; },
    value => { value.source.metadata.clockCounts['synthetic-time']--; }
  ]) {
    const altered = clone(prepared.dataset); change(altered);
    assert.throws(() => replayStudioExport(altered), /Motion Studio/);
  }
  const wrong = JSON.parse(prepared.notebookText); wrong.measurements[5].point.x += .01;
  await assert.rejects(verifyStudioExportSource(prepared.dataset, serializeMotionNotebook(wrong)), /byte length|SHA-256/);
  const changedCalibration = clone(prepared.dataset); changedCalibration.source.metadata.calibration.zeroAngle = .1;
  // Table-only receiving cannot authenticate upstream calibration: full-source receiving must detect it.
  replayStudioExport(changedCalibration);
  await assert.rejects(verifyStudioExportSource(changedCalibration, prepared.notebookText), /source snapshot replay/);
});

test('original clock, tracked-pivot, confirmation and derivative guards remain effective', async () => {
  const nominal = fixture(); nominal.source.kind = 'local-video'; nominal.source.sha256 = 'b'.repeat(64);
  nominal.measurements.forEach(row => { row.timeBasis = 'requested-seek-time'; });
  const tracked = calibrateNotebook(fixture(), {...fixture().calibration, pivotMode: 'tracked'});
  tracked.measurements.forEach(row => { row.pivotMeasurement = {status: 'manual', point: {...tracked.calibration.pivot}}; });
  for (const [input, settings, pattern] of [
    [nominal, options, /decoded media timestamps/],
    [tracked, options, /Tracked-pivot evidence/],
    [fixture(), {...options, confirmKnownDynamics: false}, /Confirm that/],
    [fixture(), {...options, inertia: 0}, /Known constant inertia/],
    [fixture(), {...options, command: NaN}, /Explicit applied torque/],
    [fixture(10), options, /segment is too short/]
  ]) {
    assert.throws(() => exportStudio(input, settings), pattern);
    await assert.rejects(prepareStudioExport(input, settings), pattern);
  }
  const unchanged = await prepareStudioExport(fixture(), options);
  const oversized = clone(unchanged.dataset); oversized.source.metadata.unrelated = 'x'.repeat(250_001);
  assert.throws(() => validateDataset(oversized), /Source metadata must be smaller than 250 KB/);
});
