/** Independent receiving regression. The injected planner is explicitly the
 * frozen owner snapshot; actual adopted consumer receiving is recorded separately.
 * These checks keep observed negative results distinct from synthetic requests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverAngular, ANGULAR_MODEL_UNITS, ANGULAR_COEFFICIENT_UNITS} from '../src/trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {createAngularTrajectoryPlanner} from '../src/experiment-design/angular-planner.mjs';
import {createAngularDurationPlanner} from '../src/experiment-design/angular-duration-planner.mjs';
import {planTrajectoryExperiment} from './support/trajectory-planner-baseline.mjs';

const planAngular = createAngularTrajectoryPlanner(planTrajectoryExperiment);
const planDurations = createAngularDurationPlanner(planTrajectoryExperiment);
const options = {noiseSigma: .01, maxTerms: 4, ambiguityDelta: 6, rateWindowSize: 9};
const scaleMeaning = 'angular_acceleration_only_absolute_torque_unknown';
const fixture = name => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url)));
const failRead = () => {throw Error('Independent receiving: forbidden evidence read');};
function poisonAfterFit(discovery) {
  for (const key of ['challengeRuns', 'heldOut', 'results', 'observations', 'oracle', 'evaluation']) {
    Object.defineProperty(discovery, key, {get: failRead});
  }
  for (const run of discovery.trainingRuns) for (const key of ['samples', 'source']) {
    Object.defineProperty(run, key, {get: failRead});
  }
  return discovery;
}
function assertAngularBoundary(value, path = 'public') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['command', 'samples', 'acquisitionRequest', 'jointTorque'].includes(key), `${path}.${key}`);
    if (key === 'inertia' || key === 'physicalInertia') assert.equal(child, null, `${path}.${key}`);
    if (key === 'absoluteTorqueIdentified' || key === 'acquisitionPerformed' || key === 'physicalSetupVerified') {
      assert.equal(child, false, `${path}.${key}`);
    }
    if (typeof child === 'string') assert.doesNotMatch(child, /N·m|kg·m|worldlaw\.torque-model/, `${path}.${key}`);
    assertAngularBoundary(child, `${path}.${key}`);
  }
}
function analyticDiscovery(coefficients, term = 'rate') {
  const models = coefficients.map((coefficient, index) => ({schema: 'worldlaw.angular-model/v1', id: `candidate-${index}`,
    terms: [{id: term, coefficient, coefficientUnit: ANGULAR_COEFFICIENT_UNITS[term]}], units: {...ANGULAR_MODEL_UNITS},
    scaleMeaning, physicalInertia: null, absoluteTorqueIdentified: false}));
  return {schema: 'worldlaw.angular-discovery/v1', units: {...ANGULAR_MODEL_UNITS}, scaleMeaning,
    physicalInertia: null, absoluteTorqueIdentified: false, candidates: models, competitive: models,
    selected: models[0], trainingRuns: [{id: 'independent-analytic-training'}]};
}
const singletonDesign = extra => ({inertia: null, dynamics: 'unforced_scalar_rotation',
  bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}}, sampleInterval: .1, ...extra});

test('measured PASCO fixed-noise negative survives forbidden future/source/sample getters over every declared duration', () => {
  const source = fixture('physical-pasco-92be.json');
  Object.defineProperty(source, 'challengeRuns', {get: failRead});
  const fitted = discoverAngularWeak(source.trainingRuns, {...options, windowDuration: 1, windowStride: .5});
  const before = JSON.stringify(fitted), clean = JSON.parse(before);
  const requested = {inertia: null, dynamics: 'unforced_scalar_rotation', sampleInterval: .04, positionCount: 5, rateCount: 3,
    bounds: {initialPosition: {min: -.3, max: .3}, initialRate: {min: -.2, max: .2}},
    predictionBounds: {position: {min: -.6, max: .6}, rate: {min: -5, max: 5}}};
  const baseline = planDurations(clean, requested, [2, 4, 8]);
  const guarded = planDurations(poisonAfterFit(fitted), requested, [8, 2, 4]);
  assert.deepEqual(guarded, baseline);
  assert.equal(guarded.status, 'uninformative');
  assert.equal(guarded.selectedPlan, null); assert.equal(guarded.recordingRequest, null);
  assert.equal(guarded.trainingFit.noiseSigma, .01);
  assert.equal(guarded.trainingFit.adequacy, 'residual_mismatch');
  assert.ok(Math.abs(guarded.trainingFit.trainingRmseInNoiseUnits - 7.552353266677547) < 1e-10);
  assert.ok(guarded.durationResults.every(row => row.status === 'uninformative' && row.consideredModelCount === 5 && row.disagreementRad < .01));
  assertAngularBoundary(guarded);
  const single = planAngular(fitted, {...requested, duration: 4});
  assert.equal(single.qualification.selectedQualification.status, 'screen_passed');
  assert.equal(single.recordingRequest, null);
  assert.ok(Math.abs(single.selected.disagreementRad - .0016441598885423836) < 1e-12);
});

test('actually fitted synthetic unknown-scale observations choose a declared duration and export only a recording request', () => {
  const source = fixture('trajectory-ambiguous-92be.json');
  Object.defineProperty(source, 'challengeRuns', {get: failRead});
  const observed = source.trainingRuns.map(run => ({id: run.id, label: run.label, kind: 'synthetic',
    inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
    source: {label: 'Independent receiving: existing synthetic observations with torque scale withheld'},
    samples: run.samples.map(({time, position}) => ({time, position}))}));
  const fitted = poisonAfterFit(discoverAngular(observed, options));
  const planned = planDurations(fitted, {inertia: null, dynamics: 'unforced_scalar_rotation',
    bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
    predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}}, [8, 2, 4]);
  assert.equal(planned.status, 'proposed');
  assert.equal(planned.selectedPlan.options.duration, 4);
  assert.deepEqual(planned.durations, [2, 4, 8]);
  assert.ok(planned.durationResults[1].disagreementRad > planned.durationResults[2].disagreementRad);
  assert.equal(planned.selectedPlan.qualification.status, 'screen_passed');
  assert.equal(planned.selectedPlan.diagnostics.competitiveModelCount, 22);
  assert.equal(planned.selectedPlan.diagnostics.consideredModelCount, 8);
  assert.equal(planned.selectedPlan.diagnostics.omittedCompetitiveCount, 14);
  assert.equal(planned.recordingRequest.schema, 'worldlaw.angular-recording-request/v1');
  assert.equal(planned.recordingRequest.kind, 'requested_protocol_not_observed_evidence');
  assert.equal(planned.recordingRequest.duration, 4);
  assert.deepEqual(planned.recordingRequest.sourceTrainingRunIds, observed.map(run => run.id));
  assert.deepEqual(planned.recordingRequest.trainingRangeCheck.initialFields, ['position', 'rate']);
  assertAngularBoundary(planned);
});

test('a below-threshold unstable prediction remains numerically unresolved in the duration summary', () => {
  const fitted = analyticDiscovery([-100, -101]);
  const requested = singletonDesign({maxStep: .1, minDisagreement: .1});
  const single = planAngular(fitted, {...requested, duration: .1});
  assert.equal(single.plannerStatus, 'uninformative');
  assert.ok(single.selected.disagreementRad < .1);
  assert.equal(single.qualification.selectedQualification.status, 'numerically_unresolved');
  assert.ok(single.qualification.selectedQualification.pairwiseSensitivityRad > 2);
  assert.equal(single.status, 'numerically_unresolved');
  const combined = planDurations(fitted, requested, [.1]);
  assert.equal(combined.status, 'numerically_unresolved'); assert.equal(combined.recordingRequest, null);
  assert.equal(combined.durationResults[0].selectedScreenStatus, 'numerically_unresolved');
});

test('a failed member never leaves a survivor-only duration score or request', () => {
  const fitted = analyticDiscovery([0, 1e8], 'spring');
  const combined = planDurations(fitted, singletonDesign({
    bounds: {initialPosition: {min: 1, max: 1}, initialRate: {min: 0, max: 0}}}), [.1, .2]);
  assert.equal(combined.status, 'no_feasible_design');
  assert.equal(combined.selectedPlan, null); assert.equal(combined.recordingRequest, null);
  for (const row of combined.durationResults) {
    assert.equal(row.consideredModelCount, 2); assert.equal(row.disagreementRad, null);
    assert.equal(row.refusedDesignCount, 1); assert.equal(row.evaluatedDesignCount, 0);
  }
});

test('same model IDs with changed coefficients across durations are refused as a changed ensemble', () => {
  const fitted = analyticDiscovery([0, 2], 'bias'); let calls = 0;
  const injected = createAngularDurationPlanner((input, requested) => {
    const computed = planTrajectoryExperiment(input, requested);
    if (++calls === 1) fitted.candidates[1].terms[0].coefficient = 3;
    return computed;
  });
  assert.throws(() => injected(fitted, singletonDesign(), [.1, .2]), error => error.code === 'inconsistent_ensemble');
  assert.equal(calls, 2);
});

test('complete search reservation refuses before running any duration and never returns a partial recommendation', () => {
  let calls = 0;
  const injected = createAngularDurationPlanner((...args) => {calls++; return planTrajectoryExperiment(...args);});
  const fitted = analyticDiscovery([0, 2], 'bias');
  assert.throws(() => injected(fitted, singletonDesign(), [.1, .2], {maxReservedSteps: 1999999}), error => error.code === 'resource_limit');
  assert.equal(calls, 0);
  assert.throws(() => injected(fitted, singletonDesign({maxTotalSteps: 30}), [.1, 4]), error =>
    error.code === 'duration_evaluation_refused' && error.failedDuration === 4 && error.completedDurationCount === 1);
  assert.equal(calls, 2);
});
