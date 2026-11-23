/** Plan two experiments against prediction differences on a finite, ordered roster.
 * Each independent observation is assumed to lie within the supplied RMS radius.
 * Two radius-r balls intersect precisely when their centers are at most 2r apart.
 * A surviving pair has a common midpoint record on every selected experiment.
 */
export function forecastRms(a, b) {
  if (!a.length || a.length !== b.length) throw new RangeError('Forecast lengths must match and be positive.');
  let norm = 0;
  for (let i = 0; i < a.length; i++) {
    const delta = a[i] - b[i];
    if (!Number.isFinite(delta)) throw new RangeError('Forecast differences must be finite.');
    norm = Math.hypot(norm, delta);
  }
  return norm / Math.sqrt(a.length);
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
  let minimum = assess([]).diameter <= threshold ? 0 : null;
  let best, maximin, diameterSum = 0, count = 0;
  for (let i = 0; i < probes.length; i++) {
    if (minimum !== 0 && assess([i]).diameter <= threshold) minimum = 1;
    for (let j = i + 1; j < probes.length; j++) {
      const candidate = assess([i, j]);
      if (!best || candidate.diameter < best.diameter) best = candidate;
      if (!maximin || candidate.minSeparation > maximin.minSeparation) maximin = candidate;
      count++;
      diameterSum += candidate.diameter;
    }
  }
  if (minimum === null && best.diameter <= threshold) minimum = 2;
  return {best, maximin, uniformMeanDiameter:diameterSum/count, planCount:count,
    minimumExperiments:minimum, envelope};
}
