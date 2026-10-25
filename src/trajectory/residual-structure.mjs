/** Descriptive receiving diagnostics. Never fits, ranks or revises a law. */
const check = (ok, message) => { if (!ok) throw new Error(message); };
export function residualStructure(rows, {lags = [1, 2, 5, 10], maxPairs = 100000} = {}) {
  check(Array.isArray(rows) && rows.length >= 4 && rows.length <= 10000,
    'A complete prediction needs 4–10000 original rows.');
  check(Number.isSafeInteger(maxPairs) && maxPairs >= 1 && maxPairs <= 640000,
    'Declare a pair budget between 1 and 640000.');
  check(Array.isArray(lags) && lags.length >= 1 && lags.length <= 64 && new Set(lags).size === lags.length
    && Array.from(lags).every(k => Number.isSafeInteger(k) && k >= 1 && k < rows.length - 2),
  'Declare 1–64 unique positive sample lags, each leaving at least two pairs.');
  const source = Array.from(rows, (row, index) => {
    check(row && [row.time, row.observed, row.predicted].every(Number.isFinite), 'Every original row needs finite time, observed and predicted angles.');
    check(Math.abs(row.observed) <= 1e6 && Math.abs(row.predicted) <= 1e6, 'Angles exceed the maintained one-million-radian execution bound.');
    if (index) check(row.time > rows[index - 1].time && Number.isFinite(row.time - rows[0].time), 'Original times must strictly increase with finite elapsed intervals.');
    return {index, time: row.time, observed: row.observed, predicted: row.predicted, residual: row.observed - row.predicted};
  });
  // The first position initializes the rollout; it is not a receiving prediction.
  const samples = source.slice(1), count = samples.length;
  const pairCount = lags.reduce((sum, lag) => sum + count - lag, 0);
  check(pairCount <= maxPairs, 'The complete declared lag population exceeds the pair budget.');
  const scale = Math.max(...samples.map(row => Math.abs(row.residual)));
  const normalized = samples.map(row => scale === 0 ? 0 : row.residual / scale);
  const mean = normalized.reduce((sum, value) => sum + value, 0) / count;
  const meanError = mean * scale;
  const rmse = Math.hypot(...normalized) / Math.sqrt(count) * scale;
  const centered = normalized.map(value => value - mean);
  const centeredRMS = Math.hypot(...centered) / Math.sqrt(count) * scale;
  const reports = lags.map(lag => {
    const pairs = samples.slice(0, count - lag).map((row, i) => ({
      earlier: {...row}, later: {...samples[i + lag]}, elapsed: samples[i + lag].time - row.time,
    }));
    const left = centered.slice(0, count - lag), right = centered.slice(lag);
    const leftNorm = Math.hypot(...left), rightNorm = Math.hypot(...right);
    // Normalize before multiplication, so subnormal residual scales need not square.
    const correlation = leftNorm && rightNorm ? Math.max(-1, Math.min(1,
      left.reduce((sum, value, i) => sum + (value / leftNorm) * (right[i] / rightNorm), 0))) : null;
    const differenceNorm = Math.hypot(...normalized.slice(lag).map((value, i) => value - normalized[i]));
    const pairNorm = Math.hypot(...normalized.slice(0, count - lag), ...normalized.slice(lag));
    const differenceRatio = pairNorm ? (differenceNorm / pairNorm) ** 2 : null;
    return {lag, count: pairs.length, correlation, differenceRatio,
      elapsedMinimum: Math.min(...pairs.map(pair => pair.elapsed)),
      elapsedMaximum: Math.max(...pairs.map(pair => pair.elapsed)), pairs,
      status: correlation === null ? 'no_centered_variation' : 'descriptive'};
  });
  return {schema: 'worldlaw.residual-structure/v1', count, excludedInitialIndex: 0,
    meanError, rmse, centeredRMS, pairCount, reports,
    meaning: 'Centered lag cosine uses the complete receiving mean. Pairs overlap; these are descriptive sample lags, not independent repetitions, frequency estimates or significance tests.'};
}
