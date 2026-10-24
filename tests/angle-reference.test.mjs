import test from 'node:test';
import assert from 'node:assert/strict';
import {gravityRun, springRun} from '../experiments/integral-discovery-92be.mjs';
import {searchAngleReference, investigateAngleReference, exportReferenceInvestigation, reopenReferenceInvestigation} from '../src/representation/angle-reference.mjs';

function run(id, position, offset, make = gravityRun) {
  const raw = make({id, position, rate: .2, duration: 6, dt: .02});
  return {id, label: id, kind: 'synthetic', dynamics: 'unforced_scalar_rotation', inertia: null,
    initialRate: raw.initialRate, source: {label: 'Independent existing ODE fixture', recordingId: id},
    samples: raw.samples.map(row => ({time: row.time, position: row.position + offset}))};
}
export function bundle(offset = .3, make = gravityRun) {
  return {schema: 'worldlaw.angular-bundle/v1', label: 'Authored reference-shift investigation',
    units: {time: 's', position: 'rad', initialRate: 'rad/s'},
    trainingRuns: [run('train-a', 1.5, offset, make), run('train-b', -1.3, offset, make)],
    challengeRuns: [run('separate-release', 2.1, offset, make)]};
}
const settings = {offsets: [-.6,-.3,0,.3,.6], fit: {terms: ['rate','gravity'], maxTerms: 2, noiseSigma: .00001}};

test('a frozen shifted coordinate predicts changed release with original recorded angles', () => {
  const input = bundle(), before = JSON.stringify(input), result = investigateAngleReference(input, settings);
  assert.equal(result.search.selected.offset, .3);
  assert.equal(result.search.status, 'shifted_hypothesis');
  const pair = result.comparisons[0];
  assert.ok(pair.selected.rollout.metrics.positionRMSE < .001);
  assert.ok(pair.baseline.rollout.metrics.positionRMSE > .1);
  assert.equal(pair.selected.rollout.rows[0].observed, input.challengeRuns[0].samples[0].position);
  assert.ok(pair.selected.resolution.maxAbsPositionDifference < .00001);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.search.selected.model.physicalInertia, null);
});

test('unshifted data pays no needless offset parameter and remains preferred', () => {
  const result = investigateAngleReference(bundle(0), settings);
  assert.equal(result.search.selected.offset, 0);
  assert.equal(result.search.status, 'unshifted_preferred');
});

test('challenge changes cannot alter candidate coefficients, ranking or selected coordinate', () => {
  const input = bundle(), original = investigateAngleReference(input, settings);
  input.challengeRuns[0].samples.forEach((row,i) => {row.position += Math.sin(i / 20);});
  const changed = investigateAngleReference(input, settings);
  assert.deepEqual(changed.search, original.search);
  assert.notEqual(changed.comparisons[0].selected.rollout.metrics.positionRMSE,
    original.comparisons[0].selected.rollout.metrics.positionRMSE);
});

test('spring plus bias retains equivalent coordinates instead of certifying calibration', () => {
  const result = searchAngleReference(bundle(.3, springRun).trainingRuns,
    {...settings, fit: {terms: ['spring','rate','bias'], noiseSigma: .0001}});
  assert.equal(result.selected.offset, 0);
  assert.ok(result.competitiveOffsets.length > 1);
  assert.equal(result.status, 'ambiguous_reference');
});

test('wrong restoring library retains mismatch; endpoint winner stays a boundary', () => {
  const wrong = searchAngleReference(bundle().trainingRuns,
    {...settings, fit: {terms: ['rate'], noiseSigma: .00001}});
  assert.equal(wrong.status, 'residual_mismatch');
  const edge = searchAngleReference(bundle(.6).trainingRuns, settings);
  assert.equal(edge.selected.offset, .6);
  assert.equal(edge.status, 'search_boundary');
});

test('reopen recomputes claims and rejects copied evidence, malformed settings and forged results', () => {
  const result = investigateAngleReference(bundle(), settings);
  const text = exportReferenceInvestigation(result);
  assert.deepEqual(reopenReferenceInvestigation(text), result);
  assert.ok(!text.includes('selected'));
  assert.throws(() => reopenReferenceInvestigation(JSON.stringify({...JSON.parse(text), selected: {offset: 10}})));
  const reused = bundle(); reused.challengeRuns = [reused.trainingRuns[0]];
  assert.throws(() => investigateAngleReference(reused, settings), /shares|distinct id|repeats/i);
  for (const offsets of [[1], [0,0], [0,NaN], [0,4], Array.from({length:42},(_,i)=>i/100)])
    assert.throws(() => searchAngleReference(bundle().trainingRuns, {offsets}));
});

test('stationary motion leaves offset unresolved and solver budget failures visible', () => {
  const input = bundle();
  input.trainingRuns.forEach(run => run.samples.forEach(row => {row.position = .3;}));
  const result = searchAngleReference(input.trainingRuns, settings);
  assert.equal(result.status, 'ambiguous_reference');
  const limited = investigateAngleReference(bundle(), {...settings, solver: {maxSteps: 1}});
  assert.equal(limited.comparisons[0].selected.error.code, 'step_limit');
  assert.equal(limited.search.selected.offset, .3);
});
