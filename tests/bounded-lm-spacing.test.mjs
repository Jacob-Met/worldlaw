import test from 'node:test';
import assert from 'node:assert/strict';
import {fitBoundedLM} from '../src/science/bounded-lm.mjs';

const E = Number.EPSILON;
function exercise({initial, bounds, iterations = 1,
  residuals = values => [values[0]], status = () => 'complete'}) {
  const before = JSON.stringify({initial, bounds});
  const trials = [];
  const result = fitBoundedLM(initial, bounds, iterations, values => {
    assert.equal(values.length, bounds.length);
    for (const [j, value] of values.entries()) {
      assert.ok(Number.isFinite(value));
      assert.ok(value >= bounds[j][0] && value <= bounds[j][1],
        'Every actual evaluation must remain inside its declared bounds');
    }
    const errors = residuals(values);
    const trial = {
      index: trials.length, values: [...values], residuals: errors,
      status: status(values), rmse: Math.hypot(...errors) / Math.sqrt(errors.length)
    };
    trials.push(trial);
    return trial;
  });
  assert.equal(JSON.stringify({initial, bounds}), before);
  assert.ok(trials.length <= 1 + iterations * (2 * initial.length + 4));
  return {result, trials};
}

for (const sign of [1, -1]) {
  const direction = sign === 1 ? 'positive' : 'reflected';
  const reflectBounds = ([lo, hi]) => sign === 1 ? [lo, hi] : [-hi, -lo];

  test('central near-bound affine progress uses actual spacing: ' + direction, () => {
    const target = sign * 1.5;
    const {result, trials} = exercise({
      initial: [sign * (1 + E)], bounds: [reflectBounds([1, 2])],
      residuals: values => [values[0] - target]
    });
    assert.equal(result.best.status, 'complete');
    assert.equal(result.iterations[0].status, 'improved');
    assert.ok(result.best.rmse < .001,
      'One damped affine step should nearly reach the ordinary-scale target');
    assert.ok(result.best.rmse < trials[0].rmse / 100);
    assert.equal(trials.length, 4);
  });

  for (const fixture of [
    {name: 'one-and-three ULP offsets', initial: 1 + E,
      bounds: [1 + E, 1 + 7 * E]},
    {name: 'two-and-three ULP offsets', initial: 1,
      bounds: [1, 1 + 6 * E]}
  ]) {
    test('inward affine optimum with ' + fixture.name + ': ' + direction, () => {
      const target = sign * (1 + 3 * E);
      const {result, trials} = exercise({
        initial: [sign * fixture.initial], bounds: [reflectBounds(fixture.bounds)],
        residuals: values => [values[0] - target]
      });
      assert.equal(result.best.status, 'complete');
      assert.equal(result.iterations[0].status, 'improved');
      assert.equal(result.best.values[0], target,
        'The representable affine minimizer must be selected, not a neighboring ULP');
      assert.equal(result.best.rmse, 0);
      assert.equal(trials.length, 4);
    });
  }
}

for (const fixture of [
  {name: 'central half-ULP collapse', initial: 1 + 2 * E,
    bounds: [1 + E, 1 + 4 * E]},
  {name: 'only two representable nodes', initial: 1, bounds: [1, 1 + E]},
  {name: 'subnormal step underflow', initial: Number.MIN_VALUE,
    bounds: [0, 4 * Number.MIN_VALUE]}
]) {
  test('probe-selection refusal remains unchanged: ' + fixture.name, () => {
    const {result, trials} = exercise({
      initial: [fixture.initial], bounds: [fixture.bounds]
    });
    assert.equal(trials.length, 1, 'No derivative or proposal evaluation after collapse');
    assert.equal(result.best.values[0], fixture.initial);
    assert.equal(result.iterations.length, 1);
    assert.equal(result.iterations[0].status, 'jacobian_unresolved');
  });
}

test('an incomplete seed still returns without probes or proposals', () => {
  const {result, trials} = exercise({
    initial: [.25], bounds: [[-1, 1]], status: () => 'incomplete'
  });
  assert.equal(trials.length, 1);
  assert.equal(result.best.status, 'incomplete');
  assert.deepEqual(result.iterations, []);
});

test('an incomplete probe still prevents proposals and preserves the seed', () => {
  const {result, trials} = exercise({
    initial: [.25], bounds: [[-1, 1]],
    status: values => values[0] === .25 ? 'complete' : 'incomplete'
  });
  assert.equal(trials.length, 3);
  assert.equal(result.best.index, 0);
  assert.equal(result.best.values[0], .25);
  assert.equal(result.iterations.length, 1);
  assert.equal(result.iterations[0].status, 'jacobian_unresolved');
});

test('non-improving proposals retain the two-probe four-proposal work ceiling', () => {
  const iterations = 5;
  // The positive probe gives a nonzero local column, but every inward proposal
  // lands on the flat half of this residual and cannot strictly improve it.
  const {result, trials} = exercise({
    initial: [0], bounds: [[-2, 2]], iterations,
    residuals: values => [1 + Math.max(0, values[0])]
  });
  assert.equal(trials.length, 1 + iterations * (2 + 4));
  assert.equal(result.iterations.length, iterations);
  assert.ok(result.iterations.every(row => row.status === 'no_improvement'));
  assert.equal(result.best.index, 0);
  assert.equal(result.best.rmse, 1);
});

test('nonfinite secant arithmetic remains unresolved rather than stationary', () => {
  const {result, trials} = exercise({
    initial: [1], bounds: [[1, 2]],
    residuals: values => [values[0] === 1 ? 0 :
      values[0] < 1.00015 ? 1.7e304 : -1.7e304]
  });
  assert.equal(trials.length, 3);
  assert.equal(result.best.index, 0);
  assert.equal(result.iterations[0].status, 'jacobian_unresolved');
});
