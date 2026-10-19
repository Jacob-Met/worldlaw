import test from 'node:test';
import assert from 'node:assert/strict';
import { rolloutAngularWithResolution } from '../src/trajectory/angular-resolution.mjs';
import { rolloutAngular, AngularDataError } from '../src/trajectory/angular-discovery.mjs';
import { TrajectoryRolloutError } from '../src/trajectory/forward.mjs';

const model = (coefficient = -4, id = 'spring') => ({
  schema: 'worldlaw.angular-model/v1', id, terms: [{ id, coefficient, coefficientUnit: id === 'spring' ? '1/s²' : '1/s' }],
  units: { position: 'rad', rate: 'rad/s', angularAcceleration: 'rad/s²' },
  scaleMeaning: 'angular_acceleration_only_absolute_torque_unknown', physicalInertia: null, absoluteTorqueIdentified: false,
});
const run = (times = [0, .25, .5, .75, 1]) => ({
  id: 'angular-resolution', label: 'Exact harmonic motion with unknown physical scale', kind: 'synthetic',
  inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: 0,
  source: { label: 'Independent analytic harmonic solution' },
  samples: times.map(time => ({ time, position: Math.cos(2 * time) })),
});
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

test('angular comparison executes the same analytic problem and retains unknown physical scale', () => {
  const evidence = run();
  const result = rolloutAngularWithResolution(model(), evidence, { maxStep: .1, maxSteps: 100 });
  assert.deepEqual(result.rollout, rolloutAngular(model(), evidence, { maxStep: .1, maxSteps: 100 }));
  assert.equal(result.rollout.schema, 'worldlaw.angular-rollout/v1');
  assert.equal(result.rollout.diagnostics.physicalInertia, null);
  assert.equal(result.rollout.diagnostics.absoluteTorqueIdentified, false);
  assert.equal(result.resolution.status, 'compared');
  assert.ok(result.resolution.positionRMSEDifference > 0 && result.resolution.positionRMSEDifference < .00001);
  assert.ok(result.rollout.rows.every(row => !Object.hasOwn(row, 'command')));
  assert.ok(!JSON.stringify(result).includes('N·m'));
  assert.match(result.resolution.meaning, /not a calibrated error bound/);
});

test('angular coarse plus refined execution consumes one combined resource budget', () => {
  const evidence = run([0, 1]);
  const exact = rolloutAngularWithResolution(model(), evidence, { maxStep: .1, maxSteps: 30 });
  assert.equal(exact.resolution.stepsCoarse, 10);
  assert.equal(exact.resolution.stepsRefined, 20);
  assert.equal(exact.resolution.combinedSteps, 30);
  const limited = rolloutAngularWithResolution(model(), evidence, { maxStep: .1, maxSteps: 29 });
  assert.equal(limited.resolution.status, 'unavailable');
  assert.equal(limited.resolution.reason, 'combined_step_budget');
  assert.equal(limited.resolution.positionRMSEDifference, null);
  assert.equal(limited.resolution.maxAbsPositionDifference, null);
  assert.equal(limited.resolution.stepsRefined, null);
  assert.equal(limited.rollout.rows.length, 2);
  assert.throws(() => rolloutAngularWithResolution(model(), evidence, { maxStep: .1, maxSteps: 9 }),
    error => error instanceof TrajectoryRolloutError && error.code === 'step_limit');
});

test('angular resolution exposes the finite inaccurate damping case independently of unknown inertia', () => {
  const evidence = run([0, .03125, .0625, .09375, .125]);
  evidence.initialRate = 1;
  evidence.samples.forEach(row => { row.position = (1 - Math.exp(-100 * row.time)) / 100; });
  const result = rolloutAngularWithResolution(model(-100, 'rate'), evidence, { maxStep: .03125 });
  assert.ok(result.rollout.metrics.positionRMSE > .04);
  assert.ok(result.resolution.positionRMSEDifference > .04);
  assert.equal(result.rollout.diagnostics.physicalValidity, 'not_established_by_finite_rollout');
});

test('angular evidence and options remain intact and future positions affect only residuals', () => {
  const evidence = deepFreeze(run()), executable = deepFreeze(model()), options = deepFreeze({ maxStep: .1 });
  const before = JSON.stringify({ evidence, executable, options });
  const original = rolloutAngularWithResolution(executable, evidence, options);
  const altered = structuredClone(evidence); altered.samples.slice(1).forEach(row => { row.position += 50; });
  const challenged = rolloutAngularWithResolution(executable, altered, options);
  assert.deepEqual(challenged.resolution, original.resolution);
  assert.deepEqual(challenged.rollout.rows.map(row => row.predicted), original.rollout.rows.map(row => row.predicted));
  assert.notEqual(challenged.rollout.metrics.positionRMSE, original.rollout.metrics.positionRMSE);
  assert.equal(JSON.stringify({ evidence, executable, options }), before);
});

test('angular comparison retains unit-validation, option and coarse-numerical typed refusals', () => {
  assert.throws(() => rolloutAngularWithResolution({ ...model(), physicalInertia: 1 }, run()),
    error => error instanceof AngularDataError && error.code === 'invalid_model');
  assert.throws(() => rolloutAngularWithResolution(model(), { ...run(), inertia: 1 }),
    error => error instanceof AngularDataError && error.code === 'unknown_scale_required');
  assert.throws(() => rolloutAngularWithResolution(model(), run(), { maxStep: 0 }),
    error => error instanceof TrajectoryRolloutError && error.code === 'invalid_options');
  assert.throws(() => rolloutAngularWithResolution(model(1e12), run()),
    error => error instanceof TrajectoryRolloutError && error.code === 'runaway_state');
});
