import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTorqueObservations, splitTrajectoryEvidence} from '../src/science/trajectory-observations.mjs';

// Independent closed-form symmetric cubic-regression derivative controls.
const h = 0.125, inertia = 0.8, sigma = 0.001, count = 101;
const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} differs from independent expectation ${expected}`);
const samples = fn => Array.from({length: count}, (_, i) => {
  const time = i * h;
  return {time, position: fn(time), command: 0};
});
const weights = {
  5: [2, -1, -2, -1, 2].map(v => v / (7 * h * h)),
  7: [5, 0, -3, -4, -3, 0, 5].map(v => v / (42 * h * h)),
};
const noise = windowSize => inertia * sigma * Math.hypot(...weights[windowSize]);

test('cubic derivatives, independent weights, declared noise and disjoint evidence counts', () => {
  const q = t => 0.1 + 0.03*t - 0.002*t*t + 0.0001*t*t*t;
  const source = samples(q);
  for (const windowSize of [5, 7]) {
    const result = deriveTorqueObservations(source, {inertia, windowSize, positionSigma: sigma});
    const half = (windowSize - 1) / 2;
    assert.equal(result.source.length, count);
    for (const estimate of result.estimates) {
      const t = estimate.time;
      const expectedAcceleration = -0.004 + 0.0006*t;
      const independent = weights[windowSize].reduce((sum, w, j) =>
        sum + w * source[estimate.positionSourceIndex - half + j].position, 0);
      near(estimate.acceleration, expectedAcceleration);
      near(estimate.acceleration, independent);
      near(estimate.observation.jointTorque, inertia * expectedAcceleration);
      near(estimate.jointTorqueSigma, noise(windowSize));
    }
    near(result.diagnostics.maxTorqueSigma, noise(windowSize));
    const split = splitTrajectoryEvidence(result);
    const expected = windowSize === 5 ? [97, 66, 27, 4, 2] : [95, 64, 25, 6, 3];
    assert.deepEqual([result.observations.length, split.observations.length, split.heldOut.length,
      split.split.excludedCrossingWindows, result.diagnostics.droppedEdges], expected);
    assert.equal(split.split.rawSourceCut, 70);
    assert.ok(split.split.trainingRawIndices[1] < split.split.heldOutRawIndices[0]);
  }
  near(noise(7) / noise(5), 1 / Math.sqrt(6));
});

test('wider window can lower propagated noise while increasing fast-motion bias', () => {
  const omega = 0.5 / h, center = 50 * h;
  const source = samples(t => Math.cos(omega * (t - center)));
  const estimates = {};
  for (const windowSize of [5, 7]) {
    const result = deriveTorqueObservations(source, {inertia, windowSize, positionSigma: sigma});
    estimates[windowSize] = result.estimates.find(row => row.positionSourceIndex === 50);
  }
  const expected5 = (4*Math.cos(1) - 2*Math.cos(0.5) - 2) / (7*h*h);
  const expected7 = (10*Math.cos(1.5) - 6*Math.cos(0.5) - 4) / (42*h*h);
  near(estimates[5].acceleration, expected5);
  near(estimates[7].acceleration, expected7);
  assert.ok(estimates[7].jointTorqueSigma < estimates[5].jointTorqueSigma);
  assert.ok(Math.abs(estimates[7].acceleration + omega*omega)
    > Math.abs(estimates[5].acceleration + omega*omega));
});

test('declared zero angle noise gives zero propagated sigma without removing derivative gain', () => {
  const source = samples(t => 0.1 * Math.sin(t));
  for (const windowSize of [5, 7]) {
    const zero = deriveTorqueObservations(source, {inertia, windowSize, positionSigma: 0});
    const nonzero = deriveTorqueObservations(source, {inertia, windowSize, positionSigma: sigma});
    assert.equal(zero.diagnostics.maxTorqueSigma, 0);
    assert.ok(zero.diagnostics.maxTorqueNoiseGain > 0);
    assert.deepEqual(zero.observations, nonzero.observations);
    for (const row of zero.estimates) {
      assert.equal(row.jointTorqueSigma, 0);
      assert.ok(row.jointTorqueNoiseGain > 0);
    }
  }
});
