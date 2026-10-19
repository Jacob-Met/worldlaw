/** Training-only trajectory experiment design. No observation or instrument acquisition. */
import {rollout} from './forward.mjs';
import {TERMS, UNITS} from '../science/torque-discovery.mjs';
const TERM_IDS = new Set(TERMS.map(term => term.id));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class TrajectoryPlanningError extends Error {
  constructor(message, code = 'invalid_design') {super(message); this.name = 'TrajectoryPlanningError'; this.code = code;}
}
const insist = (condition, message, code) => {if (!condition) throw new TrajectoryPlanningError(message, code);};
function finite(value, label, low, high) {
  insist(typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high, `${label} must be finite between ${low} and ${high}.`);
  return Object.is(value, -0) ? 0 : value;
}
function integer(value, label, low, high) {finite(value, label, low, high); insist(Number.isInteger(value), `${label} must be an integer.`); return value;}
function text(value, label, max = 240) {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} must be nonempty text up to ${max} characters.`, 'invalid_discovery');
  return value.trim();
}
function range(value, label, bound = 1e4) {
  insist(record(value), `Supply explicit ${label} minimum and maximum.`);
  const min = finite(value.min, `${label}.min`, -bound, bound), max = finite(value.max, `${label}.max`, -bound, bound);
  insist(max >= min, `${label}.max must be at least min.`); return {min, max};
}
function settings(raw) {
  insist(record(raw), 'Supply an explicit design with known inertia and permitted release bounds.');
  const allowed = ['inertia', 'bounds', 'duration', 'sampleInterval', 'command', 'positionCount', 'rateCount', 'maxModels', 'maxStep', 'maxTotalSteps', 'predictionBounds', 'minDisagreement'];
  insist(Object.keys(raw).every(key => allowed.includes(key)), 'Unsupported design field; challenge observations and instrument truth are not planner inputs.');
  insist(record(raw.bounds), 'Supply initialPosition and initialRate bounds.');
  const result = {inertia: finite(raw.inertia, 'Known inertia (kg·m²)', 1e-12, 1e12),
    bounds: {initialPosition: range(raw.bounds.initialPosition, 'initialPosition'), initialRate: range(raw.bounds.initialRate, 'initialRate')},
    duration: finite(raw.duration ?? 8, 'duration (s)', .1, 30), sampleInterval: finite(raw.sampleInterval ?? .04, 'sampleInterval (s)', .005, 1),
    command: finite(raw.command ?? 0, 'constant command (N·m)', -1e4, 1e4),
    positionCount: integer(raw.positionCount ?? 9, 'positionCount', 1, 17), rateCount: integer(raw.rateCount ?? 3, 'rateCount', 1, 9),
    maxModels: integer(raw.maxModels ?? 8, 'maxModels', 1, 16), maxStep: finite(raw.maxStep ?? .01, 'maxStep (s)', .0001, .1),
    maxTotalSteps: integer(raw.maxTotalSteps ?? 250000, 'maxTotalSteps', 1, 2000000),
    minDisagreement: finite(raw.minDisagreement ?? .01, 'minDisagreement (rad)', 0, 1e6), predictionBounds: null};
  const ratio = result.duration / result.sampleInterval, intervals = Math.round(ratio);
  insist(Math.abs(ratio - intervals) <= 32 * Number.EPSILON * Math.max(1, ratio), 'duration must contain a whole number of sample intervals.');
  insist(intervals >= 1 && intervals <= 2000, 'Each design needs 2–2001 scheduled samples.', 'resource_limit');
  if (raw.predictionBounds !== undefined) {
    insist(record(raw.predictionBounds), 'predictionBounds must contain position and rate ranges.');
    result.predictionBounds = {position: range(raw.predictionBounds.position, 'predicted position', 1e6), rate: range(raw.predictionBounds.rate, 'predicted rate', 1e6)};
  }
  return result;
}
function copyModel(raw) {
  insist(record(raw) && raw.schema === 'worldlaw.torque-model/v1' && Array.isArray(raw.terms) && raw.terms.length <= TERM_IDS.size,
    'Planner requires executable known-inertia torque candidates.', 'invalid_discovery');
  const seen = new Set();
  const terms = Array.from(raw.terms, term => {
    insist(record(term) && TERM_IDS.has(term.id) && !seen.has(term.id) && Number.isFinite(term.coefficient) && Math.abs(term.coefficient) <= 1e18,
      'Candidate terms must have distinct known IDs and finite executable coefficients.', 'invalid_discovery');
    seen.add(term.id); return {id: term.id, coefficient: term.coefficient};
  });
  if (raw.units !== undefined) insist(record(raw.units) && Object.entries(UNITS).every(([key, value]) => raw.units[key] === value),
    'Candidate units conflict with known-inertia torque semantics.', 'invalid_discovery');
  return {schema: 'worldlaw.torque-model/v1', id: text(raw.id, 'Model id'), terms};
}
function ensemble(discovery, maximum) {
  insist(record(discovery) && discovery.schema === 'worldlaw.discovery/v1' && record(discovery.units) &&
    Object.entries(UNITS).every(([key, value]) => discovery.units[key] === value),
    'Supply a training-derived torque discovery; angular-only models require a separate planner.', 'invalid_discovery');
  insist(Array.isArray(discovery.candidates) && discovery.candidates.length >= 1 && discovery.candidates.length <= 128 &&
    Array.isArray(discovery.competitive) && discovery.competitive.length >= 1 && discovery.competitive.length <= 128,
    'Supply bounded training-ranked candidates and a nonempty competitive set.', 'invalid_discovery');
  const competitiveIds = new Set(Array.from(discovery.competitive, model => text(model?.id, 'Competitive model id')));
  insist(competitiveIds.size === discovery.competitive.length, 'Competitive model ids must be unique.', 'invalid_discovery');
  const ids = Array.from(discovery.candidates, model => text(model?.id, 'Candidate model id'));
  insist(new Set(ids).size === ids.length && Array.from(competitiveIds).every(id => ids.includes(id)), 'Competitive models must belong to the unique ranked candidate list.', 'invalid_discovery');
  const ranked = discovery.candidates.filter(model => competitiveIds.has(model.id));
  const models = ranked.slice(0, maximum).map(copyModel);
  const declaredTraining = Array.isArray(discovery.trainingRuns) ? discovery.trainingRuns : discovery.diagnostics?.derivation;
  insist(Array.isArray(declaredTraining) && declaredTraining.length >= 1 && declaredTraining.length <= 8,
    'A planner needs declared training-run identities; no observed futures are inferred.', 'missing_training_provenance');
  const trainingRunIds = Array.from(declaredTraining, run => text(run?.id ?? run?.runId, 'Training run id', 160));
  insist(new Set(trainingRunIds).size === trainingRunIds.length, 'Training run ids must be unique.', 'invalid_discovery');
  return {models, trainingRunIds, competitiveCount: ranked.length};
}
function grid(range, count) {
  if (range.min === range.max) return [range.min];
  if (count === 1) return [(range.min + range.max) / 2];
  return Array.from({length: count}, (_, i) => i === count - 1 ? range.max : range.min + (range.max - range.min) * i / (count - 1));
}
function fingerprint(value) {
  const serialized = JSON.stringify(value); let hash = 14695981039346656037n;
  for (let i = 0; i < serialized.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(serialized.charCodeAt(i))) * 1099511628211n);
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
function spread(predictions) {
  const count = predictions[0].rows.length - 1, modelCount = predictions.length;
  if (modelCount < 2) return {disagreementRad: 0, maxPositionRangeRad: 0};
  let total = 0, maximum = 0;
  for (let i = 1; i <= count; i++) {
    const values = predictions.map(prediction => prediction.rows[i].position);
    maximum = Math.max(maximum, Math.max(...values) - Math.min(...values));
    for (let a = 0; a < modelCount; a++) for (let b = a + 1; b < modelCount; b++) total = Math.hypot(total, values[a] - values[b]);
  }
  return {disagreementRad: total / Math.sqrt(count * modelCount * (modelCount - 1) / 2), maxPositionRangeRad: maximum};
}
function outside(row, bounds) {
  return row.predicted < bounds.position.min || row.predicted > bounds.position.max || row.rate < bounds.rate.min || row.rate > bounds.rate.max;
}
/** No acquisition is performed. Only candidate predictions, never observed futures, score designs. */
export function planTrajectoryExperiment(discovery, requestedDesign) {
  const options = settings(requestedDesign), {models, trainingRunIds, competitiveCount} = ensemble(discovery, options.maxModels);
  const positions = grid(options.bounds.initialPosition, options.positionCount), rates = grid(options.bounds.initialRate, options.rateCount);
  const designCount = positions.length * rates.length;
  insist(designCount <= 81, 'At most 81 distinct release designs are supported.', 'resource_limit');
  const intervals = Math.round(options.duration / options.sampleInterval);
  const times = Array.from({length: intervals + 1}, (_, i) => i === intervals ? options.duration : Number((i * options.sampleInterval).toFixed(12)));
  let stepsPerRollout = 0;
  for (let i = 1; i < times.length; i++) {
    const steps = Math.max(1, Math.ceil((times[i] - times[i - 1]) / options.maxStep));
    insist(Number.isSafeInteger(steps), 'Scheduled integration steps exceed numerical range.', 'resource_limit'); stepsPerRollout += steps;
  }
  const reservedSteps = stepsPerRollout * designCount * models.length;
  insist(Number.isSafeInteger(reservedSteps) && reservedSteps <= options.maxTotalSteps,
    `The complete design comparison needs ${reservedSteps} RK4 steps; increase maxTotalSteps or reduce designs/models/duration.`, 'resource_limit');
  const ranked = []; let selected = null, bestScore = -1, attemptedRollouts = 0, completedRollouts = 0;
  for (const initialPosition of positions) for (const initialRate of rates) {
    const index = ranked.length;
    const design = {index, initialPosition, initialRate, duration: options.duration, sampleInterval: options.sampleInterval, inertia: options.inertia, command: options.command};
    // Private scheduling adapter: post-initial position placeholders are unused
    // by rollout dynamics. They are NEVER emitted as observed/acquired evidence.
    const run = {id: `unobserved-design-${index}`, label: 'Unobserved planned release', kind: 'synthetic', inertia: options.inertia, initialRate,
      source: {label: 'Private candidate-prediction schedule, not an acquisition'}, samples: times.map(time => ({time, position: initialPosition, command: options.command}))};
    const predictions = [], failures = [];
    for (const model of models) {
      attemptedRollouts++;
      try {
        const prediction = rollout(model, run, {maxStep: options.maxStep, maxSteps: stepsPerRollout});
        completedRollouts++;
        if (options.predictionBounds && prediction.rows.some(row => outside(row, options.predictionBounds))) {
          failures.push({modelId: model.id, code: 'prediction_bounds', message: 'Candidate prediction at a scheduled sample leaves the caller-declared position/rate envelope.'}); continue;
        }
        predictions.push({modelId: model.id, rows: prediction.rows.map(({time, predicted, rate}) => ({time, position: predicted, rate}))});
      } catch (error) {
        failures.push({modelId: model.id, code: error.code ?? 'prediction_failed', message: error.message ?? String(error)});
      }
    }
    if (failures.length) {ranked.push({...design, status: 'ineligible', disagreementRad: null, maxPositionRangeRad: null, failures}); continue;}
    const score = spread(predictions);
    insist(Number.isFinite(score.disagreementRad) && Number.isFinite(score.maxPositionRangeRad), 'Candidate spread exceeds numerical range.', 'numerical_failure');
    const item = {...design, status: 'evaluated', ...score, failures: []}; ranked.push(item);
    // Strict improvement preserves the original angle-major/rate-minor grid order on exact ties.
    if (score.disagreementRad > bestScore) {
      bestScore = score.disagreementRad;
      selected = {...item, acquisitionRequest: {initialPosition, initialRate, duration: options.duration, sampleInterval: options.sampleInterval}, predictions};
    }
  }
  ranked.sort((a, b) => (a.status === 'evaluated' ? 0 : 1) - (b.status === 'evaluated' ? 0 : 1) ||
    (a.status === 'evaluated' && b.status === 'evaluated' ? b.disagreementRad - a.disagreementRad : 0) || a.index - b.index);
  const status = selected === null ? 'no_feasible_design' : models.length >= 2 && selected.disagreementRad > options.minDisagreement ? 'proposed' : 'uninformative';
  return {schema: 'worldlaw.trajectory-plan/v1', status, method: 'rms_pairwise_position_disagreement', scoreUnits: 'rad',
    selectionBasis: 'training_competitive_models_only', options, selected, ranked,
    provenance: {trainingRunIds, modelIds: models.map(model => model.id), modelFingerprint: fingerprint(models),
      evidenceRevision: fingerprint({trainingRunIds, models}), fingerprintMeaning: 'Deterministic model-and-declared-ID change detector, not cryptographic provenance or source authentication.'},
    diagnostics: {designCount, evaluatedDesignCount: ranked.filter(design => design.status === 'evaluated').length,
      refusedDesignCount: ranked.filter(design => design.status === 'ineligible').length, competitiveModelCount: competitiveCount,
      consideredModelCount: models.length, omittedCompetitiveCount: competitiveCount - models.length,
      modelSelection: 'first_competitive_models_in_original_training_candidate_order', attemptedRollouts, completedRollouts,
      scheduledSamplesPerRollout: times.length, stepsPerRollout, reservedSteps, maxTotalSteps: options.maxTotalSteps,
      budgetMeaning: 'Preflight reserves the complete scheduled workload including potentially failing rollouts; actual early-failure work can be lower.',
      integrationMethod: 'fixed_step_RK4_without_error_bound', initialSampleExcludedFromScore: true,
      predictionBoundsEvaluation: 'scheduled_sample_timestamps_only_no_between_sample_guarantee',
      thresholdMeaning: 'Caller-selected model-spread threshold; not calibrated detection power or sensor uncertainty.',
      rankingReason: selected ? 'Highest finite pairwise position spread among fully evaluable bounded grid designs.' : 'Every design has at least one refused candidate prediction.',
      predictionsAreObservations: false, acquisitionPerformed: false,
      limitations: ['Disagreement is an equal-weight finite-ensemble heuristic, not calibrated entropy, information gain, uncertainty, or an optimal-design guarantee.',
        'Only the declared grid and bounded prefix of training-competitive models are compared; omitted hypotheses may change the ranking.',
        'Model mismatch, shared bias, or missing true dynamics can make confident low-disagreement predictions wrong.',
        'Numerical error, discontinuities and stiffness can affect disagreement; no joint integration error bound is established.',
        'Prediction envelopes are checked only at scheduled sample timestamps. An excursion or disagreement between samples can be missed.',
        'Any considered model failure or caller envelope violation makes the design ineligible; model failure is not an infinite-information observation.',
        'Release/prediction limits are caller-declared computational or design bounds, not authorization or safety limits for physical hardware.',
        'The planner neither observes future outcomes nor acquires evidence. An independent instrument must supply the subsequent complete run.',
        'A new run can improve, preserve, or worsen fitted structure and reserved prediction; more disagreement does not guarantee improvement.']}};
}
