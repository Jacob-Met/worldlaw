/** Optional errors-in-variables comparison in one already selected smooth structure.
 * Source-position noise is assumed independent with one common unknown variance.
 * This is iterative local covariance reweighting, not calibrated likelihood inference.
 */
import {normalizeAngularRuns, AngularDataError, ANGULAR_MODEL_UNITS, ANGULAR_COEFFICIENT_UNITS} from '../trajectory/angular-discovery.mjs';
import {weakWindows, POSITION_DERIVATIVE_TERMS} from '../trajectory/weak-operator.mjs';
import {fitLinearColumns} from '../science/linear-fit.mjs';
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const insist = (condition, message, code = 'covariance_refused') => {if (!condition) throw new AngularDataError(message, code);};
const LIMITS = Object.freeze({windows: 1024, gradientEntries: 2000000, work: 40000000});
const DEFAULTS = Object.freeze({windowDuration: 1, windowStride: .5, maxIterations: 10, coefficientTolerance: 1e-9, maxWork: LIMITS.work});
function settings(input) {
  insist(object(input) && Object.keys(input).every(key => Object.hasOwn(DEFAULTS, key)), 'Use only the supported covariance comparison options.', 'invalid_options');
  const options = {...DEFAULTS, ...input};
  insist(Number.isFinite(options.windowDuration) && options.windowDuration >= .02 && options.windowDuration <= 60, 'windowDuration must be .02–60 seconds.', 'invalid_options');
  insist(Number.isFinite(options.windowStride) && options.windowStride >= .01 && options.windowStride <= options.windowDuration, 'windowStride must be .01 seconds through windowDuration.', 'invalid_options');
  insist(Number.isInteger(options.maxIterations) && options.maxIterations >= 1 && options.maxIterations <= 12, 'Use 1–12 complete covariance iterations.', 'invalid_options');
  insist(Number.isFinite(options.coefficientTolerance) && options.coefficientTolerance >= 1e-12 && options.coefficientTolerance <= 1e-3, 'Coefficient tolerance must be 1e-12–1e-3 in the fixed coefficient coordinates.', 'invalid_options');
  insist(Number.isSafeInteger(options.maxWork) && options.maxWork >= 1 && options.maxWork <= LIMITS.work, 'Reserve at most forty million arithmetic work units.', 'invalid_options');
  return options;
}
function admitModel(model) {
  insist(object(model) && model.schema === 'worldlaw.angular-model/v1' && typeof model.id === 'string' && model.id.length > 0 && model.id.length <= 240,
    'A previously selected executable angular model is required.', 'invalid_model');
  insist(model.physicalInertia === null && model.absoluteTorqueIdentified === false && model.scaleMeaning === 'angular_acceleration_only_absolute_torque_unknown',
    'Unknown physical inertia and absolute torque must remain explicit.', 'invalid_model');
  insist(object(model.units) && Object.keys(model.units).length === 3 && Object.entries(ANGULAR_MODEL_UNITS).every(([key, value]) => model.units[key] === value),
    'Angular model units must match the maintained executable contract.', 'invalid_model');
  insist(Array.isArray(model.terms) && model.terms.length <= POSITION_DERIVATIVE_TERMS.length && new Set(model.terms.map(t => t?.id)).size === model.terms.length,
    'Use one fixed structure with unique smooth terms.', 'invalid_model');
  for (const term of model.terms) {
    insist(object(term) && POSITION_DERIVATIVE_TERMS.includes(term.id), 'Covariance comparison supports linear rate and smooth position terms only; no term was omitted.', 'unsupported_position_derivative');
    insist(term.coefficientUnit === ANGULAR_COEFFICIENT_UNITS[term.id] && Number.isFinite(term.coefficient) && Math.abs(term.coefficient) <= 1e18,
      'Every coefficient needs its original units and a finite executable value.', 'invalid_model');
  }
  return clone(model);
}
function reserve(blocks, termCount, options) {
  const windows = blocks.reduce((sum, block) => sum + block.rows.length, 0);
  const positionEntries = blocks.reduce((sum, block) => sum + block.rows.reduce((count, row) => count + row.sampleCount, 0), 0);
  const gradientEntries = positionEntries * (termCount + 1);
  insist(windows >= 8, 'At least eight complete training weak windows are required.', 'insufficient_sampling');
  insist(windows <= LIMITS.windows && gradientEntries <= LIMITS.gradientEntries,
    'Complete covariance comparison exceeds its window or derivative-storage reservation; no covariance was allocated.', 'resource_limit');
  let factorEntries = 0, covarianceProducts = 0, factorProducts = 0;
  for (const block of blocks) {
    let first = 0;
    block.first = block.rows.map((row, i) => {
      while (first < i && block.rows[first].lastIndex < row.firstIndex) first++;
      factorEntries += i - first + 1;
      for (let j = first; j <= i; j++) {
        covarianceProducts += Math.max(0, Math.min(row.lastIndex, block.rows[j].lastIndex) - Math.max(row.firstIndex, block.rows[j].firstIndex) + 1);
      }
      return first;
    });
    // The lower envelope is monotone for the maintained ordered compact windows.
    // Reserve the full band width at every factor entry, conservatively.
    factorProducts += block.rows.reduce((sum, _, i) => sum + (i - block.first[i] + 1) ** 2, 0);
  }
  const iterationWork = positionEntries * (2 * termCount + 1) + 2 * covarianceProducts + 2 * factorProducts + 2 * factorEntries * (termCount + 1) + 8 * windows * termCount ** 2;
  const maximumWork = positionEntries * (20 + 8 * termCount) + options.maxIterations * iterationWork;
  insist(windows <= LIMITS.windows && gradientEntries <= LIMITS.gradientEntries && maximumWork <= options.maxWork,
    'Complete covariance comparison exceeds its window, derivative-storage or arithmetic reservation; no partial iteration was run.', 'resource_limit');
  return {windows, gradientEntries, factorEntries, maximumWork, iterationWork, limits: {...LIMITS}, blocks: blocks.map(b => ({runId: b.run.id, windows: b.rows.length}))};
}
function whitenBlock(block, coefficients) {
  const {rows, first} = block, gradients = rows.map(row => row.positionWeights.map((weight, k) => {
    const value = weight - row.featurePositionDerivatives.reduce((sum, gradient, j) => sum + coefficients[j] * gradient[k], 0);
    insist(Number.isFinite(value), 'Residual position derivative exceeds numerical range.', 'numerical_failure');
    return value;
  }));
  const lower = rows.map((_, i) => new Float64Array(i - first[i] + 1));
  const get = (i, j) => j < first[i] ? 0 : lower[i][j - first[i]];
  for (let i = 0; i < rows.length; i++) for (let j = first[i]; j <= i; j++) {
    let value = 0;
    for (let k = Math.max(rows[i].firstIndex, rows[j].firstIndex); k <= Math.min(rows[i].lastIndex, rows[j].lastIndex); k++)
      value += gradients[i][k - rows[i].firstIndex] * gradients[j][k - rows[j].firstIndex];
    const diagonal = value;
    for (let k = Math.max(first[i], first[j]); k < j; k++) value -= get(i, k) * get(j, k);
    insist(Number.isFinite(value), 'Covariance factor exceeds numerical range.', 'numerical_failure');
    if (i === j) {
      insist(value > 1e-14 * Math.max(1, diagonal), 'Residual covariance is singular or numerically unresolved; no jitter or diagonal fallback was used.', 'singular_covariance');
      lower[i][i - first[i]] = Math.sqrt(value);
    } else lower[i][j - first[i]] = value / get(j, j);
  }
  const whiten = values => values.reduce((result, value, i) => {
    for (let j = first[i]; j < i; j++) value -= get(i, j) * result[j];
    value /= get(i, i); insist(Number.isFinite(value), 'Whitened equation exceeds numerical range.', 'numerical_failure');
    result.push(value); return result;
  }, []);
  return {target: whiten(rows.map(row => row.target)), columns: coefficients.map((_, j) => whiten(rows.map(row => row.columns[j])))};
}
/** The caller supplies training runs only. Supplied initial rates never enter this fit. */
export function comparePositionNoiseCovariance(original, trainingRuns, input = {}) {
  const options = settings(input), baseline = admitModel(original), runs = normalizeAngularRuns(trainingRuns);
  const terms = baseline.terms.map(term => term.id), operatorOptions = {...options, terms};
  const blocks = runs.map(run => ({run, rows: weakWindows(run, operatorOptions, null, insist, {onlyWindowMetadata: true})}));
  const reservation = reserve(blocks, terms.length, options), iterations = [];
  const receipt = {schema: 'worldlaw.position-covariance-comparison/v1', options, reservation, originalModel: baseline, refinedModel: null, iterations,
    assumptions: ['Original position errors are independent across samples and recordings, with one common unknown variance.',
      'The exact maintained piecewise-linear weak operator is differentiated on both target and smooth feature sides.',
      'Recording blocks remain independent even when their local sample indices or times coincide.'],
    limitations: ['One frozen structure; no structure reselection, initial-state fitting, sign restriction or physical torque inference.',
      'First-order local residual covariance does not correct every nonlinear noise bias, quadrature error, unrecorded force or model mismatch.',
      'A converged comparison can worsen a separate recording. The original model remains available and challenge errors do not choose a winner.',
      'No likelihood, confidence interval or calibrated uncertainty is reported. Iteration convergence only concerns coefficient updates.']};
  if (!terms.length) return {...receipt, status: 'no_coefficients'};
  for (const block of blocks) block.rows = weakWindows(block.run, operatorOptions, null, insist, {includePositionDerivatives: true});
  let coefficients = baseline.terms.map(term => term.coefficient), lastFit = null;
  try {
    for (let index = 0; index < options.maxIterations; index++) {
      const whitened = blocks.map(block => whitenBlock(block, coefficients));
      const fit = fitLinearColumns(terms.map((_, j) => whitened.flatMap(block => block.columns[j])), whitened.flatMap(block => block.target));
      insist(fit && fit.coefficients.every(value => Math.abs(value) <= 1e18), 'Whitened structure is rank deficient or outside executable coefficient bounds.', 'unidentifiable');
      const change = Math.hypot(...fit.coefficients.map((value, j) => value - coefficients[j]));
      iterations.push({index, inputCoefficients: [...coefficients], coefficients: [...fit.coefficients], coefficientChange: change, conditionEstimate: fit.conditionEstimate});
      coefficients = fit.coefficients; lastFit = fit;
      if (change < options.coefficientTolerance) {
        const rows = blocks.flatMap(block => block.rows), residuals = rows.map(row => row.target - row.columns.reduce((sum, value, j) => sum + value * coefficients[j], 0));
        const refinedModel = {...clone(baseline), id: baseline.id.slice(0, 220) + '~position-covariance', terms: baseline.terms.map((term, j) => ({...term, coefficient: coefficients[j]})),
          equation: 'α = ' + baseline.terms.map((term, j) => `${Number(coefficients[j].toPrecision(6))}·${term.id}`).join(' + '),
          method: 'iterated_complete_residual_position_covariance_comparison',
          metrics: {count: rows.length, rmse: Math.hypot(...residuals) / Math.sqrt(rows.length), residualUnits: 'rad', residualMeaning: 'original_noise_normalized_weak_equation_not_forward_prediction',
            conditionEstimate: lastFit.conditionEstimate, originalWeakScoreNotApplicable: true}};
        return {...receipt, status: 'converged', refinedModel};
      }
    }
    return {...receipt, status: 'iteration_limit'};
  } catch (error) {
    return {...receipt, status: 'refused', error: {message: error.message, code: error.code || 'covariance_refused'}};
  }
}
