import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {comparePositionNoiseCovariance} from '../src/predictive-selection/covariance.mjs';
import {createPredictiveChallenge, exportPredictiveChallenge, importPredictiveChallenge} from '../src/predictive-selection/session.mjs';
import {covarianceRun, covarianceBundle, covarianceOptions as options} from './fixtures/covariance-course.mjs';
const source = () => {const runs = covarianceBundle().trainingRuns; return {runs, model: discoverAngularWeak(runs, options).candidates.find(m => m.id === 'rate+spring')};};
const fitOptions = {windowDuration: options.windowDuration, windowStride: options.windowStride};

test('complete residual comparison preserves source/model and never fits supplied initial rates', () => {
  const {runs, model} = source(), snapshot = structuredClone({runs, model});
  const result = comparePositionNoiseCovariance(model, runs, fitOptions);
  assert.equal(result.status, 'converged'); assert.ok(result.iterations.length > 1);
  assert.deepEqual({runs, model}, snapshot); assert.deepEqual(result.originalModel, model);
  assert.notDeepEqual(result.refinedModel.terms, model.terms);
  assert.equal(result.refinedModel.metrics.originalWeakScoreNotApplicable, true);
  assert.equal(result.refinedModel.metrics.score, undefined);
  const changedRates = structuredClone(runs); changedRates[0].initialRate = 999; changedRates[1].initialRate = -999;
  assert.deepEqual(comparePositionNoiseCovariance(model, changedRates, fitOptions), result);
});

test('recording blocks with identical local indices remain independent instead of singular cross-recording covariance', () => {
  const {runs, model} = source(), one = comparePositionNoiseCovariance(model, [runs[0]], fitOptions);
  const copy = structuredClone(runs[0]); copy.id = 'declared-repetition'; copy.source.recordingId = copy.id;
  const repeated = comparePositionNoiseCovariance(model, [runs[0], copy], fitOptions);
  assert.equal(repeated.status, 'converged'); assert.equal(repeated.reservation.blocks.length, 2);
  for (let i = 0; i < model.terms.length; i++) assert.ok(Math.abs(one.refinedModel.terms[i].coefficient - repeated.refinedModel.terms[i].coefficient) < 1e-10);
  // This algebraic duplicate control is not evidence of independent acquisition.
});

test('whole arithmetic, window and derivative-storage limits refuse before a partial comparison', () => {
  const {runs, model} = source();
  assert.throws(() => comparePositionNoiseCovariance(model, runs, {...fitOptions, maxWork: 1}), e => e.code === 'resource_limit');
  const many = [0, 1, 2].map(i => covarianceRun('many-' + i, 1 + i / 10, 0, {count: 401, step: .02}));
  assert.throws(() => comparePositionNoiseCovariance(model, many, {windowDuration: .2, windowStride: .01}), e => e.code === 'resource_limit');
  const dense = covarianceRun('dense', 1, 0, {count: 2000, step: .01});
  assert.throws(() => comparePositionNoiseCovariance(model, [dense], {windowDuration: 10, windowStride: .01}), /derivative-storage/);
});

test('iteration and rank failures retain evidence without an executable candidate', () => {
  const {runs, model} = source(), limited = comparePositionNoiseCovariance(model, runs, {...fitOptions, maxIterations: 1});
  assert.equal(limited.status, 'iteration_limit'); assert.equal(limited.iterations.length, 1); assert.equal(limited.refinedModel, null);
  const flat = structuredClone(runs); for (const run of flat) for (const row of run.samples) row.position = 1;
  const failed = comparePositionNoiseCovariance(model, flat, fitOptions);
  assert.equal(failed.status, 'refused'); assert.equal(failed.refinedModel, null); assert.equal(failed.error.code, 'unidentifiable');
  const zero = {...model, id: 'zero', terms: []};
  const noCoefficients = comparePositionNoiseCovariance(zero, runs, fitOptions);
  assert.equal(noCoefficients.status, 'no_coefficients'); assert.equal(noCoefficients.refinedModel, null);
});

test('unsupported derivatives, units, unbounded coefficients and hidden options cannot silently fall back', () => {
  const {runs, model} = source();
  const nonlinearRate = structuredClone(model); nonlinearRate.terms[0] = {id: 'coulomb', coefficient: -.2, coefficientUnit: 'rad/s²'};
  assert.throws(() => comparePositionNoiseCovariance(nonlinearRate, runs), e => e.code === 'unsupported_position_derivative');
  for (const update of [m => m.units.position = 'm', m => m.terms[0].coefficient = Infinity, m => m.physicalInertia = 1, m => m.terms[0].coefficientUnit = 'N']) {
    const invalid = structuredClone(model); update(invalid); assert.throws(() => comparePositionNoiseCovariance(invalid, runs), e => e.code === 'invalid_model');
  }
  assert.throws(() => comparePositionNoiseCovariance(model, runs, {diagonalFallback: true}), /supported/);
  const long = {...model, id: 'a'.repeat(240)}, result = comparePositionNoiseCovariance(long, runs, fitOptions);
  assert.equal(result.refinedModel.id.length, 240);
  assert.doesNotThrow(() => comparePositionNoiseCovariance(result.refinedModel, runs, fitOptions));
});

test('ordinary predictive consumer keeps the original and freezes both comparisons before separate challenge values', () => {
  const bundle = covarianceBundle(), plain = createPredictiveChallenge(bundle, options), compared = createPredictiveChallenge(bundle, options, null, {});
  assert.equal(compared.covariance.status, 'converged'); assert.deepEqual(compared.selection, plain.selection);
  assert.deepEqual(compared.results.filter(r => !r.modelId.endsWith('~position-covariance')), plain.results);
  const changed = structuredClone(bundle); changed.challengeRuns[0].samples[30].position += 5;
  const altered = createPredictiveChallenge(changed, options, null, {});
  assert.deepEqual(compared.covariance, altered.covariance); assert.deepEqual(compared.selection, altered.selection);
  assert.deepEqual(compared.results.map(r => r.rollout.rows.map(row => row.predicted)), altered.results.map(r => r.rollout.rows.map(row => row.predicted)));
  assert.notEqual(compared.results.at(-1).rollout.metrics.positionRMSE, altered.results.at(-1).rollout.metrics.positionRMSE);
});

test('v3 replay recomputes from original inputs; old v1/v2 defaults and optional forward comparison remain usable', () => {
  const b = covarianceBundle(), plain = createPredictiveChallenge(b, options), forward = createPredictiveChallenge(b, options, {sweeps: 1});
  assert.equal(JSON.parse(exportPredictiveChallenge(plain)).schema, 'worldlaw.predictive-notebook/v1');
  assert.equal(JSON.parse(exportPredictiveChallenge(forward)).schema, 'worldlaw.predictive-notebook/v2');
  assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(plain)), plain);
  assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(forward)), forward);
  const both = createPredictiveChallenge(b, options, {sweeps: 1}, {}), raw = JSON.parse(exportPredictiveChallenge(both));
  assert.equal(raw.schema, 'worldlaw.predictive-notebook/v3'); assert.equal(raw.covariance, undefined); assert.equal(raw.results, undefined);
  raw.covariance = {status: 'converged', refinedModel: {terms: []}}; raw.results = [{status: 'excellent'}];
  assert.deepEqual(importPredictiveChallenge(JSON.stringify(raw)), both);
  delete raw.covarianceOptions; assert.throws(() => importPredictiveChallenge(JSON.stringify(raw)), /explicit options/);
});

test('optional covariance work refusal preserves the completed baseline and serializes the refused request', () => {
  const b = covarianceBundle(), plain = createPredictiveChallenge(b, options), refused = createPredictiveChallenge(b, options, null, {maxWork: 1});
  assert.equal(refused.covariance.status, 'refused'); assert.equal(refused.covariance.error.code, 'resource_limit');
  assert.deepEqual(refused.results, plain.results); assert.deepEqual(refused.selection, plain.selection);
  assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(refused)), refused);
});

test('non-JSON covariance requests cannot change meaning between execution and source-only replay', () => {
  const b = covarianceBundle();
  for (const request of [[], {maxIterations: undefined}, {maxIterations: NaN}, {maxIterations: Infinity}, {maxIterations: () => 1}])
    assert.throws(() => createPredictiveChallenge(b, options, null, request), /finite JSON numbers/);
  const request = {maxIterations: 1}, state = createPredictiveChallenge(b, options, null, request);
  request.maxIterations = 10;
  assert.equal(state.covarianceOptions.maxIterations, 1);
  assert.equal(state.covariance.status, 'iteration_limit');
  assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(state)), state);
});
