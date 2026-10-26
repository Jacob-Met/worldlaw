import test from 'node:test';
import assert from 'node:assert/strict';
import { compareStudioDynamics, STUDIO_COMPARISON_LIMITS } from '../src/science/studio-dynamics-comparison.mjs';
import { executeStudioDynamics } from '../src/science/studio-dynamics.mjs';

const law = (id, terms) => ({
  schema: 'worldlaw.torque-model/v1', id, equation: `control ${id}`,
  terms: Object.entries(terms).map(([term, coefficient]) => ({ id: term, coefficient })),
});
const discovery = (...competitive) => ({ schema: 'worldlaw.discovery/v1', competitive });
const initial = { position: 1, rate: 0 };
const settings = { duration: 0.5, dt: 0.025, inertia: 1, command: 0 };
const deepFreeze = value => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
};

test('every independent oscillator follows its own analytic oracle from the exact same initial state', () => {
  const source = discovery(law('slow', { spring: -1 }), law('fast', { spring: -4 }));
  const result = compareStudioDynamics(source, initial, settings);
  assert.equal(result.status, 'completed');
  assert.equal(result.completedCount, 2);
  assert.equal(result.refusedCount, 0);
  assert.deepEqual(result.results.map(row => row.id), ['slow', 'fast']);
  assert.deepEqual(result.results.map(row => row.equation), ['control slow', 'control fast']);
  for (let index = 0; index < result.results.length; index++) {
    const row = result.results[index], omega = index + 1;
    assert.equal(row.trajectory[0].position, initial.position);
    assert.equal(row.trajectory[0].rate, initial.rate);
    for (const sample of row.trajectory) {
      assert.ok(Math.abs(sample.position - Math.cos(omega * sample.time)) < 2e-7);
      assert.ok(Math.abs(sample.rate + omega * Math.sin(omega * sample.time)) < 3e-7);
    }
  }
  const expected = Math.cos(0.5) - Math.cos(1);
  assert.ok(Math.abs(result.summary.maxPositionSpread - expected) < 3e-7);
  assert.equal(result.summary.maxPositionSpreadTime, 0.5);
  assert.match(result.summary.interpretation, /sample times only/);
  assert.match(result.summary.interpretation, /not a continuous-time bound/);
});

test('changed command, inertia, release position and rate reach every law through a separate constant-acceleration oracle', () => {
  const source = discovery(law('command', { command: 1 }), law('command-bias', { command: 1.5, bias: -0.2 }));
  for (const [command, inertia, position, rate] of [[0.8, 2.4, -0.3, 0.7], [-0.4, 0.6, 0.9, -0.2]]) {
    const release = { position, rate };
    const options = { duration: 0.337, dt: 0.03, command, inertia };
    const result = compareStudioDynamics(source, release, options);
    assert.equal(result.status, 'completed');
    const accelerations = [command / inertia, (1.5 * command - 0.2) / inertia];
    for (let index = 0; index < result.results.length; index++) {
      const acceleration = accelerations[index];
      for (const sample of result.results[index].trajectory) {
        assert.ok(Math.abs(sample.position - (position + rate * sample.time + 0.5 * acceleration * sample.time ** 2)) < 1e-12);
        assert.ok(Math.abs(sample.rate - (rate + acceleration * sample.time)) < 1e-12);
      }
    }
  }
});

test('identical laws give identical trajectories and zero sampled spread without mutating evidence', () => {
  const source = deepFreeze(discovery(law('one', { spring: -4 }), law('two', { spring: -4 })));
  const inputs = deepFreeze({ position: 0.7, rate: -0.3 });
  const options = deepFreeze({ ...settings, duration: 0.337, dt: 0.03 });
  const before = JSON.stringify({ source, inputs, options });
  const result = compareStudioDynamics(source, inputs, options);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.results[0].trajectory, result.results[1].trajectory);
  assert.equal(result.summary.maxPositionSpread, 0);
  assert.equal(result.summary.maxRateSpread, 0);
  assert.equal(JSON.stringify({ source, inputs, options }), before);
  assert.deepEqual(result, compareStudioDynamics(source, inputs, options));
});

test('candidate order changes neither fair budgets nor the corresponding numerical trajectories', () => {
  const a = law('a', { spring: -3 }), b = law('b', { spring: -7 });
  const forward = compareStudioDynamics(discovery(a, b), initial, settings);
  const reverse = compareStudioDynamics(discovery(b, a), initial, settings);
  assert.equal(forward.status, 'completed');
  assert.equal(reverse.status, 'completed');
  assert.deepEqual(reverse.results.map(row => row.id), ['b', 'a']);
  assert.deepEqual(forward.work, reverse.work);
  assert.deepEqual(forward.results[0].trajectory, reverse.results[1].trajectory);
  assert.deepEqual(forward.results[1].trajectory, reverse.results[0].trajectory);
});

test('mixed smooth/sign-rate laws retain maintained methods on the exact inclusive nonmultiple grid', () => {
  const models = [law('smooth', { spring: -4 }), law('sign', { spring: -4, coulomb: -0.6 })];
  const options = { duration: 0.37, dt: 0.02, inertia: 1, command: 0 };
  const result = compareStudioDynamics(discovery(...models), initial, options);
  assert.equal(result.status, 'completed');
  const expectedTimes = Array.from({ length: 20 }, (_, index) => index === 19 ? 0.37 : index * 0.02);
  for (let index = 0; index < models.length; index++) {
    assert.deepEqual(result.results[index].trajectory.map(row => row.time), expectedTimes);
    assert.deepEqual(result.results[index].trajectory,
      executeStudioDynamics(models[index], initial, result.settings).trajectory);
  }
  assert.equal(result.results[0].diagnostics.method, 'adaptive_RK4_step_doubling');
  assert.equal(result.results[1].diagnostics.method, 'classical_RK4');
  assert.match(result.results[1].diagnostics.interpretation, /No local error control/);
  const adaptive = result.results[0].diagnostics;
  const actualWork = adaptive.derivativeEvaluations + adaptive.outputEvaluations + 4 * 19 + 20;
  assert.ok(actualWork <= result.work.totalReservedEvaluations);
  assert.ok(result.work.totalReservedEvaluations <= result.work.maxTotalEvaluations);
});

test('sample admission counts the initial state and final endpoint for every original law', () => {
  const source = discovery(law('a', {}), law('b', {}));
  const options = { duration: 0.25, dt: 0.1 };
  const admitted = compareStudioDynamics(source, initial, options, { maxTotalSamples: 8 });
  assert.equal(admitted.status, 'completed');
  assert.deepEqual(admitted.results[0].trajectory.map(row => row.time), [0, 0.1, 0.2, 0.25]);
  assert.equal(admitted.work.totalSamples, 8);
  const refused = compareStudioDynamics(source, initial, options, { maxTotalSamples: 7 });
  assert.equal(refused.status, 'refused');
  assert.equal(refused.results.length, 2);
  for (const row of refused.results) {
    assert.equal(row.error.code, 'comparison_sample_limit');
    assert.equal(row.trajectory, undefined);
  }
  assert.equal(refused.summary, undefined);
});

test('equal original-candidate evaluation shares include output torques and cannot borrow fixed-law savings', () => {
  const source = discovery(law('smooth', {}), law('sign', { coulomb: -0.1 }));
  const options = { duration: 1, dt: 0.1 };
  const result = compareStudioDynamics(source, initial, options, { maxTotalEvaluations: 260 });
  // Smooth needs at least 10*12+11=131, fixed needs 10*4+11=51.
  // A total of 260 can cover those minima but its equal shares of 130 cannot.
  assert.equal(result.status, 'refused');
  assert.equal(result.work.perModelEvaluationLimit, 130);
  assert.equal(result.results.length, 2);
  for (const row of result.results) assert.equal(row.error.code, 'comparison_work_limit');
  assert.equal(result.summary, undefined);
  const fixedOnly = compareStudioDynamics(discovery(law('fixed', { coulomb: -0.1 })), initial,
    { duration: 0.1, dt: 0.1 }, { maxTotalEvaluations: 6 });
  assert.equal(fixedOnly.status, 'completed');
  assert.equal(fixedOnly.results[0].reservedEvaluations, 6);
  assert.equal(fixedOnly.work.totalReservedEvaluations, 6);
});

test('an exhausted competitor remains explicit and cannot turn a surviving path into complete agreement', () => {
  const result = compareStudioDynamics(discovery(law('easy', {}), law('fast', { spring: -40000 })), initial,
    { duration: 1, dt: 0.1, maxTrials: 20 });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.completedCount, 1);
  assert.equal(result.refusedCount, 1);
  assert.equal(result.results[0].status, 'completed');
  assert.equal(result.results[1].status, 'refused');
  assert.equal(result.results[1].error.code, 'step_limit');
  assert.equal(result.results[1].trajectory, undefined);
  assert.equal(result.summary, undefined);
});

test('invalid competitors and common inputs remain visible refusals rather than omitted laws', () => {
  const result = compareStudioDynamics(discovery(law('good', {}), law('bad', { unknown: 1 })), initial, settings);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.results.map(row => row.id), ['good', 'bad']);
  assert.equal(result.results[1].error.code, 'invalid_input');
  assert.equal(result.summary, undefined);
  const source = discovery(law('one', {}), law('two', {}));
  for (const patch of [{ dt: 0 }, { duration: Infinity }, { duration: null }, { dt: null },
    { maxTrials: null }, { maxTrials: 0 }, { maxTrials: 1.5 }, { maxTrials: 100001 },
    { inertia: 0 }, { relativeTolerance: 0 }]) {
    const failed = compareStudioDynamics(source, initial, { ...settings, ...patch });
    assert.equal(failed.status, 'refused', JSON.stringify(patch));
    assert.equal(failed.results.length, 2);
    assert.ok(failed.results.every(row => row.status === 'refused' && row.error.message));
    assert.equal(failed.summary, undefined);
  }
  const failedState = compareStudioDynamics(source, { position: Infinity, rate: 0 }, settings);
  assert.equal(failedState.status, 'refused');
  assert.equal(failedState.results.length, 2);
});

test('the comparison policy can tighten but cannot silently remove the declared work and sample ceilings', () => {
  const source = discovery(law('one', {}));
  for (const policy of [{ maxTotalEvaluations: 0 }, { maxTotalEvaluations: Infinity },
    { maxTotalEvaluations: STUDIO_COMPARISON_LIMITS.maxTotalEvaluations + 1 },
    { maxTotalSamples: null }, { maxTotalSamples: 1.5 },
    { maxTotalSamples: STUDIO_COMPARISON_LIMITS.maxTotalSamples + 1 }]) {
    const result = compareStudioDynamics(source, initial, settings, policy);
    assert.equal(result.status, 'refused');
    assert.equal(result.results[0].error.code, 'invalid_policy');
  }
  assert.equal(compareStudioDynamics(discovery(), initial, settings).status, 'refused');
  assert.equal(compareStudioDynamics(null, initial, settings).status, 'refused');
});
