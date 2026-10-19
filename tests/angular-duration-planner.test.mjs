import test from 'node:test';
import assert from 'node:assert/strict';
import {planTrajectoryExperiment} from './support/trajectory-planner-baseline.mjs';
import {createAngularDurationPlanner, AngularDurationPlanningError} from '../src/experiment-design/angular-duration-planner.mjs';
import {ANGULAR_MODEL_UNITS, ANGULAR_COEFFICIENT_UNITS} from '../src/trajectory/angular-discovery.mjs';
import {angularDurationDesignReceipt} from '../experiments/angular-duration-design.mjs';

const scaleMeaning = 'angular_acceleration_only_absolute_torque_unknown';
const model = (id, terms) => ({schema: 'worldlaw.angular-model/v1', id,
  terms: terms.map(term => ({...term, coefficientUnit: ANGULAR_COEFFICIENT_UNITS[term.id]})), units: {...ANGULAR_MODEL_UNITS},
  scaleMeaning, physicalInertia: null, absoluteTorqueIdentified: false});
const discovery = models => ({schema: 'worldlaw.angular-discovery/v1', units: {...ANGULAR_MODEL_UNITS}, scaleMeaning,
  physicalInertia: null, absoluteTorqueIdentified: false, selected: models[0], candidates: models, competitive: models,
  trainingRuns: [{id: 'analytic-training'}], diagnostics: {adequacy: 'residual_mismatch'}, options: {noiseSigma: .01}, residualUnits: 'rad'});
const constant = () => discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
const design = overrides => ({inertia: null, dynamics: 'unforced_scalar_rotation', sampleInterval: .1,
  bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 0, max: 0}}, ...overrides});
const refuses = (fn, code) => assert.throws(fn, error => error instanceof AngularDurationPlanningError && error.code === code);
const plan = createAngularDurationPlanner(planTrajectoryExperiment);

test('a real finite duration comparison follows independent constant-acceleration scores', () => {
  const p = plan(constant(), design(), [1, 2, 4]);
  assert.equal(p.status, 'proposed'); assert.deepEqual(p.durations, [1, 2, 4]);
  assert.equal(p.selectedPlan.options.duration, 4); assert.equal(p.recordingRequest.duration, 4);
  for (const row of p.durationResults) {
    const samples = Math.round(row.duration / .1);
    const expected = Math.sqrt(Array.from({length: samples}, (_, i) => ((i + 1) / 10) ** 4).reduce((a, b) => a + b, 0) / samples);
    assert.ok(Math.abs(row.disagreementRad - expected) < 1e-12); assert.equal(row.status, 'proposed');
  }
  assert.equal(p.diagnostics.reservedUpperBound, 3000000);
  assert.ok(p.diagnostics.actualReservedSteps < p.diagnostics.reservedUpperBound);
  assert.equal(p.trainingFit.adequacy, 'residual_mismatch');
  assert.equal(p.physicalInertia, null); assert.equal(p.absoluteTorqueIdentified, false);
});

test('duration order cannot change the result, and input arrays remain unchanged', () => {
  const d = constant(), requested = design(), durations = [4, 1, 2], before = JSON.stringify({d, requested, durations});
  const a = plan(d, requested, durations), b = plan(d, requested, [1, 2, 4]);
  assert.deepEqual(a, b); assert.equal(JSON.stringify({d, requested, durations}), before);
});

test('the complete conservative budget is refused before invoking any duration', () => {
  let calls = 0;
  const bounded = createAngularDurationPlanner((...args) => {calls++; return planTrajectoryExperiment(...args);});
  refuses(() => bounded(constant(), design(), [1, 2, 4], {maxReservedSteps: 2999999}), 'resource_limit');
  assert.equal(calls, 0);
  const exact = bounded(constant(), design(), [1, 2, 4], {maxReservedSteps: 3000000});
  assert.equal(calls, 3); assert.equal(exact.diagnostics.maxReservedSteps, exact.diagnostics.reservedUpperBound);
});

test('invalid, duplicate, undersampled or ambiguous durations are refused before backend execution', () => {
  let calls = 0; const bounded = createAngularDurationPlanner((...args) => {calls++; return planTrajectoryExperiment(...args);});
  for (const durations of [[], [1, 1], [NaN], [0], [31], [1, 2, 3, 4, 5, 6, 7], [1.05]]) {
    refuses(() => bounded(constant(), design(), durations), 'invalid_duration_search');
  }
  refuses(() => bounded(constant(), {...design(), duration: 1}, [1, 2]), 'invalid_duration_search');
  assert.equal(calls, 0);
});

test('numerically unresolved duration winners are retained and produce no request', () => {
  const d = discovery([300, 301].map(k => model(`damping-${k}`, [{id: 'rate', coefficient: -k}])));
  const p = plan(d, design({bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}}}), [.1, .2]);
  assert.equal(p.status, 'numerically_unresolved'); assert.equal(p.selectedPlan, null); assert.equal(p.recordingRequest, null);
  assert.equal(p.durationResults.length, 2);
  assert.ok(p.durationResults.every(row => row.status === 'numerically_unresolved'));
  assert.equal(p.diagnostics.eligibleDurationCount, 0);
});

test('duration rows distinguish a no-proposal decision from numerically resolved low separation', () => {
  const d = discovery([280, 281].map(k => model(`damping-${k}`, [{id: 'rate', coefficient: -k}])));
  const p = plan(d, design({bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}}}), [.1]);
  assert.equal(p.durationResults[0].plannerStatus, 'uninformative');
  assert.equal(p.durationResults[0].qualificationStatus, 'no_proposal');
  assert.equal(p.durationResults[0].selectedScreenStatus, 'numerically_unresolved');
  assert.equal(p.durationResults[0].numericalScreenReason, 'step_sensitivity_exceeds_allowance');
  assert.ok(p.durationResults[0].pairwiseSensitivityRad > p.durationResults[0].disagreementRad);
  assert.equal(p.status, 'numerically_unresolved'); assert.equal(p.recordingRequest, null);
});

test('a later duration refusing its component budget cannot leave an earlier recommendation as a partial result', () => {
  const smallBudget = design({maxTotalSteps: 30});
  assert.throws(() => plan(constant(), smallBudget, [.1, 4]), error => error instanceof AngularDurationPlanningError &&
    error.code === 'duration_evaluation_refused' && error.failedDuration === 4 && error.completedDurationCount === 1 && error.cause?.code === 'resource_limit');
});

test('different per-duration model subsets cannot be compared as the same fixed ensemble', () => {
  const inconsistent = createAngularDurationPlanner((d, requested) => planTrajectoryExperiment(d,
    requested.duration === 2 ? {...requested, maxModels: 1} : requested));
  refuses(() => inconsistent(constant(), design(), [1, 2]), 'inconsistent_ensemble');
});

test('observed futures remain inaccessible throughout every duration evaluation', () => {
  const d = constant(), fail = () => {throw new Error('Future evidence read');};
  for (const key of ['challengeRuns', 'results', 'observations', 'oracle']) Object.defineProperty(d, key, {get: fail});
  for (const key of ['samples', 'source']) Object.defineProperty(d.trainingRuns[0], key, {get: fail});
  const p = plan(d, design(), [1, 2]);
  assert.equal(p.status, 'proposed');
  for (const forbidden of ['"samples"', '"command"', 'N·m', '"inertia":1']) assert.equal(JSON.stringify(p).includes(forbidden), false);
});

test('actual trained models choose four seconds while fixed-noise PASCO remains uninformative at every declared duration', () => {
  const receipt = angularDurationDesignReceipt(), synthetic = receipt.synthetic, measured = receipt.measured;
  assert.equal(synthetic.status, 'proposed'); assert.equal(synthetic.selectedDuration, 4);
  assert.equal(synthetic.recordingRequest.duration, 4);
  assert.deepEqual(synthetic.durationResults.map(row => row.duration), [2, 4, 8]);
  assert.ok(synthetic.durationResults[1].disagreementRad > synthetic.durationResults[2].disagreementRad);
  assert.equal(synthetic.diagnostics.actualReservedSteps, 1397520);
  assert.equal(measured.status, 'uninformative'); assert.equal(measured.selectedDuration, null); assert.equal(measured.recordingRequest, null);
  assert.ok(measured.durationResults.every(row => row.status === 'uninformative'));
  assert.equal(measured.trainingFit.noiseSigma, .01); assert.equal(measured.trainingFit.adequacy, 'residual_mismatch');
  assert.ok(measured.trainingFit.trainingRmseInNoiseUnits > 7.5);
  assert.equal(measured.diagnostics.actualReservedSteps, 485250);
});
