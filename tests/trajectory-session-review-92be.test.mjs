import test from 'node:test';
import assert from 'node:assert/strict';
import {springRun} from '../experiments/integral-discovery-92be.mjs';
import {BUNDLE_SCHEMA, RUN_UNITS, MAX_TEXT_LENGTH, TrajectoryDataError, validateRun, validateBundle, parseBundleText} from '../src/trajectory/data.mjs';
import {createChallenge, exportChallenge, restoreChallenge, normalizeOptions, NOTEBOOK_SCHEMA} from '../src/trajectory/session.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function typedFailure(fn, code) { assert.throws(fn, error => error instanceof TrajectoryDataError && (!code || error.code === code)); }
function bundle() {
  const trainingRuns = [springRun({id: 'fit-a', position: .8, rate: .3, command: .1, duration: 2}),
    springRun({id: 'fit-b', position: -1.3, rate: -.2, command: -.3, duration: 2}),
    springRun({id: 'fit-c', position: 1.65, rate: .6, command: .35, duration: 2})];
  const challengeRuns = [springRun({id: 'challenge-a', position: -2.2, rate: .7, command: -.2, duration: 2}),
    springRun({id: 'challenge-b', position: 1.1, rate: -.8, command: .25, duration: 2})];
  for (const run of [...trainingRuns, ...challengeRuns]) run.source = {...run.source, recordingId: `recording-${run.id}`, instrument: {calibration: 'declared synthetic fixture'}};
  return {schema: BUNDLE_SCHEMA, label: 'Independent analytic receiving', units: {...RUN_UNITS}, trainingRuns, challengeRuns};
}
const options = {noiseSigma: .001, maxTerms: 4, modelLimit: 3, maxStep: .01};
const fittedEvidence = state => ({selected: state.discovery.selected, candidates: state.discovery.candidates,
  competitive: state.discovery.competitive, options: state.discovery.options});
const predictions = state => state.results.map(result => ({modelId: result.modelId, runId: result.runId,
  status: result.status, rows: result.rollout?.rows.map(({time, predicted, rate, command}) => ({time, predicted, rate, command}))}));

test('actual bundle→fit→separate free-running challenge receives an independent analytic law', () => {
  const input = freeze(bundle()), before = JSON.stringify(input), state = createChallenge(input, options);
  assert.equal(state.discovery.selected.id, 'command+rate+spring');
  assert.equal(state.discovery.trainingRuns.length, 3);
  assert.equal(state.results.length, 6);
  assert.ok(state.summary.selectedPositionRMSE < .001);
  assert.equal(state.summary.selectionBasis, 'training_evidence_only');
  assert.equal(state.summary.completedChallengeRuns, 2);
  assert.deepEqual(state.results.map(result => result.modelId), state.discovery.candidates.slice(0, 3).flatMap(model => [model.id, model.id]));
  assert.equal(JSON.stringify(input), before);
  state.bundle.trainingRuns[0].source.instrument.calibration = 'changed';
  assert.equal(JSON.stringify(input), before);
});

test('poisoning future challenge angles changes residuals but neither predictions nor model coefficients/ranks', () => {
  const original = bundle(), poisoned = clone(original);
  for (const run of poisoned.challengeRuns) for (let i = 1; i < run.samples.length; i++) run.samples[i].position = 200 + Math.sin(i);
  const before = createChallenge(original, options), after = createChallenge(poisoned, options);
  assert.deepEqual(fittedEvidence(after), fittedEvidence(before));
  assert.deepEqual(predictions(after), predictions(before));
  assert.ok(after.summary.selectedPositionRMSE > 190);
  assert.ok(before.summary.selectedPositionRMSE < .001);
});

test('changing challenge initial state or commands changes predictions without influencing training selection', () => {
  const original = bundle(), altered = clone(original);
  altered.challengeRuns[0].samples[0].position += .3;
  altered.challengeRuns[0].initialRate += .5;
  for (const sample of altered.challengeRuns[0].samples) sample.command += .4;
  const before = createChallenge(original, options), after = createChallenge(altered, options);
  assert.deepEqual(fittedEvidence(after), fittedEvidence(before));
  assert.notDeepEqual(predictions(after), predictions(before));
  assert.notEqual(after.summary.selectedPositionRMSE, before.summary.selectedPositionRMSE);
  assert.deepEqual(after.results.filter(r => r.runId === 'challenge-b'), before.results.filter(r => r.runId === 'challenge-b'));
});

test('notebook exports source evidence/settings/selections and recomputes fabricated cached claims on reopen', () => {
  const state = createChallenge(bundle(), options);
  state.selectedModelId = state.discovery.candidates[1].id; state.selectedRunId = 'challenge-b';
  const text = exportChallenge(state), raw = JSON.parse(text);
  assert.equal(raw.schema, NOTEBOOK_SCHEMA);
  assert.equal(raw.discovery, undefined); assert.equal(raw.results, undefined); assert.equal(raw.summary, undefined);
  assert.equal(raw.bundle.trainingRuns[0].source.instrument.calibration, 'declared synthetic fixture');
  raw.discovery = {selected: {id: 'fabricated', terms: [{id: 'spring', coefficient: 999}]}};
  raw.results = [{modelId: 'fabricated', status: 'ok', rollout: {metrics: {positionRMSE: 0}}}];
  raw.summary = {selectedPositionRMSE: 0};
  const reopened = restoreChallenge(JSON.stringify(raw));
  assert.deepEqual(reopened.discovery, state.discovery);
  assert.deepEqual(reopened.results, state.results);
  assert.deepEqual(reopened.summary, state.summary);
  assert.equal(reopened.selectedModelId, state.selectedModelId); assert.equal(reopened.selectedRunId, state.selectedRunId);
  assert.equal(reopened.summary.selectedPositionRMSE > 0, true);
  assert.deepEqual(restoreChallenge(exportChallenge(reopened)).bundle, state.bundle);
});

test('cached selection IDs must correspond to an actually recomputed candidate/run pair', () => {
  const state = createChallenge(bundle(), options), raw = JSON.parse(exportChallenge(state));
  for (const selected of [{selectedModelId: 'fabricated'}, {selectedRunId: 'missing'}, {selectedModelId: state.discovery.candidates[4].id}]) {
    typedFailure(() => restoreChallenge(JSON.stringify({...raw, ...selected})));
  }
});

test('integral and derivative methods keep distinct residual units and training-only evidence', () => {
  const evidence = bundle(), integral = createChallenge(evidence, {...options, method: 'integral'});
  const derivative = createChallenge(evidence, {...options, method: 'derivative', noiseSigma: .03});
  assert.equal(integral.discovery.residualUnits, 'rad'); assert.equal(integral.discovery.noiseSigmaUnits, 'rad');
  assert.equal(integral.summary.fitResidualUnits, 'rad');
  assert.equal(derivative.discovery.residualUnits, 'N·m'); assert.equal(derivative.discovery.noiseSigmaUnits, 'N·m'); assert.equal(derivative.summary.fitResidualUnits, 'N·m');
  assert.equal(derivative.discovery.options.noiseSigma, .03);
  assert.equal(derivative.discovery.diagnostics.fitData, 'training_runs_only');
  assert.equal(derivative.discovery.diagnostics.derivation.length, evidence.trainingRuns.length);
  assert.ok(derivative.discovery.observations.length > 8);
  const changed = clone(evidence); changed.challengeRuns[0].samples[20].position += 100;
  assert.deepEqual(createChallenge(changed, {...options, method: 'derivative', noiseSigma: .03}).discovery, derivative.discovery);
});

test('units, provenance, missing rates, sparse rows and duplicate recording IDs are validated', () => {
  const valid = bundle();
  for (const patch of [{units: {...RUN_UNITS, position: 'degree'}}, {schema: 'unknown'}, {trainingRuns: new Array(1)}]) {
    typedFailure(() => validateBundle({...valid, ...patch}));
  }
  for (const patch of [{kind: 'verified'}, {source: {}}, {source: null}, {initialRate: undefined}, {inertia: 0},
    {samples: new Array(20)}, {samples: valid.trainingRuns[0].samples.map(row => ({...row, time: 0}))}]) {
    typedFailure(() => validateRun({...valid.trainingRuns[0], ...patch}, {role: 'training', inheritedUnits: RUN_UNITS}));
  }
  const sharedRecording = clone(valid); sharedRecording.challengeRuns[0].source.recordingId = sharedRecording.trainingRuns[0].source.recordingId;
  typedFailure(() => validateBundle(sharedRecording), 'shared_evidence');
  const sharedID = clone(valid); sharedID.challengeRuns[0].id = sharedID.trainingRuns[0].id;
  typedFailure(() => validateBundle(sharedID), 'shared_evidence');
  assert.equal(validateBundle({...valid, challengeRuns: valid.challengeRuns.map(run => ({...run, kind: 'unknown'}))}).challengeRuns[0].kind, 'unknown');
});

test('renamed exact and floating-epoch-shifted copies of training evidence are refused across roles', () => {
  const valid = bundle(), training = valid.trainingRuns[0];
  for (const epoch of [0, 1e9, -(2 ** 35)]) {
    const copied = {...clone(training), id: 'renamed-copy', source: {label: 'Renamed source'},
      samples: training.samples.map(row => ({...row, time: row.time + epoch}))};
    typedFailure(() => validateBundle({...valid, challengeRuns: [copied]}), 'shared_evidence');
  }
});

test('renamed contiguous copied subsets of training samples are refused as challenge evidence', () => {
  const valid = bundle(), training = valid.trainingRuns[0];
  for (const [start, count] of [[0, 5], [20, 25], [training.samples.length - 8, 8]]) {
    const copied = {...clone(training), id: 'renamed-subset', source: {label: 'Copied subwindow'},
      samples: training.samples.slice(start, start + count).map(row => ({...row, time: row.time + 1e9}))};
    typedFailure(() => validateBundle({...valid, challengeRuns: [copied]}), 'shared_evidence');
  }
});

test('independent quantized analytic recordings may naturally share short sequences without being copied evidence', () => {
  const quantized = run => ({...run, source: {...run.source, recordingId: run.id, quantizationRad: .001},
    samples: run.samples.map(row => ({...row, position: Math.round(row.position * 1000) / 1000}))});
  const training = quantized(springRun({id: 'quantized-training', position: .8, rate: .3, dt: .01, duration: 6}));
  for (const [position, trainStart, challengeStart, overlap] of [[.801, 514, 492, 8], [.81, 361, 339, 28]]) {
    const challenge = quantized(springRun({id: 'independent-quantized-challenge', position, rate: -.2, dt: .01, duration: 6}));
    const sensorValues = rows => rows.map(({position, command}) => [position, command]);
    assert.deepEqual(sensorValues(training.samples.slice(trainStart, trainStart + overlap)), sensorValues(challenge.samples.slice(challengeStart, challengeStart + overlap)));
    assert.notDeepEqual(sensorValues(training.samples), sensorValues(challenge.samples));
    const received = validateBundle({schema: BUNDLE_SCHEMA, label: 'Separate analytic starts with sensor quantization', units: RUN_UNITS,
      trainingRuns: [training], challengeRuns: [challenge]});
    assert.equal(received.challengeRuns[0].initialRate, -.2); assert.equal(received.trainingRuns[0].initialRate, .3);
  }
});

test('a long matching training sequence embedded amid unrelated challenge values is still refused', () => {
  const evidence = bundle(), training = evidence.trainingRuns[0], challenge = evidence.challengeRuns[0];
  for (let i = 0; i < 32; i++) {
    const original = training.samples[17 + i];
    challenge.samples[30 + i] = {...original, time: challenge.samples[30 + i].time};
  }
  typedFailure(() => validateBundle(evidence), 'shared_evidence');
});

test('a shorter partial match can pass numerical screening, which therefore cannot authenticate recording independence', () => {
  const evidence = bundle(), training = evidence.trainingRuns[0], challenge = evidence.challengeRuns[0];
  challenge.source.label = 'Constructed mixed evidence demonstrating the documented screening limit';
  for (let i = 0; i < 31; i++) {
    const original = training.samples[17 + i];
    challenge.samples[30 + i] = {...original, time: challenge.samples[30 + i].time};
  }
  const received = validateBundle(evidence);
  assert.equal(received.challengeRuns[0].samples[45].position, training.samples[32].position);
  assert.equal(received.challengeRuns[0].source.label, challenge.source.label);
  // The accepted bundle preserves the author's declaration; it contains no
  // authenticated-independence certificate or claim that the overlap is absent.
  assert.equal(received.independenceVerified, undefined);
});

test('non-JSON direct-JS provenance objects fail with typed errors rather than TypeErrors', () => {
  const run = bundle().trainingRuns[0];
  for (const value of [undefined, null, 2, 'x']) {
    typedFailure(() => validateRun({...run, source: {label: 'Bad serialization', toJSON() {return value;}}}, {inheritedUnits: RUN_UNITS}));
  }
});

test('solver budget failures remain explicit receiving results and cannot become zero-error evidence', () => {
  const evidence = bundle();
  evidence.challengeRuns = [{...evidence.challengeRuns[0], samples: [{time: 0, position: 1, command: 0}, {time: 300, position: 0, command: 0}]}];
  const state = createChallenge(evidence, {...options, maxStep: .00001, modelLimit: 2});
  assert.equal(state.results.length, 2);
  assert.ok(state.results.every(result => result.status === 'failed' && result.rollout === null && result.error.code === 'step_limit'));
  assert.equal(state.summary.selectedPositionRMSE, null); assert.equal(state.summary.completedChallengeRuns, 0);
  assert.equal(state.summary.failedRollouts, 2);
  const restored = restoreChallenge(exportChallenge(state));
  assert.deepEqual(restored.results, state.results);
});

test('text, sample, duration and option budgets reject invalid requests before fitting', () => {
  typedFailure(() => parseBundleText('x')); typedFailure(() => parseBundleText(' '.repeat(MAX_TEXT_LENGTH + 1)));
  typedFailure(() => restoreChallenge(' '.repeat(MAX_TEXT_LENGTH + 1)));
  const valid = bundle();
  assert.deepEqual(parseBundleText('\uFEFF' + JSON.stringify(valid)), validateBundle(valid));
  const tooLong = clone(valid); tooLong.challengeRuns[0].samples.at(-1).time = 301;
  typedFailure(() => validateBundle(tooLong), 'resource_limit');
  for (const option of [null, [], {method: 'unknown'}, {noiseSigma: 0}, {noiseSigma: NaN}, {maxTerms: 8},
    {maxStep: 0}, {maxStep: .2}, {modelLimit: 0}, {modelLimit: 9}, {rateWindowSize: 6}]) typedFailure(() => normalizeOptions(option), 'invalid_options');
});
