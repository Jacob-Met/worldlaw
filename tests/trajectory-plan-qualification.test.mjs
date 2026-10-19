import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planTrajectoryExperiment} from './support/trajectory-planner-baseline.mjs';
import {qualifyTrajectoryPlan, TrajectoryPlanQualificationError} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

const model = (id, terms) => ({schema: 'worldlaw.torque-model/v1', id, terms, units: {...UNITS}});
const damping = k => model(`damping-${k}`, [{id: 'rate', coefficient: -k}]);
const discovery = models => ({schema: 'worldlaw.discovery/v1', units: {...UNITS}, selected: models[0],
  candidates: models, competitive: models, trainingRuns: [{id: 'independent-training'}]});
const design = overrides => ({inertia: 1, command: 0, bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}},
  duration: .1, sampleInterval: .1, maxStep: .01, minDisagreement: .01, ...overrides});
const refuses = (fn, code) => assert.throws(fn, error => error instanceof TrajectoryPlanQualificationError && error.code === code);
const freeze = value => {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value;};

test('default-step false proposal is screened out against independent exact damping trajectories', () => {
  const d = discovery([300, 301].map(damping)), p = planTrajectoryExperiment(d, design());
  const q = qualifyTrajectoryPlan(d, p);
  const exact = k => -Math.expm1(-k * .1) / k;
  assert.equal(p.status, 'proposed'); assert.ok(Math.abs(exact(300) - exact(301)) < .000012);
  assert.equal(q.status, 'numerically_unresolved'); assert.equal(q.selectedQualification.reason, 'step_sensitivity_exceeds_allowance');
  assert.ok(q.selectedQualification.pairwiseSensitivityRad > .17);
  assert.ok(q.selectedQualification.allowanceRad < .0014);
  assert.equal(q.recommendationChanged, false); assert.equal(q.diagnostics.attemptedComparisons, 2);
});

test('a smaller step produces a non-discriminating plan rather than manufacturing a qualified proposal', () => {
  const d = discovery([300, 301].map(damping)), p = planTrajectoryExperiment(d, design({maxStep: .0001}));
  const q = qualifyTrajectoryPlan(d, p);
  assert.equal(p.status, 'uninformative'); assert.equal(q.status, 'no_proposal');
  assert.equal(q.selectedQualification.status, 'screen_passed');
  assert.ok(q.selectedQualification.pairwiseSensitivityRad < 1e-12);
});

test('constant acceleration preserves analytic radian disagreement and qualifies the original selection', () => {
  const d = discovery([model('zero', []), model('constant', [{id: 'bias', coefficient: 2}])]);
  const p = planTrajectoryExperiment(d, design({inertia: 2, duration: 2, sampleInterval: .5, maxStep: .1}));
  const q = qualifyTrajectoryPlan(d, p), expected = Math.sqrt([.5, 1, 1.5, 2].reduce((sum, t) => sum + (.5 * t ** 2) ** 2, 0) / 4);
  assert.equal(q.status, 'screen_passed'); assert.ok(Math.abs(q.selectedQualification.disagreementRad - expected) < 1e-13);
  assert.ok(q.selectedQualification.pairwiseSensitivityRad < 1e-12);
  assert.deepEqual(q.provenance.modelIds, ['zero', 'constant']);
});

test('complete sampled-grid budget is checked before partial qualification', () => {
  const d = discovery([300, 301].map(damping)), p = planTrajectoryExperiment(d, design());
  refuses(() => qualifyTrajectoryPlan(d, p, {maxTotalSteps: 59}), 'resource_limit');
  const q = qualifyTrajectoryPlan(d, p, {maxTotalSteps: 60});
  assert.equal(q.diagnostics.reservedSteps, 60); assert.equal(q.diagnostics.completedComparisons, 2);
});

test('refinement-only failure retains every fixed model and invalidates the whole design', () => {
  const d = discovery([model('zero', []), model('growth', [{id: 'rate', coefficient: 13.85}])]);
  const p = planTrajectoryExperiment(d, design({duration: 1, sampleInterval: 1, maxStep: .1}));
  const q = qualifyTrajectoryPlan(d, p);
  assert.equal(p.status, 'proposed'); assert.equal(q.status, 'numerically_unresolved');
  assert.equal(q.selectedQualification.reason, 'not_all_models_compared');
  assert.equal(q.selectedQualification.modelChecks.length, 2);
  assert.equal(q.selectedQualification.modelChecks[1].status, 'unavailable');
  assert.equal(q.selectedQualification.modelChecks[1].reason, 'refinement_execution_refused');
  assert.equal(q.selectedQualification.pairwiseSensitivityRad, null);
  assert.equal(q.diagnostics.completedComparisons, 1);
});

test('changed fitted coefficients or declared training IDs cannot qualify an old plan', () => {
  const d = discovery([300, 301].map(damping)), p = planTrajectoryExperiment(d, design());
  const changed = structuredClone(d); changed.candidates[0].terms[0].coefficient = -302;
  refuses(() => qualifyTrajectoryPlan(changed, p), 'stale_plan');
  const renamed = structuredClone(d); renamed.trainingRuns[0].id = 'different-recording';
  refuses(() => qualifyTrajectoryPlan(renamed, p), 'stale_plan');
  const selected = structuredClone(p); selected.selected.initialRate = 2;
  refuses(() => qualifyTrajectoryPlan(d, selected), 'stale_plan');
});

test('forged proposal status cannot turn a below-threshold or singleton plan into a passed recommendation', () => {
  const d = discovery([100, 101].map(damping)), p = planTrajectoryExperiment(d, design({maxStep: .0001}));
  assert.equal(p.status, 'uninformative');
  refuses(() => qualifyTrajectoryPlan(d, {...p, status: 'proposed'}), 'invalid_plan');
  const one = discovery([damping(1)]), single = planTrajectoryExperiment(one, design());
  refuses(() => qualifyTrajectoryPlan(one, {...single, status: 'proposed'}), 'invalid_plan');
  const informative = discovery([model('zero', []), model('bias', [{id: 'bias', coefficient: 20}])]);
  const proper = planTrajectoryExperiment(informative, design());
  refuses(() => qualifyTrajectoryPlan(informative, {...proper, status: 'uninformative'}), 'invalid_plan');
  refuses(() => qualifyTrajectoryPlan(informative, {...proper, status: 'no_feasible_design', selected: null}), 'invalid_plan');
});

test('source observations, future challenge values and oracle metadata are never read', () => {
  const d = discovery([300, 301].map(damping)), p = planTrajectoryExperiment(d, design()), expected = qualifyTrajectoryPlan(d, p);
  const forbidden = () => {throw new Error('Forbidden future or source access');};
  for (const key of ['challengeRuns', 'results', 'observations', 'oracle']) Object.defineProperty(d, key, {get: forbidden});
  for (const run of d.trainingRuns) for (const key of ['samples', 'source']) Object.defineProperty(run, key, {get: forbidden});
  assert.deepEqual(qualifyTrajectoryPlan(d, p), expected);
  refuses(() => qualifyTrajectoryPlan(d, p, {challengeRuns: []}), 'invalid_options');
});

test('all designs are screened deterministically without mutation or survival-based reranking', () => {
  const d = discovery([300, 301].map(damping));
  const p = planTrajectoryExperiment(d, design({bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 0, max: 1}}, rateCount: 2}));
  const before = JSON.stringify({d, p}), q = qualifyTrajectoryPlan(freeze(d), freeze(p));
  assert.equal(JSON.stringify({d, p}), before); assert.deepEqual(qualifyTrajectoryPlan(d, p), q);
  assert.equal(q.candidateQualifications.length, 2);
  assert.equal(q.candidateQualifications.find(row => row.index === 0).status, 'screen_passed');
  assert.equal(q.selectedQualification.index, p.selected.index); assert.equal(q.status, 'numerically_unresolved');
  assert.equal(q.diagnostics.attemptedComparisons, 4);
});

test('a refused original design remains ineligible without partial survivor checks', () => {
  const d = discovery([model('zero', []), model('explosive', [{id: 'spring', coefficient: 1e8}])]);
  const p = planTrajectoryExperiment(d, design({bounds: {initialPosition: {min: 1, max: 1}, initialRate: {min: 0, max: 0}}, duration: 1}));
  const q = qualifyTrajectoryPlan(d, p);
  assert.equal(q.status, 'no_proposal'); assert.equal(q.selectedQualification, null);
  assert.equal(q.candidateQualifications[0].status, 'ineligible'); assert.equal(q.diagnostics.attemptedComparisons, 0);
});

test('two-step agreement retains an explicit between-sample aliasing counterexample', () => {
  const d = discovery([model('one-cycle', [{id: 'spring', coefficient: -((2 * Math.PI) ** 2)}]),
    model('two-cycles', [{id: 'spring', coefficient: -((4 * Math.PI) ** 2)}])]);
  const p = planTrajectoryExperiment(d, design({duration: 1, sampleInterval: 1, maxStep: .001, minDisagreement: .01}));
  const q = qualifyTrajectoryPlan(d, p);
  assert.equal(q.status, 'no_proposal'); assert.equal(q.selectedQualification.status, 'screen_passed');
  assert.ok(p.selected.disagreementRad < 1e-8);
  const exactBetweenSampleDifference = Math.sin(2 * Math.PI * .25) / (2 * Math.PI) - Math.sin(4 * Math.PI * .25) / (4 * Math.PI);
  assert.ok(exactBetweenSampleDifference > .15);
  assert.match(q.diagnostics.limitations.join(' '), /between-sample excursions and aliasing/);
});

test('the actual ambiguous fixture can be screened over the complete original training shortlist', () => {
  const bundle = JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url)));
  const d = discoverIntegral(bundle.trainingRuns, {noiseSigma: .01, maxTerms: 4});
  const p = planTrajectoryExperiment(d, {inertia: .8, bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
    predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}});
  const q = qualifyTrajectoryPlan(d, p);
  assert.equal(p.status, 'proposed'); assert.equal(q.status, 'screen_passed');
  assert.equal(q.candidateQualifications.length, 27); assert.equal(q.diagnostics.attemptedComparisons, 216);
  assert.ok(q.diagnostics.reservedSteps <= q.options.maxTotalSteps);
  assert.equal(q.provenance.modelIds.length, 8); assert.equal(p.diagnostics.omittedCompetitiveCount, 14);
});
