import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitBoundedLM} from '../src/science/bounded-lm.mjs';

function run(initial, bounds, limit, residual, screen = () => true) {
  const trials = [];
  const result = fitBoundedLM(initial, bounds, limit, values => {
    const r = residual(values);
    const trial = {
      index: trials.length, values: [...values], residuals: r,
      status: screen(values, trials.length) ? 'complete' : 'incomplete',
      rmse: Math.hypot(...r) / Math.sqrt(r.length),
    };
    trials.push(trial);
    return trial;
  });
  assert.ok(trials.length <= 1 + limit * (2 * initial.length + 4));
  for (const trial of trials) trial.values.forEach((v, j) =>
    assert.ok(v >= bounds[j][0] && v <= bounds[j][1]));
  return {...result, trials};
}

test('coupled clipped-bound step continues optimizing the free coefficient', () => {
  const r = run([0, 0], [[-.5, 5], [-5, 5]], 6,
    ([x, y]) => [x + y - 3, x + 1]);
  assert.equal(r.best.values[0], -.5);
  assert.ok(Math.abs(r.best.values[1] - 3.5) < 1e-7);
  assert.ok(r.trials.some(t => t.values[0] === -.5 && t.values[1] > 3.9));
  assert.ok(!r.iterations.some(i => i.status === 'jacobian_unresolved'));
});
test('bound derivative signs allow inward release at either bound', () => {
  for (const sign of [1, -1]) {
    const r = run([-.5 * sign, 0],
      sign === 1 ? [[-.5, 5], [-5, 5]] : [[-5, .5], [-5, 5]], 6,
      ([x, y]) => [x - sign, y - 2]);
    assert.ok(Math.abs(r.best.values[0] - sign) < 1e-8);
    assert.ok(Math.abs(r.best.values[1] - 2) < 1e-8);
  }
});
test('outward gradients at every bound stop without proposal trials', () => {
  const r = run([0, 1], [[0, 2], [-1, 1]], 4, ([x, y]) => [x + 1, y - 2]);
  assert.equal(r.trials.length, 5);
  assert.deepEqual(r.best.values, [0, 1]);
  assert.equal(r.iterations[0].status, 'projected_stationary');
});
test('either incomplete inward derivative probe refuses the Jacobian', () => {
  for (const refused of [1, 2]) {
    const r = run([0], [[0, 2]], 4, ([x]) => [x - 1],
      (_, index) => index !== refused);
    assert.equal(r.trials.length, 3);
    assert.equal(r.best.index, 0);
    assert.equal(r.iterations[0].status, 'jacobian_unresolved');
  }
});
test('reduced damping rows map to noncontiguous free coefficients', () => {
  const r = run([0, 0, 1, 0], [[-5, 5], [0, 2], [-1, 1], [-5, 5]], 6,
    ([a, b, c, d]) => [2 * (a - 2), b + 1, c - 2, 3 * (d + 3)]);
  assert.ok(Math.abs(r.best.values[0] - 2) < 1e-7);
  assert.equal(r.best.values[1], 0);
  assert.equal(r.best.values[2], 1);
  assert.ok(Math.abs(r.best.values[3] + 3) < 1e-7);
});
test('incomplete seed performs no derivative or proposal work', () => {
  const r = run([0], [[-1, 1]], 4, ([x]) => [x], () => false);
  assert.equal(r.trials.length, 1);
  assert.equal(r.iterations.length, 0);
});
test('active coordinate is released after another coordinate changes its gradient', () => {
  const r = run([0, 2], [[0, 3], [-3, 3]], 10,
    ([x, y]) => [x + y - 1, Math.sqrt(.1) * (x - 2)]);
  assert.ok(r.trials.some(t => t.values[0] === 0 && Math.abs(t.values[1] - 1) < .01));
  assert.ok(Math.abs(r.best.values[0] - 2) < 1e-7);
  assert.ok(Math.abs(r.best.values[1] + 1) < 1e-7);
});
test('narrow bound probes stay inside exact declared bounds', () => {
  for (const sign of [1, -1]) {
    const bounds = sign === 1 ? [[-1e-12, 2e-12]] : [[-2e-12, 1e-12]];
    run([sign === 1 ? -1e-12 : 1e-12], bounds, 2, ([x]) => [x - sign * 5e-13]);
  }
});
test('nonfinite gradient is unresolved rather than projected stationary', () => {
  const r = run([0], [[-2, 2]], 4, ([x]) => [1e200 * (1 + x)]);
  assert.equal(r.trials.length, 3);
  assert.equal(r.best.index, 0);
  assert.equal(r.iterations[0].status, 'jacobian_unresolved');
});
