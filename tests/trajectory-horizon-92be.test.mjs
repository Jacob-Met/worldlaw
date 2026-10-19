import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePredictionHorizon, TrajectoryHorizonError } from '../src/trajectory/horizon.mjs';
import { rollout } from '../src/trajectory/forward.mjs';
import { discoverAngular, rolloutAngular } from '../src/trajectory/angular-discovery.mjs';

const source = (errors = [0, .02, -.1, .03], times = [10, 11, 14, 18]) => ({
  schema: 'worldlaw.trajectory-rollout/v1', modelId: 'test-model', runId: 'test-run',
  rows: errors.map((residual, index) => ({ time: times[index], observed: residual, predicted: 0, rate: 0, residual, command: 0 })),
});
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
const throwsCode = (callback, code) => assert.throws(callback,
  error => error instanceof TrajectoryHorizonError && error.code === code);

test('first sampled crossing uses absolute error and retains the actual irregular sampling bracket', () => {
  const result = summarizePredictionHorizon(source(), { positionTolerance: .05 });
  assert.equal(result.schema, 'worldlaw.trajectory-horizon/v1');
  assert.equal(result.status, 'threshold_exceeded');
  assert.equal(result.modelId, 'test-model');
  assert.equal(result.runId, 'test-run');
  assert.deepEqual(result.firstExceeded, { index: 2, time: 14, elapsed: 4, absoluteError: .1 });
  assert.deepEqual(result.previousSample, { index: 1, time: 11, elapsed: 1 });
  assert.deepEqual(result.lastWithin, { index: 3, time: 18, elapsed: 8, absoluteError: .03 });
  assert.equal(result.count, 3);
  assert.equal(result.withinCount, 2);
  assert.equal(result.exceededCount, 1);
  assert.equal(result.withinFraction, 2 / 3);
  assert.equal(result.initialSampleExcluded, true);
  assert.match(result.meaning, /no continuous-time crossing/);
});

test('positive and negative residuals are symmetric and equality is within tolerance', () => {
  const positive = summarizePredictionHorizon(source([0, .05, .051, .05]), { positionTolerance: .05 });
  const negative = summarizePredictionHorizon(source([0, -.05, -.051, -.05]), { positionTolerance: .05 });
  assert.deepEqual(negative, positive);
  assert.equal(positive.firstExceeded.index, 2);
  assert.equal(positive.withinCount, 2);
});

test('crossing at the first evaluated row uses t0 solely as a boundary and has no within sample', () => {
  const result = summarizePredictionHorizon(source([0, -.2, .3, -.4]), { positionTolerance: .05 });
  assert.deepEqual(result.firstExceeded, { index: 1, time: 11, elapsed: 1, absoluteError: .2 });
  assert.deepEqual(result.previousSample, { index: 0, time: 10, elapsed: 0 });
  assert.equal(result.lastWithin, null);
  assert.equal(result.count, 3);
  assert.equal(result.withinCount, 0);
  assert.equal(result.exceededCount, 3);
  assert.equal(result.withinFraction, 0);
});

test('no sampled crossing is explicitly limited to samples and excludes initialization from counts', () => {
  const result = summarizePredictionHorizon(source([0, .01, -.03, .05]), { positionTolerance: .05 });
  assert.equal(result.status, 'not_exceeded_at_samples');
  assert.equal(result.firstExceeded, null);
  assert.equal(result.previousSample, null);
  assert.equal(result.count, 3);
  assert.equal(result.withinCount, 3);
  assert.equal(result.exceededCount, 0);
  assert.equal(result.withinFraction, 1);
  assert.equal(result.lastWithin.index, 3);
  assert.ok(result.limitations.some(message => message.includes('between sampled timestamps')));
});

test('time shifts preserve elapsed crossing information without interpolating new timestamps', () => {
  const baseline = summarizePredictionHorizon(source(), { positionTolerance: .05 });
  const shifted = summarizePredictionHorizon(source(undefined, [1700000010, 1700000011, 1700000014, 1700000018]), { positionTolerance: .05 });
  assert.equal(shifted.firstExceeded.elapsed, baseline.firstExceeded.elapsed);
  assert.equal(shifted.previousSample.elapsed, baseline.previousSample.elapsed);
  assert.equal(shifted.firstExceeded.time, 1700000014);
});

test('a real free-running wrong-law result is directly consumable and tolerance changes do not alter it', () => {
  const run = {
    id: 'analytic-challenge', label: 'Independent cosine', kind: 'synthetic', inertia: 1, initialRate: 0,
    source: { label: 'Closed-form harmonic trajectory' },
    samples: [0, .25, .5, 1].map(time => ({ time, position: Math.cos(2 * time), command: 0 })),
  };
  const prediction = rollout({ schema: 'worldlaw.torque-model/v1', terms: [] }, run);
  const before = JSON.stringify(prediction);
  const strict = summarizePredictionHorizon(prediction, { positionTolerance: .05 });
  const loose = summarizePredictionHorizon(prediction, { positionTolerance: 2 });
  assert.equal(strict.firstExceeded.index, 1);
  assert.equal(loose.status, 'not_exceeded_at_samples');
  assert.equal(JSON.stringify(prediction), before);
});

test('angular acceleration predictions support the same sampled position check without a fabricated torque channel', () => {
  const makeRun = (id, amplitude) => ({
    id, label: 'Unknown-scale harmonic recording', kind: 'synthetic', inertia: null,
    dynamics: 'unforced_scalar_rotation', initialRate: 0, source: { label: 'Independent exact harmonic trajectory' },
    samples: Array.from({ length: 101 }, (_, i) => ({ time: i * .02, position: amplitude * Math.cos(2 * i * .02) })),
  });
  const discovery = discoverAngular([makeRun('train', .5)], { terms: ['spring'], noiseSigma: .0001 });
  const prediction = rolloutAngular(discovery.selected, makeRun('challenge', 1.2));
  const result = summarizePredictionHorizon(prediction, { positionTolerance: .01 });
  assert.equal(result.sourceSchema, 'worldlaw.angular-rollout/v1');
  assert.equal(result.status, 'not_exceeded_at_samples');
  assert.equal(result.count, 100);
  assert.ok(result.limitations.some(text => text.includes('physical inertia and absolute torque remain unknown')));
  assert.ok(result.limitations.every(text => !text.includes('command, inertia')));
  assert.ok(prediction.rows.every(row => !Object.hasOwn(row, 'command')));
  throwsCode(() => summarizePredictionHorizon({ ...prediction, units: { ...prediction.units, position: 'deg' } }, { positionTolerance: .01 }), 'invalid_rollout');
  const forged = structuredClone(prediction); forged.rows[1].command = 0;
  throwsCode(() => summarizePredictionHorizon(forged, { positionTolerance: .01 }), 'invalid_rollout');
});

test('input arrays and options remain unchanged and output points are independent', () => {
  const prediction = deepFreeze(source()), options = deepFreeze({ positionTolerance: .05 });
  const before = JSON.stringify({ prediction, options });
  const result = summarizePredictionHorizon(prediction, options);
  result.firstExceeded.time = 900;
  result.previousSample.time = 800;
  result.lastWithin.time = 700;
  result.limitations[0] = 'modified result';
  assert.equal(JSON.stringify({ prediction, options }), before);
  assert.equal(summarizePredictionHorizon(prediction, options).firstExceeded.time, 14);
});

test('missing, invalid, nonpositive and nonfinite tolerances fail with typed errors', () => {
  for (const options of [undefined, null, [], {}, { positionTolerance: 0 }, { positionTolerance: -1 },
    { positionTolerance: NaN }, { positionTolerance: Infinity }, { positionTolerance: '.05' }]) {
    throwsCode(() => summarizePredictionHorizon(source(), options), 'invalid_options');
  }
});

test('invalid source schemas, identities, rows, residuals, and time ordering fail with typed errors', () => {
  const valid = source();
  const change = (index, fields) => ({ ...valid, rows: valid.rows.map((row, i) => i === index ? { ...row, ...fields } : { ...row }) });
  for (const invalid of [null, [], {}, { ...valid, schema: 'wrong' }, { ...valid, modelId: '' }, { ...valid, runId: 1 },
    { ...valid, rows: [] }, { ...valid, rows: valid.rows.slice(0, 1) }, { ...valid, rows: new Array(4) },
    change(0, { observed: 1, residual: 1 }), change(2, { time: 11 }), change(2, { time: NaN }),
    change(2, { predicted: Infinity }), change(2, { rate: NaN }), change(2, { command: NaN }),
    change(2, { residual: .2 }), change(2, { observed: 1e308, predicted: -1e308, residual: 0 }),
    { ...valid, rows: valid.rows.map((row, i) => ({ ...row, time: [-1e308, -9e307, 9e307, 1e308][i] })) }]) {
    throwsCode(() => summarizePredictionHorizon(invalid, { positionTolerance: .05 }), 'invalid_rollout');
  }
});
