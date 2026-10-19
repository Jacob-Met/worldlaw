import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planTrajectoryExperiment} from './support/trajectory-planner-baseline.mjs';
import {createAngularTrajectoryPlanner, AngularPlanningError} from '../src/experiment-design/angular-planner.mjs';
import {ANGULAR_MODEL_UNITS, ANGULAR_COEFFICIENT_UNITS} from '../src/trajectory/angular-discovery.mjs';
import {rolloutAngularWithResolution} from '../src/trajectory/angular-resolution.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {angularRecordingDesignReceipt} from '../experiments/angular-recording-design.mjs';

const SCALE = 'angular_acceleration_only_absolute_torque_unknown';
const model = (id, terms) => ({schema: 'worldlaw.angular-model/v1', id,
  terms: terms.map(term => ({...term, coefficientUnit: ANGULAR_COEFFICIENT_UNITS[term.id]})), units: {...ANGULAR_MODEL_UNITS},
  scaleMeaning: SCALE, physicalInertia: null, absoluteTorqueIdentified: false,
  domain: {position: {min: -.1, max: .1}, rate: {min: -.1, max: .1}}});
const discovery = models => ({schema: 'worldlaw.angular-discovery/v1', units: {...ANGULAR_MODEL_UNITS},
  scaleMeaning: SCALE, physicalInertia: null, absoluteTorqueIdentified: false, selected: models[0], candidates: models,
  competitive: models, trainingRuns: [{id: 'declared-training'}], method: 'independent_analytic_models', residualUnits: 'rad',
  diagnostics: {adequacy: 'residual_mismatch'}, options: {noiseSigma: .01}});
const design = options => ({inertia: null, dynamics: 'unforced_scalar_rotation',
  bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 0, max: 0}}, duration: 1, sampleInterval: .1,
  maxStep: .01, minDisagreement: .01, ...options});
const plan = createAngularTrajectoryPlanner(planTrajectoryExperiment);
const refuses = (fn, code) => assert.throws(fn, error => error instanceof AngularPlanningError && error.code === code);
const freeze = value => {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value;};

test('angular planning emits a requested recording protocol, never proxy inertia or acquired samples', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const p = plan(d, design());
  assert.equal(p.schema, 'worldlaw.angular-trajectory-plan/v1'); assert.equal(p.status, 'proposed');
  assert.equal(p.qualification.status, 'screen_passed'); assert.equal(p.physicalInertia, null);
  assert.equal(p.options.inertia, null); assert.equal(p.selected.inertia, null); assert.equal(p.absoluteTorqueIdentified, false);
  assert.ok(p.ranked.every(row => row.inertia === null));
  assert.equal(p.recordingRequest.kind, 'requested_protocol_not_observed_evidence');
  assert.equal(p.recordingRequest.acquisitionPerformed, false); assert.equal(p.recordingRequest.physicalSetupVerified, false);
  assert.equal(p.recordingRequest.initialRate, 0); assert.equal(p.recordingRequest.duration, 1);
  const serialized = JSON.stringify(p);
  for (const forbidden of ['"command"', 'N·m', 'worldlaw.torque-model', '"inertia":1', '"observed"', '"residual"', '"samples"', '"acquisitionRequest"']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('private numerical composition matches the published angular rollout wrapper', () => {
  const models = [model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])], d = discovery(models), p = plan(d, design());
  const run = {id: 'independent-wrapper-schedule', label: 'Unobserved analytic schedule', kind: 'synthetic',
    dynamics: 'unforced_scalar_rotation', inertia: null, initialRate: 0, source: {label: 'Analytic numerical equivalence only'},
    samples: Array.from({length: 11}, (_, i) => ({time: i / 10, position: 0}))};
  for (const candidate of models) {
    const direct = rolloutAngularWithResolution(candidate, run, {maxStep: .01, maxSteps: 1000});
    const prediction = p.selected.predictions.find(row => row.modelId === candidate.id);
    assert.deepEqual(prediction.rows, direct.rollout.rows.map(({time, predicted, rate}) => ({time, position: predicted, rate})));
  }
  const analytic = Math.sqrt(Array.from({length: 10}, (_, i) => ((i + 1) / 10) ** 4).reduce((a, b) => a + b, 0) / 10);
  assert.ok(Math.abs(p.selected.disagreementRad - analytic) < 1e-13);
});

test('training residual mismatch survives an informative numerically resolved recommendation', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]), p = plan(d, design());
  assert.equal(p.status, 'proposed'); assert.equal(p.trainingFit.adequacy, 'residual_mismatch');
  assert.equal(p.trainingFit.noiseSigma, .01); assert.equal(p.recordingRequest.trainingAdequacy, 'residual_mismatch');
  assert.match(p.diagnostics.limitations.join(' '), /training residual mismatch is retained/);
  assert.equal(p.diagnostics.physicalSetupVerified, false);
});

test('initial and predicted extrapolation is disclosed without silently changing the declared search bounds', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const p = plan(d, design({bounds: {initialPosition: {min: .3, max: .3}, initialRate: {min: 0, max: 0}}}));
  assert.equal(p.selected.initialPosition, .3); assert.deepEqual(p.selected.trainingRangeCheck.initialFields, ['position']);
  assert.deepEqual(p.selected.trainingRangeCheck.predictedFields, ['position', 'rate']);
  assert.deepEqual(p.recordingRequest.trainingRangeCheck, p.selected.trainingRangeCheck);
  assert.deepEqual(p.options.bounds.initialPosition, {min: .3, max: .3});
});

test('a numerically unstable angular proposal is withheld as a recording request', () => {
  const d = discovery([300, 301].map(k => model(`damping-${k}`, [{id: 'rate', coefficient: -k}])));
  const p = plan(d, design({bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}}, duration: .1}));
  assert.equal(p.plannerStatus, 'proposed'); assert.equal(p.status, 'numerically_unresolved'); assert.equal(p.recordingRequest, null);
  assert.equal(p.qualification.selectedQualification.modelChecks.length, 2);
  assert.ok(p.qualification.selectedQualification.pairwiseSensitivityRad > .17);
});

test('a coarse uninformative result does not conceal unresolved angular step sensitivity', () => {
  const d = discovery([280, 281].map(k => model(`damping-${k}`, [{id: 'rate', coefficient: -k}])));
  const p = plan(d, design({bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}}, duration: .1}));
  assert.equal(p.plannerStatus, 'uninformative'); assert.ok(p.selected.disagreementRad < .01);
  assert.equal(p.qualification.status, 'no_proposal');
  assert.equal(p.qualification.selectedQualification.status, 'numerically_unresolved');
  assert.equal(p.status, 'numerically_unresolved'); assert.equal(p.diagnostics.numericalScreening, 'numerically_unresolved');
  assert.equal(p.recordingRequest, null);
});

test('unforced assumption, unknown scale and angular coefficient units cannot be supplied silently', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  for (const supplied of [{...design(), inertia: 1}, {...design(), command: 0}, {...design(), dynamics: 'forced_rotation'},
    {...design(), jointTorque: 0}, {...design(), challengeRuns: []}]) refuses(() => plan(d, supplied), 'invalid_angular_design');
  const wrongUnits = structuredClone(d); wrongUnits.candidates[1].terms[0].coefficientUnit = 'N·m';
  refuses(() => plan(wrongUnits, design()), 'invalid_angular_discovery');
  const knownScale = structuredClone(d); knownScale.physicalInertia = 1;
  refuses(() => plan(knownScale, design()), 'invalid_angular_discovery');
  const torque = structuredClone(d); torque.units.jointTorque = 'N·m';
  refuses(() => plan(torque, design()), 'invalid_angular_discovery');
  refuses(() => createAngularTrajectoryPlanner(null), 'invalid_planner');
});

test('the injected planner receives no future evidence, source metadata or raw training samples', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const fail = () => {throw new Error('Forbidden evidence access');};
  for (const key of ['challengeRuns', 'results', 'observations', 'oracle']) Object.defineProperty(d, key, {get: fail});
  for (const run of d.trainingRuns) for (const key of ['samples', 'source']) Object.defineProperty(run, key, {get: fail});
  let called = 0;
  const checked = createAngularTrajectoryPlanner((input, requested) => {
    called++; assert.deepEqual(input.trainingRuns, [{id: 'declared-training'}]);
    assert.equal(Object.hasOwn(input, 'challengeRuns'), false); assert.equal(Object.hasOwn(input, 'diagnostics'), false);
    assert.equal(requested.inertia, 1); assert.equal(requested.command, 0); // Private numeric kernel only.
    return planTrajectoryExperiment(input, requested);
  });
  assert.equal(checked(d, design()).status, 'proposed'); assert.equal(called, 1);
});

test('frozen input and reversed competitive display order preserve the identical public result', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]), requested = design();
  const before = JSON.stringify({d, requested}), p = plan(freeze(d), freeze(requested));
  assert.equal(JSON.stringify({d, requested}), before);
  const reversed = JSON.parse(before).d; reversed.competitive.reverse();
  assert.deepEqual(plan(reversed, requested), p);
  assert.deepEqual(plan(d, requested), p);
});

test('unexpected private backend fields cannot leak through the public angular representation', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const withExtraFields = createAngularTrajectoryPlanner((input, requested) => {
    const backend = planTrajectoryExperiment(input, requested);
    backend.diagnostics.privateUnit = 'N·m'; backend.options.privateInertia = 1;
    backend.options.bounds.privateUnit = 'N·m'; backend.selected.rawRun = {inertia: 1, command: 0};
    backend.selected.predictions[0].rows[0].command = 0;
    backend.ranked[0].privateUnit = 'N·m';
    return backend;
  });
  const p = withExtraFields(d, design()), serialized = JSON.stringify(p);
  for (const forbidden of ['N·m', 'privateUnit', 'privateInertia', 'rawRun', '"command"']) assert.equal(serialized.includes(forbidden), false);
  assert.equal(p.status, 'proposed');
});

test('identical and failed angular models produce no fabricated recording request', () => {
  const same = discovery([model('zero-a', []), model('zero-b', [])]);
  const p = plan(same, design()); assert.equal(p.status, 'uninformative'); assert.equal(p.recordingRequest, null);
  const runaway = discovery([model('zero', []), model('runaway', [{id: 'spring', coefficient: 1e8}])]);
  const q = plan(runaway, design({bounds: {initialPosition: {min: 1, max: 1}, initialRate: {min: 0, max: 0}}}));
  assert.equal(q.status, 'no_feasible_design'); assert.equal(q.recordingRequest, null); assert.equal(q.selected, null);
});

test('real PASCO training keeps weak-fit mismatch and refuses an uninformative declared recording grid', () => {
  const bundle = JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json', import.meta.url)));
  Object.defineProperty(bundle, 'challengeRuns', {get() {throw new Error('Reserved recording was read');}});
  const d = discoverAngularWeak(bundle.trainingRuns, {noiseSigma: .01, maxTerms: 4, ambiguityDelta: 6,
    rateWindowSize: 9, windowDuration: 1, windowStride: .5});
  const p = plan(d, design({bounds: {initialPosition: {min: -.3, max: .3}, initialRate: {min: -.2, max: .2}},
    duration: 4, sampleInterval: .04, positionCount: 5, rateCount: 3,
    predictionBounds: {position: {min: -.6, max: .6}, rate: {min: -5, max: 5}}}));
  assert.equal(d.competitive.length, 5); assert.equal(p.trainingFit.adequacy, 'residual_mismatch');
  assert.equal(p.trainingFit.noiseSigma, .01); assert.equal(p.status, 'uninformative'); assert.equal(p.recordingRequest, null);
  assert.ok(p.trainingFit.trainingRmseInNoiseUnits > 7 && p.trainingFit.trainingRmseInNoiseUnits < 8);
  assert.ok(p.selected.disagreementRad > .0016 && p.selected.disagreementRad < .0017);
  assert.equal(p.diagnostics.consideredModelCount, 5); assert.equal(p.diagnostics.evaluatedDesignCount, 15);
  assert.equal(p.qualification.diagnostics.reservedSteps, 102000);
});

test('actually fitted synthetic angular observations yield a bounded protocol while the real negative result remains retained', () => {
  const receipt = angularRecordingDesignReceipt();
  assert.equal(receipt.synthetic.selectedTrainingModel, 'rate+spring');
  assert.equal(receipt.synthetic.status, 'proposed'); assert.equal(receipt.synthetic.qualification.status, 'screen_passed');
  assert.equal(receipt.synthetic.selected.initialPosition, -2.2); assert.equal(receipt.synthetic.selected.initialRate, -.6);
  assert.ok(receipt.synthetic.selected.disagreementRad > 1.3 && receipt.synthetic.selected.disagreementRad < 1.31);
  assert.deepEqual(receipt.synthetic.selected.trainingRangeCheck.initialFields, ['position', 'rate']);
  assert.equal(receipt.synthetic.recordingRequest.inertia, null);
  assert.equal(receipt.synthetic.competitiveModelCount, 22); assert.equal(receipt.synthetic.omittedCompetitiveCount, 14);
  assert.equal(receipt.measured.status, 'uninformative'); assert.equal(receipt.measured.recordingRequest, null);
  assert.equal(receipt.measured.trainingFit.adequacy, 'residual_mismatch');
  assert.equal(receipt.measuredExpandedHypotheticalGrid.status, 'uninformative');
  assert.equal(receipt.measuredExpandedHypotheticalGrid.recordingRequest, null);
  assert.deepEqual(receipt.measuredExpandedHypotheticalGrid.selected.trainingRangeCheck.initialFields, ['position']);
});
