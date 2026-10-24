import { evaluate } from './torque-discovery.mjs';
/** Exact declared inputs only; repeated rows are not authenticated independent trials. */
export function diagnoseReplicates(model, observations) {
  const evaluated = evaluate(model, observations);
  const groups = new Map();
  for (const row of evaluated.rows) {
    const key = JSON.stringify([row.command, row.position, row.rate]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  let pureErrorSSE = 0, meanMismatchSSE = 0, replicatedGroups = 0, replicatedRows = 0;
  const states = [];
  for (const rows of groups.values()) {
    const first = rows[0], count = rows.length;
    // Center before summation to avoid losing small replicate differences.
    const mean = first.jointTorque + rows.reduce((sum, row) => sum + (row.jointTorque - first.jointTorque), 0) / count;
    const scatter = rows.reduce((sum, row) => sum + (row.jointTorque - mean) ** 2, 0);
    const mismatch = count * (mean - first.prediction) ** 2;
    pureErrorSSE += scatter; meanMismatchSSE += mismatch;
    if (count > 1) { replicatedGroups++; replicatedRows += count; }
    states.push({ command: first.command, position: first.position, rate: first.rate,
      count, observedMean: mean, prediction: first.prediction, pureErrorSSE: scatter, meanMismatchSSE: mismatch });
  }
  const count = evaluated.count, uniqueStates = groups.size, pureErrorDF = count - uniqueStates;
  const residualSSE = evaluated.rows.reduce((sum, row) => sum + row.residual ** 2, 0);
  return { status: count === 0 ? 'no-observations' : pureErrorDF === 0 ? 'no-replication' : 'computed',
    count, uniqueStates, replicatedGroups, replicatedRows, singletonRows: count - replicatedRows,
    pureErrorDF, pureErrorSSE, meanMismatchSSE, residualSSE,
    decompositionError: residualSSE - pureErrorSSE - meanMismatchSSE,
    repeatabilityRMS: pureErrorDF ? Math.sqrt(pureErrorSSE / pureErrorDF) : null,
    meanMismatchRMS: count ? Math.sqrt(meanMismatchSSE / count) : null, states };
}
