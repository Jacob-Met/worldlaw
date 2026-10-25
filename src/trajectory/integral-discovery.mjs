/** Finite-library scalar torque discovery from double-integrated angular telemetry.
 * Fits training runs only. The score is a heuristic in radian displacement units,
 * never a calibrated likelihood and never independent forward validation.
 */
import {TERMS, DEFAULT_TERMS, UNITS, DiscoveryError} from '../science/torque-discovery.mjs';
import {normalizeCommandTiming, prepareCommandTimeline, commandAtSegment} from './command-timeline.mjs';

const IDS = TERMS.map(term => term.id);
const RANK_TOLERANCE = 1e-8;
const METHOD = 'double_integral_position_regression';
const insist = (condition, message, code = 'invalid_input') => { if (!condition) throw new DiscoveryError(message, code); };
function finite(value, name, bound = 1e12) {
  insist(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound,
    `${name} must be finite with magnitude at most ${bound}.`);
  return value;
}
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const norm = values => Math.hypot(...values);

function normalizeOptions(options) {
  insist(options && typeof options === 'object' && !Array.isArray(options), 'Integral options must be an object.');
  const terms = options.terms ?? DEFAULT_TERMS;
  insist(Array.isArray(terms) && terms.length > 0 && terms.length <= IDS.length &&
    new Set(terms).size === terms.length && Array.from(terms).every(id => IDS.includes(id)), 'terms must be unique known torque-library IDs.');
  const result = {terms: [...terms], noiseSigma: options.noiseSigma ?? 0.01,
    maxTerms: options.maxTerms ?? Math.min(4, terms.length), ambiguityDelta: options.ambiguityDelta ?? 6,
    rateWindowSize: options.rateWindowSize ?? 9, rowStride: options.rowStride ?? 1};
  if (options.commandTiming !== undefined) result.commandTiming = normalizeCommandTiming(options.commandTiming);
  finite(result.noiseSigma, 'noiseSigma', 1e6);
  insist(result.noiseSigma >= 1e-12, 'noiseSigma must be at least 1e-12 radians.');
  insist(Number.isInteger(result.maxTerms) && result.maxTerms >= 0 && result.maxTerms <= terms.length,
    'maxTerms must be an integer between zero and the offered library size.');
  finite(result.ambiguityDelta, 'ambiguityDelta', 100);
  insist(result.ambiguityDelta >= 0, 'ambiguityDelta must be nonnegative.');
  insist(Number.isInteger(result.rateWindowSize) && result.rateWindowSize >= 5 && result.rateWindowSize <= 31 && result.rateWindowSize % 2 === 1,
    'rateWindowSize must be an odd integer from 5 to 31.');
  insist(Number.isInteger(result.rowStride) && result.rowStride >= 1 && result.rowStride <= 128,
    'rowStride must be an integer from 1 to 128.');
  return result;
}

function copyRuns(runs) {
  insist(Array.isArray(runs) && runs.length >= 1 && runs.length <= 8, 'Supply one to eight training runs.');
  let total = 0;
  const result = Array.from(runs, (run, index) => {
    insist(run && typeof run === 'object' && !Array.isArray(run), `Training run ${index + 1} must be an object.`);
    insist(typeof run.id === 'string' && run.id.trim().length > 0 && run.id.length <= 160, 'Each training run needs a nonempty id of at most 160 characters.');
    insist(['synthetic', 'measured', 'unknown'].includes(run.kind), 'Run kind must be synthetic, measured, or unknown.');
    finite(run.inertia, 'inertia'); insist(run.inertia > 0, 'Known constant inertia must be positive in kg·m².');
    finite(run.initialRate, 'initialRate', 1e6);
    insist(Array.isArray(run.samples) && run.samples.length >= 5 && run.samples.length <= 4096,
      'Each run must contain 5 to 4096 samples.');
    total += run.samples.length;
    const samples = Array.from(run.samples, (row, i) => ({time: finite(row?.time, `time ${i}`),
      position: finite(row?.position, `position ${i}`, 1e6), command: finite(row?.command, `command ${i}`, 1e6)}));
    for (let i = 1; i < samples.length; i++) insist(samples[i].time > samples[i - 1].time, 'Run times must increase strictly.');
    insist(samples.at(-1).time - samples[0].time <= 1e4, 'Run duration must be at most 10000 seconds.');
    return {id: run.id, label: typeof run.label === 'string' ? run.label.slice(0, 500) : run.id, kind: run.kind,
      inertia: run.inertia, initialRate: run.initialRate, samples,
      source: {label: typeof run.source?.label === 'string' ? run.source.label.slice(0, 1000) : 'Unspecified source'}};
  });
  insist(total <= 8192, 'Training input must contain at most 8192 raw samples.');
  insist(new Set(result.map(run => run.id)).size === result.length, 'Training run ids must be unique.');
  return result;
}

// Column-scaled twice-reorthogonalized modified Gram-Schmidt, avoiding X'X.
function fit(columns, target) {
  if (!columns.length) return {coefficients: [], conditionEstimate: 1};
  const scales = columns.map(norm);
  if (scales.some(value => !(value > 0) || !Number.isFinite(value))) return null;
  const q = [], r = columns.map(() => columns.map(() => 0)), pivots = [];
  for (let j = 0; j < columns.length; j++) {
    const v = columns[j].map(value => value / scales[j]);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < j; i++) {
      const projection = dot(q[i], v); r[i][j] += projection;
      for (let k = 0; k < v.length; k++) v[k] -= projection * q[i][k];
    }
    const pivot = norm(v);
    if (!(pivot > RANK_TOLERANCE)) return null;
    r[j][j] = pivot; pivots.push(pivot); q.push(v.map(value => value / pivot));
  }
  const solution = q.map(col => dot(col, target));
  for (let i = solution.length - 1; i >= 0; i--) {
    for (let j = i + 1; j < solution.length; j++) solution[i] -= r[i][j] * solution[j];
    solution[i] /= r[i][i];
  }
  const coefficients = solution.map((value, i) => value / scales[i]);
  return coefficients.every(Number.isFinite) ? {coefficients, conditionEstimate: Math.max(...pivots) / Math.min(...pivots)} : null;
}
function libraryRank(columns) {
  let remaining = columns.map(col => { const scale = norm(col); return col.map(value => scale ? value / scale : 0); });
  let rank = 0;
  while (remaining.length) {
    const sizes = remaining.map(norm), pivot = sizes.indexOf(Math.max(...sizes));
    if (!(sizes[pivot] > RANK_TOLERANCE)) break;
    const q = remaining.splice(pivot, 1)[0].map(value => value / sizes[pivot]); rank++;
    remaining = remaining.map(column => {
      for (let pass = 0; pass < 2; pass++) {
        const projection = dot(q, column);
        column = column.map((value, i) => value - projection * q[i]);
      }
      return column;
    });
  }
  return rank;
}

function localRates(run, requestedWindow) {
  const n = run.samples.length, width = Math.min(requestedWindow, n % 2 ? n : n - 1), half = (width - 1) / 2;
  const rates = run.samples.map((center, i) => {
    if (i === 0) return run.initialRate;
    const start = Math.min(Math.max(i - half, 0), n - width), rows = run.samples.slice(start, start + width);
    const scale = Math.max(...rows.map(row => Math.abs(row.time - center.time)));
    const t = rows.map(row => (row.time - center.time) / scale);
    const fitted = fit([t.map(() => 1), t, t.map(value => value * value), t.map(value => value ** 3)],
      rows.map(row => row.position - center.position));
    insist(fitted, 'A first-derivative window is numerically rank deficient.', 'unidentifiable');
    return finite(fitted.coefficients[1] / scale, 'derived angular rate', 1e6);
  });
  return {rates, usedWindowSize: width};
}

// For independent raw position noise, y_i=theta_i-theta_0-omega_0*t_i has
// Cov(y)/sigma² = I+11'. This exact inverse-square-root transforms that part of
// the residual only. Regressor noise and quadrature error still invalidate iid likelihood claims.
function whiten(values) {
  const n = values.length, meanCorrection = (1 - 1 / Math.sqrt(n + 1)) * values.reduce((sum, v) => sum + v / n, 0);
  return values.map(value => value - meanCorrection);
}

function integralRows(run, options) {
  const delayedCommand = options.commandTiming && (options.commandTiming.delaySeconds > 0 || options.commandTiming.responseTimeSeconds > 0) ? prepareCommandTimeline(run.samples, options.commandTiming) : null;
  const needsRates = options.terms.some(id => id === 'coulomb' || id === 'quadratic');
  const derivative = needsRates ? localRates(run, options.rateWindowSize) : null;
  const rows = run.samples, first = rows[0], integrals = Object.fromEntries(options.terms.map(id => [id, {first: 0, second: 0}]));
  const target = [], columns = options.terms.map(() => []), indices = [], rawRates = derivative?.rates;
  let thetaIntegral = 0, possibleWraps = 0, minStep = Infinity, maxStep = 0;
  const value = (id, i) => {
    switch (id) {
      case 'command': return rows[i].command;
      case 'spring': return rows[i].position;
      case 'gravity': return Math.sin(rows[i].position);
      case 'cosine': return Math.cos(rows[i].position);
      case 'cubic': return rows[i].position ** 3;
      case 'coulomb': return Math.sign(rawRates[i]);
      case 'quadratic': return rawRates[i] * Math.abs(rawRates[i]);
      default: return 0;
    }
  };
  for (let i = 1; i < rows.length; i++) {
    const h = rows[i].time - rows[i - 1].time, elapsed = rows[i].time - first.time;
    minStep = Math.min(minStep, h); maxStep = Math.max(maxStep, h);
    if (Math.abs(rows[i].position - rows[i - 1].position) > Math.PI) possibleWraps++;
    thetaIntegral += h * (rows[i - 1].position + rows[i].position) / 2;
    for (const id of options.terms) {
      const state = integrals[id];
      if (id === 'bias') state.second = elapsed * elapsed / 2;
      else if (id === 'rate') state.second = thetaIntegral - first.position * elapsed;
      else if (id === 'command' && delayedCommand) state.second = delayedCommand.doubleIntegrals[i];
      else {
        const left = value(id, i - 1), right = id === 'command' ? left : value(id, i);
        state.second += h * state.first + h * h * (2 * left + right) / 6;
        state.first += h * (left + right) / 2;
      }
    }
    if (i % options.rowStride === 0 || i === rows.length - 1) {
      target.push(rows[i].position - first.position - run.initialRate * elapsed);
      options.terms.forEach((id, j) => columns[j].push(integrals[id].second / run.inertia));
      indices.push(i);
    }
  }
  insist(target.every(Number.isFinite) && columns.every(col => col.every(Number.isFinite)), 'Integrated equations overflowed.', 'numerical_failure');
  insist(Number.isFinite(maxStep / minStep), 'Sampling-gap ratio exceeds numerical range.', 'numerical_failure');
  return {target, columns, indices, rawRates, diagnostics: {runId: run.id, rawCount: rows.length, equationCount: target.length,
    duration: rows.at(-1).time - first.time, minStep, maxStep, gapRatio: maxStep / minStep, possibleWraps,
    rateWindowSize: derivative?.usedWindowSize ?? null, rateMethod: needsRates ? 'local_cubic_first_derivative' : 'not_required',
    linearRateIntegral: options.terms.includes('rate') ? 'position_integral_identity_no_differentiation' : 'not_offered'}};
}

/** Discover a bounded torque model from training-only angular runs. noiseSigma is in radians. */
export function discoverIntegral(trainingRuns, requestedOptions = {}) {
  const options = normalizeOptions(requestedOptions), runs = copyRuns(trainingRuns);
  const blocks = runs.map(run => integralRows(run, options));
  const target = blocks.flatMap(block => whiten(block.target));
  const rawTarget = blocks.flatMap(block => block.target);
  const columns = options.terms.map((_, j) => blocks.flatMap(block => whiten(block.columns[j])));
  const rawColumns = options.terms.map((_, j) => blocks.flatMap(block => block.columns[j]));
  insist(target.every(Number.isFinite) && columns.every(column => column.every(Number.isFinite) && Number.isFinite(norm(column))),
    'Whitened equations exceed numerical range.', 'numerical_failure');
  insist(target.length >= 8, 'At least eight integrated equations are required; decrease rowStride or supply longer training runs.');
  const observations = runs.flatMap(run => run.samples);
  const bounds = values => ({min: Math.min(...values), max: Math.max(...values)});
  const dynamicCommand=options.commandTiming&&(options.commandTiming.delaySeconds>0||options.commandTiming.responseTimeSeconds>0);
  const appliedCommands=dynamicCommand?runs.flatMap(run=>prepareCommandTimeline(run.samples,options.commandTiming).intervals.flatMap(segments=>segments.flatMap(segment=>[commandAtSegment(segment,0),commandAtSegment(segment,segment.duration)]))):null;
  const domain = {position: bounds(observations.map(row => row.position)), command: appliedCommands?{...bounds(appliedCommands),source:'declared_timing_applied_command'}:bounds(observations.map(row => row.command)),
    ...(appliedCommands?{recordedCommand:bounds(observations.map(row=>row.command))}:{}),
    rate: {...bounds(blocks.flatMap((block, i) => block.rawRates ?? [runs[i].initialRate])),
      source: blocks.some(block => block.rawRates) ? 'declared_initial_and_estimated_rates' : 'declared_initial_rates_only'}};
  const candidates = []; let examinedCandidates = 0, rankDeficientCandidates = 0, unexecutableCandidates = 0;
  for (let mask = 0; mask < 1 << options.terms.length; mask++) {
    const indices = options.terms.flatMap((_, index) => mask & 1 << index ? [index] : []);
    if (indices.length > options.maxTerms || indices.length >= target.length) continue;
    examinedCandidates++;
    const fitted = fit(indices.map(j => columns[j]), target);
    if (!fitted) { rankDeficientCandidates++; continue; }
    if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) { unexecutableCandidates++; continue; }
    const residuals = target.map((value, i) => value - indices.reduce((sum, j, k) => sum + fitted.coefficients[k] * columns[j][i], 0));
    const rawResiduals = rawTarget.map((value, i) => value - indices.reduce((sum, j, k) => sum + fitted.coefficients[k] * rawColumns[j][i], 0));
    const rmse = norm(rawResiduals) / Math.sqrt(target.length), whitenedRmse = norm(residuals) / Math.sqrt(target.length);
    const score = target.length * Math.log(Math.max(whitenedRmse ** 2, options.noiseSigma ** 2)) + indices.length * Math.log(target.length);
    if (![rmse, whitenedRmse, score].every(Number.isFinite)) { unexecutableCandidates++; continue; }
    const terms = indices.map((j, k) => ({id: options.terms[j], coefficient: fitted.coefficients[k]}));
    candidates.push({schema: 'worldlaw.torque-model/v1', id: terms.map(term => term.id).join('+') || 'zero', terms, units: {...UNITS}, domain,
      method: METHOD, equation: 'τ = ' + (terms.map(term => `${Number(term.coefficient.toPrecision(5))}·${TERMS.find(t => t.id === term.id).label}`).join(' + ') || '0'),
      metrics: {count: target.length, rmse, whitenedRmse, maxAbsResidual: Math.max(...rawResiduals.map(Math.abs)), score,
        residualUnits: 'rad', residualMeaning: 'integrated_training_displacement_not_forward_prediction',
        conditionEstimate: fitted.conditionEstimate, rank: terms.length}});
  }
  insist(candidates.length, 'No finite executable candidate could be fitted.', 'unidentifiable');
  candidates.sort((a, b) => a.metrics.score - b.metrics.score || a.terms.length - b.terms.length);
  const selected = candidates[0], competitive = candidates.filter(model => model.metrics.score - selected.metrics.score <= options.ambiguityDelta);
  const fullLibraryRank = libraryRank(columns);
  const columnNorms = options.terms.map((id, i) => ({id, norm: norm(columns[i]),
    units: `rad per (${TERMS.find(term => term.id === id).coefficientUnit})`}));
  const weakestNorm = Math.min(...columnNorms.map(col => col.norm));
  return {schema: 'worldlaw.discovery/v1', scope: 'finite_library_scalar_torque_structure', method: METHOD,
    units: {...UNITS}, residualUnits: 'rad', noiseSigmaUnits: 'rad', selected, candidates, competitive, options,
    trainingRuns: runs, fitEquationCount: target.length,
    diagnostics: {examinedCandidates, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, librarySize: options.terms.length,
      rankTolerance: RANK_TOLERANCE, columnNorms, selectionAmbiguous: competitive.length > 1 || fullLibraryRank < options.terms.length,
      identifiability: fullLibraryRank < options.terms.length ? 'insufficient_excitation' : selected.metrics.conditionEstimate > 1e4 ?
        'weak_numerical_conditioning' : 'finite_library_local_only',
      smallestRegressorColumnNorm: weakestNorm, competitiveCount: competitive.length,
      trainingRmseInNoiseUnits: selected.metrics.whitenedRmse / options.noiseSigma,
      adequacy: selected.metrics.whitenedRmse > 3 * options.noiseSigma ? 'residual_mismatch' : 'not_falsified_on_training',
      scoreMethod: 'n*log(max(whitened_displacement_mse,position_noise_sigma^2))+term_count*log(n)',
      scoreInterpretation: 'heuristic_not_calibrated_likelihood_or_posterior',
      conditionEstimateMeaning: 'ratio_of_scaled_QR_diagonal_extremes_not_exact_condition_number',
      covarianceTreatment: 'inverse_sqrt_of_I_plus_ones_for_shared_initial_position_error_only',
      commandConvention: 'left_sample_zero_order_hold', quadrature: 'exact_for_piecewise_linear_features_and_zero_order_held_command',
      ...(options.commandTiming ? {commandTiming: {...options.commandTiming}, commandConvention: options.commandTiming.responseTimeSeconds>0?'exact_first_order_response_to_delayed_held_command_with_declared_initial_equilibrium':'delayed_left_sample_zero_order_hold_with_declared_constant_prehistory'} : {}),
      initialRateAssumption: 'caller_supplied_exact_initial_angular_rate', runs: blocks.map(block => block.diagnostics),
      warnings: [...(blocks.some(block => block.diagnostics.possibleWraps) ? ['possible_angle_wrap_no_unwrapping_applied'] : []),
        ...(blocks.some(block => block.diagnostics.gapRatio > 10) ? ['highly_irregular_sampling'] : []),
        ...(fullLibraryRank < options.terms.length ? ['insufficient_excitation'] : [])],
      limitations: [
        'Only subsets of the declared scalar torque library are searched; no topology or arbitrary-law discovery.',
        'noiseSigma is an assumed independent position-error scale in radians, not torque noise.',
        'The score accounts only for a shared noisy initial position; integrated noisy regressors still cause correlation and errors-in-variables bias.',
        'Cumulative equations from one run are not independent physical experiments; score and competitive spread are not calibrated uncertainty.',
        'Piecewise-linear quadrature biases undersampled fast dynamics; nonlinear rate terms also depend on first-derivative smoothing.',
        'Known constant inertia, calibrated unwrapped position, aligned zero-order-held torque and exact initialRate are assumed.',
        'Initial-rate errors create drift and can produce convincing but incorrect parameters.',
        'Training displacement residual is not free-running forward prediction; separate challenge runs are required.',
        'No passivity, friction-sign, or mechanism-topology constraints are imposed.',
      ]}};
}

