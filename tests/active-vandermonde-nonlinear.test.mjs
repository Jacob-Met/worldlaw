import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
  ACTIVE_VANDERMONDE_READINGS_SCHEMA,
  designActiveVandermondeNonlinear,
  replayActiveVandermondeNonlinear,
  evaluateActiveVandermondeReadings,
} from '../src/science/active-vandermonde-nonlinear.mjs';
import {
  sealActivePlan,
  createActiveNotebook,
  receiveActiveNotebook,
  replayActiveNotebook,
} from '../src/science/active-experiment-record.mjs';

const gcd = (aa, bb) => { let a = aa < 0n ? -aa : aa, b = bb < 0n ? -bb : bb; while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => { if (n === 0n) return { n: 0n, d: 1n }; if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
const parseQ = (s) => { const p = String(s).split('/'); return Q(BigInt(p[0]), BigInt(p[1] ?? '1')); };
const addQ = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const mulQ = (a, b) => Q(a.n * b.n, a.d * b.d);
const powQ = (a, m) => { let r = Q(1n); for (let i = 0; i < m; i++) r = mulQ(r, a); return r; };
const fmtQ = (a) => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);

function simulateExactEpisodes({ A, bUnit, C, horizon, amplitudes, x0ByEpisode, gRationalFn, noiseQ = Q(0n), delayed = false }) {
  const Aq = A.map((r) => r.map(parseQ));
  const bq = bUnit.map(parseQ);
  const Cq = C.map(parseQ);
  return amplitudes.map((ampStr, k) => {
    const u = parseQ(ampStr);
    let x = x0ByEpisode[k].map(parseQ);
    const readings = [];
    for (let t = 0; t < horizon; t++) {
      let y = Cq.reduce((s, c, i) => addQ(s, mulQ(c, x[i])), Q(0n));
      if (noiseQ.n !== 0n) {
        y = addQ(y, (k + t) % 2 === 0 ? noiseQ : Q(-noiseQ.n, noiseQ.d));
      }
      readings.push({ tick: t, value: fmtQ(y) });
      const drive = delayed && t === 0 ? Q(0n) : gRationalFn(u);
      x = Aq.map((row, i) => addQ(row.reduce((s, aij, j) => addQ(s, mulQ(aij, x[j])), Q(0n)), mulQ(bq[i], drive)));
    }
    return { episode: k, amplitude: ampStr, readings };
  });
}

const evalPolyQ = (coeffs) => (u) => coeffs.map(parseQ).reduce((s, c, m) => addQ(s, mulQ(c, powQ(u, m))), Q(0n));

test('signed 5-point Vandermonde schedule separates u=2 aliased linear, quadratic, and cubic laws with orthogonal parity Fisher matrix', async () => {
  const request = {
    schema: ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
    stateDimension: 2,
    horizon: 4,
    maxDegree: 3,
    noiseBound: '1/100',
    amplitudes: ['-2', '-1', '0', '1', '2'],
    plant: {
      A: [['1', '1'], ['0', '1/2']],
      bUnit: ['0', '1'],
      C: ['1', '0'],
    },
    hypotheses: [
      { id: 'linear_u', coefficients: ['0', '1', '0', '0'] },
      { id: 'quadratic_half_u2', coefficients: ['0', '0', '1/2', '0'] },
      { id: 'cubic_quarter_u3', coefficients: ['0', '0', '0', '1/4'] },
      { id: 'mixed_duffing_valve', coefficients: ['1/5', '1', '-1/2', '1/4'] },
    ],
  };

  const plan = designActiveVandermondeNonlinear(request);
  assert.equal(plan.status, 'certified_vandermonde_separation_and_identification');
  assert.equal(plan.parityOrthogonal, true);
  assert.equal(plan.fisherDeterminant, '10080');
  assert.ok(Math.abs(plan.fisherConditionNumber - 134.103654) < 1e-2);
  assert.deepEqual(plan.pseudoinverseEstimator[1], ['1/12', '-2/3', '0', '2/3', '-1/12']);
  assert.deepEqual(plan.pseudoinverseEstimator[3], ['-1/12', '1/6', '0', '-1/6', '1/12']);
  assert.deepEqual(plan.outOfFamilyAnnihilators, [['1', '-4', '6', '-4', '1']]);
  assert.equal(plan.singleAmplitudeU2AliasedPairs.length, 3);
  assert.ok(plan.pairwiseSeparations.every((row) => row.certified));

  const sourceJson = JSON.stringify(request);
  const sealedPlan = await sealActivePlan(sourceJson);
  assert.deepEqual(replayActiveVandermondeNonlinear(request, plan), plan);

  const episodes = simulateExactEpisodes({
    A: [['1', '1'], ['0', '1/2']],
    bUnit: ['0', '1'],
    C: ['1', '0'],
    horizon: 4,
    amplitudes: plan.amplitudes,
    x0ByEpisode: [['3', '-2'], ['-5', '4'], ['3/2', '-1/2'], ['0', '7'], ['-5/2', '5/4']],
    gRationalFn: evalPolyQ(['1/5', '1', '-1/2', '1/4']),
  });

  const readoutText = JSON.stringify({
    schema: ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source: 'synthetic unseen mixed quadratic-cubic valve trajectory with per-episode unknown x0',
    acquisition: 'synthetic',
    sourceSHA256: sealedPlan.sourceSHA256,
    planSHA256: sealedPlan.planSHA256,
    episodes,
  });

  const notebook = await createActiveNotebook(sourceJson);
  const updated = await receiveActiveNotebook(notebook, readoutText);
  const replayedBook = await replayActiveNotebook(updated);
  const res = replayedBook.readouts[0].result;

  assert.equal(res.status, 'one_nonlinear_law_certified');
  assert.deepEqual(res.consistentHypothesisIds, ['mixed_duffing_valve']);
  assert.equal(res.abstainedOutOfFamily, false);
  assert.deepEqual(res.recoveredPolynomialLaw.map((r) => r.estimate), ['1/5', '1', '-1/2', '1/4']);
});

test('optimal scale selection minimizes spectral Fisher condition number and recovers unseen continuous nonlinear laws', () => {
  const request = {
    schema: ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
    stateDimension: 1,
    horizon: 3,
    maxDegree: 3,
    noiseBound: '1/500',
    maxFisherConditionNumber: 60,
    candidateSchedules: [
      ['-2', '-1', '0', '1', '2'],
      ['-4/3', '-2/3', '0', '2/3', '4/3'],
      ['-1', '-1/2', '0', '1/2', '1'],
    ],
    plant: { A: [['4/5']], bUnit: ['1'], C: ['1'] },
  };

  const plan = designActiveVandermondeNonlinear(request);
  assert.deepEqual(plan.amplitudes, ['-4/3', '-2/3', '0', '2/3', '4/3']);
  assert.ok(plan.fisherConditionNumber < 45, `expected kappa_2 < 45, got ${plan.fisherConditionNumber}`);

  const episodes = simulateExactEpisodes({
    A: [['4/5']],
    bUnit: ['1'],
    C: ['1'],
    horizon: 3,
    amplitudes: plan.amplitudes,
    x0ByEpisode: [['10'], ['-4'], ['5/2'], ['0'], ['-15/2']],
    gRationalFn: evalPolyQ(['-1/3', '7/5', '2/3', '-4/5']),
  });

  const out = evaluateActiveVandermondeReadings(request, plan, {
    schema: ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source: 'unseen cubic-quadratic system outside hypothesis catalog',
    acquisition: 'synthetic',
    episodes,
  });
  assert.equal(out.status, 'nonlinear_polynomial_law_recovered');
  assert.deepEqual(out.recoveredPolynomialLaw.map((r) => r.estimate), ['-1/3', '7/5', '2/3', '-4/5']);
});

test('parity-complete 7-point signed Vandermonde schedule abstains on both even (quartic/abs) and odd (saturation/quintic) plus delayed outsiders', () => {
  const request = {
    schema: ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
    stateDimension: 1,
    horizon: 3,
    maxDegree: 3,
    noiseBound: '1/200',
    amplitudes: ['-3/2', '-1', '-1/2', '0', '1/2', '1', '3/2'],
    plant: { A: [['1/2']], bUnit: ['1'], C: ['1'] },
    hypotheses: [{ id: 'linear_1', coefficients: ['0', '1', '0', '0'] }],
  };
  const plan = designActiveVandermondeNonlinear(request);
  assert.equal(plan.outOfFamilyAnnihilators.length, 3);
  const x0s = [['1'], ['-2'], ['3'], ['-1'], ['1/2'], ['2'], ['-3/2']];

  // 1. Quartic even outsider g(u) = u + 1/4 u^4
  const quartic = evaluateActiveVandermondeReadings(request, plan, {
    schema: ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source: 'quartic outsider control',
    acquisition: 'synthetic',
    episodes: simulateExactEpisodes({
      A: [['1/2']], bUnit: ['1'], C: ['1'], horizon: 3, amplitudes: plan.amplitudes, x0ByEpisode: x0s,
      gRationalFn: (u) => addQ(u, mulQ(Q(1n, 4n), powQ(u, 4))),
    }),
  });
  assert.equal(quartic.status, 'abstained_out_of_family_nonlinearity');
  assert.ok(quartic.polynomialViolations.length >= 1);

  // 2. Odd clipped saturation g(u) = max(-1, min(1, u)) (defeats 5-point even-only check, caught by 7-point odd annihilator!)
  const clipQ = (u) => (u.n < -u.d ? Q(-1n) : u.n > u.d ? Q(1n) : u);
  const clipped = evaluateActiveVandermondeReadings(request, plan, {
    schema: ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source: 'actuator saturation outsider control',
    acquisition: 'synthetic',
    episodes: simulateExactEpisodes({
      A: [['1/2']], bUnit: ['1'], C: ['1'], horizon: 3, amplitudes: plan.amplitudes, x0ByEpisode: x0s,
      gRationalFn: clipQ,
    }),
  });
  assert.equal(clipped.status, 'abstained_out_of_family_nonlinearity');
  assert.ok(clipped.polynomialViolations.length >= 1);

  // 3. Asymmetric deadzone g(u) = u > 1/2 ? u - 1/2 : (u < 0 ? u : 0)
  const deadzoneQ = (u) => (u.n * 2n > u.d ? addQ(u, Q(-1n, 2n)) : u.n < 0n ? u : Q(0n));
  const deadzone = evaluateActiveVandermondeReadings(request, plan, {
    schema: ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source: 'asymmetric deadzone outsider control',
    acquisition: 'synthetic',
    episodes: simulateExactEpisodes({
      A: [['1/2']], bUnit: ['1'], C: ['1'], horizon: 3, amplitudes: plan.amplitudes, x0ByEpisode: x0s,
      gRationalFn: deadzoneQ,
    }),
  });
  assert.equal(deadzone.status, 'abstained_out_of_family_nonlinearity');
  assert.ok(deadzone.polynomialViolations.length >= 1);

  // 4. One-tick delayed actuator (caught by within-episode Hankel/observability dynamical annihilator)
  const delayed = evaluateActiveVandermondeReadings(request, plan, {
    schema: ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source: 'unmodeled one-tick delay outsider control',
    acquisition: 'synthetic',
    episodes: simulateExactEpisodes({
      A: [['1/2']], bUnit: ['1'], C: ['1'], horizon: 3, amplitudes: plan.amplitudes, x0ByEpisode: x0s,
      gRationalFn: (u) => u,
      delayed: true,
    }),
  });
  assert.equal(delayed.status, 'abstained_out_of_family_nonlinearity');
  assert.ok(delayed.dynamicalViolations.length >= 1);
});
