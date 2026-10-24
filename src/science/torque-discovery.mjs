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
  { id: 'cubic', label: 'θ³', coefficientUnit: 'N·m/rad³', optional: true },
].map(Object.freeze));
export const DEFAULT_TERMS = Object.freeze(TERMS.filter(term => !term.optional).map(term => term.id));
export const UNITS = Object.freeze({command:'N·m', position:'rad', rate:'rad/s', jointTorque:'N·m'});
const ids = TERMS.map(t => t.id);
const LIMIT = 4096;
import {fitLinearColumns as fit, linearColumnRank as libraryRank, RANK_TOLERANCE} from './linear-fit.mjs';
const fields = ['command', 'position', 'rate'];

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
    case 'rate': return row.rate;
    case 'coulomb': return Math.sign(row.rate);
    case 'spring': return row.position;
    case 'gravity': return Math.sin(row.position);
    case 'cubic': return row.position ** 3;
    case 'quadratic': return row.rate * Math.abs(row.rate);
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
  return result;
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
    const fitted = fit(indices.map(index => columns[index]), target);
    if (!fitted) { rankDeficientCandidates++; continue; }
    // An irrelevant, almost-zero feature can demand an enormous coefficient.
    // Reject that candidate without discarding other well-defined structures.
    if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) { unexecutableCandidates++; continue; }
    const terms = indices.map((index, j) => ({ id: options.terms[index], coefficient: fitted.coefficients[j] }));
    const model = {
      schema: 'worldlaw.torque-model/v1', id: terms.map(term => term.id).join('+') || 'zero', terms, units: UNITS, domain,
      equation: 'τ = ' + (terms.map(term => `${Number(term.coefficient.toPrecision(5))}·${TERMS.find(t => t.id === term.id).label}`).join(' + ') || '0'),
    };
    const evaluation = evaluate(model, samples);
    // This noise-floor information criterion is a ranking heuristic. It is not
    // a posterior, a confidence interval, or evidence of absolute model adequacy.
    const score = samples.length * Math.log(Math.max(evaluation.rmse ** 2, options.noiseSigma ** 2)) + terms.length * Math.log(samples.length);
    model.metrics = { count: samples.length, rmse: evaluation.rmse, maxAbsResidual: evaluation.maxAbsResidual,
      score, conditionEstimate: fitted.conditionEstimate, rank: terms.length };
    candidates.push(model);
  }
  requireThat(candidates.length, 'No estimable model in the candidate library.', 'unidentifiable');
  // Stable order exposes library-order tie breaking: a tied selection is not a
  // claim that one observationally equivalent physical explanation is correct.
  candidates.sort((a, b) => a.metrics.score - b.metrics.score || a.terms.length - b.terms.length);
  const selected = candidates[0];
  const competitive = candidates.filter(model => model.metrics.score - selected.metrics.score <= options.ambiguityDelta);
  const fullLibraryRank = libraryRank(columns);
  return {
    schema: 'worldlaw.discovery/v1', scope: 'finite_library_scalar_torque_structure', units: UNITS,
    selected, candidates, competitive, observations: samples, options,
    diagnostics: {
      examinedCandidates: examined, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, librarySize: options.terms.length,
      rankTolerance: RANK_TOLERANCE, selectionAmbiguous: competitive.length > 1 || fullLibraryRank < options.terms.length,
      identifiability: fullLibraryRank < options.terms.length ? 'insufficient_excitation' :
        selected.metrics.conditionEstimate > 1e4 ? 'weak_numerical_conditioning' : 'finite_library_local_only',
      competitiveCount: competitive.length, trainingRmseInNoiseUnits: selected.metrics.rmse / options.noiseSigma,
      adequacy: selected.metrics.rmse > 3 * options.noiseSigma ? 'residual_mismatch' : 'not_falsified_on_training',
      scoreMethod: 'n*log(max(training_mse,noise_sigma^2))+term_count*log(n)',
      conditionEstimateMeaning: 'ratio_of_scaled_QR_diagonal_extremes_not_exact_condition_number',
      limitations: [
        'Only structures expressible by the supplied finite term library are searched.',
        'noiseSigma is a caller assumption; rankings and ambiguity depend on it.',
        'Competitive-model spread is not calibrated predictive uncertainty.',
        'Training fit does not establish physical validity or held-out performance.',
        'No passivity, friction-sign, or mechanism-topology constraints are imposed.',
        'Rank-deficient structures are not executable hypotheses; additional pilot excitation may be needed.',
      ],
    },
  };
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
