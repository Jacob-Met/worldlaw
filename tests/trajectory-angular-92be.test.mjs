import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeAngularBundle, discoverAngular, rolloutAngular, AngularDataError} from '../src/trajectory/angular-discovery.mjs';
import {springRun, gravityRun} from '../experiments/integral-discovery-92be.mjs';

const rawBundle = () => JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json', import.meta.url)));
const angular = run => ({id: run.id, label: run.label, kind: run.kind, inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
  samples: run.samples.map(({time, position}) => ({time, position})), source: {...run.source, recordingId: run.id}});
const fixture = () => ({schema: 'worldlaw.angular-bundle/v1', label: 'Independent analytic runs with undeclared physical scale',
  units: {time: 's', position: 'rad', initialRate: 'rad/s'},
  trainingRuns: [angular(springRun({id: 'a', position: .8})), angular(springRun({id: 'b', position: -1.4, rate: .2}))],
  challengeRuns: [angular(springRun({id: 'c', position: 1.75, rate: -.4}))]});
function finiteTree(value) {if (typeof value === 'number') assert.ok(Number.isFinite(value)); else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);}
function immutable(value) {if (value && typeof value === 'object') {Object.values(value).forEach(immutable); Object.freeze(value);} return value;}
function refuses(fn, code) {assert.throws(fn, error => error instanceof AngularDataError && (!code || error.code === code));}
function noPhysicalProxy(value) {
  if (!value || typeof value !== 'object') return;
  assert.notEqual(value.schema, 'worldlaw.torque-model/v1');
  for (const [key, child] of Object.entries(value)) {
    assert.notEqual(key, 'command'); assert.notEqual(key, 'jointTorque');
    if ((key === 'inertia' && Array.isArray(value.samples)) || key === 'physicalInertia') assert.equal(child, null);
    if (typeof child === 'string') assert.ok(!child.includes('N·m'), child);
    noPhysicalProxy(child);
  }
}

test('analytic damped spring identifies acceleration coefficients and predicts a separate start without a torque scale', () => {
  const b = normalizeAngularBundle(fixture());
  const d = discoverAngular(b.trainingRuns, {noiseSigma: .0001});
  assert.equal(d.selected.id, 'rate+spring');
  assert.ok(Math.abs(d.selected.terms.find(t => t.id === 'spring').coefficient + 2.2 / .8) < .0005);
  assert.ok(Math.abs(d.selected.terms.find(t => t.id === 'rate').coefficient + .22 / .8) < .0001);
  assert.equal(d.selected.equation.startsWith('α = '), true);
  const r = rolloutAngular(JSON.parse(JSON.stringify(d.selected)), b.challengeRuns[0], {maxStep: .005});
  assert.ok(r.metrics.positionRMSE < .001);
  assert.equal(r.diagnostics.observationsResetState, false);
  assert.equal(d.noiseSigmaUnits, 'rad'); assert.equal(d.selected.terms[0].coefficientUnit, '1/s');
  for (const output of [b, d, r]) {noPhysicalProxy(output); finiteTree(output);}
});

test('nonlinear fine-step gravity oracle transfers altered starts using angular units', () => {
  const runs = [angular(gravityRun({id: 'g1', position: 1.2})), angular(gravityRun({id: 'g2', position: -1.7, rate: .3}))];
  const d = discoverAngular(runs, {noiseSigma: .0001});
  assert.equal(d.selected.id, 'rate+gravity');
  assert.ok(Math.abs(d.selected.terms.find(t => t.id === 'gravity').coefficient + 2.2 / .8) < .001);
  assert.equal(d.selected.terms.find(t => t.id === 'gravity').coefficientUnit, 'rad/s²');
  const check = rolloutAngular(d.selected, angular(gravityRun({id: 'g3', position: 2, rate: -.5})), {maxStep: .005});
  assert.ok(check.metrics.positionRMSE < .001);
});

test('held-out future observations change residuals but never predictions, coefficients, or training rank', () => {
  const b = normalizeAngularBundle(fixture()); const before = JSON.stringify(b.trainingRuns);
  const d = discoverAngular(b.trainingRuns, {noiseSigma: .0001}); const rank = JSON.stringify(d.candidates);
  const r = rolloutAngular(d.selected, b.challengeRuns[0]);
  const altered = structuredClone(b.challengeRuns[0]); altered.samples.slice(1).forEach((row, i) => row.position += 4 + Math.sin(i));
  const other = rolloutAngular(d.selected, altered);
  assert.deepEqual(other.rows.map(row => row.predicted), r.rows.map(row => row.predicted));
  assert.ok(other.metrics.positionRMSE > 3);
  assert.equal(JSON.stringify(d.candidates), rank); assert.equal(JSON.stringify(b.trainingRuns), before);
});

test('normalization, discovery and execution copy immutable caller evidence and JSON reopening is executable', () => {
  const original = immutable(fixture()), before = JSON.stringify(original);
  const b = normalizeAngularBundle(original), d = discoverAngular(immutable(b.trainingRuns), immutable({noiseSigma: .0001}));
  const r = rolloutAngular(immutable(d.selected), immutable(b.challengeRuns[0]));
  assert.deepEqual(rolloutAngular(JSON.parse(JSON.stringify(d.selected)), JSON.parse(JSON.stringify(b.challengeRuns[0]))), r);
  d.trainingRuns[0].source.label = 'changed'; d.trainingRuns[0].samples[0].position = 99;
  assert.equal(JSON.stringify(original), before);
});

test('requires explicit unknown inertia, declared angular units, and a supplied initial rate', () => {
  for (const inertia of [undefined, 0, 1, 'unknown']) {const b = fixture(); b.trainingRuns[0].inertia = inertia; refuses(() => normalizeAngularBundle(b), 'unknown_scale_required');}
  const missingRate = fixture(); delete missingRate.trainingRuns[0].initialRate; refuses(() => normalizeAngularBundle(missingRate));
  const units = fixture(); units.units.command = 'N·m'; refuses(() => normalizeAngularBundle(units), 'unsupported_units');
  const degrees = fixture(); degrees.units.position = 'deg'; refuses(() => normalizeAngularBundle(degrees), 'unsupported_units');
  const override = fixture(); override.trainingRuns[0].units = {...override.units, position: 'deg'};
  refuses(() => normalizeAngularBundle(override), 'unsupported_units');
  refuses(() => discoverAngular(override.trainingRuns), 'unsupported_units');
  const forced = fixture(); forced.trainingRuns[0].samples[0].command = 0; refuses(() => normalizeAngularBundle(forced));
  refuses(() => discoverAngular(fixture().trainingRuns, {terms: ['command']}), 'invalid_options');
});

test('reused recording identity, complete copied subwindows and large pasted windows are refused', () => {
  const identity = fixture(); identity.challengeRuns[0].source.recordingId = 'a'; refuses(() => normalizeAngularBundle(identity), 'shared_evidence');
  for (const length of [5, 41, 100]) {
    const b = fixture(); b.challengeRuns[0].samples = b.trainingRuns[0].samples.slice(21, 21 + length).map(row => ({...row, time: row.time + 1e9}));
    refuses(() => normalizeAngularBundle(b), 'shared_evidence');
  }
  const b = fixture(); const copied = b.trainingRuns[0].samples.slice(31, 70);
  for (let i = 0; i < copied.length; i++) b.challengeRuns[0].samples[40 + i].position = copied[i].position;
  refuses(() => normalizeAngularBundle(b), 'shared_evidence');
});

test('invalid and sparse evidence, metadata transformations, and resource budgets yield typed errors', () => {
  const sparse = fixture(); sparse.trainingRuns[0].samples = new Array(20); refuses(() => normalizeAngularBundle(sparse));
  const b = fixture(); b.trainingRuns[0].source.toJSON = () => null; refuses(() => normalizeAngularBundle(b));
  const tooLong = fixture(); tooLong.trainingRuns[0].samples = Array.from({length: 4097}, (_, i) => ({time: i * .01, position: i * .001}));
  refuses(() => normalizeAngularBundle(tooLong));
  const d = discoverAngular(fixture().trainingRuns, {terms: ['spring'], maxTerms: 1});
  assert.throws(() => rolloutAngular(d.selected, fixture().challengeRuns[0], {maxSteps: 1}), error => error.code === 'step_limit');
});

test('executable angular model refuses forged physical scale, torque units, bad coefficients and commands', () => {
  const b = fixture(), d = discoverAngular(b.trainingRuns), model = d.selected;
  for (const patch of [{physicalInertia: 1}, {absoluteTorqueIdentified: true}, {schema: 'worldlaw.torque-model/v1'}, {units: {position: 'rad', rate: 'rad/s', jointTorque: 'N·m'}}]) {
    refuses(() => rolloutAngular({...model, ...patch}, b.challengeRuns[0]), 'invalid_model');
  }
  const wrong = structuredClone(model); wrong.terms[0].coefficientUnit = 'N·m'; refuses(() => rolloutAngular(wrong, b.challengeRuns[0]), 'invalid_model');
  const command = structuredClone(model); command.terms = [{id: 'command', coefficient: 1, coefficientUnit: '1'}]; refuses(() => rolloutAngular(command, b.challengeRuns[0]), 'invalid_model');
  const infinite = structuredClone(model); infinite.terms[0].coefficient = Infinity; refuses(() => rolloutAngular(infinite, b.challengeRuns[0]), 'invalid_model');
});

test('real source bytes and role assignment are pinned; quantized matching motion is not falsely treated as copied evidence', () => {
  const b = normalizeAngularBundle(rawBundle());
  assert.equal(b.trainingRuns.length, 2); assert.equal(b.challengeRuns.length, 1);
  assert.deepEqual([...b.trainingRuns, ...b.challengeRuns].map(run => run.initialRate), [.681, 0, .785]);
  for (const run of [...b.trainingRuns, ...b.challengeRuns]) {
    const bytes = readFileSync(new URL(`../examples/${run.source.localRawFile}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), run.source.sha256);
    assert.equal(run.kind, 'measured'); assert.equal(run.inertia, null);
    assert.equal(run.samples.length, 2001); assert.equal(run.samples[0].time, 5); assert.equal(run.samples.at(-1).time, 25);
  }
  assert.equal(b.trainingRuns[1].samples.slice(1243, 1255).map(row => row.position).join(), b.challengeRuns[0].samples.slice(1609, 1621).map(row => row.position).join());
});

test('retains actual measured default failure: large training mismatch and a bounded typed challenge failure', () => {
  const b = normalizeAngularBundle(rawBundle()); const d = discoverAngular(b.trainingRuns, {noiseSigma: .01, maxTerms: 4});
  assert.equal(d.selected.id, 'coulomb+spring+gravity+bias');
  assert.equal(d.diagnostics.adequacy, 'residual_mismatch');
  assert.ok(d.selected.metrics.whitenedRmse > .35 && d.selected.metrics.whitenedRmse < .36);
  assert.throws(() => rolloutAngular(d.selected, b.challengeRuns[0], {maxStep: .005}), error => error.code === 'runaway_state');
  noPhysicalProxy(d); finiteTree(d);
});
