/**
 * Multi-amplitude signed Vandermonde interventional design and exact rational
 * nonlinear law recovery with Fisher condition-number certification and
 * two-axis (cross-amplitude polynomial + within-episode dynamical) out-of-family
 * residual abstention.
 *
 * Eliminates single-amplitude (u = 2) and unsigned polynomial aliasing across
 * offset + linear + quadratic + cubic actuator laws under arbitrary unknown
 * per-episode initial states x_k[0].
 */
import {compileExactAffineCircuits} from './active-linear-family.mjs';

export const ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA = 'worldlaw.active-vandermonde-nonlinear/v1';
export const ACTIVE_VANDERMONDE_READINGS_SCHEMA = 'worldlaw.active-vandermonde-readings/v1';

const err = (msg) => { throw new Error('Active Vandermonde nonlinear: ' + msg); };
const need = (ok, msg) => { if (!ok) err(msg); };
const absBig = (x) => (x < 0n ? -x : x);
const gcdBig = (aa, bb) => {
  let a = absBig(aa), b = absBig(bb);
  while (b) [a, b] = [b, a % b];
  return a;
};
const lcmBig = (a, b) => (a === 0n || b === 0n ? 0n : absBig(a / gcdBig(a, b) * b));

const Q = (n, d = 1n) => {
  need(d !== 0n, 'zero denominator');
  if (n === 0n) return { n: 0n, d: 1n };
  if (d < 0n) { n = -n; d = -d; }
  const g = gcdBig(n, d);
  return { n: n / g, d: d / g };
};
const Z = () => Q(0n);
const ONE = () => Q(1n);
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const div = (a, b) => { need(b.n !== 0n, 'division by zero'); return Q(a.n * b.d, a.d * b.n); };
const neg = (a) => Q(-a.n, a.d);
const absQ = (a) => Q(absBig(a.n), a.d);
const cmpQ = (a, b) => {
  const lhs = a.n * b.d, rhs = b.n * a.d;
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};
const powQ = (a, m) => {
  let out = ONE();
  for (let i = 0; i < m; i++) out = mul(out, a);
  return out;
};
const fmt = (a) => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);
const toFloat = (a) => Number(a.n) / Number(a.d);

function parseRational(x, label = 'rational') {
  if (typeof x === 'number') {
    need(Number.isSafeInteger(x), `${label} numbers must be safe integers; pass rationals as strings`);
    x = String(x);
  }
  need(
    typeof x === 'string' && x.length <= 40 && /^[+-]?\d+(?:\/[1-9]\d*)?$/.test(x),
    `${label} must be an exact integer or rational string`
  );
  const parts = x.split('/');
  const n = BigInt(parts[0]);
  const d = BigInt(parts[1] ?? '1');
  need(absBig(n) <= 1000000000000n && d <= 1000000000000n, `${label} exceeds rational budget`);
  return Q(n, d);
}

const dot = (a, b) => a.reduce((s, v, i) => add(s, mul(v, b[i])), Z());
const l1Norm = (vec) => vec.reduce((s, v) => add(s, absQ(v)), Z());
const matVec = (M, v) => M.map((row) => dot(row, v));
const transpose = (M) => {
  const rows = M.length, cols = M[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (__, i) => M[i][j]));
};
const matMul = (A, B) => {
  const Bt = transpose(B);
  return A.map((row) => Bt.map((col) => dot(row, col)));
};

function rref(M) {
  const a = M.map((r) => r.slice());
  const m = a.length, n = a[0]?.length ?? 0;
  let k = 0;
  const pivots = [];
  for (let c = 0; c < n && k < m; c++) {
    let p = k;
    while (p < m && a[p][c].n === 0n) p++;
    if (p === m) continue;
    [a[k], a[p]] = [a[p], a[k]];
    const piv = a[k][c];
    a[k] = a[k].map((v) => div(v, piv));
    for (let r = 0; r < m; r++) {
      if (r !== k && a[r][c].n !== 0n) {
        const f = a[r][c];
        a[r] = a[r].map((v, j) => sub(v, mul(f, a[k][j])));
      }
    }
    pivots.push(c);
    k++;
  }
  return { a, pivots };
}

/** Basis of right nullspace { v : M v = 0 }, primitive integer-scaled for canonical byte stability. */
function rightNullBasis(M) {
  const n = M[0]?.length ?? 0;
  const { a, pivots } = rref(M);
  const pivSet = new Set(pivots);
  const basis = [];
  for (let free = 0; free < n; free++) {
    if (pivSet.has(free)) continue;
    const v = Array.from({ length: n }, Z);
    v[free] = ONE();
    for (let i = 0; i < pivots.length; i++) {
      v[pivots[i]] = neg(a[i][free]);
    }
    basis.push(primitiveIntegerRow(v));
  }
  return basis;
}

function primitiveIntegerRow(vec) {
  let denLcm = 1n;
  for (const q of vec) denLcm = lcmBig(denLcm, q.d);
  const ints = vec.map((q) => q.n * (denLcm / q.d));
  let g = 0n;
  for (const v of ints) g = gcdBig(g, v);
  if (g === 0n) return vec.map(() => Z());
  let sign = 1n;
  for (const v of ints) {
    if (v !== 0n) { sign = v < 0n ? -1n : 1n; break; }
  }
  return ints.map((v) => Q((v / g) * sign, 1n));
}

/** Exact rational Gauss-Jordan inverse and determinant of square matrix F. */
function invertAndDet(F) {
  const n = F.length;
  const aug = F.map((row, i) => [
    ...row.slice(),
    ...Array.from({ length: n }, (_, j) => (i === j ? ONE() : Z())),
  ]);
  let det = ONE();
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && aug[p][c].n === 0n) p++;
    need(p < n, 'Vandermonde Fisher matrix is rank-deficient; supply distinct amplitudes');
    if (p !== c) {
      [aug[c], aug[p]] = [aug[p], aug[c]];
      det = neg(det);
    }
    const piv = aug[c][c];
    det = mul(det, piv);
    aug[c] = aug[c].map((v) => div(v, piv));
    for (let r = 0; r < n; r++) {
      if (r !== c && aug[r][c].n !== 0n) {
        const f = aug[r][c];
        aug[r] = aug[r].map((v, j) => sub(v, mul(f, aug[c][j])));
      }
    }
  }
  const inv = aug.map((row) => row.slice(n));
  return { inv, det };
}

/** Exact symmetric Jacobi eigensolver for spectral Fisher condition number kappa_2(F). */
function symmetricEigenvalues(F) {
  const n = F.length;
  const A = F.map((row) => row.map(toFloat));
  for (let sweep = 0; sweep < 80; sweep++) {
    let maxOff = 0, p = 0, q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(A[i][j]);
        if (v > maxOff) { maxOff = v; p = i; q = j; }
      }
    }
    if (maxOff < 1e-15) break;
    const diff = A[q][q] - A[p][p];
    let t;
    if (Math.abs(A[p][q]) < 1e-30 * Math.abs(diff)) {
      t = A[p][q] / diff;
    } else {
      const phi = diff / (2 * A[p][q]);
      t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
      if (phi < 0) t = -t;
    }
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;
    const app = A[p][p], aqq = A[q][q], apq = A[p][q];
    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0;
    A[q][p] = 0;
    for (let r = 0; r < n; r++) {
      if (r !== p && r !== q) {
        const arp = A[r][p], arq = A[r][q];
        A[r][p] = c * arp - s * arq;
        A[p][r] = A[r][p];
        A[r][q] = s * arp + c * arq;
        A[q][r] = A[r][q];
      }
    }
  }
  return A.map((row, i) => row[i]).sort((x, y) => x - y);
}

function matPow(A, exp) {
  const n = A.length;
  let result = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? ONE() : Z()))
  );
  let base = A;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = matMul(result, base);
    e >>= 1;
    if (e > 0) base = matMul(base, base);
  }
  return result;
}

function parsePlant(raw, n, horizon) {
  need(raw && typeof raw === 'object' && !Array.isArray(raw), 'plant object is required');
  need(
    Array.isArray(raw.A) && raw.A.length === n && raw.A.every((r) => Array.isArray(r) && r.length === n),
    `plant.A must be ${n}x${n}`
  );
  const A = raw.A.map((r) => r.map((v) => parseRational(v, 'plant.A')));
  need(Array.isArray(raw.bUnit) && raw.bUnit.length === n, `plant.bUnit must have length ${n}`);
  const bUnit = raw.bUnit.map((v) => parseRational(v, 'plant.bUnit'));
  const rawC = Array.isArray(raw.C?.[0]) ? raw.C[0] : raw.C;
  need(Array.isArray(rawC) && rawC.length === n, `plant.C must have length ${n}`);
  const C = rawC.map((v) => parseRational(v, 'plant.C'));

  const obsTicks = raw.observationTicks ?? Array.from({ length: horizon }, (_, t) => t);
  need(
    Array.isArray(obsTicks) && obsTicks.length >= n + 1 && obsTicks.length <= horizon &&
    obsTicks.every((t, i) => Number.isSafeInteger(t) && t >= 0 && t < horizon && (i === 0 || t > obsTicks[i - 1])),
    'observationTicks must be strictly increasing integers within [0, horizon)'
  );
  const pulseTicks = raw.pulseTicks ?? Array.from({ length: horizon - 1 }, (_, t) => t);
  need(
    Array.isArray(pulseTicks) && pulseTicks.length >= 1 &&
    pulseTicks.every((t, i) => Number.isSafeInteger(t) && t >= 0 && t < horizon - 1 && (i === 0 || t > pulseTicks[i - 1])),
    'pulseTicks must be strictly increasing integers within [0, horizon - 1)'
  );
  const pulseSet = new Set(pulseTicks);

  // Observability rows O[r] = C * A^{tau_r} and unit forced response h_p[r]
  const O = [];
  const hp = [];
  for (const tau of obsTicks) {
    const At = matPow(A, tau);
    O.push(transpose(At).map((col) => dot(C, col)));
    let forced = Z();
    for (let j = 0; j < tau; j++) {
      if (!pulseSet.has(j)) continue;
      const Astep = matPow(A, tau - 1 - j);
      const xStep = matVec(Astep, bUnit);
      forced = add(forced, dot(C, xStep));
    }
    hp.push(forced);
  }

  return { A, bUnit, C, obsTicks, pulseTicks, O, hp };
}

function actuatorInvariants(O, hp, exactNoiseDesign) {
  // Left-nullspace of O: { c : O^T c = 0 }
  const nullO = rightNullBasis(transpose(O));
  need(nullO.length > 0, 'observationTicks must exceed observable state rank to eliminate unknown x[0]');

  // Preserve the historical witness on ties, including every noiseless design.
  const candidates = [...nullO];
  for (let i = 0; i < nullO.length; i++) {
    for (let j = i + 1; j < nullO.length; j++) {
      candidates.push(primitiveIntegerRow(nullO[i].map((v, k) => add(v, nullO[j][k]))));
      candidates.push(primitiveIntegerRow(nullO[i].map((v, k) => sub(v, nullO[j][k]))));
    }
  }
  if (exactNoiseDesign) {
    // Extreme points of ker(O^T) intersected with the unit l1 ball are circuits.
    // Thus a circuit attains the largest normalized forced response.
    for (const { weights } of compileExactAffineCircuits(O)) {
      candidates.push(primitiveIntegerRow(weights));
    }
  }
  let bestCircuit = null;
  let bestGain = null;
  let bestAmplification = null;
  for (const cand of candidates) {
    let gain = dot(cand, hp);
    if (gain.n === 0n) continue;
    let c = cand;
    if (gain.n < 0n) {
      c = cand.map(neg);
      gain = neg(gain);
    }
    const amp = div(l1Norm(c), gain);
    if (bestAmplification === null || cmpQ(amp, bestAmplification) < 0) {
      bestCircuit = c;
      bestGain = gain;
      bestAmplification = amp;
    }
  }
  need(bestCircuit !== null, 'plant actuator response lies inside unobservable initial-state subspace');

  // Within-episode dynamical annihilators: { d : O^T d = 0 AND h_p^T d = 0 }
  const augmented = transpose(O).map((r) => r.slice());
  augmented.push(hp.slice());
  const dynNull = rightNullBasis(augmented);

  return {
    circuit: bestCircuit,
    forcedGain: bestGain,
    noiseAmplification: bestAmplification,
    dynamicalAnnihilators: dynNull,
  };
}

function parseHypotheses(raw, maxDegree) {
  if (raw === undefined || raw === null) return [];
  need(Array.isArray(raw) && raw.length <= 32, 'hypotheses must be an array of at most 32 candidate laws');
  const seen = new Set();
  return raw.map((item) => {
    need(item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim().length > 0, 'hypothesis id required');
    need(!seen.has(item.id), `duplicate hypothesis id ${item.id}`);
    seen.add(item.id);
    need(Array.isArray(item.coefficients) && item.coefficients.length === maxDegree + 1, `hypothesis ${item.id} requires ${maxDegree + 1} polynomial coefficients`);
    return {
      id: item.id,
      coefficients: item.coefficients.map((v) => parseRational(v, `hypothesis ${item.id}`)),
    };
  });
}

function buildScheduleDesign(ampStrings, maxDegree, epsilonZ, hypotheses) {
  need(Array.isArray(ampStrings) && ampStrings.length >= maxDegree + 2 && ampStrings.length <= 13,
    `amplitudes must provide K >= ${maxDegree + 2} distinct rational levels to separate degree-${maxDegree} terms and certify out-of-family residuals`);
  const amps = ampStrings.map((v) => parseRational(v, 'amplitude'));
  const canonicalKeys = amps.map(fmt);
  need(new Set(canonicalKeys).size === amps.length, 'amplitudes must be pairwise distinct');

  const K = amps.length;
  const cols = maxDegree + 1;
  const V = amps.map((u) => Array.from({ length: cols }, (_, m) => powQ(u, m)));
  const Vt = transpose(V);
  const F = matMul(Vt, V);
  const { inv: Finv, det: detF } = invertAndDet(F);
  const P = matMul(Finv, Vt);

  // Verify exact rational left-inverse P * V == I
  const PV = matMul(P, V);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      const want = i === j ? 1n : 0n;
      need(PV[i][j].n === want && PV[i][j].d === 1n, 'internal Vandermonde normal-equation check failed');
    }
  }

  const eigs = symmetricEigenvalues(F);
  need(eigs[0] > 0, 'Fisher matrix must be strictly positive definite');
  const fisherConditionNumber = Number((eigs[eigs.length - 1] / eigs[0]).toFixed(6));

  // Cross-amplitude out-of-family residual annihilators: W_oof * V = 0
  const oofBasis = rightNullBasis(Vt);
  need(oofBasis.length === K - cols, 'unexpected Vandermonde nullspace dimension');

  const coeffNormsL1 = P.map(l1Norm);
  const coeffErrorRadii = coeffNormsL1.map((norm) => mul(norm, epsilonZ));
  const oofThresholds = oofBasis.map((w) => mul(l1Norm(w), epsilonZ));

  // Check parity orthogonality (all odd moments == 0)
  let parityOrthogonal = true;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      if ((i + j) % 2 === 1 && F[i][j].n !== 0n) parityOrthogonal = false;
    }
  }

  // Single-amplitude u = 2 aliasing witness
  const u2 = Q(2n, 1n);
  const u2Vec = Array.from({ length: cols }, (_, m) => powQ(u2, m));
  const singleAmpCollisions = [];
  for (let i = 0; i < hypotheses.length; i++) {
    for (let j = i + 1; j < hypotheses.length; j++) {
      const y1 = dot(hypotheses[i].coefficients, u2Vec);
      const y2 = dot(hypotheses[j].coefficients, u2Vec);
      if (cmpQ(absQ(sub(y1, y2)), mul(Q(2n), epsilonZ)) <= 0) {
        singleAmpCollisions.push([hypotheses[i].id, hypotheses[j].id]);
      }
    }
  }

  // Pairwise multi-amplitude separation margin across candidate hypotheses
  const pairwise = [];
  let allSeparated = true;
  for (let i = 0; i < hypotheses.length; i++) {
    for (let j = i + 1; j < hypotheses.length; j++) {
      let maxDiff = Z();
      let witnessAmplitude = canonicalKeys[0];
      for (let k = 0; k < K; k++) {
        const diff = absQ(sub(dot(V[k], hypotheses[i].coefficients), dot(V[k], hypotheses[j].coefficients)));
        if (cmpQ(diff, maxDiff) > 0) {
          maxDiff = diff;
          witnessAmplitude = canonicalKeys[k];
        }
      }
      const certified = cmpQ(maxDiff, mul(Q(2n), epsilonZ)) > 0;
      if (!certified) allSeparated = false;
      pairwise.push({
        pair: [hypotheses[i].id, hypotheses[j].id],
        maxInvariantSeparation: fmt(maxDiff),
        requiredSeparation: fmt(mul(Q(2n), epsilonZ)),
        witnessAmplitude,
        certified,
      });
    }
  }

  return {
    amps,
    canonicalKeys,
    V,
    F,
    Finv,
    detF,
    P,
    fisherEigenvalues: eigs.map((x) => Number(x.toFixed(8))),
    fisherConditionNumber,
    parityOrthogonal,
    oofBasis,
    oofThresholds,
    coeffNormsL1,
    coeffErrorRadii,
    singleAmpCollisions,
    pairwise,
    allSeparated,
  };
}

export function designActiveVandermondeNonlinear(request) {
  return designNonlinear(request, false);
}

function designNonlinear(request, historical) {
  need(request && typeof request === 'object' && request.schema === ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
    'expected schema ' + ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA);
  const n = request.stateDimension;
  const horizon = request.horizon;
  const maxDegree = request.maxDegree ?? 3;
  need(Number.isSafeInteger(n) && n >= 1 && n <= 8, 'stateDimension must be in 1..8');
  need(Number.isSafeInteger(horizon) && horizon >= n + 1 && horizon <= 16, 'horizon must be in (stateDimension+1)..16');
  need(Number.isSafeInteger(maxDegree) && maxDegree >= 2 && maxDegree <= 4, 'maxDegree must be in 2..4');

  const noiseBound = parseRational(request.noiseBound ?? '0', 'noiseBound');
  need(noiseBound.n >= 0n, 'noiseBound must be nonnegative');
  const maxFisherCond = request.maxFisherConditionNumber ?? 250;
  need(typeof maxFisherCond === 'number' && Number.isFinite(maxFisherCond) && maxFisherCond >= 1,
    'maxFisherConditionNumber must be a finite number >= 1');

  const plant = parsePlant(request.plant, n, horizon);
  const invariant = actuatorInvariants(plant.O, plant.hp, !historical && noiseBound.n > 0n);
  const epsilonZ = mul(invariant.noiseAmplification, noiseBound);
  const hypotheses = parseHypotheses(request.hypotheses, maxDegree);

  const schedules = Array.isArray(request.candidateSchedules) && request.candidateSchedules.length > 0
    ? request.candidateSchedules
    : [request.amplitudes ?? ['-2', '-1', '0', '1', '2']];

  let chosen = null;
  for (const sched of schedules) {
    const built = buildScheduleDesign(sched, maxDegree, epsilonZ, hypotheses);
    if (built.fisherConditionNumber > maxFisherCond) continue;
    if (
      chosen === null ||
      (built.allSeparated && !chosen.allSeparated) ||
      (built.allSeparated === chosen.allSeparated && built.fisherConditionNumber < chosen.fisherConditionNumber)
    ) {
      chosen = built;
    }
  }
  need(chosen !== null, `no candidate schedule satisfied maxFisherConditionNumber <= ${maxFisherCond}`);

  const status = hypotheses.length === 0
    ? 'certified_vandermonde_identification_design'
    : chosen.allSeparated
      ? 'certified_vandermonde_separation_and_identification'
      : 'vandermonde_design_noise_limited';

  return {
    schema: ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
    status,
    stateDimension: n,
    horizon,
    maxDegree,
    noiseBound: fmt(noiseBound),
    invariantNoiseBound: fmt(epsilonZ),
    amplitudes: chosen.canonicalKeys,
    episodeCount: chosen.canonicalKeys.length,
    observationTicks: plant.obsTicks,
    pulseTicks: plant.pulseTicks,
    initialStateEliminator: invariant.circuit.map(fmt),
    forcedResponseGain: fmt(invariant.forcedGain),
    dynamicalAnnihilators: invariant.dynamicalAnnihilators.map((row) => row.map(fmt)),
    vandermondeMatrix: chosen.V.map((row) => row.map(fmt)),
    fisherMatrix: chosen.F.map((row) => row.map(fmt)),
    fisherDeterminant: fmt(chosen.detF),
    fisherEigenvalues: chosen.fisherEigenvalues,
    fisherConditionNumber: chosen.fisherConditionNumber,
    maxFisherConditionNumber: maxFisherCond,
    parityOrthogonal: chosen.parityOrthogonal,
    pseudoinverseEstimator: chosen.P.map((row) => row.map(fmt)),
    coefficientL1Norms: chosen.coeffNormsL1.map(fmt),
    coefficientErrorRadii: chosen.coeffErrorRadii.map(fmt),
    outOfFamilyAnnihilators: chosen.oofBasis.map((row) => row.map(fmt)),
    outOfFamilyThresholds: chosen.oofThresholds.map(fmt),
    singleAmplitudeU2AliasedPairs: chosen.singleAmpCollisions,
    hypothesisIds: hypotheses.map((h) => h.id),
    pairwiseSeparations: chosen.pairwise,
  };
}

export function replayActiveVandermondeNonlinear(request, plan) {
  const recomputed = designActiveVandermondeNonlinear(request);
  const frozen = JSON.stringify(plan);
  if (JSON.stringify(recomputed) === frozen) return recomputed;
  // Older plans used a conservative invariant. Replay only its exact original
  // schedule and certificate; readouts continue to use that frozen invariant.
  const previous = designNonlinear(request, true);
  need(JSON.stringify(previous) === frozen,
    'Replayed Vandermonde nonlinear certificate does not match frozen plan');
  return previous;
}

/** Project each complete bounded-error episode onto its scalar actuator
 * response. For every circuit w of O, |w.y - (w.h)g| <= epsilon ||w||1.
 * These are all dual faces, not just a nullspace basis. Their intersection
 * is exactly the set of g admitting ONE initial state and ONE error vector.
 * Then intersect the resulting response box with the shared polynomial
 * image. A conformal decomposition into circuits makes those box checks
 * sufficient even when individual response intervals have zero width. */
function jointReadoutGeometry(plant, episodeValues, noiseBound, V) {
  const circuits = compileExactAffineCircuits(plant.O);
  const intervals = [];
  const dynamicalViolations = [];
  const witness = (weights, values) => {
    const row = primitiveIntegerRow(weights);
    return {
      certificate: 'complete_episode_noise_box',
      annihilatorIndex: null,
      weights: row.map(fmt),
      residual: fmt(absQ(dot(row, values))),
      threshold: fmt(mul(l1Norm(row), noiseBound)),
    };
  };
  for (let k = 0; k < episodeValues.length; k++) {
    const values = episodeValues[k];
    let lower = null, upper = null, lowerWeights = null, upperWeights = null;
    let violation = null;
    for (const {weights} of circuits) {
      const gain = dot(weights, plant.hp);
      const response = dot(weights, values);
      const radius = mul(l1Norm(weights), noiseBound);
      if (gain.n === 0n) {
        if (!violation && cmpQ(absQ(response), radius) > 0)
          violation = witness(weights, values);
        continue;
      }
      // Normalize to unit response; its sign is then immaterial.
      const normalized = weights.map(q => div(q, gain));
      const center = div(response, gain);
      const spread = div(radius, absQ(gain));
      const lo = sub(center, spread), hi = add(center, spread);
      if (lower === null || cmpQ(lo, lower) > 0) {
        lower = lo; lowerWeights = normalized;
      }
      if (upper === null || cmpQ(hi, upper) < 0) {
        upper = hi; upperWeights = normalized;
      }
    }
    need(lower !== null && upper !== null, 'internal actuator response is not observable');
    if (!violation && cmpQ(lower, upper) > 0)
      violation = witness(lowerWeights.map((q, i) => sub(q, upperWeights[i])), values);
    intervals.push({lower, upper});
    if (violation) dynamicalViolations.push({episode: k, ...violation});
  }
  if (dynamicalViolations.length) return {intervals, dynamicalViolations, polynomialViolation: null};

  const centers = intervals.map(({lower, upper}) => div(add(lower, upper), Q(2n)));
  const radii = intervals.map(({lower, upper}) => div(sub(upper, lower), Q(2n)));
  let polynomialViolation = null;
  for (const {weights} of compileExactAffineCircuits(V)) {
    const row = primitiveIntegerRow(weights);
    const residual = absQ(dot(row, centers));
    const threshold = row.reduce((sum, q, i) => add(sum, mul(absQ(q), radii[i])), Z());
    if (cmpQ(residual, threshold) > 0) {
      polynomialViolation = {
        certificate: 'complete_polynomial_response_box',
        annihilatorIndex: null,
        weights: row.map(fmt),
        responseIntervals: intervals.map(({lower, upper}) => [fmt(lower), fmt(upper)]),
        residual: fmt(residual),
        threshold: fmt(threshold),
      };
      break;
    }
  }
  return {intervals, dynamicalViolations, polynomialViolation};
}

export function evaluateActiveVandermondeReadings(request, plan, supplied) {
  const verifiedPlan = replayActiveVandermondeNonlinear(request, plan);
  need(supplied && typeof supplied === 'object' && supplied.schema === ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    'expected readings schema ' + ACTIVE_VANDERMONDE_READINGS_SCHEMA);
  need(typeof supplied.source === 'string' && supplied.source.trim().length >= 8,
    'readings require descriptive source attribution');
  need(['synthetic', 'supplied'].includes(supplied.acquisition), 'acquisition must be synthetic or supplied');

  const episodes = supplied.episodes;
  const K = verifiedPlan.amplitudes.length;
  need(Array.isArray(episodes) && episodes.length === K, `expected exactly ${K} interventional episodes`);

  const noiseBound = parseRational(verifiedPlan.noiseBound);
  const epsilonZ = parseRational(verifiedPlan.invariantNoiseBound);
  const circuit = verifiedPlan.initialStateEliminator.map((v) => parseRational(v));
  const forcedGain = parseRational(verifiedPlan.forcedResponseGain);
  const dynBasis = verifiedPlan.dynamicalAnnihilators.map((row) => row.map((v) => parseRational(v)));
  const obsTicks = verifiedPlan.observationTicks;

  const zVec = [];
  const episodeValues = [];
  const dynamicalViolations = [];

  for (let k = 0; k < K; k++) {
    const ep = episodes[k];
    need(ep && ep.episode === k, `episode index mismatch at ${k}`);
    const amp = fmt(parseRational(ep.amplitude, 'episode amplitude'));
    need(amp === verifiedPlan.amplitudes[k], `episode ${k} amplitude ${amp} != planned ${verifiedPlan.amplitudes[k]}`);
    need(Array.isArray(ep.readings) && ep.readings.length === obsTicks.length,
      `episode ${k} must supply ${obsTicks.length} tick readings`);
    const yk = [];
    for (let i = 0; i < obsTicks.length; i++) {
      const row = ep.readings[i];
      need(row && row.tick === obsTicks[i], `episode ${k} reading ${i} tick mismatch`);
      yk.push(parseRational(row.value, `episode ${k} tick ${obsTicks[i]} value`));
    }
    episodeValues.push(yk);
    for (let dIdx = 0; dIdx < dynBasis.length; dIdx++) {
      const wDyn = dynBasis[dIdx];
      const residual = absQ(dot(wDyn, yk));
      const bound = mul(l1Norm(wDyn), noiseBound);
      if (cmpQ(residual, bound) > 0) {
        dynamicalViolations.push({
          episode: k,
          amplitude: amp,
          annihilatorIndex: dIdx,
          residual: fmt(residual),
          threshold: fmt(bound),
        });
      }
    }
    zVec.push(div(dot(circuit, yk), forcedGain));
  }

  // Cross-amplitude out-of-family polynomial annihilator test
  const oofBasis = verifiedPlan.outOfFamilyAnnihilators.map((row) => row.map((v) => parseRational(v)));
  const oofThresholds = verifiedPlan.outOfFamilyThresholds.map((v) => parseRational(v));
  const polynomialViolations = [];
  const oofResiduals = [];
  for (let r = 0; r < oofBasis.length; r++) {
    const res = dot(oofBasis[r], zVec);
    const absRes = absQ(res);
    oofResiduals.push(fmt(res));
    if (cmpQ(absRes, oofThresholds[r]) > 0) {
      polynomialViolations.push({
        annihilatorIndex: r,
        residual: fmt(absRes),
        threshold: fmt(oofThresholds[r]),
      });
    }
  }

  // Exact Gauss-Markov polynomial law estimate beta_hat = P * z
  const P = verifiedPlan.pseudoinverseEstimator.map((row) => row.map((v) => parseRational(v)));
  const radii = verifiedPlan.coefficientErrorRadii.map((v) => parseRational(v));
  const betaHat = matVec(P, zVec);
  const recoveredLaw = betaHat.map((est, m) => ({
    degree: m,
    estimate: fmt(est),
    lowerBound: fmt(sub(est, radii[m])),
    upperBound: fmt(add(est, radii[m])),
    errorRadius: fmt(radii[m]),
  }));

  const hypotheses = parseHypotheses(request.hypotheses, verifiedPlan.maxDegree);
  const V = verifiedPlan.vandermondeMatrix.map((row) => row.map((v) => parseRational(v)));
  const plant = parsePlant(request.plant, request.stateDimension, request.horizon);
  const joint = jointReadoutGeometry(plant, episodeValues, noiseBound, V);
  // Preserve historical diagnostic fields and valid notebook bytes. Basis
  // residuals remain useful explanations, but never suffice for acceptance.
  if (!dynamicalViolations.length) {
    for (const row of joint.dynamicalViolations)
      dynamicalViolations.push({...row, amplitude: verifiedPlan.amplitudes[row.episode]});
  }
  if (!polynomialViolations.length && joint.polynomialViolation)
    polynomialViolations.push(joint.polynomialViolation);
  const abstained = joint.dynamicalViolations.length > 0 || joint.polynomialViolation !== null;
  const consistentIds = [];
  const falsifiedIds = [];

  if (!abstained) {
    for (const h of hypotheses) {
      let ok = true;
      for (let k = 0; k < K; k++) {
        const predicted = dot(V[k], h.coefficients);
        if (cmpQ(predicted, joint.intervals[k].lower) < 0 ||
            cmpQ(predicted, joint.intervals[k].upper) > 0) {
          ok = false;
          break;
        }
      }
      if (ok) consistentIds.push(h.id);
      else falsifiedIds.push(h.id);
    }
  }

  let status;
  if (abstained) {
    status = 'abstained_out_of_family_nonlinearity';
  } else if (hypotheses.length === 0) {
    status = 'nonlinear_polynomial_law_recovered';
  } else if (consistentIds.length === 1) {
    status = 'one_nonlinear_law_certified';
  } else if (consistentIds.length === 0) {
    status = 'all_hypotheses_falsified';
  } else {
    status = 'multiple_hypotheses_consistent';
  }

  return {
    schema: 'worldlaw.active-vandermonde-result/v1',
    status,
    readoutSource: supplied.source,
    acquisition: supplied.acquisition,
    episodeInvariants: zVec.map(fmt),
    outOfFamilyResiduals: oofResiduals,
    polynomialViolations,
    dynamicalViolations,
    abstainedOutOfFamily: abstained,
    recoveredPolynomialLaw: recoveredLaw,
    consistentHypothesisIds: consistentIds,
    falsifiedHypothesisIds: falsifiedIds,
    physicalProvenanceVerified: false,
  };
}
