/** World-level split calibration for a fixed acquisition, candidate fitting and
 * stopping policy. One complete independent calibration trajectory per world.
 * Disjoint worlds, same policy, and exchangeability of each round score with
 * its references are design requirements, not consequences of a policyId.
 * A small p is evidence against the calibrated family; a large p is inconclusive.
 */
const SCHEMA = 'worldlaw.residual-calibration/v1';

function requireThat(ok, message) {
  if (!ok) throw new RangeError(message);
}
function id(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function nonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}
function validateCalibration({policyId, roundScoresByWorld, alpha, maxRounds}) {
  requireThat(id(policyId), 'Require the frozen policy identity.');
  requireThat(Number.isFinite(alpha) && alpha > 0 && alpha < 1, 'Require alpha strictly between zero and one.');
  requireThat(Number.isSafeInteger(maxRounds) && maxRounds > 0, 'Require a positive integer round count.');
  requireThat(Array.isArray(roundScoresByWorld) && roundScoresByWorld.length > 0, 'No independent calibration worlds.');
  const ids = new Set();
  for (const record of roundScoresByWorld) {
    requireThat(record && id(record.worldId) && !ids.has(record.worldId), 'Invalid or repeated calibration world.');
    ids.add(record.worldId);
    requireThat(Array.isArray(record.scores) && record.scores.length === maxRounds, 'Incomplete reference rounds.');
    for (const value of record.scores) requireThat(nonnegative(value), 'Invalid reference score.');
  }
}
export function createResidualCalibration({policyId, roundScoresByWorld, alpha, maxRounds}) {
  validateCalibration({policyId, roundScoresByWorld, alpha, maxRounds});
  const rows = roundScoresByWorld.map(({worldId,scores}) =>
    Object.freeze({worldId, scores:Object.freeze([...scores])}));
  return Object.freeze({schema:SCHEMA, policyId, roundScoresByWorld:Object.freeze(rows), alpha, maxRounds});
}
export function assessResidual(calibration, {policyId, round, score, worldId}) {
  requireThat(calibration?.schema === SCHEMA && policyId === calibration.policyId, 'Calibration schema or frozen policy mismatch.');
  validateCalibration(calibration); // Also validate a serialized, restored reference.
  requireThat(Number.isSafeInteger(round) && round >= 1 && round <= calibration.maxRounds, 'Round outside frozen horizon.');
  requireThat(nonnegative(score), 'Require a finite nonnegative test score.');
  const rows = calibration.roundScoresByWorld;
  if (worldId !== undefined) {
    requireThat(id(worldId) && !rows.some(row => row.worldId === worldId), 'Test world overlaps calibration or lacks identity.');
  }
  const n = rows.length;
  const atLeast = rows.reduce((count, row) => count + Number(row.scores[round-1] >= score), 0);
  const p = (1 + atLeast)/(n + 1);
  const threshold = calibration.alpha/calibration.maxRounds;
  const status = 1/(n+1) > threshold ? 'insufficient_calibration'
    : p <= threshold ? 'abstain' : 'not_rejected';
  return {policyId, round, score, n, atLeast, p, threshold, status};
}

/** All candidate arrays and the observed array include the imposed initial row.
 * Validate that row, but score indices 1..N-1 only. Candidate order is retained.
 */
export function residualScore(plannedPredictionArrays, observedPositions, noiseSigma) {
  requireThat(Number.isFinite(noiseSigma) && noiseSigma > 0, 'Require positive finite position noise sigma.');
  requireThat(Array.isArray(observedPositions) && observedPositions.length >= 2, 'Require initial and measured positions.');
  requireThat(Array.isArray(plannedPredictionArrays) && plannedPredictionArrays.length, 'No candidate prediction arrays.');
  for (const value of observedPositions) requireThat(Number.isFinite(value), 'Nonfinite or missing observation.');
  const rowsUsed = observedPositions.length - 1;
  const candidateScores = [];
  let best = Infinity;
  for (const predictions of plannedPredictionArrays) {
    requireThat(Array.isArray(predictions) && predictions.length === observedPositions.length, 'Incomplete candidate predictions.');
    let scale = 0, sum = 0;
    for (let i = 0; i < predictions.length; i++) {
      requireThat(Number.isFinite(predictions[i]), 'Nonfinite or missing prediction.');
      if (i === 0) continue;
      const magnitude = Math.abs(predictions[i] - observedPositions[i])/noiseSigma;
      requireThat(Number.isFinite(magnitude), 'Normalized residual exceeds numerical range.');
      if (magnitude > scale) {
        sum = sum*(scale/magnitude)**2 + 1;
        scale = magnitude;
      } else if (scale > 0) {
        sum += (magnitude/scale)**2;
      }
    }
    const rms = scale*Math.sqrt(sum/rowsUsed);
    requireThat(nonnegative(rms), 'Nonfinite candidate score.');
    candidateScores.push(rms);
    best = Math.min(best,rms);
  }
  return {score:best, candidateScores, rowsUsed};
}
