/** Experimental compact-window weak angular law discovery. Training evidence only. */
import {normalizeAngularRuns, ANGULAR_MODEL_UNITS, ANGULAR_COEFFICIENT_UNITS, AngularDataError} from './angular-discovery.mjs';
const IDS = Object.keys(ANGULAR_COEFFICIENT_UNITS);
const LABELS = {rate: 'ω', coulomb: 'sign(ω)', spring: 'θ', gravity: 'sin(θ)', quadratic: 'ω|ω|', bias: '1'};
const METHOD = 'compact_window_weak_angular_acceleration_regression';
const SCALE = 'angular_acceleration_only_absolute_torque_unknown';
const RANK_TOLERANCE = 1e-8;
const MAX_WINDOWS = 2048;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const insist = (condition, message, code = 'invalid_options') => {if (!condition) throw new AngularDataError(message, code);};
const norm = values => Math.hypot(...values);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
function settings(raw) {
  insist(object(raw), 'Weak discovery options must be an object.');
  const terms = raw.terms ?? IDS;
  insist(Array.isArray(terms) && terms.length >= 1 && new Set(terms).size === terms.length && Array.from(terms).every(id => IDS.includes(id)),
    'Offer unique known autonomous angular terms; no command feature is available.');
  const result = {terms: [...terms], maxTerms: raw.maxTerms ?? Math.min(4, terms.length), noiseSigma: raw.noiseSigma ?? .01,
    ambiguityDelta: raw.ambiguityDelta ?? 6, windowDuration: raw.windowDuration ?? 1, windowStride: raw.windowStride ?? .5,
    rateWindowSize: raw.rateWindowSize ?? 9};
  insist(Number.isInteger(result.maxTerms) && result.maxTerms >= 0 && result.maxTerms <= terms.length, 'maxTerms exceeds the offered library.');
  insist(Number.isFinite(result.noiseSigma) && result.noiseSigma >= 1e-12 && result.noiseSigma <= 1e6, 'noiseSigma must be 1e-12–1e6 radians.');
  insist(Number.isFinite(result.ambiguityDelta) && result.ambiguityDelta >= 0 && result.ambiguityDelta <= 100, 'ambiguityDelta must be 0–100.');
  insist(Number.isFinite(result.windowDuration) && result.windowDuration >= .02 && result.windowDuration <= 60, 'windowDuration must be .02–60 seconds.');
  insist(Number.isFinite(result.windowStride) && result.windowStride >= .01 && result.windowStride <= result.windowDuration, 'windowStride must be .01 seconds through windowDuration.');
  insist(Number.isInteger(result.rateWindowSize) && result.rateWindowSize >= 5 && result.rateWindowSize <= 31 && result.rateWindowSize % 2 === 1,
    'rateWindowSize must be an odd integer from 5 to 31.');
  return result;
}
// Scoped scaled, twice-reorthogonalized QR, matching the integral solver's
// numerical method without importing or modifying its private internals.
function fit(columns, target) {
  if (!columns.length) return {coefficients: [], conditionEstimate: 1};
  const scales = columns.map(norm);
  if (scales.some(scale => !(scale > 0) || !Number.isFinite(scale))) return null;
  const q = [], r = columns.map(() => columns.map(() => 0)), pivots = [];
  for (let j = 0; j < columns.length; j++) {
    const v = columns[j].map(value => value / scales[j]);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < j; i++) {
      const projection = dot(q[i], v); r[i][j] += projection;
      for (let k = 0; k < v.length; k++) v[k] -= projection * q[i][k];
    }
    const pivot = norm(v); if (!(pivot > RANK_TOLERANCE)) return null;
    r[j][j] = pivot; pivots.push(pivot); q.push(v.map(value => value / pivot));
  }
  const solution = q.map(column => dot(column, target));
  for (let i = solution.length - 1; i >= 0; i--) {
    for (let j = i + 1; j < solution.length; j++) solution[i] -= r[i][j] * solution[j];
    solution[i] /= r[i][i];
  }
  const coefficients = solution.map((value, i) => value / scales[i]);
  return coefficients.every(Number.isFinite) ? {coefficients, conditionEstimate: Math.max(...pivots) / Math.min(...pivots)} : null;
}
function libraryRank(columns) {
  let remaining = columns.map(column => {const scale = norm(column); return column.map(value => scale ? value / scale : 0);}), rank = 0;
  while (remaining.length) {
    const sizes = remaining.map(norm), pivot = sizes.indexOf(Math.max(...sizes));
    if (!(sizes[pivot] > RANK_TOLERANCE)) break;
    const q = remaining.splice(pivot, 1)[0].map(value => value / sizes[pivot]); rank++;
    remaining = remaining.map(column => {
      for (let pass = 0; pass < 2; pass++) {const projection = dot(q, column); column = column.map((value, i) => value - projection * q[i]);}
      return column;
    });
  }
  return rank;
}
function localRates(run, requested) {
  const n = run.samples.length, width = Math.min(requested, n % 2 ? n : n - 1), half = (width - 1) / 2;
  return run.samples.map((center, i) => {
    const start = Math.min(Math.max(i - half, 0), n - width), rows = run.samples.slice(start, start + width);
    const scale = Math.max(...rows.map(row => Math.abs(row.time - center.time))), x = rows.map(row => (row.time - center.time) / scale);
    const solved = fit([x.map(() => 1), x, x.map(v => v * v), x.map(v => v ** 3)], rows.map(row => row.position - center.position));
    insist(solved, 'A first-rate window is rank deficient.', 'unidentifiable');
    const rate = solved.coefficients[1] / scale;
    insist(Number.isFinite(rate) && Math.abs(rate) <= 1e6, 'A derived rate exceeds executable range.', 'numerical_failure');
    return rate;
  });
}
const phi = x => x * x * (1 - x) * (1 - x);
// Integrals of phi and x*phi, evaluated over short segments using a shifted
// polynomial to avoid cancellation near a window boundary.
function moments(a, b) {
  const h = b - a;
  const c = [phi(a), 2 * a - 6 * a * a + 4 * a ** 3, 1 - 6 * a + 6 * a * a, -2 + 4 * a, 1];
  let integral = 0, firstOffset = 0;
  for (let k = 0; k < c.length; k++) {
    integral += c[k] * h ** (k + 1) / (k + 1);
    firstOffset += c[k] * h ** (k + 2) / (k + 2);
  }
  return {integral, firstOffset};
}
function windows(run, options, rates) {
  const samples = run.samples, result = []; let start = 0, end = 0;
  while (start < samples.length - 1) {
    const startTime = samples[start].time;
    // Compare elapsed intervals, never a tolerance scaled by absolute epoch.
    // Exactly representable shifts must not change selected sample indices.
    const endTolerance = 16 * Number.EPSILON * Math.max(1, options.windowDuration);
    while (end < samples.length && samples[end].time - startTime < options.windowDuration - endTolerance) end++;
    if (end >= samples.length) break;
    insist(end - start + 1 >= 9, 'Each weak window needs at least nine raw samples; increase windowDuration or improve sampling.', 'insufficient_sampling');
    const duration = samples[end].time - samples[start].time;
    const rows = samples.slice(start, end + 1), x = rows.map(row => (row.time - rows[0].time) / duration);
    const weights = x.map(() => 0), features = Object.fromEntries(options.terms.map(id => [id, 0]));
    const feature = (id, i) => {
      const position = rows[i].position;
      switch (id) {case 'spring': return position; case 'gravity': return Math.sin(position); case 'bias': return 1;
        case 'coulomb': return Math.sign(rates[start + i]); case 'quadratic': return rates[start + i] * Math.abs(rates[start + i]); default: return 0;}
    };
    for (let i = 0; i < rows.length - 1; i++) {
      const h = x[i + 1] - x[i], {integral, firstOffset} = moments(x[i], x[i + 1]);
      // Exact ∫ phi'' * linear(theta) dx, using integration by parts.
      const amount = (phi(x[i + 1]) - phi(x[i])) / h;
      weights[i] += amount; weights[i + 1] -= amount;
      for (const id of options.terms) {
        if (id === 'rate') features[id] += duration * (rows[i + 1].position - rows[i].position) / h * integral;
        else {
          const left = feature(id, i), right = feature(id, i + 1);
          features[id] += duration * duration * (left * integral + (right - left) / h * firstOffset);
        }
      }
    }
    // Eliminate constant and linear endpoint interpolants exactly in the
    // floating-point target operator. No initial angular velocity is supplied.
    const constantProjection = weights.reduce((sum, value, i) => sum + value * (1 - x[i]), 0);
    const linearProjection = weights.reduce((sum, value, i) => sum + value * x[i], 0);
    weights[0] -= constantProjection; weights[weights.length - 1] -= linearProjection;
    const noiseGain = norm(weights);
    insist(noiseGain > 0 && Number.isFinite(noiseGain), 'Weak target weights have no finite noise scale.', 'numerical_failure');
    const target = dot(weights, rows.map(row => row.position)) / noiseGain;
    const columns = options.terms.map(id => features[id] / noiseGain);
    insist(Number.isFinite(target) && columns.every(Number.isFinite), 'Weak equations exceed numerical range.', 'numerical_failure');
    result.push({target, columns, firstIndex: start, lastIndex: end, startTime: rows[0].time, endTime: rows.at(-1).time, sampleCount: rows.length, targetNoiseGain: noiseGain});
    insist(result.length <= MAX_WINDOWS, 'Too many weak windows; increase windowStride.', 'resource_limit');
    const strideTolerance = 16 * Number.EPSILON * Math.max(1, options.windowStride);
    do {start++;} while (start < samples.length && samples[start].time - startTime < options.windowStride - strideTolerance);
    if (end <= start) end = start + 1;
  }
  insist(result.length, 'Run is shorter than one complete weak window.', 'insufficient_sampling');
  return result;
}
/** The fitter receives no challenge data and does not use supplied initialRate. */
export function discoverAngularWeak(trainingRuns, requestedOptions = {}) {
  const options = settings(requestedOptions), runs = normalizeAngularRuns(trainingRuns);
  const needsRates = options.terms.some(id => id === 'coulomb' || id === 'quadratic');
  const blocks = runs.map(run => {const rates = needsRates ? localRates(run, options.rateWindowSize) : null; return {run, rates, rows: windows(run, options, rates)};});
  const rows = blocks.flatMap(block => block.rows);
  insist(rows.length >= 8, 'At least eight weak windows are required across training runs.', 'insufficient_sampling');
  insist(rows.length <= MAX_WINDOWS, 'At most 2048 weak windows are supported; increase windowStride.', 'resource_limit');
  const target = rows.map(row => row.target), columns = options.terms.map((_, i) => rows.map(row => row.columns[i]));
  insist(Number.isFinite(norm(target)) && columns.every(column => Number.isFinite(norm(column))), 'Weak columns exceed numerical range.', 'numerical_failure');
  const bounds = values => ({min: Math.min(...values), max: Math.max(...values)});
  const domain = {position: bounds(runs.flatMap(run => run.samples.map(row => row.position))),
    rate: needsRates ? {...bounds(blocks.flatMap(block => block.rates)), source: 'training_local_cubic_first_derivative'} : {min: null, max: null, source: 'rate_not_estimated_linear_rate_integrated_by_parts'}};
  const candidates = []; let examinedCandidates = 0, rankDeficientCandidates = 0, unexecutableCandidates = 0;
  for (let mask = 0; mask < 1 << options.terms.length; mask++) {
    const indices = options.terms.flatMap((_, i) => mask & 1 << i ? [i] : []);
    if (indices.length > options.maxTerms || indices.length >= target.length) continue;
    examinedCandidates++; const fitted = fit(indices.map(i => columns[i]), target);
    if (!fitted) {rankDeficientCandidates++; continue;}
    if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) {unexecutableCandidates++; continue;}
    const residuals = target.map((value, j) => value - indices.reduce((sum, i, k) => sum + fitted.coefficients[k] * columns[i][j], 0));
    const rmse = norm(residuals) / Math.sqrt(target.length), score = target.length * Math.log(Math.max(rmse ** 2, options.noiseSigma ** 2)) + indices.length * Math.log(target.length);
    if (![rmse, score].every(Number.isFinite)) {unexecutableCandidates++; continue;}
    const terms = indices.map((i, k) => ({id: options.terms[i], coefficient: fitted.coefficients[k], coefficientUnit: ANGULAR_COEFFICIENT_UNITS[options.terms[i]]}));
    candidates.push({schema: 'worldlaw.angular-model/v1', id: terms.map(term => term.id).join('+') || 'zero', terms,
      equation: 'α = ' + (terms.map(term => `${Number(term.coefficient.toPrecision(5))}·${LABELS[term.id]}`).join(' + ') || '0'),
      units: {...ANGULAR_MODEL_UNITS}, physicalInertia: null, absoluteTorqueIdentified: false, scaleMeaning: SCALE, method: METHOD, domain,
      metrics: {count: target.length, rmse, maxAbsResidual: Math.max(...residuals.map(Math.abs)), score, residualUnits: 'rad',
        residualMeaning: 'noise_normalized_weak_equation_not_forward_prediction', conditionEstimate: fitted.conditionEstimate, rank: terms.length}});
  }
  insist(candidates.length, 'No finite executable weak candidate could be fitted.', 'unidentifiable');
  candidates.sort((a, b) => a.metrics.score - b.metrics.score || a.terms.length - b.terms.length);
  const selected = candidates[0], competitive = candidates.filter(model => model.metrics.score - selected.metrics.score <= options.ambiguityDelta);
  const fullLibraryRank = libraryRank(columns);
  return {schema: 'worldlaw.angular-discovery/v1', scope: 'finite_library_autonomous_angular_acceleration', method: METHOD,
    units: {...ANGULAR_MODEL_UNITS}, residualUnits: 'rad', noiseSigmaUnits: 'rad', physicalInertia: null, absoluteTorqueIdentified: false, scaleMeaning: SCALE,
    selected, candidates, competitive, trainingRuns: runs, options, fitEquationCount: target.length,
    diagnostics: {examinedCandidates, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, librarySize: options.terms.length,
      rankTolerance: RANK_TOLERANCE, columnNorms: columns.map((column, i) => ({id: options.terms[i], norm: norm(column), units: `rad per (${ANGULAR_COEFFICIENT_UNITS[options.terms[i]]})`})),
      selectionAmbiguous: competitive.length > 1 || fullLibraryRank < options.terms.length, competitiveCount: competitive.length,
      identifiability: fullLibraryRank < options.terms.length ? 'insufficient_excitation' : selected.metrics.conditionEstimate > 1e4 ? 'weak_numerical_conditioning' : 'finite_library_local_only',
      trainingRmseInNoiseUnits: selected.metrics.rmse / options.noiseSigma, adequacy: selected.metrics.rmse > 3 * options.noiseSigma ? 'residual_mismatch' : 'not_falsified_on_training',
      testFunction: 'phi(x)=x²(1−x)² on [0,1]; zero value and slope at both endpoints',
      target: 'integral phi_second_derivative(x)*theta(x) dx; piecewise-linear position integrated exactly',
      initialRateAssumption: 'not_used_in_fitting; supplied_rate_reserved_for_independent_forward_initialization',
      quadrature: 'exact_weighted_piecewise_linear_features; nonlinear_features_approximated_between_samples',
      covarianceTreatment: 'each_target_row_divided_by_its_raw_position_weight_norm; cross_window_covariance_not_whitened',
      scoreMethod: 'n*log(max(noise_normalized_weak_mse,position_noise_sigma²))+term_count*log(n)',
      scoreInterpretation: 'heuristic_not_calibrated_likelihood_or_posterior',
      conditionEstimateMeaning: 'ratio_of_scaled_QR_diagonal_extremes_not_exact_condition_number',
      forcingAssumption: 'unforced_scalar_rotation_declared_not_verified_by_missing_actuator_data',
      runs: blocks.map(block => ({runId: block.run.id, rawCount: block.run.samples.length, equationCount: block.rows.length,
        rateMethod: needsRates ? 'local_cubic_first_derivative_training_only' : 'not_required',
        linearRateIntegral: 'integration_by_parts_no_pointwise_rate_needed',
        windows: block.rows.map(({target, columns, ...metadata}) => metadata)})),
      limitations: ['Finite autonomous scalar angular-acceleration library only; no arbitrary-law or topology discovery.',
        'Physical inertia and absolute torque are unknown; coefficients are acceleration-normalized.',
        'Initial angular rate is eliminated from fitting, but forward prediction still requires a supplied uncertain starting rate.',
        'Overlapping windows, shared noisy regressors and rate estimation introduce correlation and errors-in-variables bias; no calibrated confidence is reported.',
        'Weak integration attenuates high-frequency information; window duration can hide rapid or unsupported dynamics.',
        'Nonlinear feature quadrature and first-rate estimates are biased under coarse or noisy sampling.',
        'Window residuals are not free-running trajectory errors; separate recordings must test predictions.',
        'No coefficient-sign, passivity, or mechanism-topology constraints are imposed.',
        'Unforced dynamics and angle-zero consistency are assumptions; absent actuator/calibration channels cannot verify them.',
        'Different recordings of one apparatus do not establish transfer to unseen mechanisms.']}};
}
