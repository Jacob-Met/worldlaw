import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acquireVirtualPendulum, VIRTUAL_PENDULUM_INSTRUMENT, VirtualExperimentError} from '../src/trajectory/virtual-experiment.mjs';
import {validateRun, validateBundle, RUN_UNITS} from '../src/trajectory/data.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

const request = (extra = {}) => ({initialPosition: 1.8, initialRate: .3, seed: 8123, ...extra});
const acquire = (extra = {}, history = []) => acquireVirtualPendulum(request(extra), {existingRuns: history});
const refuses = (fn, code) => assert.throws(fn, error => error instanceof VirtualExperimentError && error.code === code);
const fixture = JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url)));
function freeze(value) {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value;}

test('independent instrument exactly reproduces all original unforced fixture observations', () => {
  for (const run of [...fixture.trainingRuns, ...fixture.challengeRuns]) {
    const acquired = acquire({initialPosition: run.samples[0].position, initialRate: run.initialRate,
      seed: run.source.seed, noiseSigma: run.source.positionNoiseSigma, duration: 6.4});
    assert.deepEqual(acquired.samples, run.samples);
    assert.equal(acquired.inertia, run.inertia);
    assert.equal(acquired.initialRate, run.initialRate);
  }
});

test('acquisition is a complete valid synthetic SI run with fixed physical scale and bounded work', () => {
  const run = acquire();
  assert.deepEqual(validateRun(run, {role: 'training'}), run);
  assert.deepEqual(run.units, RUN_UNITS);
  assert.equal(run.kind, 'synthetic'); assert.equal(run.inertia, .8);
  assert.equal(run.samples.length, 201); assert.equal(run.samples.at(-1).time, 8);
  assert.equal(run.samples[0].position, 1.8); assert.equal(run.initialRate, .3);
  assert.ok(run.samples.every(sample => sample.command === 0));
  assert.equal(run.source.numerical.steps, 16000); assert.ok(run.source.numerical.maxStep <= .0005);
  assert.match(run.source.provenance, /not_physical_measurement/);
  assert.match(run.source.acquisition, /no learned candidate/);
});

test('stationary zero-noise equilibrium remains exactly stationary through maximum bounded acquisition', () => {
  const run = acquire({initialPosition: 0, initialRate: 0, noiseSigma: 0, duration: 20, sampleInterval: .01});
  assert.equal(run.samples.length, 2001); assert.ok(run.samples.every(sample => sample.position === 0));
  assert.equal(run.source.numerical.steps, 40000);
  assert.equal(run.source.numerical.maxStep, .0005);
});

test('known explicit pendulum law predicts independently acquired noiseless altered-start trajectories', () => {
  const model = {schema: 'worldlaw.torque-model/v1', terms: [{id: 'rate', coefficient: -.24}, {id: 'gravity', coefficient: -2.2}]};
  for (const initialPosition of [-2.2, .1, 2.2]) {
    const run = acquire({initialPosition, initialRate: -.6, noiseSigma: 0, duration: 4});
    assert.ok(rollout(model, run, {maxStep: .002}).metrics.positionRMSE < 1e-10);
    assert.ok(rollout({...model, terms: [{id: 'spring', coefficient: -2.2}]}, run).metrics.positionRMSE > .001);
  }
});

test('seeded noise is repeatable, initial state exact, and new seeds change observations without changing dynamics', () => {
  const first = acquire(), replay = acquire();
  assert.deepEqual(replay, first);
  const next = acquire({seed: 8124});
  assert.notEqual(next.id, first.id); assert.notDeepEqual(next.samples, first.samples);
  assert.equal(first.samples[0].position, next.samples[0].position);
  const noiseA = acquire({noiseSigma: 0, seed: 1}), noiseB = acquire({noiseSigma: 0, seed: 4294967295});
  assert.deepEqual(noiseA.samples, noiseB.samples);
  assert.equal(noiseA.id, noiseB.id); assert.equal(noiseA.source.recordingId, noiseB.source.recordingId);
  assert.deepEqual(acquire({seed: 0}), acquire({seed: 0}));
});

test('retained evidence rejects exact replay, relabeling and reused noise streams even under different releases', () => {
  const run = acquire();
  refuses(() => acquire({}, [run]), 'repeated_evidence');
  refuses(() => acquire({}, [{...run, id: 'relabeled'}]), 'repeated_evidence');
  refuses(() => acquire({initialPosition: -1.2}, [run]), 'reused_noise_stream');
  refuses(() => acquire({duration: 4}, [run]), 'reused_noise_stream');
  refuses(() => acquire({noiseSigma: .003}, [run]), 'reused_noise_stream');
  assert.doesNotThrow(() => acquire({seed: 8124, initialPosition: -1.2}, [run]));
  refuses(() => acquire({seed: fixture.trainingRuns[0].source.seed}, fixture.trainingRuns), 'reused_noise_stream');
});

test('noiseless repetitions cannot become independent evidence by changing seed or recording grid', () => {
  const first = acquire({noiseSigma: 0});
  refuses(() => acquire({noiseSigma: 0, seed: 9}, [first]), 'repeated_evidence');
  refuses(() => acquire({noiseSigma: 0, seed: 9, duration: 4, sampleInterval: .05}, [first]), 'repeated_evidence');
  assert.doesNotThrow(() => acquire({noiseSigma: 0, initialPosition: -.9}, [first]));
});

test('canonical recording identity remains a guard when callers attempt train/challenge relabeling', () => {
  const run = acquire(), replay = {...acquire(), id: 'false-independent-challenge'};
  assert.throws(() => validateBundle({schema: 'worldlaw.trajectory-bundle/v1', label: 'Replay', units: RUN_UNITS,
    trainingRuns: [run], challengeRuns: [replay]}), error => error.code === 'shared_evidence');
  assert.doesNotThrow(() => validateBundle({schema: 'worldlaw.trajectory-bundle/v1', label: 'Separate controlled releases', units: RUN_UNITS,
    trainingRuns: [run], challengeRuns: [acquire({seed: 8124, initialPosition: -1.2}, [run])]}));
});

test('input request/history remain unchanged and replay output is fresh JSON-compatible evidence', () => {
  const options = freeze(request()), existing = freeze([acquire({seed: 91, initialPosition: -.5})]);
  const before = JSON.stringify({options, existing});
  const first = acquireVirtualPendulum(options, {existingRuns: existing}), second = acquireVirtualPendulum(options, {existingRuns: existing});
  first.samples[1].position = 900; first.source.oracle.gravity = 900;
  assert.equal(JSON.stringify({options, existing}), before); assert.notEqual(second.samples[1].position, 900);
  assert.equal(second.source.oracle.gravity, -2.2);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), second);
  assert.equal(VIRTUAL_PENDULUM_INSTRUMENT.inertia, .8); assert.ok(Object.isFrozen(VIRTUAL_PENDULUM_INSTRUMENT.allowedInitialRate));
});

test('typed refusal handles forged physical inputs, absent history, nonfinite settings and sampling budgets', () => {
  for (const bad of [{model: {}}, {coefficients: []}, {inertia: .8}, {command: 0}, {mode: 'measured'},
    {initialPosition: NaN}, {initialPosition: 2.5}, {initialRate: -2.1}, {seed: -1}, {seed: 4294967296},
    {seed: 1.5}, {seed: undefined}, {duration: 20.1}, {duration: .65}, {sampleInterval: .001}, {noiseSigma: -.01}]) {
    refuses(() => acquire(bad), 'invalid_request');
  }
  refuses(() => acquire({duration: .64, sampleInterval: .08}), 'resource_limit');
  for (const context of [undefined, {}, null, [], {existingRuns: null}, {existingRuns: new Array(1)},
    {existingRuns: [], id: 'forged'}, {existingRuns: [{id: 'x', kind: 'synthetic', source: {instrumentId: VIRTUAL_PENDULUM_INSTRUMENT.id}}]}]) {
    refuses(() => acquireVirtualPendulum(request(), context), 'invalid_history');
  }
});
