import {validateRows} from '../data.mjs';
import {fitLinearColumns} from '../science/linear-fit.mjs';
import {investigateStiffness, normalizeSettings} from './science.mjs';

export const KNOT_PROFILE_SCHEMA = 'worldlaw.stiffness-knot-profile/v1';
export const MAX_PROFILE_WORK = 16_000_000;
const MIN_SIDE = 3;
const EPS_FACTOR = 512;

// Adjacent IEEE-754 value toward the interior, including across signed zero.
// These are finite proposals, not a claim that an open real interval attains
// its infimum. The maintained fitter still decides whether to admit them.
function nextUp(value) {
  if (value === 0) return Number.MIN_VALUE;
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) + (value > 0 ? 1n : -1n));
  return bits.getFloat64(0);
}

function dot(a, b) {
  let sum = 0, correction = 0;
  for (let i = 0; i < a.length; i++) {
    const value = a[i] * b[i] - correction, next = sum + value;
    correction = (next - sum) - value; sum = next;
  }
  return sum;
}
function projectResidual(columns, values) {
  const fit = fitLinearColumns(columns, values);
  if (!fit) return null;
  const residual = values.map((value, i) => value - columns.reduce(
    (sum, column, j) => sum + column[i] * fit.coefficients[j], 0));
  return residual.every(Number.isFinite) ? residual : null;
}
function modelKey(model) {
  return JSON.stringify([model.family, model.knot, model.origin ?? null]);
}
function compareModels(a, b) {
  return a.metrics.score - b.metrics.score || a.metrics.parameterCount - b.metrics.parameterCount ||
    (a.knot === b.knot ? 0 : a.knot === null ? -1 : b.knot === null ? 1 : a.knot - b.knot);
}
function optionsFrom(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => key !== 'workLimit')) throw Error('Unknown knot-profile option.');
  const workLimit = input.workLimit ?? MAX_PROFILE_WORK;
  if (!Number.isSafeInteger(workLimit) || workLimit < 1 || workLimit > MAX_PROFILE_WORK)
    throw Error(`Knot-profile work limit must be an integer from 1 to ${MAX_PROFILE_WORK}.`);
  return {workLimit};
}

/**
 * Training-only proposal search for the existing one-hinge family.
 * Between adjacent observed angles, h(t) = u - t v for 0 <= t <= 1.
 * After projecting out the unchanged nuisance/position columns, the residual
 * reduction is (a - t b)^2 / (c - 2 t d + t^2 e). Its nonzero stationary
 * candidate is t = (b c - a d) / (b d - a e). All proposed angles are refit
 * by investigateStiffness; this module never supplies executable coefficients.
 * Floating arithmetic, open side-support boundaries and QR admission mean this
 * is a proposal search, not a certificate of a continuous global minimum.
 */
export function profileStiffnessKnots(observations, requestedSettings, requestedOptions = {}) {
  const rows = validateRows(observations), settings = normalizeSettings(requestedSettings);
  const {workLimit} = optionsFrom(requestedOptions);
  const positions = [...new Set(rows.map(row => row.position))].sort((a, b) => a - b);
  const ids = [...settings.nuisanceTerms, 'position'];
  const intervalCount = Math.max(0, positions.length - 1);
  const eligibleCount = Math.max(0, positions.length - 2 * MIN_SIDE + 1);
  // Conservative declared arithmetic units, not a measured latency estimate.
  // Includes two projections per eligible interval and a refit upper bound
  // covering endpoints, their interior neighbors, midpoint, stationary proposal
  // and the declared grid.
  const work = rows.length * (eligibleCount * (4 * ids.length ** 2 + 12 * (ids.length + 1) ** 2) +
    (settings.knots.length + 2) * (ids.length + 1) ** 2);
  const result = {
    schema: KNOT_PROFILE_SCHEMA, settings, options: {workLimit},
    source: {trainingRows: rows.length, distinctPositions: positions.length,
      positionRange: {min: positions[0], max: positions.at(-1)}},
    status: 'unavailable', work, workLimit, examinedIntervals: 0, intervalCount,
    intervals: [], proposedKnots: [], profile: [], candidates: [],
    gridSelected: null, selected: null, proposed: null, improvement: null,
    qualification: [
      'Training observations alone generate, fit and rank every angle; separate checks are not an input.',
      'Only the existing global, one-hinge and explicitly offered cubic families are compared.',
      'Every emitted model is refit by the maintained fitter with its unchanged rank, coefficient and side-support gates.',
      'All eligible observed-angle intervals are inspected unless the complete search is refused before work.',
      'Finite-precision stationary proposals, representative/end angles and adjacent interior values are not a certified global optimum or a confidence interval.',
      'Endpoints without three distinct angles on each side remain refused; an unattained open-boundary infimum is not claimed as a solution.',
      'An inferred change angle does not identify contact, physical cause, safety or instrument calibration.'
    ]
  };
  if (work > workLimit) return {...result, status: 'work_limit'};
  if (positions.length < 2 * MIN_SIDE) return {...result, status: 'insufficient_position_support'};

  const columns = ids.map(id => rows.map(row => id === 'bias' ? 1 : row[id]));
  const residual = projectResidual(columns, rows.map(row => row.jointTorque));
  if (!residual) return {...result, status: 'baseline_rank_deficient'};
  const residualScale = Math.hypot(...residual);
  const target = residual.map(value => residualScale === 0 ? 0 : value / residualScale);
  const proposed = new Set();
  const add = angle => { if (Number.isFinite(angle)) proposed.add(angle); };
  for (let i = 0; i < intervalCount; i++) {
    const lower = positions[i], upper = positions[i + 1], width = upper - lower;
    const entry = {lower, upper, leftInteriorSupport: i + 1,
      rightInteriorSupport: positions.length - i - 1, status: 'inspected', stationary: null};
    result.intervals.push(entry); result.examinedIntervals++;
    if (entry.leftInteriorSupport < MIN_SIDE || entry.rightInteriorSupport < MIN_SIDE) {
      entry.status = 'insufficient_side_support'; continue;
    }
    const midpoint = lower + width / 2;
    // Include both boundary proposals even when the strict native side gate
    // refuses them. The returned native profile accounts for those refusals.
    add(lower); add(upper); add(midpoint);
    const afterLower = nextUp(lower), beforeUpper = -nextUp(-upper);
    if (afterLower > lower && afterLower < upper) add(afterLower);
    if (beforeUpper > lower && beforeUpper < upper) add(beforeUpper);
    const u = projectResidual(columns, rows.map(row => row.position >= upper ? row.position - lower : 0));
    const v = projectResidual(columns, rows.map(row => row.position >= upper ? width : 0));
    if (!u || !v) { entry.status = 'projection_unavailable'; continue; }
    const scale = Math.max(Math.hypot(...u), Math.hypot(...v));
    if (!(scale > 0) || !Number.isFinite(scale)) { entry.status = 'projected_column_unavailable'; continue; }
    const un = u.map(value => value / scale), vn = v.map(value => value / scale);
    const a = dot(target, un), b = dot(target, vn), c = dot(un, un), d = dot(un, vn), e = dot(vn, vn);
    const numerator = b * c - a * d, denominator = b * d - a * e;
    const tolerance = EPS_FACTOR * Number.EPSILON * (Math.abs(b * d) + Math.abs(a * e));
    if (![a,b,c,d,e,numerator,denominator].every(Number.isFinite)) { entry.status = 'nonfinite_profile'; continue; }
    if (Math.abs(denominator) <= tolerance) {
      entry.status = residualScale === 0 ? 'zero_baseline_residual' : 'stationary_unresolved'; continue;
    }
    const t = numerator / denominator;
    if (!Number.isFinite(t)) { entry.status = 'stationary_unresolved'; continue; }
    if (t > 0 && t < 1) {
      const angle = lower + t * width;
      // A rounded endpoint is retained as an endpoint, never relabeled interior.
      if (angle > lower && angle < upper) { entry.stationary = angle; add(angle); }
      else entry.status = 'stationary_rounded_to_boundary';
    } else entry.status = 'no_interior_stationary';
  }
  result.proposedKnots = [...proposed].sort((a, b) => a - b);
  const grid = investigateStiffness(rows, settings);
  result.gridSelected = grid.selected;
  const knots = [...new Set([...settings.knots, ...result.proposedKnots])].sort((a, b) => a - b);
  const models = new Map(), entries = new Map();
  // The public maintained fitter admits at most 101 declarations per call.
  // Batching retains every declaration; no candidate truncation is permitted.
  for (let offset = 0; offset < knots.length; offset += 101) {
    const fit = investigateStiffness(rows, {...settings, knots: knots.slice(offset, offset + 101)});
    for (const entry of fit.profile) entries.set(modelKey(entry), entry);
    for (const model of fit.candidates) models.set(modelKey(model), model);
  }
  result.profile = [...entries.values()];
  result.candidates = [...models.values()].sort(compareModels);
  result.selected = result.candidates[0] ?? null;
  if (!result.selected || !grid.selected) return {...result, status: 'unidentifiable'};
  const scoreReduction = grid.selected.metrics.score - result.selected.metrics.score;
  const scoreTolerance = EPS_FACTOR * Number.EPSILON *
    (1 + Math.abs(grid.selected.metrics.score) + Math.abs(result.selected.metrics.score));
  result.improvement = {scoreReduction, scoreTolerance,
    trainingRmseBefore: grid.selected.metrics.rmse, trainingRmseAfter: result.selected.metrics.rmse};
  if (result.selected.family === 'piecewise' && !settings.knots.includes(result.selected.knot) && scoreReduction > scoreTolerance) {
    result.proposed = result.selected; result.status = 'candidate_found';
  } else {
    result.status = 'grid_retained'; result.selected = grid.selected;
    result.improvement.scoreReduction = 0;
    result.improvement.trainingRmseAfter = grid.selected.metrics.rmse;
  }
  return result;
}
