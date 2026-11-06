import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitTrajectoryLM} from '../src/trajectory-lm/fit.mjs';
import {fitConditionTrajectories} from '../src/condition-trajectories/fit.mjs';

const seed = {
  schema: 'worldlaw.angular-model/v1', id: 'rate+spring', equation: 'stale',
  terms: [
    {id: 'rate', coefficient: -.3, coefficientUnit: '1/s'},
    {id: 'spring', coefficient: -3.6, coefficientUnit: '1/s²'},
  ],
  units: {position: 'rad', rate: 'rad/s', angularAcceleration: 'rad/s²'},
  physicalInertia: null, absoluteTorqueIdentified: false,
  scaleMeaning: 'angular_acceleration_only_absolute_torque_unknown',
};
function course(id, A, v, decay = .1, k = 4) {
  const w = Math.sqrt(k - decay * decay), B = (v + decay * A) / w;
  return {
    id, kind: 'synthetic', dynamics: 'unforced_scalar_rotation', inertia: null,
    initialRate: v,
    source: {label: 'Independent analytic damped oscillator; declared bound excludes true stiffness'},
    samples: Array.from({length: 121}, (_, i) => {
      const time = i * .05;
      return {time, position: Math.exp(-decay * time) *
        (A * Math.cos(w * time) + B * Math.sin(w * time))};
    }),
  };
}
function check(result, bounds, before, runs) {
  assert.equal(JSON.stringify(runs), before);
  assert.ok(result.trials.length <= result.maximumEvaluations);
  assert.ok(result.reservation.steps <= 4000000);
  assert.ok(result.reservation.rows <= 262144);
  for (const trial of result.trials) {
    trial.values.forEach((v, j) => assert.ok(v >= bounds[j][0] && v <= bounds[j][1]));
    if (trial.status === 'complete')
      assert.ok(trial.runs.every(run => run.status === 'screened'));
  }
  assert.ok(!result.iterations.some(i => i.status === 'jacobian_unresolved'));
}
test('trajectory fitter improves free damping after stiffness reaches its declared bound', () => {
  const runs = [course('a', 1, .2), course('b', -.7, -.1)];
  const before = JSON.stringify(runs), bounds = [[-1, 0], [-3.9, -2]];
  const result = fitTrajectoryLM(seed, runs, {
    iterations: 8, maxStep: .02, screen: .001, bounds, maxTotalSteps: 4000000,
  });
  check(result, bounds, before, runs);
  assert.equal(result.maximumEvaluations, 65);
  assert.equal(result.best.values[1], -3.9);
  const first = result.trials.find(t => t.status === 'complete' && t.values[1] === -3.9);
  assert.ok(first);
  assert.ok(result.best.rmse < first.rmse * .8);
  assert.ok(result.best.rmse > .02 && result.best.rmse < .04);
  assert.ok(result.best.index > first.index);
});
test('condition fitter improves both condition rates with bounded shared stiffness', () => {
  const runs = [course('air', 1, .2, .1), course('baffle', -.7, -.1, .45)];
  const before = JSON.stringify(runs);
  const result = fitConditionTrajectories(seed, runs, {
    iterations: 8, maxStep: .02, screen: .001,
    sharedBounds: [[-3.9, -2]], rateBounds: [[-2, 0], [-2, 0]],
    maxTotalSteps: 4000000,
  });
  check(result, [[-3.9, -2], [-2, 0], [-2, 0]], before, runs);
  assert.equal(result.maximumEvaluations, 81);
  assert.equal(result.best.values[0], -3.9);
  const first = result.trials.find(t => t.status === 'complete' && t.values[0] === -3.9);
  assert.ok(first);
  assert.ok(result.best.rmse < first.rmse * .75);
  assert.ok(result.best.rmse > .02 && result.best.rmse < .035);
  assert.ok(result.best.index > first.index);
  assert.deepEqual(result.parameterOrder, [
    {role: 'shared', term: 'spring'},
    {role: 'condition', term: 'rate', runId: 'air'},
    {role: 'condition', term: 'rate', runId: 'baffle'},
  ]);
});
