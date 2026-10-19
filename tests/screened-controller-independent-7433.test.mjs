/** Independent wrapper contract checks. The owner state machine is a test double;
 * planning, forward execution and numerical qualification are the real modules.
 * This suite does not claim actual-instrument or browser receiving. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {withNumericalScreen} from '../src/experiment-design/screened-controller.mjs';
import {planTrajectoryExperiment} from './support/trajectory-planner-baseline.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

const copy = value => structuredClone(value);
const discoveryFor = rates => {
  const models = rates.map(rate => ({schema: 'worldlaw.torque-model/v1', id: 'rate-' + rate,
    terms: [{id: 'rate', coefficient: -rate}], units: {...UNITS}}));
  return {schema: 'worldlaw.discovery/v1', units: {...UNITS}, selected: models[0],
    candidates: models, competitive: models, trainingRuns: [{id: 'independent-controller-contract-training'}]};
};
const design = (maxStep = .1) => ({inertia: 1, bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}},
  duration: .1, sampleInterval: .1, maxStep, minDisagreement: .001});
function ownerFailure(code) {const error = new Error(code); error.code = code; throw error;}

function opaqueController(discovery) {
  const registered = new WeakMap(), calls = {acquire: 0, apply: 0, restore: 0};
  const fingerprint = session => JSON.stringify({discovery: session.current.discovery, plan: session.plan,
    acquisition: session.acquisition, history: session.history, design: session.design});
  const register = session => {registered.set(session, fingerprint(session)); return session;};
  const check = session => {
    if (!registered.has(session)) ownerFailure('owner_unknown_session');
    if (registered.get(session) !== fingerprint(session)) ownerFailure('owner_stale_session');
  };
  const api = {
    createExperimentSession() {
      return register({current: {discovery: copy(discovery), selectedModelId: discovery.selected.id, positionTolerance: .05},
        plan: null, acquisition: null, history: [], design: null});
    },
    planNextExperiment(session, requested) {
      check(session);
      if (session.acquisition) ownerFailure('owner_pending_evidence');
      return register({...session, plan: planTrajectoryExperiment(session.current.discovery, requested), design: copy(requested)});
    },
    acquireNextExperiment(session) {
      check(session);
      if (session.acquisition) ownerFailure('owner_repeated_evidence');
      if (session.plan?.status !== 'proposed') ownerFailure('owner_no_proposal');
      calls.acquire++;
      // Deliberately only an ownership sentinel. The real instrument is received separately.
      return register({...session, acquisition: {id: 'test-double-independent-recording', run: {
        kind: 'test-double-recording', samples: [{time: 0, position: .123}, {time: .1, position: .456}],
      }}});
    },
    applyNextExperiment(session) {
      check(session);
      if (!session.acquisition) ownerFailure('owner_missing_acquisition');
      calls.apply++;
      return register({...session, history: [...session.history, copy(session.acquisition)], plan: null, acquisition: null, design: null});
    },
    experimentView(session) {
      check(session);
      return {available: true, plan: session.plan, acquisition: session.acquisition,
        settings: session.design, notice: 'Owner evidence remains authoritative.'};
    },
    exportExperimentSession(session) {
      check(session);
      return JSON.stringify({schema: 'test-owner-notebook/v1', design: session.design,
        acquisition: session.acquisition, history: session.history});
    },
    restoreExperimentSession(text) {
      calls.restore++;
      const raw = JSON.parse(text);
      assert.equal(raw.schema, 'test-owner-notebook/v1');
      let session = api.createExperimentSession();
      if (raw.design) session = api.planNextExperiment(session, raw.design);
      return register({...session, acquisition: copy(raw.acquisition), history: copy(raw.history)});
    },
  };
  return {api, calls};
}

test('actual numerical false proposal cannot acquire and forged view qualification does not unlock it', () => {
  const {api, calls} = opaqueController(discoveryFor([100, 101])), wrapped = withNumericalScreen(api);
  const initial = wrapped.createExperimentSession(), initialBytes = JSON.stringify(initial);
  const planned = wrapped.planNextExperiment(initial, design());
  assert.equal(JSON.stringify(initial), initialBytes);
  assert.equal(planned.plan.status, 'proposed');
  assert.ok(planned.plan.selected.disagreementRad > .09);
  const rawPlan = JSON.stringify(planned.plan), view = wrapped.experimentView(planned);
  assert.equal(view.plan.status, 'numerically_unresolved');
  assert.equal(view.numericalQualification.status, 'numerically_unresolved');
  assert.equal(view.acquisitionAllowed, false);
  view.numericalQualification.status = 'screen_passed';
  view.numericalQualification.selectedQualification.status = 'screen_passed';
  view.plan.status = 'proposed';
  view.acquisitionAllowed = true;
  assert.throws(() => wrapped.acquireNextExperiment(planned), error => error.code === 'numerically_unresolved');
  assert.equal(calls.acquire, 0);
  assert.equal(JSON.stringify(planned.plan), rawPlan);
  assert.equal(wrapped.experimentView(planned).numericalQualification.status, 'numerically_unresolved');
});

test('a real stable informative plan acquires once while ordinary display changes and opaque validation remain supported', () => {
  const {api, calls} = opaqueController(discoveryFor([1, 2])), wrapped = withNumericalScreen(api);
  const planned = wrapped.planNextExperiment(wrapped.createExperimentSession(), design(.001));
  assert.equal(wrapped.experimentView(planned).numericalQualification.status, 'screen_passed');
  planned.current.positionTolerance = .12;
  planned.current.selectedModelId = planned.current.discovery.candidates[1].id;
  assert.equal(wrapped.experimentView(planned).acquisitionAllowed, true);
  const acquired = wrapped.acquireNextExperiment(planned);
  assert.equal(calls.acquire, 1);
  assert.equal(acquired.current.positionTolerance, .12);
  assert.equal(wrapped.experimentView(acquired).acquisitionAllowed, false);
  assert.throws(() => wrapped.acquireNextExperiment(acquired), error => error.code === 'owner_repeated_evidence');
  assert.equal(calls.acquire, 1);
  planned.current.discovery.candidates[0].terms[0].coefficient += 1;
  assert.throws(() => wrapped.experimentView(planned), error => error.code === 'owner_stale_session');
  assert.throws(() => wrapped.acquireNextExperiment(planned), error => error.code === 'owner_stale_session');
});

test('unavailable complete screening fails closed, and caller mutation cannot loosen factory settings', () => {
  const {api, calls} = opaqueController(discoveryFor([1, 2])), options = {maxTotalSteps: 1};
  const wrapped = withNumericalScreen(api, options);
  options.maxTotalSteps = 3000000;
  const planned = wrapped.planNextExperiment(wrapped.createExperimentSession(), design(.001));
  const view = wrapped.experimentView(planned);
  assert.equal(view.numericalQualification.status, 'unavailable');
  assert.equal(view.numericalQualification.error.code, 'resource_limit');
  assert.equal(view.plan.status, 'numerically_unresolved');
  assert.throws(() => wrapped.acquireNextExperiment(planned), error => error.code === 'numerical_screen_unavailable');
  assert.equal(calls.acquire, 0);
});

test('already acquired evidence survives unresolved screening, portable reopen and explicit apply', () => {
  const {api, calls} = opaqueController(discoveryFor([100, 101]));
  const original = api.acquireNextExperiment(api.planNextExperiment(api.createExperimentSession(), design()));
  const originalRun = copy(original.acquisition.run), wrapped = withNumericalScreen(api);
  const view = wrapped.experimentView(original);
  assert.equal(view.numericalQualification.status, 'numerically_unresolved');
  assert.deepEqual(view.acquisition.run, originalRun);
  const text = wrapped.exportExperimentSession(original), raw = JSON.parse(text);
  assert.equal(raw.numericalQualification, undefined);
  raw.numericalQualification = {status: 'screen_passed', inventedAccuracy: 0};
  const reopened = wrapped.restoreExperimentSession(JSON.stringify(raw));
  assert.equal(wrapped.experimentView(reopened).numericalQualification.status, 'numerically_unresolved');
  assert.deepEqual(reopened.acquisition.run, originalRun);
  assert.throws(() => wrapped.acquireNextExperiment(reopened), error => error.code === 'owner_repeated_evidence');
  const applied = wrapped.applyNextExperiment(reopened);
  assert.equal(calls.acquire, 1);
  assert.equal(calls.apply, 1);
  assert.deepEqual(applied.history[0].run, originalRun);
  assert.equal(wrapped.experimentView(applied).numericalQualification, null);
  const historyReopened = wrapped.restoreExperimentSession(wrapped.exportExperimentSession(applied));
  assert.deepEqual(historyReopened.history[0].run, originalRun);
});

test('reopening an unacquired plan recomputes the screen and original no-proposal refusals remain unchanged', () => {
  const {api, calls} = opaqueController(discoveryFor([100, 101])), wrapped = withNumericalScreen(api);
  const unstable = wrapped.planNextExperiment(wrapped.createExperimentSession(), design());
  const raw = JSON.parse(wrapped.exportExperimentSession(unstable));
  raw.numericalQualification = {status: 'screen_passed'};
  raw.acquisitionAllowed = true;
  const reopened = wrapped.restoreExperimentSession(JSON.stringify(raw));
  assert.equal(wrapped.experimentView(reopened).acquisitionAllowed, false);
  assert.throws(() => wrapped.acquireNextExperiment(reopened), error => error.code === 'numerically_unresolved');
  const uninformative = wrapped.planNextExperiment(wrapped.createExperimentSession(), design(.0001));
  assert.equal(uninformative.plan.status, 'uninformative');
  assert.equal(wrapped.experimentView(uninformative).numericalQualification.status, 'no_proposal');
  assert.throws(() => wrapped.acquireNextExperiment(uninformative), error => error.code === 'owner_no_proposal');
  assert.equal(calls.acquire, 0);
});
