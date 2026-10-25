/**
 * Bounded structural discovery for scalar torque laws. Dependency-free browser ESM.
 * This searches a declared feature library; it does not infer mechanism topology.
 * No held-out observations are accepted by the fitting API.
 */
export const TERMS = Object.freeze([
  { id: 'command', label: 'u', coefficientUnit: '1' },
  { id: 'rate', label: 'ω', coefficientUnit: 'N·m·s/rad' },
  { id: 'coulomb', label: 'sign(ω)', coefficientUnit: 'N·m' },
  { id: 'spring', label: 'θ', coefficientUnit: 'N·m/rad' },
  { id: 'gravity', label: 'sin(θ)', coefficientUnit: 'N·m' },
  { id: 'quadratic', label: 'ω|ω|', coefficientUnit: 'N·m·s²/rad²' },
  { id: 'bias', label: '1', coefficientUnit: 'N·m' },
  { id: 'command_position', label: 'uθ', coefficientUnit: '1/rad', optional: true },
  { id: 'rate_squared', label: 'ω²', coefficientUnit: 'N·m·s²/rad²', optional: true },
  { id: 'cosine', label: 'cos(θ)', coefficientUnit: 'N·m', optional: true },
  { id: 'cubic', label: 'θ³', coefficientUnit: 'N·m/rad³', optional: true },
].map(Object.freeze));
export const DEFAULT_TERMS = Object.freeze(TERMS.filter(term => !term.optional).map(term => term.id));
export const UNITS = Object.freeze({command:'N·m', position:'rad', rate:'rad/s', jointTorque:'N·m'});
const ids = TERMS.map(t => t.id);
const LIMIT = 4096;
import {fitLinearColumns as fit, linearColumnRank as libraryRank, RANK_TOLERANCE} from './linear-fit.mjs';
import {fitSoftL1Columns, softL1Work, SOFT_L1_MAX_WORK} from './robust-fit.mjs';
const fields = ['command', 'position', 'rate'];
const observedFields = [...fields, 'jointTorque'];
// Only private, freshly computed least-squares fits are reused. Robust fits
// deliberately rerun the complete bounded optimization on every refit.
const fittedSources = new WeakMap();

export class DiscoveryError extends Error {
  constructor(message, code = 'invalid_input') { super(message); this.name = 'DiscoveryError'; this.code = code; }
}
function requireThat(value, message, code) { if (!value) throw new DiscoveryError(message, code); }
function finite(value, name, bound = 1e12) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound,
    `${name} must be a finite number with magnitude at most ${bound}.`);
  return value;
}
function input(row, observed = false) {
  requireThat(row && typeof row === 'object' && !Array.isArray(row), 'Each observation/input must be an object.');
  const result = Object.fromEntries(fields.map(key => [key, finite(row[key], key, 1e6)]));
  if (observed) result.jointTorque = finite(row.jointTorque, 'jointTorque');
  return result;
}
function rows(values, minimum = 0) {
  requireThat(Array.isArray(values) && values.length >= minimum && values.length <= LIMIT,
    `Expected between ${minimum} and ${LIMIT} observations.`);
  return values.map(row => input(row, true));
}
function feature(id, row) {
  switch (id) {
    case 'command': return row.command;
    case 'command_position': return row.command * row.position;
    case 'rate': return row.rate;
    case 'coulomb': return Math.sign(row.rate);
    case 'spring': return row.position;
    case 'gravity': return Math.sin(row.position);
    case 'cosine': return Math.cos(row.position);
    case 'cubic': return row.position ** 3;
    case 'quadratic': return row.rate * Math.abs(row.rate);
    case 'rate_squared': return row.rate * row.rate;
    case 'bias': return 1;
    default: throw new DiscoveryError(`Unknown feature ${id}.`);
  }
}
function norm(a) { return Math.hypot(...a); }
function normalizeOptions(options = {}) {
  requireThat(options && typeof options === 'object' && !Array.isArray(options), 'Options must be an object.');
  const terms = options.terms === undefined ? [...DEFAULT_TERMS] : options.terms;
  requireThat(Array.isArray(terms) && terms.length > 0 && terms.length <= ids.length &&
    new Set(terms).size === terms.length && terms.every(id => ids.includes(id)), 'terms must be unique known feature IDs.');
  const result = {
    terms: [...terms], noiseSigma: options.noiseSigma ?? 0.01,
    maxTerms: options.maxTerms ?? Math.min(4, terms.length), ambiguityDelta: options.ambiguityDelta ?? 6,
  };
  finite(result.noiseSigma, 'noiseSigma', 1e6);
  requireThat(result.noiseSigma > 0 && result.noiseSigma >= 1e-12, 'noiseSigma must be at least 1e-12 N·m.');
  requireThat(Number.isInteger(result.maxTerms) && result.maxTerms >= 0 && result.maxTerms <= terms.length,
    'maxTerms must be an integer between zero and the feature-library size.');
  finite(result.ambiguityDelta, 'ambiguityDelta', 100);
  requireThat(result.ambiguityDelta >= 0, 'ambiguityDelta must be nonnegative.');
  requireThat(options.loss === undefined || ['least_squares', 'soft_l1'].includes(options.loss), 'Unknown reading-loss assumption.');
  if (options.loss === 'soft_l1') {
    finite(options.lossScale, 'lossScale', 1e6);
    requireThat(options.lossScale >= 1e-7, 'Declare a soft-L1 scale of at least 0.0000001 N·m.');
    result.loss = 'soft_l1'; result.lossScale = options.lossScale;
  }
  return result;
}

export function discoveryRobustWork(rowCount, requestedOptions = {}) {
  const options = normalizeOptions(requestedOptions);
  return options.loss === 'soft_l1' ? softL1Work(rowCount, options.terms.length, options.maxTerms) : 0;
}

function checkedTerms(model) {
  requireThat(model && model.schema === 'worldlaw.torque-model/v1' && Array.isArray(model.terms), 'Invalid executable torque model.');
  requireThat(model.terms.length <= ids.length && new Set(model.terms.map(t => t?.id)).size === model.terms.length,
    'Model terms must be unique.');
  model.terms.forEach(term => { requireThat(ids.includes(term.id), 'Model contains an unknown term.'); finite(term.coefficient, 'coefficient', 1e18); });
  return model.terms;
}
function predictUnchecked(model, row) {
  const value = model.terms.reduce((sum, term) => sum + term.coefficient * feature(term.id, row), 0);
  requireThat(Number.isFinite(value), 'Model prediction overflowed.', 'numerical_failure');
  return value;
}
export function predict(model, values) { checkedTerms(model); return predictUnchecked(model, input(values)); }

/**
 * Snapshot one model for repeated numerical evaluation. Every point still uses
 * the public coordinate bounds and finite-result check. The private snapshot
 * prevents a caller's later edits from changing a running solver's equation.
 */
export function prepareTorquePredictor(model) {
  checkedTerms(model);
  const snapshot = {schema: 'worldlaw.torque-model/v1',
    terms: model.terms.map(({id, coefficient}) => ({id, coefficient}))};
  // Validate the captured values as well, including accessor-backed callers.
  checkedTerms(snapshot);
  return (command, position, rate) => predictUnchecked(snapshot, {
    command: finite(command, 'command', 1e6),
    position: finite(position, 'position', 1e6),
    rate: finite(rate, 'rate', 1e6),
  });
}

export function evaluate(model, observations) {
  checkedTerms(model);
  const samples = rows(observations);
  const result = samples.map(row => {
    const prediction = predictUnchecked(model, row);
    return { ...row, prediction, residual: row.jointTorque - prediction };
  });
  const residuals = result.map(row => row.residual);
  return { count: samples.length, rmse: samples.length ? norm(residuals) / Math.sqrt(samples.length) : null,
    maxAbsResidual: samples.length ? Math.max(...residuals.map(Math.abs)) : null, rows: result };
}

export function discover(observations, requestedOptions = {}) {
  const samples = rows(observations, 8), options = normalizeOptions(requestedOptions);
  const robustWork = discoveryRobustWork(samples.length, options);
  requireThat(robustWork <= SOFT_L1_MAX_WORK,
    `Complete soft-L1 search needs ${robustWork} work units; the limit is ${SOFT_L1_MAX_WORK}. No subset of the observations or candidate library was fitted.`, 'work_limit');
  const columns = options.terms.map(id => samples.map(row => feature(id, row)));
  const target = samples.map(row => row.jointTorque);
  const candidates = []; let rankDeficientCandidates = 0, unexecutableCandidates = 0, examined = 0;
  const domain = Object.fromEntries(fields.map(key => [key, {
    min: Math.min(...samples.map(row => row[key])), max: Math.max(...samples.map(row => row[key])),
  }]));
  for (let mask = 0; mask < (1 << options.terms.length); ++mask) {
    const indices = options.terms.flatMap((_, index) => mask & (1 << index) ? [index] : []);
    if (indices.length > options.maxTerms || indices.length >= samples.length) continue;
    examined++;
    let fitted = fit(indices.map(index => columns[index]), target);
    if (!fitted) { rankDeficientCandidates++; continue; }
    // An irrelevant, almost-zero feature can demand an enormous coefficient.
    // Reject that candidate without discarding other well-defined structures.
    if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) { unexecutableCandidates++; continue; }
    if (options.loss === 'soft_l1') {
      fitted = fitSoftL1Columns(indices.map(index => columns[index]), target, options.lossScale, fitted);
      requireThat(fitted.status === 'converged',
        `Soft-L1 optimization is unresolved for ${indices.map(index => options.terms[index]).join('+') || 'zero'} (${fitted.status}). No partially optimized ranking is reported.`, 'robust_fit_incomplete');
      if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) { unexecutableCandidates++; continue; }
    }
    const terms = indices.map((index, j) => ({ id: options.terms[index], coefficient: fitted.coefficients[j] }));
    const model = {
      schema: 'worldlaw.torque-model/v1', id: terms.map(term => term.id).join('+') || 'zero', terms, units: UNITS, domain,
      equation: 'τ = ' + (terms.map(term => `${Number(term.coefficient.toPrecision(5))}·${TERMS.find(t => t.id === term.id).label}`).join(' + ') || '0'),
    };
    const evaluation = evaluate(model, samples);
    // This noise-floor information criterion is a ranking heuristic. It is not
    // a posterior, a confidence interval, or evidence of absolute model adequacy.
    const scoreError = options.loss === 'soft_l1' ? fitted.meanLoss : evaluation.rmse ** 2;
    const score = samples.length * Math.log(Math.max(scoreError, options.noiseSigma ** 2)) + terms.length * Math.log(samples.length);
    model.metrics = { count: samples.length, rmse: evaluation.rmse, maxAbsResidual: evaluation.maxAbsResidual,
      score, conditionEstimate: fitted.conditionEstimate, rank: terms.length };
    if (options.loss === 'soft_l1') {
      model.fitting = {loss:'soft_l1',scale:options.lossScale};
      model.metrics.robust = {meanLoss:fitted.meanLoss,iterations:fitted.iterations,
        scaledGradient:fitted.scaledGradient,stationarityTolerance:fitted.stationarityTolerance,
        minWeight:Math.min(...fitted.weights),halfWeightCount:fitted.weights.filter(weight => weight < 0.5).length};
    }
    candidates.push(model);
  }
  requireThat(candidates.length, 'No estimable model in the candidate library.', 'unidentifiable');
  const fullLibraryRank = libraryRank(columns);
  return rankFittedSource({samples, options, candidates, examined, rankDeficientCandidates,
    unexecutableCandidates, fullLibraryRank, robustWork}, options);
}

function rankFittedSource(source, options) {
  const {samples, examined, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, robustWork} = source;
  // Keep the private fits in their original enumeration order. Sorting a prior
  // ranked list would change the stable tie-break when a new noise floor ties it.
  const candidates = source.candidates.map(model => ({...model,
    terms: model.terms.map(term => ({...term})),
    domain: Object.fromEntries(fields.map(key => [key, {...model.domain[key]}])),
    metrics: {...model.metrics, score: samples.length * Math.log(Math.max(
      options.loss === 'soft_l1' ? model.metrics.robust.meanLoss : model.metrics.rmse ** 2,
      options.noiseSigma ** 2)) + model.terms.length * Math.log(samples.length)},
  }));
  candidates.sort((a, b) => a.metrics.score - b.metrics.score || a.terms.length - b.terms.length);
  const selected = candidates[0];
  const competitive = candidates.filter(model => model.metrics.score - selected.metrics.score <= options.ambiguityDelta);
  const result = {
    schema: 'worldlaw.discovery/v1', scope: 'finite_library_scalar_torque_structure', units: UNITS,
    selected, candidates, competitive, observations: samples.map(row => ({...row})),
    options: {...options, terms: [...options.terms]},
    diagnostics: {
      examinedCandidates: examined, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, librarySize: options.terms.length,
      rankTolerance: RANK_TOLERANCE, selectionAmbiguous: competitive.length > 1 || fullLibraryRank < options.terms.length,
      identifiability: fullLibraryRank < options.terms.length ? 'insufficient_excitation' :
        selected.metrics.conditionEstimate > 1e4 ? 'weak_numerical_conditioning' : 'finite_library_local_only',
      competitiveCount: competitive.length, trainingRmseInNoiseUnits: selected.metrics.rmse / options.noiseSigma,
      adequacy: selected.metrics.rmse > 3 * options.noiseSigma ? 'residual_mismatch' : 'not_falsified_on_training',
      scoreMethod: options.loss === 'soft_l1' ? 'n*log(max(mean_soft_l1_loss,noise_sigma^2))+term_count*log(n)' : 'n*log(max(training_mse,noise_sigma^2))+term_count*log(n)',
      conditionEstimateMeaning: 'ratio_of_scaled_QR_diagonal_extremes_not_exact_condition_number',
      limitations: [
        'Only structures expressible by the supplied finite term library are searched.',
        'noiseSigma is a caller assumption; rankings and ambiguity depend on it.',
        'Competitive-model spread is not calibrated predictive uncertainty.',
        'Training fit does not establish physical validity or held-out performance.',
        'No passivity, friction-sign, or mechanism-topology constraints are imposed.',
        'Rank-deficient structures are not executable hypotheses; additional pilot excitation may be needed.',
        ...(options.loss === 'soft_l1' ? [
          'The chosen soft-L1 scale reduces large-residual influence; it does not identify which readings are wrong.',
          'Raw RMSE and adequacy retain every original reading, including reduced-weight residuals.',
          'The soft-L1 complexity score is a ranking heuristic, not likelihood or calibrated confidence.',
          'Large coordinate leverage, coherent omitted physics and majority contamination can still mislead this estimator.',
        ] : []),
      ],
      ...(options.loss === 'soft_l1' ? {robustWorkReserved:robustWork,robustWorkLimit:SOFT_L1_MAX_WORK} : {}),
    },
  };
  if (options.loss !== 'soft_l1') fittedSources.set(result, source);
  return result;
}

/** Reuse only private least-squares fits with identical source and library. */
export function refitDiscovery(discovery, requestedOptions = {}) {
  requireThat(discovery?.schema === 'worldlaw.discovery/v1', 'Expected a discovery result.');
  const samples = rows(discovery.observations, 8), options = normalizeOptions(requestedOptions);
  const source = fittedSources.get(discovery);
  if (source && options.loss !== 'soft_l1' && source.options.loss !== 'soft_l1'
    && options.maxTerms === source.options.maxTerms
    && options.terms.length === source.options.terms.length
    && options.terms.every((term, i) => term === source.options.terms[i])
    && samples.length === source.samples.length
    && samples.every((row, i) => observedFields.every(key => Object.is(row[key], source.samples[i][key])))) {
    return rankFittedSource(source, options);
  }
  return discover(samples, options);
}

export function planExperiment(discovery, candidateInputs) {
  requireThat(discovery?.schema === 'worldlaw.discovery/v1' && Array.isArray(discovery.competitive) && discovery.competitive.length,
    'Expected a discovery result.');
  requireThat(Array.isArray(candidateInputs) && candidateInputs.length > 0 && candidateInputs.length <= LIMIT,
    `Provide one to ${LIMIT} candidate inputs.`);
  const models = discovery.competitive;
  models.forEach(checkedTerms);
  const ranked = candidateInputs.map((row, index) => {
    const point = input(row);
    const predictions = models.map(model => ({ modelId: model.id, value: predictUnchecked(model, point) }));
    const values = predictions.map(p => p.value);
    const disagreement = Math.max(...values) - Math.min(...values);
    const extrapolation = fields.filter(key => discovery.selected.domain &&
      (point[key] < discovery.selected.domain[key].min || point[key] > discovery.selected.domain[key].max));
    return { index, input: point, disagreement, predictions, extrapolation };
  }).sort((a, b) => b.disagreement - a.disagreement || a.index - b.index);
  return { status: models.length > 1 && ranked[0].disagreement > 2 * discovery.options.noiseSigma ? 'proposed' : 'uninformative',
    selected: ranked[0], ranked, modelIds: models.map(model => model.id),
    method: 'maximum_competitive_model_prediction_range',
    interpretation: 'A heuristic among caller-permitted inputs; no physical actuation is performed.' };
}

export function revise(discovery, newObservations) {
  requireThat(discovery?.schema === 'worldlaw.discovery/v1', 'Expected a discovery result.');
  const added = rows(newObservations, 1);
  const before = evaluate(discovery.selected, added);
  const next = discover([...discovery.observations, ...added], discovery.options);
  return { ...next, revision: { previousModelId: discovery.selected.id, addedCount: added.length, before } };
}

/** Execute learned dynamics θ'=ω, ω'=τ/I using fixed-step classical RK4. */
export function simulate(model, initial, { duration = 4, dt = 0.01, inertia = 1, command = 0 } = {}) {
  checkedTerms(model);
  finite(duration, 'duration', 1000); finite(dt, 'dt', 1); finite(inertia, 'inertia', 1e12); finite(command, 'command', 1e6);
  requireThat(duration > 0 && dt > 0 && inertia > 0 && Math.ceil(duration / dt) <= 10000,
    'Simulation needs positive duration, dt and inertia, with at most 10000 steps.');
  let position = finite(initial?.position, 'initial.position', 1e6), rate = finite(initial?.rate, 'initial.rate', 1e6), time = 0;
  const state = () => ({time, position, rate, jointTorque: predict(model, {command, position, rate})});
  const trajectory = [state()];
  const derivative = (p, v) => ({p: v, v: predict(model, {command, position:p, rate:v}) / inertia});
  const steps = Math.ceil(duration / dt);
  for (let i = 0; i < steps; ++i) {
    const h = Math.min(dt, duration - time);
    const a = derivative(position, rate), b = derivative(position+h*a.p/2, rate+h*a.v/2);
    const c = derivative(position+h*b.p/2, rate+h*b.v/2), d = derivative(position+h*c.p, rate+h*c.v);
    position += h*(a.p+2*b.p+2*c.p+d.p)/6; rate += h*(a.v+2*b.v+2*c.v+d.v)/6;
    time = i === steps-1 ? duration : (i+1)*dt;
    trajectory.push(state());
  }
  return trajectory;
}



