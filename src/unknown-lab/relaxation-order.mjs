// A single positive relaxing mode has D(0)D(2s) = D(s)^2 after paired release.
// Two active positive modes have determinant A B (r^s - q^s)^2.
function finite(value, label, upper = 1e6) {
  if (!Number.isFinite(value) || value < 0 || value > upper) {
    throw new RangeError(label + ' is outside its supported range');
  }
  return value;
}

function range(values, label, upper) {
  if (!Array.isArray(values) || values.length !== 2) throw new TypeError(label + ' needs two endpoints');
  const low = finite(values[0], label, upper);
  const high = finite(values[1], label, upper);
  if (low > high) throw new RangeError(label + ' endpoints are reversed');
  return [low, high];
}

function roundoff(scale) {
  return 128 * Number.EPSILON * Math.max(1, scale);
}

export function planRelaxationReads({ fast, slow, amplitude, error, maxStride }) {
  const [,fastMax] = range(fast, 'fast retention', 1);
  const [slowMin, slowMax] = range(slow, 'slow retention', 1);
  const [minAmp, maxAmp] = range(amplitude, 'per-mode amplitude', 1e6);
  finite(error, 'paired difference error');
  if (!Number.isSafeInteger(maxStride) || maxStride < 1 || maxStride > 128) {
    throw new RangeError('maxStride must be an integer from 1 through 128');
  }
  const candidates = [];
  for (let s = 1; s <= maxStride; s++) {
    const separation = Math.max(0, slowMin ** s - fastMax ** s);
    const determinant = (minAmp * separation) ** 2;
    // Both the observed value and the lower-bound reconstruction may deviate by error.
    const noisePenalty = 2 * error * maxAmp * ((1 + fastMax ** s) ** 2 + (1 + slowMax ** s) ** 2);
    const scale = (2 * maxAmp + 2 * error) ** 2;
    const margin = determinant - noisePenalty - 2 * roundoff(scale);
    candidates.push({stride:s, margin});
  }
  const best = candidates.reduce((a,b) => b.margin > a.margin ? b : a);
  if (best.margin <= 0) return {status:'unresolved', candidates};
  return {status:'separating-plan', waits:[0,best.stride,2*best.stride], candidates};
}

export function inspectRelaxationReads(observations, error) {
  finite(error, 'paired difference error');
  if (!Array.isArray(observations) || observations.length > 3) throw new RangeError('Use at most three equal-stride reads');
  const values = [];
  const waits = [];
  for (const {wait,difference} of observations) {
    if (!Number.isSafeInteger(wait) || wait < 0 || !Number.isFinite(difference) || Math.abs(difference) > 3e6) {
      throw new RangeError('Invalid paired read');
    }
    values.push(difference);
    waits.push(wait);
  }
  if ((waits.length && waits[0] !== 0) || (waits.length >= 2 && waits[1] < 1) ||
      (waits.length === 3 && waits[2] !== 2 * waits[1])) throw new RangeError('Expected waits 0, s, 2s');
  if (values.length < 3) return {status:'unresolved', reason:'fewer-than-three-reads'};
  if (values.some(value => value + error < 0)) return {status:'unresolved', reason:'outside-positive-model-domain'};
  const [first,middle,last] = values;
  const lower = Math.max(0,first-error) * Math.max(0,last-error) - (middle+error) ** 2;
  const tolerance = roundoff((Math.max(...values.map(Math.abs)) + error) ** 2);
  return {status: lower > tolerance ? 'positive-curvature' : 'unresolved', determinantLowerBound:lower, tolerance};
}
