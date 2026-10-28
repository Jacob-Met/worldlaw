/** A descriptive span of retained predictions, not a probability interval. */
const keyOf = (candidate, joint) => joint
  ? `${candidate.delaySeconds}:${candidate.responseTimeSeconds}`
  : String(candidate.delaySeconds);

/**
 * Summarize the existing training-competitive family on one original recording.
 * A candidate contributes its entire aligned forecast or none of it. In
 * particular, a missing point must not silently narrow a row-wise survivor span.
 */
export function commandTimingComparison(report, runId) {
  const run = report.bundle.challengeRuns.find(candidate => candidate.id === runId);
  if (!run) throw new Error('The comparison needs an original challenge recording.');
  const joint = Boolean(report.options.responseTimes);
  const candidateKeys = joint
    ? report.competitiveResponses.map(candidate => keyOf(candidate, true))
    : report.competitiveDelays.map(String);
  const byKey = new Map(report.candidates.map(candidate => [keyOf(candidate, joint), candidate]));
  const available = [], unavailable = [];

  for (const key of candidateKeys) {
    const candidate = byKey.get(key);
    const receiving = candidate?.receiving?.find(item => item.runId === runId);
    let reason;
    if (!candidate || candidate.status !== 'fitted') {
      reason = 'The retained competitive candidate has no fitted prediction.';
    } else if (receiving?.status !== 'executed') {
      reason = receiving?.error?.message ?? 'No executed prediction for this recording.';
    } else if (!Array.isArray(receiving.rollout?.rows) || receiving.rollout.rows.length !== run.samples.length) {
      reason = 'The prediction does not cover the complete original recording.';
    } else if (receiving.rollout.rows.some((row, index) => row.time !== run.samples[index].time || !Number.isFinite(row.predicted))) {
      reason = 'The prediction is not finite on the exact original timestamp grid.';
    }
    if (reason) unavailable.push({key, reason});
    else available.push({key, rows: receiving.rollout.rows});
  }

  const rows = available.length ? run.samples.map((sample, index) => {
    let low = Infinity, high = -Infinity;
    for (const prediction of available) {
      const value = prediction.rows[index].predicted;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    return {time: sample.time, low, high};
  }) : [];

  return {
    runId,
    candidateCount: candidateKeys.length,
    candidateKeys,
    availableCount: available.length,
    availableKeys: available.map(candidate => candidate.key),
    unavailable,
    rows,
    qualification: 'Only complete predictions on this recording are included. Pointwise boundaries can come from different candidates; they need not be one executable trajectory. This is not a probability or confidence interval.',
  };
}
