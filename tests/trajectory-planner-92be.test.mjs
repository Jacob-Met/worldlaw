import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planTrajectoryExperiment, TrajectoryPlanningError} from '../src/trajectory/planner.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';
import {originalFixtureReceipt} from '../experiments/trajectory-planning-92be.mjs';
const fixture = () => JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url)));
const design = () => ({inertia: .8, bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
  predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}});
const model = (id, terms) => ({schema: 'worldlaw.torque-model/v1', id, terms, units: {...UNITS}});
const discovery = models => ({schema: 'worldlaw.discovery/v1', units: {...UNITS}, selected: models[0], candidates: models, competitive: models, trainingRuns: [{id: 'training-only'}]});
const refuses = (fn, code) => assert.throws(fn, error => error instanceof TrajectoryPlanningError && error.code === code);
function freeze(value) {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value;}

test('actual small-angle training proposes a bounded whole trajectory and preserves training model order', () => {
  const b = fixture(), d = discoverIntegral(b.trainingRuns, {noiseSigma: .01, maxTerms: 4}), p = planTrajectoryExperiment(d, design());
  assert.equal(p.status, 'proposed'); assert.equal(p.selected.initialPosition, -2.2); assert.equal(p.selected.initialRate, -.6);
  assert.ok(p.selected.disagreementRad > 1.3 && p.selected.disagreementRad < 1.31);
  assert.equal(p.selected.predictions.length, 8); assert.ok(p.selected.predictions.every(prediction => prediction.rows.length === 201));
  assert.deepEqual(p.provenance.modelIds, d.candidates.slice(0, 8).map(model => model.id));
  assert.equal(p.diagnostics.omittedCompetitiveCount, 14); assert.equal(p.diagnostics.reservedSteps, 210816);
  assert.ok(p.diagnostics.reservedSteps <= p.options.maxTotalSteps);
  assert.equal(p.diagnostics.acquisitionPerformed, false); assert.equal(p.diagnostics.predictionsAreObservations, false);
  assert.deepEqual(Object.keys(p.selected.acquisitionRequest).sort(), ['duration', 'initialPosition', 'initialRate', 'sampleInterval']);
  assert.ok(p.selected.predictions.every(prediction => prediction.rows.every(row => !Object.hasOwn(row, 'observed') && !Object.hasOwn(row, 'residual'))));
});

test('pairwise position disagreement has exact radian meaning on constant-acceleration analytic models', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const p = planTrajectoryExperiment(d, {inertia: 2, bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 0, max: 0}},
    duration: 2, sampleInterval: .5, maxStep: .1, minDisagreement: 0});
  const expected = Math.sqrt([.5, 1, 1.5, 2].reduce((sum, t) => sum + (.5 * t * t) ** 2, 0) / 4);
  assert.ok(Math.abs(p.selected.disagreementRad - expected) < 1e-13); assert.equal(p.scoreUnits, 'rad');
  assert.equal(p.diagnostics.initialSampleExcludedFromScore, true); assert.ok(Math.abs(p.selected.maxPositionRangeRad - 2) < 1e-13);
});

test('planner never reads observed futures, challenge fields, raw training samples or instrument truth metadata', () => {
  const b = fixture(), d = discoverIntegral(b.trainingRuns), wanted = planTrajectoryExperiment(d, design());
  const fail = () => {throw new Error('Forbidden evidence access');};
  for (const key of ['challengeRuns', 'observations', 'oracle', 'results']) Object.defineProperty(d, key, {get: fail});
  for (const run of d.trainingRuns) {Object.defineProperty(run, 'samples', {get: fail}); Object.defineProperty(run, 'source', {get: fail});}
  assert.deepEqual(planTrajectoryExperiment(d, design()), wanted);
  refuses(() => planTrajectoryExperiment(d, {...design(), challengeRuns: b.challengeRuns}), 'invalid_design');
});

test('immutable inputs remain unchanged, repeated calls are deterministic, and model changes update provenance', () => {
  const d = discoverIntegral(fixture().trainingRuns), options = design(), before = JSON.stringify({d, options});
  const p = planTrajectoryExperiment(freeze(d), freeze(options));
  assert.equal(JSON.stringify({d, options}), before); assert.deepEqual(planTrajectoryExperiment(d, options), p);
  const changed = JSON.parse(before).d; changed.candidates[0].terms[0].coefficient -= .01;
  const q = planTrajectoryExperiment(changed, options);
  assert.notEqual(q.provenance.modelFingerprint, p.provenance.modelFingerprint);
  p.provenance.trainingRunIds[0] = 'changed'; assert.equal(d.trainingRuns[0].id, 'fit-small-positive');
});

test('exact zero-disagreement ties preserve grid order and remain uninformative', () => {
  const d = discovery([model('zero-a', []), model('zero-b', [])]);
  const p = planTrajectoryExperiment(d, {inertia: 1, bounds: {initialPosition: {min: -1, max: 1}, initialRate: {min: -1, max: 1}},
    duration: 1, sampleInterval: .1, positionCount: 3, rateCount: 3});
  assert.equal(p.status, 'uninformative'); assert.equal(p.selected.index, 0);
  assert.equal(p.selected.disagreementRad, 0); assert.deepEqual(p.ranked.map(item => item.index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const single = planTrajectoryExperiment(discovery([model('single-wrong-law', [])]), design());
  assert.equal(single.status, 'uninformative'); assert.equal(single.selected.disagreementRad, 0);
});

test('competitive-list display order cannot replace the original training candidate ordering', () => {
  const d = discoverIntegral(fixture().trainingRuns), p = planTrajectoryExperiment(d, design());
  d.competitive.reverse();
  assert.deepEqual(planTrajectoryExperiment(d, design()), p);
});

test('candidate runaway or declared envelope violation makes a design ineligible rather than maximally informative', () => {
  const unstable = discovery([model('zero', []), model('explosive', [{id: 'spring', coefficient: 1e8}])]);
  const options = {inertia: 1, bounds: {initialPosition: {min: 1, max: 1}, initialRate: {min: 0, max: 0}}, duration: 1, sampleInterval: .1};
  const failed = planTrajectoryExperiment(unstable, options);
  assert.equal(failed.status, 'no_feasible_design'); assert.equal(failed.selected, null);
  assert.equal(failed.ranked[0].disagreementRad, null); assert.equal(failed.ranked[0].failures[0].code, 'runaway_state');
  const finite = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const bounded = planTrajectoryExperiment(finite, {...options, predictionBounds: {position: {min: -.5, max: .5}, rate: {min: -1, max: 1}}});
  assert.equal(bounded.status, 'no_feasible_design'); assert.ok(bounded.ranked[0].failures.every(failure => failure.code === 'prediction_bounds'));
});

test('whole-grid work is refused before partial comparison when the shared budget cannot cover it', () => {
  const d = discoverIntegral(fixture().trainingRuns);
  refuses(() => planTrajectoryExperiment(d, {...design(), maxTotalSteps: 210815}), 'resource_limit');
  const exact = planTrajectoryExperiment(d, {...design(), maxTotalSteps: 210816});
  assert.equal(exact.diagnostics.reservedSteps, exact.options.maxTotalSteps);
  refuses(() => planTrajectoryExperiment(d, {...design(), positionCount: 17, rateCount: 9}), 'resource_limit');
});

test('sampled prediction-envelope checks explicitly retain the between-sample excursion counterexample', () => {
  const d = discovery([model('one-cycle', [{id: 'spring', coefficient: -((2 * Math.PI) ** 2)}]),
    model('two-cycles', [{id: 'spring', coefficient: -((4 * Math.PI) ** 2)}])]);
  const p = planTrajectoryExperiment(d, {inertia: 1, bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}},
    duration: 1, sampleInterval: 1, maxStep: .001, minDisagreement: 0,
    predictionBounds: {position: {min: -.01, max: .01}, rate: {min: -2, max: 2}}});
  assert.equal(p.diagnostics.refusedDesignCount, 0);
  assert.ok(p.selected.predictions.every(prediction => prediction.rows.every(row => Math.abs(row.position) < .01)));
  assert.ok(Math.sin(2 * Math.PI * .25) / (2 * Math.PI) > .01); // Exact trajectory between samples.
  assert.match(p.diagnostics.predictionBoundsEvaluation, /scheduled_sample/);
  assert.ok(p.diagnostics.limitations.some(text => text.includes('between samples can be missed')));
});

test('invalid units, unsupported angular scale, malformed ensembles and absent explicit bounds are refused', () => {
  const d = discoverIntegral(fixture().trainingRuns);
  for (const options of [undefined, {}, {...design(), inertia: null}, {...design(), bounds: {initialPosition: {min: 2, max: 1}, initialRate: {min: 0, max: 0}}}, {...design(), duration: 8.01}]) {
    refuses(() => planTrajectoryExperiment(d, options), 'invalid_design');
  }
  refuses(() => planTrajectoryExperiment({...d, schema: 'worldlaw.angular-discovery/v1'}, design()), 'invalid_discovery');
  const units = structuredClone(d); units.units.jointTorque = 'rad/s²'; refuses(() => planTrajectoryExperiment(units, design()), 'invalid_discovery');
  const missing = structuredClone(d); delete missing.trainingRuns; refuses(() => planTrajectoryExperiment(missing, design()), 'missing_training_provenance');
  const sparse = structuredClone(d); sparse.competitive = new Array(2); refuses(() => planTrajectoryExperiment(sparse, design()), 'invalid_discovery');
});

test('a whole independently acquired planned release revises the ambiguous law while the original challenge remains fixed', () => {
  const receipt = originalFixtureReceipt();
  assert.equal(receipt.selectedBefore, 'rate+spring'); assert.ok(receipt.before.positionRMSE > .5);
  assert.equal(receipt.strategies.planned.sampleCount, 201);
  assert.equal(receipt.strategies.planned.selectedModel, 'rate+gravity');
  assert.ok(receipt.strategies.planned.receive.positionRMSE < .001);
  assert.equal(receipt.strategies.passiveSmall.selectedModel, 'rate+spring'); assert.ok(receipt.strategies.passiveSmall.receive.positionRMSE > .5);
  assert.equal(receipt.strategies.fixedWide.selectedModel, 'rate+gravity'); assert.ok(receipt.strategies.fixedWide.receive.positionRMSE < .001);
});
