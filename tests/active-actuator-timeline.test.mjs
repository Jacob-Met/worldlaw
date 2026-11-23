import test from 'node:test';
import assert from 'node:assert/strict';
import {designActiveVandermondeNonlinear as design, evaluateActiveVandermondeReadings as receive,
  ACTIVE_ACTUATOR_TIMELINE_SCHEMA, ACTIVE_ACTUATOR_TIMELINE_READINGS_SCHEMA} from '../src/science/active-vandermonde-nonlinear.mjs';
import {createActiveNotebook, receiveActiveNotebook, replayActiveNotebook} from '../src/science/active-experiment-record.mjs';

const drift = {A: [[1,1],[0,1]], bUnit: [1,0], C: [1,0]};
const source = (amplitudeTimeline, noiseBound = 0, changes = {}) => ({
  schema: ACTIVE_ACTUATOR_TIMELINE_SCHEMA, stateDimension: 2, maxDegree: 2,
  plant: drift, amplitudeTimeline, noiseBound, ...changes
});
const pair = [{id: 'zero', coefficients: [0,0,0]}, {id: 'identity', coefficients: [0,1,0]}];
const read = (values, ticks = values.map((_,i) => i)) => ({
  schema: ACTIVE_ACTUATOR_TIMELINE_READINGS_SCHEMA, source: 'authored scalar sensor',
  acquisition: 'synthetic', observations: values.map((value, i) => ({tick: ticks[i], value}))
});
function simulate(amplitudes, coefficients, position, bias) {
  const output = [position];
  for (const u of amplitudes) {
    const g = u === null ? 0 : coefficients.reduceRight((v, c) => v*u+c, 0);
    position += bias + g;
    output.push(position);
  }
  return output;
}

test('continuous excitation recovers slope and curvature but exhibits the exact unobservable offset', () => {
  for (const horizon of [3,6,12]) {
    assert.throws(() => design({schema: 'worldlaw.active-vandermonde-nonlinear/v1',
      stateDimension: 2, horizon, maxDegree: 2, plant: drift, amplitudes: [-5,-2,0,2,5]}), /initial-state subspace/);
  }
  const schedule = [-2,-1,0,1,2], q = source(schedule), plan = design(q);
  assert.equal(plan.identifiableRank, 2);
  assert.deepEqual(plan.indistinguishableDirections,
    [{coefficients: ['1','0','0'], initialStateShift: ['0','-1']}]);
  const values = simulate(schedule, [7,-3,2], 11, -4);
  assert.deepEqual(values, simulate(schedule, [8,-3,2], 11, -5));
  const report = receive(q, plan, read(values));
  assert.equal(report.minimumReadingError, '0');
  assert.deepEqual(report.estimates.map(x => [x.coefficients,x.interval]), [
    [['0','1','0'],['-3','-3']], [['0','0','1'],['2','2']]
  ]);
  assert.equal(design(source([4,4,4,4])).identifiableRank, 0);
  const changed = values.slice(); changed[4]++;
  assert.equal(receive(q, plan, read(changed)).polynomialFamilyConsistent, false);
  assert.deepEqual(receive(q, plan, read(changed)).estimates, []);
});

test('unit noise keeps the closed pair boundary, with independent primal witnesses', () => {
  const bound = source([-4,4], 1, {hypotheses: pair}), plan = design(bound);
  assert.deepEqual(plan.pairwiseSeparations, [{pair: ['zero','identity'], distance: '2', separated: false}]);
  const common = [1,-1,1];
  for (const candidate of [simulate([-4,4], [0,0,0], 0, 0), simulate([-4,4], [0,1,0], 2, 0)])
    assert.ok(candidate.every((y,t) => Math.abs(y-common[t]) <= 1));
  assert.deepEqual(receive(bound, plan, read(common)).consistentHypothesisIds, ['zero','identity']);
  const separated = source([-5,5], 1, {hypotheses: pair}), strong = design(separated);
  assert.deepEqual(strong.pairwiseSeparations, [{pair: ['zero','identity'], distance: '5/2', separated: true}]);
  assert.deepEqual(receive(separated, strong, read(common)).consistentHypothesisIds, ['zero']);
  assert.throws(() => receive(separated, plan, read(common)), /plan changed/);
});

test('a null transition switches the actuator off; a zero amplitude retains its intercept', () => {
  const active = source([0,0,0], 0, {maxDegree: 0});
  assert.equal(design(active).identifiableRank, 0);
  const switched = source([0,null,0], 0, {maxDegree: 0}), plan = design(switched);
  assert.equal(plan.identifiableRank, 1);
  assert.equal(receive(switched, plan, read(simulate(switched.amplitudeTimeline, [9], 1, 2))).estimates[0].estimate, '9');
  assert.throws(() => design({...switched, plant: {...drift, pulseTicks: [0,1]}}), /all transitions/);
});

test('portable receiver binds the original timeline, exact readings and ordered observation ticks', async () => {
  const q = source([-2,-1,0,1,2], 0, {plant: {...drift, observationTicks: [0,1,3,4,5]}});
  const book = await createActiveNotebook(JSON.stringify(q)), ticks = book.plan.observationTicks;
  const all = simulate(q.amplitudeTimeline, [5,1,-2], -3, 4);
  const readings = {...read(ticks.map(t => all[t]), ticks), sourceSHA256: book.plan.sourceSHA256,
    planSHA256: book.plan.planSHA256};
  const saved = await receiveActiveNotebook(book, JSON.stringify(readings));
  assert.deepEqual((await replayActiveNotebook(JSON.parse(JSON.stringify(saved)))).readouts[0].result.estimates.map(e => e.estimate), ['1','-2']);
  await assert.rejects(receiveActiveNotebook(book, JSON.stringify({...readings, observations: readings.observations.toReversed()})), /frozen observation tick/);
  await assert.rejects(replayActiveNotebook({...saved, sourceText: JSON.stringify({...q, amplitudeTimeline: [2,1,0,-1,-2]})}), /source bytes changed/);
});

const memoryless = {A: [[0]], bUnit: [1], C: [1]};
const repeated = source([1,1], 1, {plant: memoryless, stateDimension: 1, maxDegree: 2});

test('opposite noise faces pin an identifiable sum at one value', () => {
  const plan = design(repeated);
  assert.equal(plan.identifiableRank, 1);
  const [row] = receive(repeated, plan, read([7,-1,1])).estimates;
  assert.deepEqual(row.coefficients, ['1','1','1']);
  assert.equal(Number(row.interval[1]) - Number(row.interval[0]), 2);
  assert.deepEqual(row.feasibleInterval, ['0','0']);
  assert.deepEqual(row.endpointReadingWeights, {lower: ['0','0','1'], upper: ['0','1','0']});
  assert.equal(receive(repeated, plan, read([7,-1,2])).polynomialFamilyConsistent, false);
});

test('all nuisance coefficients participate and both rational endpoints are attained', () => {
  const q = source([-1,0,1], 1, {plant: memoryless, stateDimension: 1, maxDegree: 1});
  const observations = [0,0,1,1];
  const rows = receive(q, design(q), read(observations)).estimates;
  assert.deepEqual(rows.map(r => r.feasibleInterval), [['0','3/2'],['-1/2','3/2']]);
  // Each tuple witnesses an endpoint for *one* functional across all three readings.
  for (const [intercept,slope] of [[0,0],[1.5,.5],[.5,-.5],[.5,1.5]]) {
    const predicted = [0,...[-1,0,1].map(u => intercept + slope*u)];
    assert.ok(predicted.every((v,i) => Math.abs(v-observations[i]) <= 1));
  }
  const exact = {...q, noiseBound: 0};
  assert.deepEqual(receive(exact, design(exact), read([0,0,1,2])).estimates.map(r => r.feasibleInterval),
    [['1','1'],['1','1']]);
});

test('portable replay checks sharp endpoint certificates and reconstructs historical v1 estimates', async () => {
  const book = await createActiveNotebook(JSON.stringify(repeated));
  const readings = {...read([7,-1,1]), sourceSHA256: book.plan.sourceSHA256, planSHA256: book.plan.planSHA256};
  const saved = await receiveActiveNotebook(book, JSON.stringify(readings));
  const current = saved.readouts[0].result;
  assert.equal(current.schema, 'worldlaw.active-actuator-timeline-result/v2');
  assert.deepEqual((await replayActiveNotebook(saved)).readouts[0].result, current);
  const tamper = structuredClone(saved);
  tamper.readouts[0].result.estimates[0].endpointReadingWeights.lower[0] = '1';
  await assert.rejects(replayActiveNotebook(tamper), /exact readout replay refused/);
  const historical = structuredClone(saved);
  const old = historical.readouts[0].result;
  old.schema = 'worldlaw.active-actuator-timeline-result/v1';
  old.estimates = old.estimates.map(({coefficients, estimate, interval}) => ({coefficients, estimate, interval}));
  assert.deepEqual((await replayActiveNotebook(historical)).readouts[0].result, old);
  old.estimates[0].interval[0] = '99';
  await assert.rejects(replayActiveNotebook(historical), /exact readout replay refused/);
});
