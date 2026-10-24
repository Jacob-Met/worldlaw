/** Declared initial-state grid sensitivity. No fitting to receiving observations. */
import {normalizeAngularRuns, AngularDataError} from './angular-discovery.mjs';
import {rolloutAngularWithResolution} from './angular-resolution.mjs';

const insist = (ok, message) => {if (!ok) throw new AngularDataError(message, 'invalid_sensitivity');};
const bounded = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const offsets = width => width === 0 ? [0] : [-width, 0, width];

/** The grid is fixed by declarations, never selected using receiving errors. */
export function initialStateSensitivity(model, rawRun, requested = {}) {
  const [run] = normalizeAngularRuns([rawRun]);
  insist(requested && typeof requested === 'object' && !Array.isArray(requested), 'Declare sensitivity settings as an object.');
  const options = {positionHalfWidth: requested.positionHalfWidth ?? 0,
    rateHalfWidth: requested.rateHalfWidth ?? 0, maxStep: requested.maxStep ?? .01,
    maxTotalSteps: requested.maxTotalSteps ?? 300000, numericalTolerance: requested.numericalTolerance ?? .001};
  insist(bounded(options.positionHalfWidth, 0, 100) && bounded(options.rateHalfWidth, 0, 100), 'Initial angle/rate half-widths must be finite from 0 to 100 in rad and rad/s.');
  insist(bounded(options.maxStep, 1e-5, .1), 'Solver maxStep must be 0.00001–0.1 seconds.');
  insist(Number.isSafeInteger(options.maxTotalSteps) && bounded(options.maxTotalSteps, 1, 1000000), 'Total integration budget must be 1–1000000 steps.');
  insist(bounded(options.numericalTolerance, 1e-12, 100), 'Numerical comparison tolerance must be positive and at most 100 rad.');
  const grid = offsets(options.positionHalfWidth).flatMap(positionOffset => offsets(options.rateHalfWidth).map(rateOffset => ({positionOffset, rateOffset})));
  // Reserve the exact whole coarse+half-step grid before executing any variant.
  const stepsPerVariant = run.samples.slice(1).reduce((sum, row, i) => {
    const duration = row.time - run.samples[i].time;
    return sum + Math.max(1, Math.ceil(duration / options.maxStep)) + Math.max(1, Math.ceil(duration / (options.maxStep / 2)));
  }, 0);
  insist(Number.isSafeInteger(stepsPerVariant) && stepsPerVariant * grid.length <= options.maxTotalSteps,
    'The complete initial-state grid exceeds the total integration budget; shorten the run or use a coarser step.');
  const variants = grid.map(({positionOffset, rateOffset}) => {
    const initialPosition = run.samples[0].position + positionOffset, initialRate = run.initialRate + rateOffset;
    const base = {positionOffset, rateOffset, initialPosition, initialRate};
    try {
      // Only time and declared initial state reach prediction. Later measured
      // angles are removed even though the shared solver itself never uses them.
      const forecastRun = {...run, initialRate, samples: run.samples.map(row => ({time: row.time, position: initialPosition}))};
      const {rollout, resolution} = rolloutAngularWithResolution(model, forecastRun,
        {maxStep: options.maxStep, maxSteps: stepsPerVariant});
      const predictions = rollout.rows.map(({time, predicted, rate}) => ({time, position: predicted, rate}));
      const qualified = resolution.status === 'compared' && resolution.maxAbsPositionDifference <= options.numericalTolerance;
      return {...base, status: qualified ? 'screened' : 'step_sensitive', predictions, resolution};
    } catch (error) {
      return {...base, status: 'failed', predictions: null, resolution: null,
        error: {code: error.code ?? 'prediction_failed', message: error.message}};
    }
  });
  // No partial survivor envelope: every declared initial state must be screened.
  const complete = variants.every(variant => variant.status === 'screened');
  const range = complete ? run.samples.map((row, index) => {
    const values = variants.map(variant => variant.predictions[index].position);
    return {time: row.time, min: Math.min(...values), max: Math.max(...values)};
  }) : null;
  const forecasts = {schema: 'worldlaw.initial-state-grid/v1', modelId: model.id, runId: run.id,
    options, variants, range, complete, reservedSteps: stepsPerVariant * grid.length,
    physicalInertia: null, absoluteTorqueIdentified: false,
    meaning: 'Extrema at sampled initial states only; not a confidence interval or a bound on all intervening initial states.',
    limitations: ['Widths are caller declarations, not estimated uncertainty.',
      'No initial condition is fitted, ranked or selected using receiving observations.',
      'The same finite model is used for every grid point; model uncertainty is excluded.',
      'Two-resolution agreement does not establish convergence or physical validity.',
      'A measurement inside the sampled range does not validate a model or its assumed widths.']};
  // Receiving statistics are explicitly separate from the immutable forecasts.
  const scores = variants.map(variant => {
    if (!variant.predictions) return {positionOffset: variant.positionOffset, rateOffset: variant.rateOffset, rmse: null};
    const errors = variant.predictions.slice(1).map((row, i) => row.position - run.samples[i + 1].position);
    return {positionOffset: variant.positionOffset, rateOffset: variant.rateOffset, rmse: Math.hypot(...errors) / Math.sqrt(errors.length)};
  });
  const outsideCount = range ? run.samples.slice(1).filter((row, i) => row.position < range[i + 1].min || row.position > range[i + 1].max).length : null;
  return {forecasts, receiving: {scores, outsideCount, count: run.samples.length - 1, initialSampleExcluded: true,
    interpretation: complete ? 'Descriptive comparison with the declared sampled grid; not a model-selection or uncertainty-calibration test.' : 'Incomplete grid: range comparison refused; all variant outcomes retained.'}};
}
