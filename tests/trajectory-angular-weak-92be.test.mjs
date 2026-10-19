import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {discoverAngular, rolloutAngular, normalizeAngularBundle, AngularDataError} from '../src/trajectory/angular-discovery.mjs';
import {springRun, gravityRun, dragRun, gaussian} from '../experiments/integral-discovery-92be.mjs';
const angular = run => ({id: run.id, label: run.label, kind: run.kind, inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
  samples: run.samples.map(({time, position}) => ({time, position})), source: {...run.source, recordingId: run.id}});
const training = (make = springRun, extra = {}) => [angular(make({id: 'a', position: .8, rate: .3, ...extra})), angular(make({id: 'b', position: -1.4, rate: -.2, ...extra}))];
const coefficient = (model, id) => model.terms.find(term => term.id === id)?.coefficient ?? 0;
const near = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}, tolerance ${tolerance}`);
const refuses = (fn, code) => assert.throws(fn, error => error instanceof AngularDataError && error.code === code);
function freeze(value) {if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value;}
function finiteTree(value) {if (typeof value === 'number') assert.ok(Number.isFinite(value)); else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);}

test('weak spring equations recover acceleration coefficients without first or second derivatives', () => {
  const d = discoverAngularWeak(training(), {terms: ['rate', 'spring'], noiseSigma: .00001});
  near(coefficient(d.selected, 'spring'), -2.2 / .8, .00001); near(coefficient(d.selected, 'rate'), -.22 / .8, .000001);
  assert.equal(d.selected.id, 'rate+spring'); assert.equal(d.diagnostics.runs[0].rateMethod, 'not_required');
  assert.equal(d.selected.terms[0].coefficientUnit, '1/s'); assert.equal(d.noiseSigmaUnits, 'rad');
  const r = rolloutAngular(d.selected, angular(springRun({id: 'unseen', position: 2.1, rate: -.5, duration: 8})), {maxStep: .005});
  assert.ok(r.metrics.positionRMSE < 1e-5); finiteTree(d); finiteTree(r);
});

test('wide-angle gravity is recovered from a separate explicit equation oracle and predicts an altered start', () => {
  const d = discoverAngularWeak(training(gravityRun), {noiseSigma: .00001});
  assert.equal(d.selected.id, 'rate+gravity'); near(coefficient(d.selected, 'gravity'), -2.2 / .8, .00001);
  assert.equal(d.selected.terms.find(term => term.id === 'gravity').coefficientUnit, 'rad/s²');
  assert.ok(rolloutAngular(d.selected, angular(gravityRun({id: 'unseen', position: 2.1, rate: -.5, duration: 8})), {maxStep: .005}).metrics.positionRMSE < 1e-5);
});

test('changing supplied initial rates cannot change any weak coefficient, score, rank or first-rate estimate', () => {
  const runs = training(), options = {noiseSigma: .0001}, first = discoverAngularWeak(runs, options);
  const altered = structuredClone(runs); altered[0].initialRate = 999; altered[1].initialRate = -456;
  const second = discoverAngularWeak(altered, options);
  assert.deepEqual(second.candidates, first.candidates); assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.match(second.diagnostics.initialRateAssumption, /not_used_in_fitting/);
  const oldA = discoverAngular(runs, options), oldB = discoverAngular(altered, options);
  assert.notDeepEqual(oldA.selected.terms, oldB.selected.terms);
});

test('exact affine motion is annihilated with constant and linear endpoint nuisance eliminated', () => {
  const runs = training().map((run, j) => ({...run, initialRate: -500, samples: run.samples.map(row => ({time: row.time, position: 900000 + (j ? -3 : 2) * row.time}))}));
  const d = discoverAngularWeak(runs, {terms: ['bias'], maxTerms: 0, noiseSigma: .001});
  assert.equal(d.selected.id, 'zero'); assert.ok(d.selected.metrics.rmse < 1e-8);
});

test('first-rate nonlinear terms recover analytic quadratic drag without using initialRate', () => {
  const runs = [angular(dragRun({id: 'positive', rate: 2.2})), angular(dragRun({id: 'negative', rate: -2.8}))];
  runs.forEach(run => {run.initialRate = 999;});
  const d = discoverAngularWeak(runs, {terms: ['quadratic'], maxTerms: 1, noiseSigma: .00001});
  assert.equal(d.selected.id, 'quadratic'); near(coefficient(d.selected, 'quadratic'), -.7 / .8, .0005);
  assert.equal(d.selected.terms[0].coefficientUnit, '1/rad'); assert.match(d.diagnostics.runs[0].rateMethod, /first_derivative/);
});

test('target row normalization makes iid position noise interpretable in radians, without claiming joint whitening', () => {
  const runs = training(springRun, {duration: 12}).map((run, index) => {
    const noise = gaussian(101 + index); return {...run, samples: run.samples.map(row => ({time: row.time, position: .003 * noise()}))};
  });
  const d = discoverAngularWeak(runs, {terms: ['bias'], maxTerms: 0, noiseSigma: .003});
  assert.ok(d.selected.metrics.rmse > .002 && d.selected.metrics.rmse < .004);
  assert.match(d.diagnostics.covarianceTreatment, /not_whitened/);
  assert.equal(d.selected.metrics.whitenedRmse, undefined);
});

test('preserves immutable evidence and large representable time shifts; JSON models remain executable', () => {
  const runs = training(springRun, {dt: .03125}), before = JSON.stringify(runs);
  const d = discoverAngularWeak(freeze(runs), freeze({noiseSigma: .0001}));
  const shifted = JSON.parse(before).map(run => ({...run, samples: run.samples.map(row => ({...row, time: row.time + 2 ** 30}))}));
  assert.deepEqual(discoverAngularWeak(shifted, {noiseSigma: .0001}).candidates, d.candidates);
  const c = angular(springRun({id: 'c', position: 2, rate: -.5}));
  assert.deepEqual(rolloutAngular(JSON.parse(JSON.stringify(d.selected)), c), rolloutAngular(d.selected, c));
  d.trainingRuns[0].source.label = 'changed'; assert.equal(JSON.stringify(runs), before);
});

test('short-window boundaries use local elapsed intervals at very large representable epochs', () => {
  const run = angular(springRun({id: 'short-clock'}));
  run.initialRate = 0; run.samples = Array.from({length: 513}, (_, i) => ({time: i / 512, position: Math.cos(i / 512)}));
  const shifted = {...run, samples: run.samples.map(row => ({...row, time: row.time + 2 ** 39}))};
  const options = {terms: ['spring'], noiseSigma: 1e-6, windowDuration: .03125, windowStride: .015625};
  const a = discoverAngularWeak([run], options), b = discoverAngularWeak([shifted], options);
  assert.equal(a.fitEquationCount, 63); assert.equal(b.fitEquationCount, 63);
  assert.deepEqual(a.diagnostics.runs[0].windows.map(row => [row.firstIndex, row.lastIndex]), b.diagnostics.runs[0].windows.map(row => [row.firstIndex, row.lastIndex]));
  assert.deepEqual(a.candidates, b.candidates);
});

test('held-out future positions only affect reported residuals and supplied start rate still matters in rollout', () => {
  const d = discoverAngularWeak(training()), c = angular(springRun({id: 'heldout', position: 2, rate: -.5}));
  const first = rolloutAngular(d.selected, c), changed = structuredClone(c);
  changed.samples.slice(1).forEach(row => {row.position += 4;});
  assert.deepEqual(rolloutAngular(d.selected, changed).rows.map(row => row.predicted), first.rows.map(row => row.predicted));
  changed.initialRate += .25;
  assert.notDeepEqual(rolloutAngular(d.selected, changed).rows.map(row => row.predicted), first.rows.map(row => row.predicted));
});

test('typed refusal covers insufficient samples, too few windows, sparse inputs and bounded computational work', () => {
  refuses(() => discoverAngularWeak(training(springRun, {dt: .15})), 'insufficient_sampling');
  refuses(() => discoverAngularWeak(training(), {windowDuration: 6, windowStride: 6}), 'insufficient_sampling');
  const tooMany = training()[0]; tooMany.samples = Array.from({length: 4096}, (_, i) => ({time: i * .01, position: Math.cos(i * .01)}));
  refuses(() => discoverAngularWeak([tooMany], {windowDuration: .1, windowStride: .01}), 'resource_limit');
  const sparse = training(); sparse[0].samples = new Array(50); refuses(() => discoverAngularWeak(sparse), 'invalid_angular_evidence');
  for (const options of [{terms: ['command']}, {windowStride: 2}, {windowDuration: 0}, {maxTerms: 99}, {rateWindowSize: 4}, {noiseSigma: NaN}]) {
    refuses(() => discoverAngularWeak(training(), options), 'invalid_options');
  }
});

test('stationary evidence explicitly reports deficient excitation and makes no torque or confidence claim', () => {
  const d = discoverAngularWeak(training(springRun, {position: 0, rate: 0}));
  assert.equal(d.selected.id, 'zero'); assert.equal(d.diagnostics.fullLibraryRank, 1);
  assert.equal(d.diagnostics.identifiability, 'insufficient_excitation'); assert.equal(d.diagnostics.selectionAmbiguous, true);
  assert.equal(d.physicalInertia, null); assert.equal(d.absoluteTorqueIdentified, false);
  assert.ok(d.diagnostics.limitations.some(text => text.includes('No coefficient-sign, passivity')));
  assert.ok(!JSON.stringify(d).includes('N·m')); finiteTree(d);
});

test('frozen measured receipt stays finite while retaining training mismatch and training-only ranking', () => {
  const b = normalizeAngularBundle(JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json', import.meta.url))));
  const d = discoverAngularWeak(b.trainingRuns, {noiseSigma: .01, maxTerms: 4, windowDuration: 1, windowStride: .5, rateWindowSize: 9});
  const rank = JSON.stringify(d.candidates);
  assert.equal(d.selected.id, 'gravity+bias'); assert.equal(d.fitEquationCount, 78);
  assert.equal(d.diagnostics.adequacy, 'residual_mismatch'); assert.ok(d.diagnostics.trainingRmseInNoiseUnits > 7);
  const r = rolloutAngular(d.selected, b.challengeRuns[0], {maxStep: .005});
  assert.equal(r.metrics.count, 2000); assert.ok(r.metrics.positionRMSE > .32 && r.metrics.positionRMSE < .33);
  const lowerRanked = rolloutAngular(d.candidates[5], b.challengeRuns[0], {maxStep: .005});
  assert.ok(lowerRanked.metrics.positionRMSE < r.metrics.positionRMSE);
  assert.equal(JSON.stringify(d.candidates), rank); assert.equal(d.selected.id, 'gravity+bias');
});
