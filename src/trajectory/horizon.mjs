/** Sampled prediction-error threshold summary; never a continuous-time horizon. */
export class TrajectoryHorizonError extends Error {
  constructor(message, code = 'invalid_rollout') {
    super(message);
    this.name = 'TrajectoryHorizonError';
    this.code = code;
  }
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function insist(condition, message, code) {
  if (!condition) throw new TrajectoryHorizonError(message, code);
}
function finite(value, label) {
  insist(typeof value === 'number' && Number.isFinite(value), `${label} must be finite.`, 'invalid_rollout');
  return value;
}
function identity(value, label) {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= 512,
    `${label} must be nonempty text of at most 512 characters.`, 'invalid_rollout');
  return value;
}

/**
 * Summarize sampled |observed-predicted| against a required positive radian tolerance.
 * The exactly initialized t0 row is a boundary, excluded from all error statistics.
 * Equality counts as within tolerance. No interpolation or model selection occurs.
 */
export function summarizePredictionHorizon(source, options = {}) {
  insist(record(options), 'Horizon options must be an object.', 'invalid_options');
  const positionTolerance = options.positionTolerance;
  insist(typeof positionTolerance === 'number' && Number.isFinite(positionTolerance) && positionTolerance > 0,
    'positionTolerance must be an explicitly supplied positive finite number in radians.', 'invalid_options');
  insist(record(source) && source.schema === 'worldlaw.trajectory-rollout/v1',
    'Expected a worldlaw.trajectory-rollout/v1 result.', 'invalid_rollout');
  const modelId = identity(source.modelId, 'Model ID'), runId = identity(source.runId, 'Run ID');
  insist(Array.isArray(source.rows) && source.rows.length >= 2 && source.rows.length <= 10000,
    'Rollout must contain 2–10000 sample rows.', 'invalid_rollout');

  let previousTime;
  const rows = Array.from(source.rows, (row, index) => {
    insist(record(row), `Rollout row ${index} must be an object.`, 'invalid_rollout');
    const time = finite(row.time, `Row ${index} time`);
    for (const key of ['observed', 'predicted', 'rate', 'residual', 'command']) finite(row[key], `Row ${index} ${key}`);
    insist(Number.isFinite(row.observed - row.predicted) && row.residual === row.observed - row.predicted,
      `Row ${index} residual must equal observed minus predicted.`, 'invalid_rollout');
    if (index) insist(time > previousTime && Number.isFinite(time - previousTime),
      'Rollout timestamps must strictly increase with finite intervals.', 'invalid_rollout');
    else insist(row.residual === 0, 'The first rollout row must be exactly initialized.', 'invalid_rollout');
    previousTime = time;
    return { time, absoluteError: Math.abs(row.residual) };
  });
  const initialTime = rows[0].time;
  insist(Number.isFinite(rows.at(-1).time - initialTime), 'Rollout duration must be finite.', 'invalid_rollout');

  let firstExceeded = null, previousSample = null, lastWithin = null, withinCount = 0;
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const point = { index, time: row.time, elapsed: row.time - initialTime, absoluteError: row.absoluteError };
    if (row.absoluteError <= positionTolerance) {
      withinCount++;
      lastWithin = point;
    } else if (firstExceeded === null) {
      firstExceeded = point;
      previousSample = { index: index - 1, time: rows[index - 1].time, elapsed: rows[index - 1].time - initialTime };
    }
  }
  const count = rows.length - 1;
  return {
    schema: 'worldlaw.trajectory-horizon/v1', modelId, runId, positionTolerance, positionUnit: 'rad',
    status: firstExceeded ? 'threshold_exceeded' : 'not_exceeded_at_samples',
    firstExceeded, previousSample, lastWithin,
    count, withinCount, exceededCount: count - withinCount, withinFraction: withinCount / count,
    initialSampleExcluded: true,
    meaning: 'First sampled absolute prediction error above the caller-selected tolerance; no continuous-time crossing or physical validity is established.',
    limitations: [
      'An earlier exceedance and return between sampled timestamps can be missed.',
      'previousSample is the preceding observed boundary, not an interpolated crossing; it may be the excluded initialization row.',
      'lastWithin is the latest evaluated sample within tolerance, including returns after an earlier exceedance.',
      'The tolerance is a user-selected comparison criterion, not a calibrated uncertainty or automatic law-validation threshold.',
      'Residuals include model, measurement, initial-state, command, inertia, and numerical integration errors.',
    ],
  };
}
