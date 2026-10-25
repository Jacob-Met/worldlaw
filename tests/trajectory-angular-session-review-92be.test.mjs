/** Independent consumer receiving: measured evidence semantics, persistence, and isolation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge, exportChallenge, restoreChallenge, normalizeOptions} from '../src/trajectory/session.mjs';
import {AngularDataError} from '../src/trajectory/angular-discovery.mjs';
import {TrajectoryDataError} from '../src/trajectory/data.mjs';
const bundle = () => JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json', import.meta.url)));
const weak = {method: 'weak', noiseSigma: .01, maxTerms: 4, maxStep: .005};
const predictions = state => state.results.map(result => ({modelId: result.modelId, runId: result.runId, status: result.status,
  rows: result.rollout?.rows.map(({time, predicted, rate}) => ({time, predicted, rate}))}));
function assertUnknownScale(state) {
  for (const run of [...state.bundle.trainingRuns, ...state.bundle.challengeRuns]) {
    assert.equal(run.inertia, null); assert.equal(run.kind, 'measured');
    assert.ok(run.samples.every(row => !Object.hasOwn(row, 'command') && !Object.hasOwn(row, 'jointTorque')));
  }
  for (const model of state.discovery.candidates) {
    assert.equal(model.schema, 'worldlaw.angular-model/v1'); assert.equal(model.physicalInertia, null);
    assert.equal(model.absoluteTorqueIdentified, false); assert.equal(model.units.angularAcceleration, 'rad/s²');
    assert.ok(!JSON.stringify(model.units).includes('N·m')); assert.ok(!model.terms.some(term => term.id === 'command'));
  }
  for (const result of state.results.filter(result => result.status === 'ok')) {
    assert.equal(result.rollout.schema, 'worldlaw.angular-rollout/v1');
    assert.equal(result.rollout.diagnostics.physicalInertia, null);
    assert.ok(result.rollout.rows.every(row => !Object.hasOwn(row, 'command')));
  }
}

test('consumer rejects a method or term budget incompatible with the physical-scale mode', () => {
  assert.throws(() => createChallenge(bundle(), {method: 'derivative'}), error => error instanceof TrajectoryDataError && error.code === 'invalid_options');
  assert.equal(normalizeOptions({method: 'weak'}).method, 'weak'); // Also admitted for known-inertia torque traces.
  for (const options of [{maxTerms: 7}, {windowDuration: 0}, {windowDuration: .2, windowStride: .5}]) {
    assert.throws(() => createChallenge(bundle(), {...weak, ...options}), error => error instanceof TrajectoryDataError && error.code === 'invalid_options');
  }
});

test('actual measured cumulative failure remains explicit and does not become a successful zero-error result', () => {
  const state = createChallenge(bundle(), {method: 'integral', maxStep: .005});
  assert.equal(state.discovery.selected.id, 'coulomb+spring+gravity+bias');
  assert.equal(state.discovery.diagnostics.adequacy, 'residual_mismatch');
  assert.equal(state.results[0].status, 'failed'); assert.equal(state.results[0].error.code, 'runaway_state');
  assert.equal(state.results[0].rollout, null); assert.equal(state.results[0].resolution, null);
  assert.equal(state.summary.selectedPositionRMSE, null); assert.equal(state.summary.completedChallengeRuns, 0);
  assert.equal(state.summary.failedRollouts, 6); assertUnknownScale(state);
});

test('fixed weak measured receipt executes independently while preserving mismatch and training-derived ranking', () => {
  const input = bundle(), before = JSON.stringify(input), state = createChallenge(input, weak);
  assert.equal(state.discovery.selected.id, 'gravity+bias'); assert.equal(state.discovery.diagnostics.adequacy, 'residual_mismatch');
  assert.ok(state.discovery.diagnostics.trainingRmseInNoiseUnits > 7);
  assert.ok(state.summary.selectedPositionRMSE > .32 && state.summary.selectedPositionRMSE < .33);
  assert.equal(state.summary.failedRollouts, 0); assert.equal(state.summary.fitResidualUnits, 'rad');
  assert.equal(state.summary.selectionBasis, 'training_evidence_only'); assert.deepEqual(state.summary.evidenceKinds, ['measured']);
  assert.deepEqual(state.results.map(result => result.modelId), state.discovery.candidates.slice(0, 8).map(model => model.id));
  assert.ok(state.results[5].rollout.metrics.positionRMSE < state.results[0].rollout.metrics.positionRMSE);
  assert.equal(state.selectedModelId, state.discovery.selected.id);
  assert.ok(state.results.every(result => result.resolution.status === 'compared' && result.resolution.combinedSteps <= result.resolution.maxSteps));
  assert.equal(JSON.stringify(input), before); assertUnknownScale(state);
});

test('future challenge angle perturbations change errors without changing coefficients, candidate order or predictions', () => {
  const original = bundle(), changed = structuredClone(original);
  changed.challengeRuns[0].samples.slice(1).forEach(row => {row.position += 3;});
  const options = {...weak, modelLimit: 2}, a = createChallenge(original, options), b = createChallenge(changed, options);
  assert.deepEqual(b.discovery.candidates, a.discovery.candidates); assert.deepEqual(b.discovery.competitive, a.discovery.competitive);
  assert.deepEqual(predictions(b), predictions(a)); assert.ok(b.summary.selectedPositionRMSE > 3);
  assert.ok(a.summary.selectedPositionRMSE < .33);
});

test('notebook reopening recomputes fabricated results and preserves the explicitly selected alternative and tolerance', () => {
  const state = createChallenge(bundle(), weak); state.selectedModelId = state.discovery.candidates[5].id; state.positionTolerance = .1;
  const exported = JSON.parse(exportChallenge(state));
  assert.equal(exported.discovery, undefined); assert.equal(exported.results, undefined); assert.equal(exported.summary, undefined);
  exported.discovery = {selected: {id: 'fabricated', terms: [{id: 'bias', coefficient: 0}]}};
  exported.results = [{status: 'ok', rollout: {metrics: {positionRMSE: 0}}}]; exported.summary = {selectedPositionRMSE: 0};
  const reopened = restoreChallenge(JSON.stringify(exported));
  assert.deepEqual(reopened.discovery, state.discovery); assert.deepEqual(reopened.results, state.results); assert.deepEqual(reopened.summary, state.summary);
  assert.equal(reopened.options.method, 'weak'); assert.equal(reopened.selectedModelId, state.selectedModelId); assert.equal(reopened.positionTolerance, .1);
  assert.equal(reopened.bundle.trainingRuns[0].source.sha256, state.bundle.trainingRuns[0].source.sha256);
  assert.equal(reopened.bundle.challengeRuns[0].samples[0].time, 5); assert.equal(reopened.bundle.challengeRuns[0].initialRate, .785);
  assertUnknownScale(reopened);
});

test('declared unknown scale and per-run units cannot be silently overridden during source import', () => {
  const known = bundle(); known.trainingRuns[0].inertia = 1;
  assert.throws(() => createChallenge(known, weak), error => error instanceof AngularDataError && error.code === 'unknown_scale_required');
  const degrees = bundle(); degrees.trainingRuns[0].units = {time: 'ms', position: 'deg', initialRate: 'deg/s'};
  assert.throws(() => createChallenge(degrees, weak), error => error instanceof AngularDataError && error.code === 'unsupported_units');
  const noRate = bundle(); delete noRate.challengeRuns[0].initialRate;
  assert.throws(() => createChallenge(noRate, weak), error => error instanceof AngularDataError);
  const command = bundle(); command.trainingRuns[0].samples[0].command = 0;
  assert.throws(() => createChallenge(command, weak), error => error instanceof AngularDataError);
});

test('a stored selection must still exist after a fresh fit instead of trusting cached candidate identity', () => {
  const state = createChallenge(bundle(), {...weak, modelLimit: 2}), notebook = JSON.parse(exportChallenge(state));
  notebook.selectedModelId = 'forged-passing-law';
  assert.throws(() => restoreChallenge(JSON.stringify(notebook)), error => error instanceof TrajectoryDataError);
});
