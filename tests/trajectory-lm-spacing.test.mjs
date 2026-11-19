import test from 'node:test';
import assert from 'node:assert/strict';
import {fitTrajectoryLM} from '../src/trajectory-lm/fit.mjs';

function fixture(coefficient, iterations) {
  const seed = {
    schema: 'worldlaw.angular-model/v1', id: 'bias',
    terms: [{id: 'bias', coefficient, coefficientUnit: 'rad/s²'}],
    units: {position: 'rad', rate: 'rad/s', angularAcceleration: 'rad/s²'},
    physicalInertia: null, absoluteTorqueIdentified: false,
    scaleMeaning: 'angular_acceleration_only_absolute_torque_unknown'
  };
  const runs = [{
    id: 'wide-interval-constant-acceleration', kind: 'synthetic',
    dynamics: 'unforced_scalar_rotation', inertia: null, initialRate: 0,
    source: {label: 'Authored constant acceleration with exact binary timestamps'},
    samples: Array.from({length: 5}, (_, i) => {
      const time = i / 16;
      return {time, position: 1.5 * time * time / 2};
    })
  }];
  return {seed, runs, options: {
    iterations, maxStep: 1 / 16, screen: .001,
    bounds: [[1, 2]], maxTotalSteps: 4000000
  }};
}

function receive(input, maximumEvaluations, reservation) {
  const original = structuredClone(input);
  const result = fitTrajectoryLM(input.seed, input.runs, input.options);
  assert.deepEqual(input, original, 'Original model, rows, starts and options stay unchanged');
  assert.equal(result.status, 'training_improved');
  assert.equal(result.best.status, 'complete');
  assert.equal(result.maximumEvaluations, maximumEvaluations);
  assert.deepEqual(result.reservation, reservation);
  assert.ok(result.trials.length <= maximumEvaluations);
  assert.ok(result.trials.every(row =>
    row.values.every(value => Number.isFinite(value) && value >= 1 && value <= 2)));
  assert.ok(result.best.runs.every(run => run.status === 'screened' &&
    run.resolution.status === 'compared' &&
    run.resolution.maxAbsPositionDifference <= input.options.screen));
  return result;
}

test('actual trajectory fitter resolves an ordinary step from a near-bound seed', () => {
  const result = receive(fixture(1 + Number.EPSILON, 1), 7, {steps: 84, rows: 35});
  assert.ok(result.best.rmse < .0001,
    'A representable near-bound stencil must not halve the useful first step');
  assert.ok(result.best.rmse < result.trials[0].rmse / 100);
  assert.ok(Math.abs(result.best.values[0] - 1.5) < .01);
});

test('an ordinary interior seed retains its useful one-iteration fit', () => {
  const result = receive(fixture(1.1, 1), 7, {steps: 84, rows: 35});
  assert.ok(result.best.rmse < .00001);
  assert.ok(Math.abs(result.best.values[0] - 1.5) < .001);
});

test('the longer declared budget can recover the authored optimum', () => {
  const result = receive(fixture(1 + Number.EPSILON, 8), 49, {steps: 588, rows: 245});
  assert.ok(result.best.rmse < 1e-12);
  assert.ok(Math.abs(result.best.values[0] - 1.5) < 1e-10);
});
