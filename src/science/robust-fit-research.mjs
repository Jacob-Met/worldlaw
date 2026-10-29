// Research: expose failed iterate without relabeling status.
import {fitLinearColumns} from './linear-fit.mjs';

// These are numerical/work limits, not a statistical calibration. All candidates
// reserve the entire permitted solve before any robust optimization is started.
export const SOFT_L1_MAX_ITERATIONS = 64;
export const SOFT_L1_MAX_BACKTRACKS = 24;
export const SOFT_L1_GRADIENT_TOLERANCE = 1e-8;
export const SOFT_L1_MAX_WORK = 250_000_000;

export function softL1Work(rows, termCount, maxTerms) {
  let work = 0;
  for (let mask = 0; mask < 2 ** termCount; mask++) {
    let count = 0;
    for (let value = mask; value; value >>>= 1) count += value & 1;
    if (count > maxTerms || count >= rows) continue;
    // Two QR solves, gradients, and both complete line searches per iteration.
    // This deliberately reserves unavailable/rank-deficient structures too.
    work += rows * (count * count + count + 1 + SOFT_L1_MAX_ITERATIONS *
      (2 * (count * count + count + 1) + 2 * SOFT_L1_MAX_BACKTRACKS * (count + 1) + 3 * (count + 1)));
  }
  return work;
}

/** Twice the soft-L1 objective, in squared torque units; stable near zero. */
export function softL1Loss(residual, scale) {
  return 2 * residual * residual / (Math.hypot(1, residual / scale) + 1);
}

export function softL1Weight(residual, scale) {
  return 1 / Math.hypot(1, residual / scale);
}

/**
 * Fixed-design convex soft-L1 fit. The caller admits finite bounded columns and
 * target and reserves the full workload. Reuses the maintained normalized QR.
 * A successful numerical stationarity check is not an interval certificate.
 */
export function fitSoftL1Columns(columns, target, scale, initialFit = null) {
  if (!Number.isFinite(scale) || scale < 1e-7 || scale > 1e6) throw new Error('Soft-L1 scale must be between 0.0000001 and 1000000 N·m.');
  if (!Array.isArray(target) || !target.length || target.length > 4096 ||
      !Array.isArray(columns) || columns.length > 9 ||
      target.some(value => !Number.isFinite(value)) || columns.some(column =>
        !Array.isArray(column) || column.length !== target.length || column.some(value => !Number.isFinite(value)))) {
    throw new Error('Soft-L1 needs bounded finite equal-length columns and readings.');
  }
  let fitted = initialFit || fitLinearColumns(columns, target);
  if (!fitted) return {status:'rank-unavailable'};
  let coefficients = [...fitted.coefficients];
  const columnNorms = columns.map(column => Math.hypot(...column));
  const residualsFor = values => target.map((reading, row) =>
    reading - columns.reduce((sum, column, j) => sum + column[row] * values[j], 0));
  const objective = residuals => residuals.reduce((sum, residual) => sum + softL1Loss(residual, scale) / 2, 0);
  let solves = 0, lineSearchEvaluations = 0, scaledGradient = Infinity;
  for (let iteration = 0; iteration <= SOFT_L1_MAX_ITERATIONS; iteration++) {
    const residuals = residualsFor(coefficients);
    const factors = residuals.map(residual => Math.hypot(1, residual / scale));
    const psi = residuals.map((residual, row) => residual / factors[row]);
    const gradients = columns.map(column => column.reduce((sum, value, row) => sum + value * psi[row], 0));
    scaledGradient = Math.max(0, ...gradients.map((gradient, j) => Math.abs(gradient) / columnNorms[j])) / Math.sqrt(target.length);
    const before = objective(residuals);
    if (![before, scaledGradient, ...coefficients].every(Number.isFinite)) return {status:'numerical-failure',iterations:iteration};
    if (scaledGradient <= SOFT_L1_GRADIENT_TOLERANCE * scale) {
      return {status:'converged',coefficients,conditionEstimate:fitted.conditionEstimate,
        iterations:iteration,solves,lineSearchEvaluations,scaledGradient,
        stationarityTolerance:SOFT_L1_GRADIENT_TOLERANCE * scale,
        meanLoss:2 * before / target.length,
        weights:residuals.map(residual => softL1Weight(residual, scale))};
    }
    if (iteration === SOFT_L1_MAX_ITERATIONS) break;
    let accepted = false;
    // Newton supplies the actual soft-L1 curvature. Positive-weight IRLS is a
    // descent fallback when the curvature system is numerically rank deficient.
    for (const method of ['newton', 'irls']) {
      const weights = factors.map(factor => factor ** (method === 'newton' ? -1.5 : -0.5));
      const weightedTarget = method === 'newton' ? psi.map((value, row) => value / weights[row]) : target.map((value, row) => value * weights[row]);
      const candidate = fitLinearColumns(columns.map(column => column.map((value, row) => value * weights[row])), weightedTarget);
      solves++;
      if (!candidate) continue;
      const step = candidate.coefficients.map((value, j) => method === 'newton' ? value : value - coefficients[j]);
      const slope = step.reduce((sum, value, j) => sum + value * gradients[j], 0);
      if (!(slope > 0) || !Number.isFinite(slope)) continue;
      for (let backtrack = 0; backtrack < SOFT_L1_MAX_BACKTRACKS; backtrack++) {
        const fraction = 2 ** -backtrack;
        const next = coefficients.map((value, j) => value + fraction * step[j]);
        const after = objective(residualsFor(next));
        lineSearchEvaluations++;
        // A small floating-point allowance avoids stagnation at the objective's
        // last representable bit; final acceptance still needs stationarity.
        if (Number.isFinite(after) && after <= before - 1e-4 * fraction * slope + 1e-14 * Math.max(1, before)) {
          coefficients = next; fitted = candidate; accepted = true; break;
        }
      }
      if (accepted) break;
    }
    if (!accepted) return {status:'line-search-unresolved',coefficients,iterations:iteration + 1,scaledGradient};
  }
  return {status:'iteration-limit',coefficients,iterations:SOFT_L1_MAX_ITERATIONS,scaledGradient};
}
