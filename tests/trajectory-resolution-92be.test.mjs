import test from 'node:test';
import assert from 'node:assert/strict';
import { rollout, TrajectoryRolloutError } from '../src/trajectory/forward.mjs';
import { rolloutWithResolution } from '../src/trajectory/resolution.mjs';

const model = (coefficient = -4, id = 'spring') => ({
  schema: 'worldlaw.torque-model/v1', id, terms: [{ id, coefficient }],
});
const run = (times = [0, .25, .5, .75, 1], overrides = {}) => ({
  id: 'resolution-fixture', label: 'Independent analytic oscillator', kind: 'synthetic',
  inertia: 1, initialRate: 0, source: { label: 'Independent closed-form analytic trajectory' },
  samples: times.map(time => ({ time, position: Math.cos(2 * time), command: 0 })),
  ...overrides,
});
const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected}; tolerance ${tolerance}`);
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

test('smooth harmonic comparison reports prediction sensitivity and preserves the coarse result', () => {
  const evidence = run();
  const result = rolloutWithResolution(model(), evidence, { maxStep: .1, maxSteps: 100 });
  const coarse = rollout(model(), evidence, { maxStep: .1, maxSteps: 100 });
  const refined = rollout(model(), evidence, { maxStep: .05, maxSteps: 88 });
  assert.deepEqual(result.rollout, coarse);
  assert.equal(result.resolution.status, 'compared');
  assert.equal(result.resolution.coarseMaxStep, .1);
  assert.equal(result.resolution.refinedMaxStep, .05);
  assert.equal(result.resolution.count, evidence.samples.length - 1);
  const differences = refined.rows.slice(1).map((row, i) => row.predicted - coarse.rows[i + 1].predicted);
  near(result.resolution.positionRMSEDifference, Math.hypot(...differences) / Math.sqrt(differences.length));
  near(result.resolution.maxAbsPositionDifference, Math.max(...differences.map(Math.abs)));
  assert.equal(result.resolution.stepsCoarse, coarse.diagnostics.steps);
  assert.equal(result.resolution.stepsRefined, refined.diagnostics.steps);
  assert.equal(result.resolution.combinedSteps, coarse.diagnostics.steps + refined.diagnostics.steps);
  assert.ok(result.resolution.combinedSteps <= 100);
  assert.ok(refined.metrics.positionRMSE < coarse.metrics.positionRMSE);
  assert.match(result.resolution.meaning, /not a calibrated error bound/);
});

test('successive harmonic comparisons decrease under smooth-law step refinement', () => {
  const evidence = run([0, 1]);
  const coarse = rolloutWithResolution(model(), evidence, { maxStep: .1 });
  const finer = rolloutWithResolution(model(), evidence, { maxStep: .05 });
  const ratio = coarse.resolution.positionRMSEDifference / finer.resolution.positionRMSEDifference;
  assert.ok(ratio > 14 && ratio < 18, `Observed discrepancy refinement ratio ${ratio}`);
});

test('the retained finite inaccurate stiff-law case produces a large resolution discrepancy', () => {
  const evidence = run([0, .03125, .0625, .09375, .125], { initialRate: 1 });
  evidence.samples = evidence.samples.map(row => ({ ...row, position: (1 - Math.exp(-100 * row.time)) / 100 }));
  const result = rolloutWithResolution(model(-100, 'rate'), evidence, { maxStep: .03125 });
  assert.equal(result.resolution.status, 'compared');
  assert.ok(result.rollout.metrics.positionRMSE > .04);
  assert.ok(result.resolution.positionRMSEDifference > .04);
  assert.ok(result.resolution.maxAbsPositionDifference > .07);
  assert.ok(result.resolution.limitations.some(message => message.includes('Stiff dynamics')));
  assert.ok(result.resolution.limitations.some(message => message.includes('Coulomb')));
});

test('coarse and refined executions share one combined step budget', () => {
  const evidence = run([0, 1]);
  const exactBudget = rolloutWithResolution(model(), evidence, { maxStep: .1, maxSteps: 30 });
  assert.equal(exactBudget.resolution.status, 'compared');
  assert.equal(exactBudget.resolution.stepsCoarse, 10);
  assert.equal(exactBudget.resolution.stepsRefined, 20);
  assert.equal(exactBudget.resolution.combinedSteps, 30);
  for (const maxSteps of [10, 29]) {
    const limited = rolloutWithResolution(model(), evidence, { maxStep: .1, maxSteps });
    assert.equal(limited.resolution.status, 'unavailable');
    assert.equal(limited.resolution.reason, 'combined_step_budget');
    assert.equal(limited.rollout.diagnostics.steps, 10);
    assert.equal(limited.resolution.positionRMSEDifference, null);
    assert.equal(limited.resolution.maxAbsPositionDifference, null);
    assert.equal(limited.resolution.stepsRefined, null);
    assert.equal(limited.resolution.availableRefinementSteps, maxSteps - 10);
    assert.ok(limited.rollout.rows.every(row => Number.isFinite(row.predicted)));
  }
  assert.throws(() => rolloutWithResolution(model(), evidence, { maxStep: .1, maxSteps: 9 }),
    error => error instanceof TrajectoryRolloutError && error.code === 'step_limit');
});

test('prediction sensitivity is independent of held-out future observations', () => {
  const evidence = run();
  const changed = run();
  changed.samples.forEach((row, i) => { if (i) row.position += 1000 * i; });
  const clean = rolloutWithResolution(model(), evidence);
  const challenged = rolloutWithResolution(model(), changed);
  assert.deepEqual(challenged.resolution, clean.resolution);
  assert.notEqual(challenged.rollout.metrics.positionRMSE, clean.rollout.metrics.positionRMSE);
});

test('inputs remain intact, result rows are independent, and default options are normalized by forward', () => {
  const evidence = deepFreeze(run()), executable = deepFreeze(model()), options = deepFreeze({ maxStep: .1, maxSteps: 30 });
  const snapshot = JSON.stringify({ evidence, executable, options });
  const result = rolloutWithResolution(executable, evidence, options);
  result.rollout.rows[0].observed = 100;
  result.resolution.limitations[0] = 'changed result';
  assert.equal(JSON.stringify({ evidence, executable, options }), snapshot);
  const defaulted = rolloutWithResolution(executable, evidence);
  assert.equal(defaulted.resolution.coarseMaxStep, .01);
  assert.equal(defaulted.resolution.refinedMaxStep, .005);
  assert.equal(defaulted.resolution.maxSteps, 200000);
  assert.notEqual(defaulted.resolution.limitations[0], 'changed result');
});

test('invalid options, model and run retain forward typed refusals', () => {
  for (const options of [null, [], { maxStep: 0 }, { maxStep: NaN }, { maxSteps: 0 }, { maxSteps: 2.5 }, { maxSteps: 1000001 }]) {
    assert.throws(() => rolloutWithResolution(model(), run(), options),
      error => error instanceof TrajectoryRolloutError && error.code === 'invalid_options');
  }
  assert.throws(() => rolloutWithResolution(null, run()),
    error => error instanceof TrajectoryRolloutError && error.code === 'invalid_model');
  assert.throws(() => rolloutWithResolution(model(), { ...run(), initialRate: undefined }),
    error => error instanceof TrajectoryRolloutError && error.code === 'invalid_run');
  assert.throws(() => rolloutWithResolution(model(1e12), run()),
    error => error instanceof TrajectoryRolloutError && error.code === 'runaway_state');
});

test('an unrepresentable half step is unavailable, never zero sensitivity', () => {
  const evidence = run([0, Number.MIN_VALUE], { initialRate: 0 });
  const result = rolloutWithResolution({ schema: 'worldlaw.torque-model/v1', terms: [] }, evidence, { maxStep: Number.MIN_VALUE });
  assert.equal(result.resolution.status, 'unavailable');
  assert.equal(result.resolution.reason, 'half_step_not_representable');
  assert.equal(result.resolution.positionRMSEDifference, null);
});
