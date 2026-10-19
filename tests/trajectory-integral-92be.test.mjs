import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {DiscoveryError, predict} from '../src/science/torque-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {springRun, gravityRun, dragRun, runComparison} from '../experiments/integral-discovery-92be.mjs';

const near = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b} exceeds ${tolerance}`);
const coefficient = (model, id) => model.terms.find(term => term.id === id)?.coefficient ?? 0;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function finiteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
}
function invalid(fn, code = 'invalid_input') {
  assert.throws(fn, error => error instanceof DiscoveryError && error.code === code);
}

function switchedCommandRun(epoch = 0) {
  const commands = [1, -.8, .3, .9, -1.2, .4, -.3, 1.1, .2, -.6, .1, .8, 900];
  const inertia = .7, initialRate = -.3, gain = 1.4, bias = .12;
  let position = .6, rate = initialRate;
  const samples = commands.map((command, i) => {
    if (i) {
      const dt = .125, acceleration = (gain * commands[i - 1] + bias) / inertia;
      position += rate * dt + acceleration * dt * dt / 2; rate += acceleration * dt;
    }
    return {time: epoch + i * .125, position, command};
  });
  return {id: 'switched-command', label: 'Exact piecewise constant acceleration', kind: 'synthetic', inertia,
    initialRate, samples, source: {label: 'Independent analytic acceleration recurrence'}};
}

test('exact ZOH command quadrature recovers gain/bias and preserves SI executable units', () => {
  const result = discoverIntegral([switchedCommandRun()], {terms: ['command', 'bias'], noiseSigma: 1e-10, maxTerms: 2});
  assert.equal(result.selected.id, 'command+bias');
  near(coefficient(result.selected, 'command'), 1.4, 1e-13);
  near(coefficient(result.selected, 'bias'), .12, 1e-13);
  assert.ok(result.selected.metrics.rmse < 1e-14);
  assert.equal(result.residualUnits, 'rad'); assert.equal(result.noiseSigmaUnits, 'rad');
  assert.equal(result.selected.units.jointTorque, 'N·m');
  near(predict(result.selected, {position: 0, rate: 0, command: .5}), .82, 1e-13);
  assert.equal(result.diagnostics.commandConvention, 'left_sample_zero_order_hold');
  assert.equal(result.diagnostics.runs[0].rateMethod, 'not_required');
  assert.equal(result.observations, undefined);
  finiteTree(result);
});

test('representable absolute time shifts preserve fitted coefficients and unused final command never affects the fit', () => {
  const options = {terms: ['command', 'bias'], noiseSigma: 1e-10};
  const a = discoverIntegral([switchedCommandRun()], options);
  const b = discoverIntegral([switchedCommandRun(2 ** 35)], options);
  assert.deepEqual(a.selected.terms, b.selected.terms);
  const altered = switchedCommandRun(); altered.samples.at(-1).command = -1e6;
  const c = discoverIntegral([altered], options);
  assert.deepEqual(a.selected.terms, c.selected.terms);
});

test('independent analytic damped springs recover physical coefficients and transfer to altered starts', () => {
  const runs = [springRun({id: 'spring-a', position: .8, command: .1}),
    springRun({id: 'spring-b', position: -1.3, command: -.3}), springRun({id: 'spring-c', position: 1.65, command: .35})];
  const result = discoverIntegral(runs, {noiseSigma: .0001});
  assert.equal(result.selected.id, 'command+rate+spring');
  near(coefficient(result.selected, 'command'), 1.3, .0003);
  near(coefficient(result.selected, 'rate'), -.22, .0001);
  near(coefficient(result.selected, 'spring'), -2.2, .0005);
  const heldOut = springRun({id: 'unseen-start', position: -2.2, rate: .7, command: -.2, duration: 8});
  const check = rollout(result.selected, heldOut, {maxStep: .005});
  assert.ok(check.metrics.positionRMSE < .001);
  assert.equal(result.trainingRuns.some(run => run.id === heldOut.id), false);
  assert.equal(result.diagnostics.runs[0].linearRateIntegral, 'position_integral_identity_no_differentiation');
});

test('independent fine-step nonlinear pendulum distinguishes sinusoidal restoration and transfers', () => {
  const result = discoverIntegral([gravityRun({id: 'g-a', position: .8, command: .1}),
    gravityRun({id: 'g-b', position: -1.3, command: -.3}), gravityRun({id: 'g-c', position: 1.65, command: .35})], {noiseSigma: .0001});
  assert.equal(result.selected.id, 'command+rate+gravity');
  near(coefficient(result.selected, 'gravity'), -2.2, .0005);
  const heldOut = gravityRun({id: 'gravity-unseen', position: 2.15, rate: -.65, command: -.18, duration: 8});
  assert.ok(rollout(result.selected, heldOut, {maxStep: .005}).metrics.positionRMSE < .001);
});

test('linear drag uses the position integral identity without any numerical rate estimation', () => {
  const result = discoverIntegral([springRun()], {terms: ['rate', 'spring'], maxTerms: 2, noiseSigma: .0001});
  assert.equal(result.diagnostics.runs[0].rateMethod, 'not_required');
  assert.equal(result.selected.domain.rate.source, 'declared_initial_rates_only');
  assert.ok(result.selected.metrics.rmse < .0001);
});

test('stationary unexcited runs report rank deficiency and finite ambiguity', () => {
  const run = springRun({id: 'stationary', position: 0, rate: 0});
  const result = discoverIntegral([run]);
  assert.equal(result.selected.id, 'zero');
  assert.equal(result.diagnostics.fullLibraryRank, 1);
  assert.equal(result.diagnostics.identifiability, 'insufficient_excitation');
  assert.equal(result.diagnostics.selectionAmbiguous, true);
  assert.ok(result.diagnostics.rankDeficientCandidates > 0);
  finiteTree(result);
});

test('JSON reopening retains executable models and returned training data does not alias inputs', () => {
  const runs = freeze([springRun({id: 'immutable'})]), options = freeze({terms: ['rate', 'spring'], noiseSigma: .0001});
  const before = JSON.stringify({runs, options}), result = discoverIntegral(runs, options);
  const restored = JSON.parse(JSON.stringify(result));
  assert.equal(predict(restored.selected, {position: .7, rate: -.2, command: 0}), predict(result.selected, {position: .7, rate: -.2, command: 0}));
  result.trainingRuns[0].samples[0].position = 99; result.trainingRuns[0].source.label = 'changed'; result.options.terms[0] = 'bias';
  assert.equal(JSON.stringify({runs, options}), before);
});

test('row stride has explicit source equation counts and full endpoints', () => {
  const result = discoverIntegral([springRun({dt: .025, duration: 1})], {terms: ['spring'], rowStride: 3});
  assert.equal(result.fitEquationCount, 14);
  assert.equal(result.diagnostics.runs[0].rawCount, 41);
  assert.equal(result.diagnostics.runs[0].equationCount, 14);
});

test('scaled QR remains finite at tiny valid inertia rather than silently discarding the nonzero structure', () => {
  const run = springRun({id: 'tiny-inertia', duration: 1, dt: .1}); run.inertia = 1e-200;
  const result = discoverIntegral([run], {terms: ['spring'], maxTerms: 1});
  assert.equal(result.selected.id, 'spring');
  assert.equal(result.diagnostics.fullLibraryRank, 1);
  finiteTree(result);
});

test('bad runs/options including sparse arrays reject with typed errors', () => {
  const run = springRun({duration: 1, dt: .1});
  for (const runs of [null, [], new Array(1), [null], [{...run, id: ' '}], [run, run], [{...run, kind: 'real'}],
    [{...run, inertia: 0}], [{...run, inertia: Infinity}], [{...run, initialRate: undefined}],
    [{...run, samples: new Array(9)}], [{...run, samples: run.samples.slice(0, 4)}],
    [{...run, samples: run.samples.map(sample => ({...sample, time: 0}))}],
    [{...run, samples: run.samples.map(sample => ({...sample, command: NaN}))}],
    [{...run, samples: run.samples.map(sample => ({...sample, position: Infinity}))}],
    [{...run, samples: run.samples.map((sample, i) => ({...sample, time: i * 2000}))}]]) invalid(() => discoverIntegral(runs));
  for (const options of [null, [], {terms: []}, {terms: new Array(1)}, {terms: ['spring', 'spring']}, {terms: ['unknown']},
    {noiseSigma: 0}, {noiseSigma: NaN}, {maxTerms: 8}, {maxTerms: 1.5}, {ambiguityDelta: -1},
    {rateWindowSize: 6}, {rateWindowSize: 3}, {rowStride: 0}, {rowStride: 1.5}]) invalid(() => discoverIntegral([run], options));
  invalid(() => discoverIntegral([run], {rowStride: 128}));
});

test('numerical-range failures reject instead of emitting nonfinite diagnostics', () => {
  const run = springRun({duration: 1, dt: .1});
  invalid(() => discoverIntegral([{...run, inertia: Number.MIN_VALUE}], {terms: ['spring']}), 'numerical_failure');
  const gaps = {...run, samples: run.samples.map((sample, i) => ({...sample, time: i === 0 ? 0 : i === 1 ? Number.MIN_VALUE : i}))};
  invalid(() => discoverIntegral([gaps], {terms: ['spring']}), 'numerical_failure');
});

test('noise sweep records independent forward improvement and retains concrete failures', async () => {
  const result = await runComparison();
  assert.equal(result.rows.length, 24);
  finiteTree(result);
  assert.equal(result.rows.filter(row => row.integralPositionRMSE < row.derivativePositionRMSE).length, 24);
  // Useful trajectory predictions do not imply exact term-set recovery.
  assert.ok(result.rows.some(row => row.integralModel.split('+').length === 4));
  const rateError = result.retainedCounterexamples.find(row => row.case.startsWith('incorrect_initial'));
  assert.ok(rateError.integralPositionRMSE > 20 * rateError.derivativePositionRMSE);
  const coarse = result.retainedCounterexamples.find(row => row.case.startsWith('coarse'));
  assert.ok(coarse.integralPositionRMSE > .2);
  const omitted = result.retainedCounterexamples.find(row => row.case.startsWith('omitted'));
  assert.equal(omitted.trainingAdequacy, 'not_falsified_on_training');
  assert.ok(omitted.integralPositionRMSE > .2);
  const inertia = result.retainedCounterexamples.find(row => row.case.startsWith('miscalibrated'));
  assert.ok(inertia.consistentWrongInertiaPositionRMSE < .001);
  assert.ok(Math.abs(coefficient(inertia.integralModel, 'spring') - inertia.trueSpringCoefficient) > .5);
  assert.ok(inertia.correctedInertiaPositionRMSE > .1);
});


test('first-derivative nonlinear terms recover analytic drag and retain honest smoothing bias', () => {
  for (const coulomb of [false, true]) {
    const training = [dragRun({id: 'drag-a', rate: 2.2, coulomb}), dragRun({id: 'drag-b', rate: -1.8, coulomb})];
    const result = discoverIntegral(training, {noiseSigma: .0001});
    assert.equal(result.diagnostics.runs[0].rateMethod, 'local_cubic_first_derivative');
    const expectedTerm = coulomb ? 'coulomb' : 'quadratic';
    near(coefficient(result.selected, expectedTerm), -.7, .001);
    const heldOut = dragRun({id: 'drag-altered-start', position: -.6, rate: 3, coulomb});
    assert.ok(rollout(result.selected, heldOut).metrics.positionRMSE < .001);
  }
});
