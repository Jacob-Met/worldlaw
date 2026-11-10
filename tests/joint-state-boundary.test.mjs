import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitJointState} from '../src/joint-state/fit.mjs';

function fixture() {
  const seed = {
    schema: 'worldlaw.angular-model/v1', id: 'rate+spring',
    terms: [
      {id: 'rate', coefficient: -.3, coefficientUnit: '1/s'},
      {id: 'spring', coefficient: -3.6, coefficientUnit: '1/s²'},
    ],
    units: {position: 'rad', rate: 'rad/s', angularAcceleration: 'rad/s²'},
    physicalInertia: null, absoluteTorqueIdentified: false,
    scaleMeaning: 'angular_acceleration_only_absolute_torque_unknown',
  };
  const runs = [[1, .2], [-.7, -.1], [.5, 0]].map(([A, v], index) => {
    const d = .1, w = Math.sqrt(4 - d * d), B = (v + d * A) / w;
    return {
      id: `independent-root-three-course-${'abc'[index]}`,
      kind: 'synthetic', dynamics: 'unforced_scalar_rotation', inertia: null,
      initialRate: v,
      source: {label: 'Independent three-course analytic damped oscillator corroboration'},
      rateObservation: {
        unit: 'rad/s',
        basis: 'Exact analytic derivative of the same authored trajectory',
        dependence: 'not-assumed-independent',
      },
      samples: Array.from({length: 126}, (_, i) => {
        const time = i * .04, c = A * Math.cos(w * time) + B * Math.sin(w * time);
        return {
          time,
          position: Math.exp(-d * time) * c,
          rate: Math.exp(-d * time) * (-d * c + w * (-A * Math.sin(w * time) + B * Math.cos(w * time))),
        };
      }),
    };
  });
  const options = {
    iterations: 8, maxStep: .02, screen: .001, rateScreen: .001,
    bounds: [[-1, 0], [-3.85, -2]], maxTotalSteps: 4000000,
    channelScales: {
      positionRad: .1, rateRadPerSecond: .1,
      basis: 'Declared equal numerical objective weights; not independent errors',
    },
  };
  return {seed, runs, options};
}

function assertScreened(run, options) {
  assert.equal(run.status, 'screened');
  assert.equal(run.resolution.status, 'compared');
  for (const [value, limit] of [
    [run.resolution.maxAbsPositionDifference, options.screen],
    [run.resolution.maxAbsRateDifference, options.rateScreen],
  ]) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= limit);
  }
}

test('joint supplied-position/rate fitting continues after a constrained spring hits its bound', () => {
  const {seed, runs, options} = fixture();
  const before = JSON.stringify({seed, runs, options});
  const result = fitJointState(seed, runs, options);
  assert.equal(JSON.stringify({seed, runs, options}), before);
  assert.deepEqual(result.runs, runs);
  assert.deepEqual(result.options, options);
  assert.equal(result.maximumEvaluations, 65);
  assert.deepEqual(result.reservation, {steps: 186810, rows: 24570});
  assert.ok(result.trials.length <= result.maximumEvaluations);
  for (const trial of result.trials) {
    assert.equal(trial.values.length, options.bounds.length);
    trial.values.forEach((value, j) => {
      assert.ok(Number.isFinite(value) && value >= options.bounds[j][0] && value <= options.bounds[j][1]);
    });
  }
  // The true spring coefficient is -4, outside this deliberately constrained box.
  // Compare accepted fits, not finite-difference probes or a cached expected model.
  const boundaryIteration = result.iterations.find(row =>
    row.status === 'improved' && result.trials[row.bestTrial].values[1] === options.bounds[1][0]);
  assert.ok(boundaryIteration, 'an accepted proposal must reach the declared spring bound');
  const firstBoundary = result.trials[boundaryIteration.bestTrial];
  assert.equal(firstBoundary.status, 'complete');
  assert.equal(result.best.status, 'complete');
  assert.ok(result.best.index > firstBoundary.index, 'the free rate coefficient must improve after bound entry');
  assert.ok(result.iterations.some(row => row.iteration > boundaryIteration.iteration && row.status === 'improved'));
  assert.equal(result.best.values[1], options.bounds[1][0]);
  assert.ok(result.best.rmse < .9 * firstBoundary.rmse, 'continued fitting must materially reduce the declared weighted objective');
  assert.equal(result.best.runs.length, runs.length);
  for (const run of result.best.runs) {
    const prior = firstBoundary.runs.find(row => row.id === run.id);
    assert.ok(prior);
    assertScreened(run, options);
    assert.ok(run.positionRMSE < prior.positionRMSE, `${run.id}: position improves`);
    assert.ok(run.suppliedRateRMSE < prior.suppliedRateRMSE, `${run.id}: supplied rate improves`);
  }
});

test('a passing position screen cannot admit a joint-state seed whose supplied-rate screen fails', () => {
  const {seed, runs, options} = fixture();
  options.rateScreen = 1e-16;
  const before = JSON.stringify({seed, runs, options});
  const result = fitJointState(seed, runs, options);
  assert.equal(JSON.stringify({seed, runs, options}), before);
  assert.deepEqual(result.runs, runs);
  assert.equal(result.status, 'seed_unresolved');
  assert.equal(result.model, null);
  assert.equal(result.trials.length, 1);
  assert.equal(result.best.status, 'incomplete');
  assert.deepEqual(result.iterations, []);
  assert.equal(result.maximumEvaluations, 65);
  assert.deepEqual(result.reservation, {steps: 186810, rows: 24570});
  assert.equal(result.trials[0].runs.length, runs.length);
  for (const run of result.trials[0].runs) {
    assert.equal(run.status, 'unresolved');
    assert.equal(run.resolution.status, 'compared');
    const position = run.resolution.maxAbsPositionDifference;
    const rate = run.resolution.maxAbsRateDifference;
    assert.ok(Number.isFinite(position) && position >= 0 && position <= options.screen);
    assert.ok(Number.isFinite(rate) && rate > options.rateScreen);
  }
});
