import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA as sourceSchema,
  ACTIVE_VANDERMONDE_READINGS_SCHEMA as readingsSchema,
  designActiveVandermondeNonlinear,
  evaluateActiveVandermondeReadings,
} from '../src/science/active-vandermonde-nonlinear.mjs';

// All values in this course are dyadic and small enough for exact binary64
// arithmetic. Emit an exact rational for the independent product receiver.
function dyadic(value) {
  let denominator = 1;
  while (!Number.isInteger(value * denominator)) denominator *= 2;
  assert.ok(Number.isSafeInteger(value * denominator));
  return denominator === 1 ? String(value) : [value * denominator, denominator].join('/');
}

const designLevels = [-1.5, -1, -.5, 0, .5, 1, 1.5];
const inside = .25;
const outside = 2;

function course(levels) {
  const request = {
    schema: sourceSchema, stateDimension: 1, horizon: 3, maxDegree: 3, noiseBound: '0',
    amplitudes: levels.map(dyadic), plant: { A: [['0']], bUnit: ['1'], C: ['1'] },
    hypotheses: [{ id: 'unit-gain', coefficients: ['0', '1', '0', '0'] }],
  };
  const plan = designActiveVandermondeNonlinear(request);
  return function evaluate(law) {
    const episodes = levels.map((u, episode) => ({
      episode, amplitude: dyadic(u),
      // A=0 makes y(t>0) exactly g(u), for any starting state.
      readings: [episode - 3, law(u), law(u)].map((y, tick) => ({tick, value: dyadic(y)})),
    }));
    return evaluateActiveVandermondeReadings(request, plan, {
      schema: readingsSchema, source: 'finite-support identifiability audit', acquisition: 'synthetic', episodes,
    });
  };
}

const alternatives = [
  {name: 'degree-seven polynomial', delta: u => designLevels.reduce((p, v) => p * (2*u - 2*v), 1) / 128,
   detectedInside: true, detectedOutside: true},
  // sin(2*pi*u)/2 evaluated exactly on the entire audit support.
  {name: 'periodic ripple', delta: u => {
    if (Number.isInteger(2*u)) return 0;
    assert.equal(u, inside);
    return .5;
  }, detectedInside: true, detectedOutside: false},
  {name: 'change in gain beyond the measured range', delta: u => Math.max(0, u - 1.5),
   detectedInside: false, detectedOutside: true},
];

test('finite signed intervention support admits exact smooth and piecewise alternatives', () => {
  const designs = [designLevels, [...designLevels, inside], [...designLevels, outside], [...designLevels, inside, outside]];
  const evaluate = designs.map(course);
  const originals = evaluate.map(fn => fn(u => u));
  for (const control of originals) {
    assert.equal(control.status, 'one_nonlinear_law_certified');
    assert.deepEqual(control.consistentHypothesisIds, ['unit-gain']);
  }
  for (const alt of alternatives) {
    for (const sign of [-1, 1]) {
      const law = u => u + sign * alt.delta(u);
      const detected = [false, alt.detectedInside, alt.detectedOutside, true];
      for (let i = 0; i < evaluate.length; i++) {
        const result = evaluate[i](law);
        if (detected[i]) {
          assert.equal(result.status, 'abstained_out_of_family_nonlinearity', alt.name);
          assert.ok(result.polynomialViolations.length > 0, alt.name);
          assert.deepEqual(result.dynamicalViolations, []);
        } else {
          assert.deepEqual(result, originals[i], alt.name);
        }
      }
    }
  }
});
