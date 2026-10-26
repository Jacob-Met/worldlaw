import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNotebook, calibrateNotebook, validateNotebook, exportAngular} from '../src/motion/measurement.mjs';
import {inspectMotionRecording, previewMotionStart, createMotionAngularBundle, MOTION_PREFIX_START_SCHEMA} from '../src/trajectory/motion-intake.mjs';
import {estimateAngularPrelude} from '../src/science/angular-prelude.mjs';
import {createChallenge, exportChallenge, restoreChallenge} from '../src/trajectory/session.mjs';
import {rolloutAngularWithResolution} from '../src/trajectory/angular-resolution.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => JSON.stringify(value);
const point = (angle, radius = 200) => ({x: 320 + radius * Math.sin(angle), y: 80 + radius * Math.cos(angle)});
const assumptions = {unforcedScalarRotation: true, sharedAngleFrame: true,
  basis: 'Authored analytic software fixture with one exact shared fixed reference; not a physical recording.'};
const start = {mode: 'source-prefix', originSampleIndex: 30, windowSize: 17};
const fitting = {method: 'weak', windowDuration: .4, windowStride: .2, noiseSigma: .00001,
  maxTerms: 2, modelLimit: 1, maxStep: .01};

function recording(name, A, B, count = 201) {
  const source = {name, A, B, count, meaning: 'Authored analytic point source, not video bytes.'};
  const notebook = calibrateNotebook(createNotebook({source: {kind: 'synthetic', label: name,
    width: 640, height: 480, duration: (count - 1) * .02, sha256: hash(source), metadata: source}}),
  {pivot: {x: 320, y: 80}, maxGapSeconds: .04, pixelSigma: 1});
  notebook.measurements = Array.from({length: count}, (_, i) => {
    const time = i * .02, angle = Math.exp(-.12 * time) * (A * Math.cos(2 * time) + B * Math.sin(2 * time));
    return {time, timeBasis: 'synthetic-time', status: 'manual', point: point(angle), reason: 'Authored exact-coordinate fixture.'};
  });
  return validateNotebook(notebook);
}
const pair = () => ({training: recording('authored-training', .95, .4), challenge: recording('authored-challenge', -.65, .8)});
const declaration = (notebook, extra = {}) => ({input: text(notebook), segmentId: 0, kind: 'synthetic', ...extra});
const preparedPair = (input, trainingStart = start, challengeStart = start) => createMotionAngularBundle({
  training: declaration(input.training, {start: trainingStart}), challenge: declaration(input.challenge, {start: challengeStart}), assumptions});

test('supplied-rate default preserves original complete course and exact legacy rate declaration', async () => {
  const input = pair();
  const bundle = await createMotionAngularBundle({training: declaration(input.training, {initialRate: .686, initialRateBasis: 'Authored oracle training start.'}),
    challenge: declaration(input.challenge, {initialRate: 1.678, initialRateBasis: 'Authored oracle challenge start.'}), assumptions});
  const run = bundle.trainingRuns[0], angular = exportAngular(input.training);
  assert.deepEqual(run.samples, angular.samples.map(({time, position}) => ({time, position})));
  assert.deepEqual(run.source.motion.observationIndices, angular.source.metadata.measurementIndices);
  assert.deepEqual(run.source.motion.initialRate, {value: .686, unit: 'rad/s', basis: 'Authored oracle training start.',
    qualification: 'Caller supplied; not inferred from future challenge positions or authenticated by the application.'});
  assert.equal(run.source.motion.initialRate.preparation, undefined);
});

test('maximum-size ordinary Motion courses retain source-prefix provenance within angular source limits', async () => {
  const input = {training: recording('long-authored-training', .95, .4, 4000),
    challenge: recording('long-authored-challenge', -.65, .8, 4000)};
  const bundle = await preparedPair(input);
  for (const run of [...bundle.trainingRuns, ...bundle.challengeRuns]) {
    assert.equal(run.samples.length, 3970);
    assert.equal(run.source.motion.selectedCourse.count, 4000);
    assert.equal(run.source.motion.observationIndices.length, 3970);
    assert.ok(JSON.stringify(run.source).length <= 32_000);
  }
});

test('explicit original window supplies adopted rate without changing its measured origin or later samples', async () => {
  const input = pair(), inspection = await inspectMotionRecording(text(input.challenge));
  const preview = previewMotionStart(inspection, {role: 'challenge', segmentId: 0, start});
  const angular = exportAngular(input.challenge), expectedWindow = angular.samples.slice(14, 31);
  const sigma = Math.max(...expectedWindow.map(row => row.positionSigma));
  const estimate = estimateAngularPrelude(expectedWindow, angular.samples[30], {windowSizes: [17], positionSigma: sigma});
  const bundle = await preparedPair(input), run = bundle.challengeRuns[0], p = run.source.motion.initialRate.preparation;
  assert.equal(p.schema, MOTION_PREFIX_START_SCHEMA);
  assert.equal(run.initialRate, preview.rate);
  assert.equal(run.source.motion.initialRate.value, estimate.estimates[0].rate);
  assert.deepEqual(p.prefixSamples, expectedWindow.map(({time, position, positionSigma}) => ({time, position, positionSigma})));
  assert.deepEqual(p.prefixSourceIndices, Array.from({length: 17}, (_, i) => i + 14));
  assert.deepEqual(p.origin, {courseSampleIndex: 30, measurementIndex: 30, time: angular.samples[30].time, position: angular.samples[30].position});
  assert.deepEqual(run.samples, angular.samples.slice(30).map(({time, position}) => ({time, position})));
  assert.deepEqual(run.source.motion.observationIndices, Array.from({length: 171}, (_, i) => i + 30));
  assert.equal(run.source.motion.selectedCourse.count, 201, 'The complete original selected course remains described.');
  assert.equal(p.omittedBeforeWindowCount, 14);
  assert.equal(p.omittedBeforeForecastCount, 30);
  assert.equal(p.noise.origin, 'maximum_motion_window_sigma');
  assert.equal(p.noise.positionSigma, sigma);
  assert.match(p.persistence, /does not re-estimate/);
});

test('future positions and future propagated noise cannot alter prefix estimate or a frozen forecast', async () => {
  const input = pair(), original = await preparedPair(input), frozen = createChallenge(original, fitting).discovery.selected;
  const changed = clone(input);
  const angles = exportAngular(input.challenge).samples;
  for (let i = 31; i < changed.challenge.measurements.length; i++)
    changed.challenge.measurements[i].point = point(angles[i].position + .35 + .03 * Math.sin(i), 25);
  changed.challenge.source.sha256 = hash(changed.challenge.measurements);
  const altered = await preparedPair(changed), first = original.challengeRuns[0], second = altered.challengeRuns[0];
  assert.deepEqual(second.source.motion.initialRate.preparation, first.source.motion.initialRate.preparation);
  assert.equal(second.initialRate, first.initialRate);
  assert.ok(second.samples.slice(1).every((row, i) => row.position !== first.samples[i + 1].position));
  const before = rolloutAngularWithResolution(frozen, first, {maxStep: .01});
  const after = rolloutAngularWithResolution(frozen, second, {maxStep: .01});
  const forecast = result => result.rollout.rows.map(({time, predicted, rate}) => ({time, predicted, rate}));
  assert.deepEqual(forecast(after), forecast(before));
  assert.notEqual(after.rollout.metrics.positionRMSE, before.rollout.metrics.positionRMSE);
  assert.deepEqual(altered.trainingRuns, original.trainingRuns);
});

test('a later continuous course preserves original indices and never borrows across a gap', async () => {
  const input = pair();
  input.training.measurements[60] = {time: 1.2, status: 'missing', point: null, timeBasis: 'synthetic-time'};
  const inspection = await inspectMotionRecording(text(input.training));
  assert.throws(() => previewMotionStart(inspection, {role: 'training', segmentId: 1,
    start: {...start, originSampleIndex: 15}}), /complete trailing window/);
  const request = {...start, originSampleIndex: 20};
  const bundle = await createMotionAngularBundle({training: {...declaration(input.training, {start: request}), segmentId: 1},
    challenge: declaration(input.challenge, {start}), assumptions});
  const run = bundle.trainingRuns[0], p = run.source.motion.initialRate.preparation;
  assert.equal(run.source.motion.selectedCourse.startTime, 1.22);
  assert.equal(run.source.motion.selectedCourse.count, 140);
  assert.equal(p.origin.measurementIndex, 81);
  assert.deepEqual(p.prefixSourceIndices, Array.from({length: 17}, (_, i) => i + 65));
  assert.equal(run.source.motion.observationIndices[0], 81);
  assert.equal(run.source.motion.omittedCourseCount, 1);
});

test('preview is provisional and actual pair reparses bytes rather than trusting cached inspection', async () => {
  const input = pair(), originalText = text(input.training), inspection = await inspectMotionRecording(originalText);
  const originalPreview = previewMotionStart(inspection, {role: 'training', segmentId: 0, start});
  inspection.notebook.measurements[28].point.x += 1;
  const alteredPreview = previewMotionStart(inspection, {role: 'training', segmentId: 0, start});
  assert.notEqual(alteredPreview.rate, originalPreview.rate);
  const bundle = await createMotionAngularBundle({training: {input: originalText, segmentId: 0, kind: 'synthetic', start},
    challenge: declaration(input.challenge, {start}), assumptions});
  assert.equal(bundle.trainingRuns[0].initialRate, originalPreview.rate);
  assert.equal(text(input.training), originalText);
});

test('explicit noise choices and fitted-reference conditioning remain inspectable', async () => {
  const input = pair();
  input.challenge.revisions.push({type: 'path-reference', method: 'authored-full-course-reference',
    pivot: input.challenge.calibration.pivot, sourceObservations: input.challenge.measurements.map(({time, point}) => ({time, point}))});
  const overridden = await preparedPair(input, {...start, positionSigma: .004}, {...start, positionSigma: .003});
  const run = overridden.challengeRuns[0], p = run.source.motion.initialRate.preparation;
  assert.deepEqual(p.noise, {origin: 'caller_override', positionSigma: .003});
  assert.equal(run.source.motion.reference.pathFitEventCount, 1);
  assert.equal(run.source.motion.reference.conditioning.fitPrecedesDownstreamSplit, true);
  const residual = await preparedPair(input, {...start, positionSigma: null}, {...start, positionSigma: null});
  assert.equal(residual.challengeRuns[0].source.motion.initialRate.preparation.noise.origin, 'polynomial_residual_proxy');
  assert.equal(residual.challengeRuns[0].source.motion.initialRate.preparation.settings.positionSigma, null);
});

test('portable notebook keeps an explicitly adopted input and full reproducibility provenance', async () => {
  const bundle = await preparedPair(pair()), session = createChallenge(bundle, fitting);
  const reopened = restoreChallenge(exportChallenge(session));
  assert.deepEqual(reopened.bundle, session.bundle);
  assert.deepEqual(reopened.discovery, session.discovery);
  const run = reopened.bundle.challengeRuns[0], p = run.source.motion.initialRate.preparation;
  const independentlyReproduced = estimateAngularPrelude(p.prefixSamples, p.origin, p.settings);
  assert.equal(independentlyReproduced.estimates[0].rate, run.initialRate);
  assert.match(p.persistence, /reuses the saved scalar/);
  assert.match(p.persistence, /does not re-estimate/);
});

test('incomplete or conflicting requests and unsupported source assumptions are refused', async () => {
  const input = pair(), inspection = await inspectMotionRecording(text(input.training));
  for (const request of [
    {...start, originSampleIndex: undefined}, {...start, windowSize: undefined}, {...start, windowSize: 16},
    {...start, originSampleIndex: 15}, {...start, originSampleIndex: 185}, {...start, positionSigma: -1},
    {...start, mode: 'automatic'}, {...start, futureWindow: true}
  ]) assert.throws(() => previewMotionStart(inspection, {role: 'training', segmentId: 0, start: request}));
  assert.throws(() => previewMotionStart(inspection, {role: 'challenge', segmentId: 0,
    start: {...start, originSampleIndex: 200}}), /at least two/);
  await assert.rejects(createMotionAngularBundle({training: declaration(input.training, {start, initialRate: 0, initialRateBasis: 'Conflicting supplied input.'}),
    challenge: declaration(input.challenge, {start}), assumptions}), /not both/);
  const sameVideo = clone(input); sameVideo.challenge.source.sha256 = sameVideo.training.source.sha256;
  await assert.rejects(preparedPair(sameVideo), /shares a declared recording/);
  const nominal = clone(input); nominal.challenge.source.kind = 'local-video';
  nominal.challenge.measurements[20].timeBasis = 'requested-seek-time';
  await assert.rejects(preparedPair(nominal), /decoded media timestamps/);
  const moving = clone(input); moving.challenge = calibrateNotebook(moving.challenge, {...moving.challenge.calibration, pivotMode: 'tracked'});
  await assert.rejects(preparedPair(moving), /fixed image reference/);
});
