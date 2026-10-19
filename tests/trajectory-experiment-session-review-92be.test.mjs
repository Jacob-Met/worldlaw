import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {
  createExperimentSession, planNextExperiment, acquireNextExperiment,
  applyNextExperiment, experimentView, exportExperimentSession, restoreExperimentSession,
} from '../src/trajectory/experiment-session.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';

const clone = value => structuredClone(value);
const fixture = () => JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url)));
const settings = () => ({inertia: .8, bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
  duration: 8, sampleInterval: .04, command: 0, positionCount: 9, rateCount: 3, maxModels: 8,
  maxStep: .01, maxTotalSteps: 250000,
  predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}});
const fitOptions = {method: 'integral', noiseSigma: .01, maxTerms: 4, modelLimit: 8, maxStep: .01};
const start = (bundle = fixture()) => createExperimentSession(createChallenge(bundle, fitOptions));
function freeze(value) {
  if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);}
  return value;
}
function typedRefusal(fn) {
  assert.throws(fn, error => error instanceof Error && typeof error.code === 'string' && error.code.length > 0);
}

test('planning and whole-run acquisition leave the actual fitted challenge unchanged until explicit apply', () => {
  const input = createChallenge(fixture(), fitOptions), inputText = JSON.stringify(input);
  const initial = createExperimentSession(freeze(input)), initialText = JSON.stringify(initial);
  const planned = planNextExperiment(freeze(initial), settings()), plannedText = JSON.stringify(planned);
  const acquired = acquireNextExperiment(freeze(planned), {seed: 10001, noiseSigma: .00002});
  assert.equal(JSON.stringify(input), inputText);
  assert.equal(JSON.stringify(initial), initialText);
  assert.equal(JSON.stringify(planned), plannedText);
  assert.deepEqual(planned.current, initial.current);
  assert.deepEqual(acquired.current, initial.current);
  const applied = applyNextExperiment(acquired);
  assert.equal(applied.current.bundle.trainingRuns.length, 3);
  assert.equal(initial.current.bundle.trainingRuns.length, 2);
  assert.equal(initial.current.discovery.selected.id, 'rate+spring');
  assert.equal(applied.current.discovery.selected.id, 'rate+gravity');
  assert.ok(initial.current.summary.selectedPositionRMSE > .5);
  assert.ok(applied.current.summary.selectedPositionRMSE < .001);
  assert.deepEqual(applied.current.bundle.challengeRuns, initial.current.bundle.challengeRuns);
  const newRun = applied.current.bundle.trainingRuns[2];
  assert.equal(newRun.kind, 'synthetic'); assert.equal(newRun.inertia, .8);
  assert.equal(newRun.samples.length, 201); assert.ok(newRun.samples.every(row => row.command === 0));
  assert.equal(newRun.source.seed, 10001);
  assert.equal(newRun.source.provenance, 'synthetic_virtual_instrument_not_physical_measurement');
});

test('the controller refuses acquisition under a plan with incompatible physical inertia or actuation', () => {
  for (const mismatch of [{inertia: 1}, {command: .2}]) {
    typedRefusal(() => acquireNextExperiment(planNextExperiment(start(), {...settings(), ...mismatch}), {seed: 10001}));
  }
});

test('original training and reserved-challenge noise streams are included in acquisition history', () => {
  const b = fixture(), planned = planNextExperiment(start(b), settings());
  for (const run of [...b.trainingRuns, ...b.challengeRuns]) {
    assert.throws(() => acquireNextExperiment(planned, {seed: run.source.seed, noiseSigma: .00002}),
      error => error.code === 'reused_noise_stream');
  }
});

function retainedHighNoiseBundle() {
  const trainingA = acquireVirtualPendulum({initialPosition: .06, initialRate: 0, duration: 6.4, sampleInterval: .04, seed: 50021, noiseSigma: .01}, {existingRuns: []});
  const trainingB = acquireVirtualPendulum({initialPosition: -.045, initialRate: .025, duration: 6.4, sampleInterval: .04, seed: 50022, noiseSigma: .01}, {existingRuns: [trainingA]});
  const challenge = acquireVirtualPendulum({initialPosition: 1.9, initialRate: 0, duration: 8, sampleInterval: .04, seed: 50023, noiseSigma: .01}, {existingRuns: [trainingA, trainingB]});
  const b = fixture(); b.label = 'Retained high-noise active-refit failure';
  b.trainingRuns = [trainingA, trainingB]; b.challengeRuns = [challenge];
  return b;
}

test('an acquired run whose training-selected refit runs away stays applied without a best-result fallback', () => {
  const initial = start(retainedHighNoiseBundle());
  const acquired = acquireNextExperiment(planNextExperiment(initial, settings()), {seed: 50024, noiseSigma: .01});
  const applied = applyNextExperiment(acquired);
  assert.equal(initial.current.discovery.selected.id, 'coulomb+spring');
  assert.ok(Number.isFinite(initial.current.summary.selectedPositionRMSE));
  assert.equal(applied.current.discovery.selected.id, 'rate+spring+gravity+bias');
  assert.equal(applied.current.bundle.trainingRuns.length, 3);
  assert.equal(applied.current.bundle.trainingRuns[2].source.seed, 50024);
  const received = applied.current.results.find(result => result.modelId === applied.current.discovery.selected.id);
  assert.equal(received.status, 'failed'); assert.equal(received.error.code, 'runaway_state');
  assert.equal(applied.current.summary.selectedPositionRMSE, null);
  assert.deepEqual(applied.current.bundle.challengeRuns, initial.current.bundle.challengeRuns);
});

test('poisoned future challenge positions change only receiving evidence, never the plan or acquired training refit', () => {
  const original = fixture(), poisoned = clone(original);
  for (const run of poisoned.challengeRuns) for (let i = 1; i < run.samples.length; i++) run.samples[i].position = 200 + Math.sin(i);
  const before = start(original), other = start(poisoned);
  assert.deepEqual(other.current.discovery, before.current.discovery);
  const planned = planNextExperiment(before, settings()), poisonedPlan = planNextExperiment(other, settings());
  assert.deepEqual(poisonedPlan.plan, planned.plan);
  const acquired = acquireNextExperiment(planned, {seed: 10001}), poisonedAcquired = acquireNextExperiment(poisonedPlan, {seed: 10001});
  assert.deepEqual(poisonedAcquired.acquisition.run, acquired.acquisition.run);
  const applied = applyNextExperiment(acquired), poisonedApplied = applyNextExperiment(poisonedAcquired);
  assert.deepEqual(poisonedApplied.current.discovery, applied.current.discovery);
  const predictions = state => state.current.results.map(result => ({modelId: result.modelId, status: result.status,
    rows: result.rollout?.rows.map(({time, predicted, rate}) => ({time, predicted, rate}))}));
  assert.deepEqual(predictions(poisonedApplied), predictions(applied));
  assert.ok(applied.current.summary.selectedPositionRMSE < .001);
  assert.ok(poisonedApplied.current.summary.selectedPositionRMSE > 190);
  assert.deepEqual(applied.current.bundle.challengeRuns, before.current.bundle.challengeRuns);
  assert.deepEqual(poisonedApplied.current.bundle.challengeRuns, other.current.bundle.challengeRuns);
});

test('pending raw acquisition survives reopen while fabricated cached models, curves and scores are recomputed', () => {
  const pending = acquireNextExperiment(planNextExperiment(start(), settings()), {seed: 10001});
  pending.current.selectedModelId = pending.current.discovery.candidates[1].id;
  pending.current.positionTolerance = .123;
  const raw = JSON.parse(exportExperimentSession(pending));
  assert.equal(raw.experiment.history.length, 0);
  assert.deepEqual(raw.experiment.pending.run, pending.acquisition.run);
  assert.equal(raw.bundle.trainingRuns.length, 2);
  assert.equal(raw.discovery, undefined); assert.equal(raw.results, undefined);
  raw.discovery = {selected: {id: 'fabricated', terms: [{id: 'spring', coefficient: 99}]}};
  raw.results = [{modelId: 'fabricated', status: 'ok', rollout: {metrics: {positionRMSE: 0}}}];
  raw.summary = {selectedPositionRMSE: 0};
  raw.experiment.plan = {status: 'proposed', selected: {disagreementRad: 999, predictions: []}};
  raw.experiment.comparison = {after: {status: 'ok', positionRMSE: 0}};
  raw.experiment.pending.results = [{status: 'ok', positionRMSE: 0}];
  const reopened = restoreExperimentSession(JSON.stringify(raw));
  assert.deepEqual(reopened.current.discovery, pending.current.discovery);
  assert.deepEqual(reopened.current.results, pending.current.results);
  assert.deepEqual(reopened.plan, pending.plan);
  assert.deepEqual(reopened.acquisition, pending.acquisition);
  assert.equal(reopened.history.length, 0); assert.equal(reopened.current.bundle.trainingRuns.length, 2);
  assert.equal(reopened.current.selectedModelId, pending.current.selectedModelId);
  assert.equal(reopened.current.positionTolerance, .123);
  assert.equal(experimentView(reopened).comparison, null);
  assert.throws(() => acquireNextExperiment(reopened, {seed: 10002}), error => error.code === 'repeated_evidence');
  const applied = applyNextExperiment(reopened);
  assert.equal(applied.current.discovery.selected.id, 'rate+gravity');
  assert.deepEqual(applied.history[0].run, pending.acquisition.run);
  assert.equal(applied.current.positionTolerance, .123);
});

test('applied history preserves complete raw runs, prevents replay and enforces the bounded training-run budget', () => {
  // A wider declared training-score margin deliberately retains alternatives so
  // this protocol test can exercise two acquisitions; it is no quality claim.
  const initial = createExperimentSession(createChallenge(fixture(), {...fitOptions, ambiguityDelta: 100}));
  const first = applyNextExperiment(acquireNextExperiment(planNextExperiment(initial, settings()), {seed: 10001}));
  const planned = planNextExperiment(first, {...settings(), minDisagreement: 0});
  assert.equal(planned.plan.status, 'proposed');
  assert.throws(() => acquireNextExperiment(planned, {seed: 10001}), error => ['repeated_evidence', 'reused_noise_stream'].includes(error.code));
  const second = applyNextExperiment(acquireNextExperiment(planned, {seed: 10002}));
  assert.equal(second.history.length, 2); assert.equal(second.current.bundle.trainingRuns.length, 4);
  const reopened = restoreExperimentSession(exportExperimentSession(second));
  assert.deepEqual(reopened.history, second.history);
  assert.deepEqual(reopened.current.discovery, second.current.discovery);
  assert.deepEqual(reopened.comparison, second.comparison);
  assert.deepEqual(reopened.current.bundle.challengeRuns, first.current.bundle.challengeRuns);
  assert.deepEqual(reopened.history.map(event => event.run), reopened.current.bundle.trainingRuns.slice(2));
  assert.throws(() => planNextExperiment(reopened, settings()), error => error.code === 'resource_limit');
});

test('reopening refuses edited acquisition samples, protocol requests and unreplayed current evidence', () => {
  const pending = acquireNextExperiment(planNextExperiment(start(), settings()), {seed: 10001});
  const exported = JSON.parse(exportExperimentSession(pending));
  for (const change of [
    raw => {raw.experiment.pending.run.samples[20].position += .01;},
    raw => {raw.experiment.pending.request.initialPosition += .01;},
    raw => {raw.bundle.trainingRuns[0].samples[20].position += .01;},
  ]) {
    const raw = clone(exported); change(raw);
    assert.throws(() => restoreExperimentSession(JSON.stringify(raw)), error => error.code === 'invalid_history');
  }
});

test('external fitted-evidence, model, pending-run and plan mutation invalidates the opaque workflow', () => {
  const planned = planNextExperiment(start(), settings());
  assert.throws(() => acquireNextExperiment({...planned}, {seed: 10001}), error => error.code === 'invalid_experiment');
  const originalPosition = planned.current.bundle.trainingRuns[0].samples[20].position;
  planned.current.bundle.trainingRuns[0].samples[20].position += .01;
  assert.throws(() => acquireNextExperiment(planned, {seed: 10001}), error => error.code === 'stale_plan');
  planned.current.bundle.trainingRuns[0].samples[20].position = originalPosition;
  const coefficient = planned.current.discovery.candidates[0].terms[0].coefficient;
  planned.current.discovery.candidates[0].terms[0].coefficient += .01;
  assert.throws(() => acquireNextExperiment(planned, {seed: 10001}), error => error.code === 'stale_plan');
  planned.current.discovery.candidates[0].terms[0].coefficient = coefficient;
  const pending = acquireNextExperiment(planned, {seed: 10001});
  pending.acquisition.run.samples[20].position += .01;
  assert.throws(() => applyNextExperiment(pending), error => error.code === 'stale_plan');
  planned.plan.selected.initialPosition += .01;
  assert.throws(() => acquireNextExperiment(planned, {seed: 10002}), error => error.code === 'stale_plan');
});

test('the comparison cannot change its reserved recording or cached before/after evidence outside a transition', () => {
  const b = fixture();
  const extra = acquireVirtualPendulum({initialPosition: .8, initialRate: -.2, duration: 8, seed: 12345},
    {existingRuns: [...b.trainingRuns, ...b.challengeRuns]});
  b.challengeRuns.push(extra);
  const pending = acquireNextExperiment(planNextExperiment(start(b), settings()), {seed: 10001});
  pending.evaluationRunId = extra.id;
  assert.throws(() => applyNextExperiment(pending), error => error.code === 'stale_plan');
  const applied = applyNextExperiment(acquireNextExperiment(planNextExperiment(start(), settings()), {seed: 10001}));
  applied.comparison.after.positionRMSE = 0;
  assert.throws(() => experimentView(applied), error => error.code === 'stale_plan');
});

test('reopen retains a failed applied revision and its same-recording comparison rather than choosing a better cached model', () => {
  const initial = start(retainedHighNoiseBundle());
  const applied = applyNextExperiment(acquireNextExperiment(planNextExperiment(initial, settings()), {seed: 50024, noiseSigma: .01}));
  const raw = JSON.parse(exportExperimentSession(applied));
  raw.summary = {selectedPositionRMSE: 0}; raw.results = [{modelId: 'rate+gravity', status: 'ok'}];
  raw.experiment.comparison = {after: {status: 'ok', modelId: 'rate+gravity', positionRMSE: 0}};
  const reopened = restoreExperimentSession(JSON.stringify(raw)), view = experimentView(reopened);
  assert.equal(reopened.current.discovery.selected.id, 'rate+spring+gravity+bias');
  assert.equal(reopened.current.summary.selectedPositionRMSE, null);
  assert.equal(view.comparison.before.modelId, 'coulomb+spring'); assert.equal(view.comparison.before.status, 'ok');
  assert.equal(view.comparison.after.modelId, 'rate+spring+gravity+bias'); assert.equal(view.comparison.after.status, 'failed');
  assert.deepEqual(view.comparison.after.rows, []); assert.equal(view.comparison.after.error.code, 'runaway_state');
  assert.match(view.notice, /failed.*remain applied/i);
  assert.deepEqual(reopened.history[0].run, applied.history[0].run);
  assert.deepEqual(view.comparison.evaluationRun, initial.current.bundle.challengeRuns[0]);
});
