/** Plan two experiments against prediction differences on a finite, ordered roster.
 * Each independent observation is assumed to lie within the supplied RMS radius.
 * Two radius-r balls intersect precisely when their centers are at most 2r apart.
 * A surviving pair has a common midpoint record on every selected experiment.
 */
export function forecastRms(a, b) {
  if (!a.length || a.length !== b.length) throw new RangeError('Forecast lengths must match and be positive.');
  let norm = 0, scale = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new RangeError('Forecast values must be finite numbers.');
    const delta = a[i] - b[i];
    scale = Math.max(scale, Math.abs(a[i]), Math.abs(b[i]));
    norm = Math.hypot(norm, delta);
  }
  if (Number.isFinite(norm)) return norm / Math.sqrt(a.length);
  // Scale before subtracting when even a single difference or the vector norm overflows.
  let scaledNorm = 0;
  for (let i = 0; i < a.length; i++) scaledNorm = Math.hypot(scaledNorm, a[i] / scale - b[i] / scale);
  const rms = (scaledNorm / Math.sqrt(a.length)) * scale;
  if (!Number.isFinite(rms)) throw new RangeError('Forecast RMS exceeds the finite numeric range.');
  return rms;
}

export function forecastDistances(traces) {
  if (traces.length < 2) throw new RangeError('At least two rival forecasts are required.');
  const result = [];
  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) result.push(forecastRms(traces[i], traces[j]));
  }
  return result;
}

export function planForecastDiameter(probes, radius) {
  if (!Number.isFinite(radius) || radius < 0 || !Number.isFinite(2 * radius)) {
    throw new RangeError('A finite nonnegative record radius is required.');
  }
  if (probes.length < 2) throw new RangeError('Two distinct experiments are required.');
  const n = probes[0].length;
  if (!n || probes.some(row => row.length !== n || row.some(v => !Number.isFinite(v) || v < 0))) {
    throw new RangeError('Each experiment must supply distances for the same ordered law pairs.');
  }
  const threshold = 2 * radius;
  const envelope = Array.from({length:n}, (_, k) => probes.reduce((m, row) => Math.max(m, row[k]), 0));
  function assess(indices) {
    let diameter = 0, minSeparation = Infinity;
    const ambiguous = [];
    for (let k = 0; k < n; k++) {
      const separation = indices.reduce((s, i) => Math.max(s, probes[i][k]), 0);
      minSeparation = Math.min(minSeparation, separation);
      if (separation <= threshold) {
        ambiguous.push(k);
        diameter = Math.max(diameter, envelope[k]);
      }
    }
    return {indices, diameter, minSeparation, ambiguous};
  }
  let minimumPlan = assess([]).diameter <= threshold ? [] : null;
  const planCount = probes.length * (probes.length - 1) / 2;
  const largest = envelope.reduce((m, x) => Math.max(m, x), 0);
  const sumScale = largest > Number.MAX_VALUE / planCount ? largest : 1;
  let best, maximin, diameterSum = 0, count = 0;
  for (let i = 0; i < probes.length; i++) {
    if (minimumPlan === null && assess([i]).diameter <= threshold) minimumPlan = [i];
    for (let j = i + 1; j < probes.length; j++) {
      const candidate = assess([i, j]);
      if (!best || candidate.diameter < best.diameter) best = candidate;
      if (!maximin || candidate.minSeparation > maximin.minSeparation) maximin = candidate;
      count++;
      diameterSum += candidate.diameter / sumScale;
    }
  }
  if (minimumPlan === null && best.diameter <= threshold) minimumPlan = best.indices;
  return {best, maximin, uniformMeanDiameter:(diameterSum/count)*sumScale, planCount:count,
    minimumExperiments:minimumPlan?.length ?? null, minimumPlan, envelope};
}
