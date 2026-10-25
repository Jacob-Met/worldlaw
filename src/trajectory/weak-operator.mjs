import {fitLinearColumns} from '../science/linear-fit.mjs';
/** Shared compact-window operator. Callers admit source units and settings before use.
 * The optional command feature retains supplied values; no forcing is invented.
 */
const MAX_WINDOWS = 2048;
const norm = values => Math.hypot(...values);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const phi = x => x * x * (1 - x) * (1 - x);
// Integrals of phi and x*phi, evaluated over short segments using a shifted
// polynomial to avoid cancellation near a window boundary.
function moments(a, b) {
  const h = b - a;
  const c = [phi(a), 2 * a - 6 * a * a + 4 * a ** 3, 1 - 6 * a + 6 * a * a, -2 + 4 * a, 1];
  let integral = 0, firstOffset = 0;
  for (let k = 0; k < c.length; k++) {
    integral += c[k] * h ** (k + 1) / (k + 1);
    firstOffset += c[k] * h ** (k + 2) / (k + 2);
  }
  return {integral, firstOffset};
}
export function weakWindows(run, options, rates, insist) {
  const samples = run.samples, result = []; let start = 0, end = 0;
  while (start < samples.length - 1) {
    const startTime = samples[start].time;
    // Compare elapsed intervals, never a tolerance scaled by absolute epoch.
    // Exactly representable shifts must not change selected sample indices.
    const endTolerance = 16 * Number.EPSILON * Math.max(1, options.windowDuration);
    while (end < samples.length && samples[end].time - startTime < options.windowDuration - endTolerance) end++;
    if (end >= samples.length) break;
    insist(end - start + 1 >= 9, 'Each weak window needs at least nine raw samples; increase windowDuration or improve sampling.', 'insufficient_sampling');
    const duration = samples[end].time - samples[start].time;
    const rows = samples.slice(start, end + 1), x = rows.map(row => (row.time - rows[0].time) / duration);
    const weights = x.map(() => 0), features = Object.fromEntries(options.terms.map(id => [id, 0]));
    const feature = (id, i) => {
      const position = rows[i].position;
      switch (id) {case 'command': return rows[i].command; case 'spring': return position; case 'cubic': return position ** 3; case 'gravity': return Math.sin(position); case 'bias': return 1;
        case 'coulomb': return Math.sign(rates[start + i]); case 'quadratic': return rates[start + i] * Math.abs(rates[start + i]); default: return 0;}
    };
    for (let i = 0; i < rows.length - 1; i++) {
      const h = x[i + 1] - x[i], {integral, firstOffset} = moments(x[i], x[i + 1]);
      // Exact ∫ phi'' * linear(theta) dx, using integration by parts.
      const amount = (phi(x[i + 1]) - phi(x[i])) / h;
      weights[i] += amount; weights[i + 1] -= amount;
      for (const id of options.terms) {
        if (id === 'command') features[id] += duration * duration * rows[i].command * integral;
        else if (id === 'rate') features[id] += duration * (rows[i + 1].position - rows[i].position) / h * integral;
        else {
          const left = feature(id, i), right = feature(id, i + 1);
          features[id] += duration * duration * (left * integral + (right - left) / h * firstOffset);
        }
      }
    }
    // Eliminate constant and linear endpoint interpolants exactly in the
    // floating-point target operator. No initial angular velocity is supplied.
    const constantProjection = weights.reduce((sum, value, i) => sum + value * (1 - x[i]), 0);
    const linearProjection = weights.reduce((sum, value, i) => sum + value * x[i], 0);
    weights[0] -= constantProjection; weights[weights.length - 1] -= linearProjection;
    const noiseGain = norm(weights);
    insist(noiseGain > 0 && Number.isFinite(noiseGain), 'Weak target weights have no finite noise scale.', 'numerical_failure');
    const target = dot(weights, rows.map(row => row.position)) / noiseGain;
    const columns = options.terms.map(id => features[id] / noiseGain);
    insist(Number.isFinite(target) && columns.every(Number.isFinite), 'Weak equations exceed numerical range.', 'numerical_failure');
    result.push({target, columns, firstIndex: start, lastIndex: end, startTime: rows[0].time, endTime: rows.at(-1).time, sampleCount: rows.length, targetNoiseGain: noiseGain});
    insist(result.length <= MAX_WINDOWS, 'Too many weak windows; increase windowStride.', 'resource_limit');
    const strideTolerance = 16 * Number.EPSILON * Math.max(1, options.windowStride);
    do {start++;} while (start < samples.length && samples[start].time - startTime < options.windowStride - strideTolerance);
    if (end <= start) end = start + 1;
  }
  insist(result.length, 'Run is shorter than one complete weak window.', 'insufficient_sampling');
  return result;
}

export function weakLocalRates(run, requested, insist) {
  const n = run.samples.length, width = Math.min(requested, n % 2 ? n : n - 1), half = (width - 1) / 2;
  return run.samples.map((center, i) => {
    const start = Math.min(Math.max(i - half, 0), n - width), rows = run.samples.slice(start, start + width);
    const scale = Math.max(...rows.map(row => Math.abs(row.time - center.time))), x = rows.map(row => (row.time - center.time) / scale);
    const solved = fitLinearColumns([x.map(() => 1), x, x.map(v => v * v), x.map(v => v ** 3)], rows.map(row => row.position - center.position));
    insist(solved, 'A first-rate window is rank deficient.', 'unidentifiable');
    const rate = solved.coefficients[1] / scale;
    insist(Number.isFinite(rate) && Math.abs(rate) <= 1e6, 'A derived rate exceeds executable range.', 'numerical_failure');
    return rate;
  });
}
