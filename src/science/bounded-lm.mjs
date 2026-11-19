import {fitLinearColumns} from './linear-fit.mjs';

/**
 * Local bounded LM with a numerically estimated active set.
 * The caller owns domain validation, complete work reservation and screened
 * residuals. This is not a global optimum or physical-identifiability certificate.
 * Each iteration uses at most two probes per coordinate and four proposals.
 */
export function fitBoundedLM(initial, bounds, iterationLimit, evaluate) {
  let best = evaluate(initial);
  let lambda = .001;
  const iterations = [];
  if (best.status !== 'complete') return {best, iterations};

  for (let iteration = 0; iteration < iterationLimit; iteration++) {
    const columns = [];
    let valid = true;
    for (let j = 0; j < initial.length; j++) {
      const x = best.values[j];
      const [lo, hi] = bounds[j];
      const nominal = Math.max(1e-5, Math.abs(x) * 1e-4);
      const central = x > lo && x < hi;
      // Keep the second inward probe away from the opposite endpoint: using
      // half the interval can round x + 2*h outside the declared bounds.
      const h = central
        ? Math.min(nominal, (x - lo) / 2, (hi - x) / 2)
        : x === lo
          ? Math.min(nominal, (hi - x) / 4)
          : x === hi
            ? -Math.min(nominal, (x - lo) / 4)
            : 0;
      if (!Number.isFinite(h) || h === 0 || x + h === x ||
          (central ? x - h === x : x + 2 * h === x + h)) {
        valid = false;
        break;
      }
      const a = [...best.values], b = [...best.values];
      a[j] += h;
      b[j] += central ? -h : 2 * h;
      if (a[j] < lo || a[j] > hi || b[j] < lo || b[j] > hi) {
        valid = false;
        break;
      }
      // Use the locations actually represented after addition. A requested h
      // need not equal either displacement, even when both probes are distinct.
      const da = a[j] - x, db = b[j] - x;
      const geometryValid = Number.isFinite(da) && Number.isFinite(db) &&
        da !== 0 && db !== 0 && da !== db && (central
          ? da > 0 && db < 0
          : x === lo ? da > 0 && db > da
          : x === hi ? da < 0 && db < da : false);
      if (!geometryValid) {
        valid = false;
        break;
      }
      const symmetric = central && da === -db;
      const denominator = da - db;
      let weight = 0;
      if (symmetric) {
        if (!Number.isFinite(denominator) || denominator === 0) {
          valid = false;
          break;
        }
      } else {
        const magnitude = Math.max(Math.abs(da), Math.abs(db));
        const ua = da / magnitude, ub = db / magnitude, delta = ub - ua;
        weight = -ua / delta;
        if (!Number.isFinite(magnitude) || magnitude <= 0 ||
            !Number.isFinite(ua) || !Number.isFinite(ub) ||
            ua === 0 || ub === 0 || !Number.isFinite(delta) || delta === 0 ||
            !Number.isFinite(weight)) {
          valid = false;
          break;
        }
      }
      const plus = evaluate(a), other = evaluate(b);
      if (plus.status !== 'complete' || other.status !== 'complete') {
        valid = false;
        break;
      }
      // The quadratic through the actual three nodes has derivative
      // first + weight * (second - first). Equal secants stay exactly equal.
      // Finite geometry does not certify resolved or accurate residuals.
      const column = plus.residuals.map((v, k) => {
        if (symmetric) return (v - other.residuals[k]) / denominator;
        const first = (v - best.residuals[k]) / da;
        const second = (other.residuals[k] - best.residuals[k]) / db;
        const difference = second - first;
        return Number.isFinite(first) && Number.isFinite(second) &&
          Number.isFinite(difference) ? first + weight * difference : NaN;
      });
      if (!column.every(Number.isFinite)) {
        valid = false;
        break;
      }
      columns.push(column);
    }
    if (!valid) {
      iterations.push({iteration, status: 'jacobian_unresolved'});
      break;
    }

    const gradients = columns.map(column =>
      column.reduce((sum, v, k) => sum + v * best.residuals[k], 0));
    if (!gradients.every(Number.isFinite)) {
      iterations.push({iteration, status: 'jacobian_unresolved'});
      break;
    }
    // Recompute the set every iteration. A bound coordinate must be released
    // when changes in the other coordinates turn its descent direction inward.
    const free = gradients.map((_, j) => j).filter(j => !(
      (best.values[j] === bounds[j][0] && gradients[j] > 0) ||
      (best.values[j] === bounds[j][1] && gradients[j] < 0)));
    if (!free.length || free.every(j => gradients[j] === 0)) {
      iterations.push({
        iteration, status: 'projected_stationary', lambda, bestTrial: best.index,
      });
      break;
    }

    const scales = columns.map(column => Math.max(1e-12, Math.hypot(...column)));
    let improved = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const augmented = free.map((j, k) => columns[j].concat(
        Array.from({length: free.length}, (_, i) =>
          i === k ? Math.sqrt(lambda) * scales[j] : 0)));
      const fit = fitLinearColumns(
        augmented, best.residuals.map(x => -x).concat(Array(free.length).fill(0)));
      if (!fit) {
        lambda *= 10;
        continue;
      }
      const values = [...best.values];
      free.forEach((j, k) => {
        values[j] = Math.max(bounds[j][0],
          Math.min(bounds[j][1], values[j] + fit.coefficients[k]));
      });
      const next = evaluate(values);
      if (next.status === 'complete' && next.rmse < best.rmse) {
        best = next;
        lambda = Math.max(1e-9, lambda / 3);
        improved = true;
        break;
      }
      lambda *= 10;
    }
    iterations.push({
      iteration, status: improved ? 'improved' : 'no_improvement',
      lambda, bestTrial: best.index,
    });
  }
  return {best, iterations};
}
