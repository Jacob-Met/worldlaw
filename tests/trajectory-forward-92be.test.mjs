import test from 'node:test';
import assert from 'node:assert/strict';
import { rollout, TrajectoryRolloutError } from '../src/trajectory/forward.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected}; tolerance ${tolerance}`);
const model = terms => ({ schema: 'worldlaw.torque-model/v1', id: terms.map(([id]) => id).join('+') || 'zero',
  terms: terms.map(([id, coefficient]) => ({ id, coefficient })) });
const run = (samples, overrides = {}) => ({
  id: 'independent-analytic-fixture', label: 'Independent analytic fixture', kind: 'synthetic',
  inertia: 1, initialRate: 0, samples,
  source: { label: 'Analytic solutions authored independently of the executable predictor' }, ...overrides,
});
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function throwsCode(callback, code) {
  assert.throws(callback, error => error instanceof TrajectoryRolloutError && error.code === code);
}

test('free-running RK4 matches an independent harmonic analytic trajectory and rate', () => {
  const times = [0, .033, .151, .409, .983, 1.501, 2.37];
  const omega = 2, initialRate = .3, initialPosition = .8;
  const truth = time => initialPosition * Math.cos(omega * time) + initialRate / omega * Math.sin(omega * time);
  const evidence = run(times.map(time => ({ time, position: truth(time), command: 0 })), { initialRate, inertia: .5 });
  const result = rollout(model([['spring', -2]]), evidence);
  assert.equal(result.schema, 'worldlaw.trajectory-rollout/v1');
  assert.deepEqual(result.rows.map(row => row.time), times);
  assert.equal(result.metrics.count, times.length - 1);
  assert.ok(result.metrics.positionRMSE < 4e-9);
  for (const row of result.rows) {
    near(row.predicted, truth(row.time), 6e-9);
    near(row.rate, -initialPosition * omega * Math.sin(omega * row.time) + initialRate * Math.cos(omega * row.time), 1e-8);
    near(row.residual, row.observed - row.predicted);
  }
  assert.equal(result.diagnostics.observationsResetState, false);
  assert.equal(result.diagnostics.physicalValidity, 'not_established_by_finite_rollout');
});

test('irregular command switches use the left sample command including every RK4 endpoint stage', () => {
  const times = [0, .125, .375, .4375, 1.0625];
  const commands = [2, -3, .5, 1.25, 900];
  let position = .4, rate = -.2;
  const inertia = 2;
  const expectedRates = [rate];
  const samples = times.map((time, i) => {
    if (i) {
      const duration = time - times[i - 1];
      const acceleration = (1.5 * commands[i - 1] + .3) / inertia;
      position += rate * duration + .5 * acceleration * duration ** 2;
      rate += acceleration * duration;
      expectedRates.push(rate);
    }
    return { time, position, command: commands[i] };
  });
  const result = rollout(model([['command', 1.5], ['bias', .3]]), run(samples, { initialRate: -.2, inertia }), { maxStep: .03 });
  assert.ok(result.metrics.positionRMSE < 1e-14);
  result.rows.forEach((row, i) => { near(row.rate, expectedRates[i], 2e-15); assert.equal(row.command, commands[i]); });
  assert.equal(result.diagnostics.steps, times.slice(1).reduce((sum, time, i) => sum + Math.ceil((time - times[i]) / .03), 0));
});

test('exact representable epoch shifts preserve dynamics and original timestamps', () => {
  const samples = [0, .125, .375, 1.0625].map(time => ({ time, position: .1 + .2 * time + .5 * time * time, command: 2 }));
  const baseline = rollout(model([['command', 1]]), run(samples, { initialRate: .2, inertia: 2 }));
  for (const epoch of [1700000000, -1700000000, 2 ** 42]) {
    const shifted = rollout(model([['command', 1]]), run(samples.map(sample => ({ ...sample, time: sample.time + epoch })), { initialRate: .2, inertia: 2 }));
    assert.deepEqual(shifted.metrics, baseline.metrics);
    shifted.rows.forEach((row, index) => {
      assert.equal(row.predicted, baseline.rows[index].predicted);
      assert.equal(row.rate, baseline.rows[index].rate);
      assert.equal(row.time, samples[index].time + epoch);
    });
  }
});

test('held-out future observations never reset state or infer the supplied initial rate', () => {
  const samples = [0, .2, .4, .8, 1].map(time => ({ time, position: .5 + 2 * time, command: 0 }));
  const original = run(samples, { initialRate: 2 });
  const poisoned = run(samples.map((sample, index) => ({ ...sample, position: index ? 1000 - 3 * index : sample.position })), { initialRate: 2 });
  const clean = rollout(model([]), original), challenged = rollout(model([]), poisoned);
  assert.deepEqual(challenged.rows.map(({ predicted, rate }) => ({ predicted, rate })), clean.rows.map(({ predicted, rate }) => ({ predicted, rate })));
  assert.ok(challenged.metrics.positionRMSE > 900);
  const wrongInitialRate = rollout(model([]), run(samples, { initialRate: 0 }));
  near(wrongInitialRate.rows.at(-1).predicted, .5);
  near(wrongInitialRate.metrics.finalAbsError, 2);
});

test('wrong restoring law accumulates independent forward error and metrics exclude initialization', () => {
  const samples = [0, .2, .7, 1.2, 2].map(time => ({ time, position: Math.cos(2 * time), command: 0 }));
  const result = rollout(model([['spring', -1]]), run(samples));
  const residuals = result.rows.slice(1).map(row => row.residual);
  assert.ok(result.metrics.positionRMSE > .4);
  near(result.metrics.positionRMSE, Math.sqrt(residuals.reduce((sum, residual) => sum + residual ** 2, 0) / residuals.length));
  near(result.metrics.maxAbsError, Math.max(...residuals.map(Math.abs)));
  near(result.metrics.finalAbsError, Math.abs(residuals.at(-1)));
});

test('inputs are not mutated and returned evidence rows do not alias caller data', () => {
  const evidence = deepFreeze(run([{ time: 0, position: .1, command: 0 }, { time: .5, position: .1, command: 0 }]));
  const executable = deepFreeze(model([])), options = deepFreeze({ maxStep: .01 });
  const snapshot = JSON.stringify({ evidence, executable, options });
  const result = rollout(executable, evidence, options);
  result.rows[0].observed = 400;
  assert.equal(JSON.stringify({ evidence, executable, options }), snapshot);
});

test('step budget is preflighted, exact limits accepted, and no partial success returned', () => {
  const evidence = run([{ time: 0, position: 0, command: 0 }, { time: .125, position: 0, command: 0 }, { time: .25, position: 0, command: 0 }]);
  assert.equal(rollout(model([]), evidence, { maxStep: .0625, maxSteps: 4 }).diagnostics.steps, 4);
  throwsCode(() => rollout(model([]), evidence, { maxStep: .0625, maxSteps: 3 }), 'step_limit');
  throwsCode(() => rollout(model([]), evidence, { maxStep: Number.MIN_VALUE }), 'step_limit');
});

test('a subnormal positive interval still receives one step and retains representable drift', () => {
  const interval = Number.MIN_VALUE;
  const expected = 1e6 * interval;
  const evidence = run([{ time: 0, position: 0, command: 0 }, { time: interval, position: expected, command: 0 }], { initialRate: 1e6 });
  for (const maxStep of [interval, 1e100]) {
    const result = rollout(model([]), evidence, { maxStep });
    assert.equal(result.diagnostics.steps, 1);
    assert.ok(result.rows[1].predicted > 0);
    near(result.rows[1].predicted, expected, 2 * Number.MIN_VALUE);
  }
});

test('invalid models, runs, metadata, timestamps and options produce typed errors', () => {
  const valid = run([{ time: 0, position: 1, command: 0 }, { time: 1, position: 0, command: 0 }]);
  for (const bad of [null, [], {}, { schema: 'wrong', terms: [] }, model([['unknown', 1]]), model([['spring', 1], ['spring', 2]]),
    { schema: 'worldlaw.torque-model/v1', terms: [null] }, { schema: 'worldlaw.torque-model/v1', terms: new Array(1) },
    model([['bias', NaN]]), model([['bias', 1e19]]), { ...model([]), id: '' }]) {
    throwsCode(() => rollout(bad, valid), 'invalid_model');
  }
  for (const bad of [null, [], {}, { ...valid, id: '' }, { ...valid, label: '' }, { ...valid, kind: 'verified' },
    { ...valid, source: null }, { ...valid, source: {} }, { ...valid, inertia: 0 }, { ...valid, inertia: -1 },
    { ...valid, inertia: Infinity }, { ...valid, inertia: 1e13 }, { ...valid, initialRate: undefined },
    { ...valid, initialRate: NaN }, { ...valid, initialRate: 1e7 }, { ...valid, samples: [] },
    { ...valid, samples: valid.samples.slice(0, 1) }, { ...valid, samples: [null, valid.samples[1]] }, { ...valid, samples: new Array(2) },
    { ...valid, samples: valid.samples.map(row => ({ ...row, time: 0 })) },
    { ...valid, samples: [...valid.samples].reverse() },
    { ...valid, samples: valid.samples.map(row => ({ ...row, position: Infinity })) },
    { ...valid, samples: valid.samples.map(row => ({ ...row, command: 1e7 })) },
    { ...valid, samples: [{ time: -1e308, position: 0, command: 0 }, { time: 1e308, position: 0, command: 0 }] }]) {
    throwsCode(() => rollout(model([]), bad), 'invalid_run');
  }
  for (const bad of [null, [], { maxStep: 0 }, { maxStep: -1 }, { maxStep: NaN }, { maxStep: Infinity },
    { maxSteps: 0 }, { maxSteps: 2.5 }, { maxSteps: 1000001 }, { maxSteps: Infinity }]) {
    throwsCode(() => rollout(model([]), valid, bad), 'invalid_options');
  }
});

test('runaway intermediate states and nonfinite accelerations fail explicitly', () => {
  const evidence = run([{ time: 0, position: 1, command: 0 }, { time: 1, position: 0, command: 0 }]);
  throwsCode(() => rollout(model([['spring', 1e12]]), evidence), 'runaway_state');
  throwsCode(() => rollout(model([['bias', 1]]), { ...evidence, inertia: Number.MIN_VALUE }), 'numerical_failure');
});

test('step refinement reduces smooth harmonic numerical error at approximately RK4 order', () => {
  const evidence = run([{ time: 0, position: 1, command: 0 }, { time: 1, position: Math.cos(2), command: 0 }]);
  const coarse = rollout(model([['spring', -4]]), evidence, { maxStep: .1 });
  const fine = rollout(model([['spring', -4]]), evidence, { maxStep: .05 });
  const ratio = coarse.metrics.finalAbsError / fine.metrics.finalAbsError;
  assert.ok(ratio > 14 && ratio < 18, `Observed convergence ratio ${ratio}`);
});

test('a finite stiff-law rollout can be inaccurate; finer resolution resolves the retained counterexample', () => {
  const samples = [0, .03125, .0625, .09375, .125].map(time => ({
    time, position: (1 - Math.exp(-100 * time)) / 100, command: 0,
  }));
  const evidence = run(samples, { initialRate: 1 });
  const executable = model([['rate', -100]]);
  const coarse = rollout(executable, evidence, { maxStep: .03125 });
  const fine = rollout(executable, evidence, { maxStep: .001 });
  assert.ok(Number.isFinite(coarse.metrics.positionRMSE));
  assert.ok(coarse.metrics.positionRMSE > .04);
  assert.ok(fine.metrics.positionRMSE < 1e-9);
  assert.equal(coarse.diagnostics.numericalErrorEstimate, null);
  assert.equal(coarse.diagnostics.physicalValidity, 'not_established_by_finite_rollout');
});
