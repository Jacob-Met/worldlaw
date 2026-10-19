/**
 * Screen an existing trajectory recommendation for RK4 step sensitivity.
 * The established planner owns the grid and ranking. This adapter neither
 * acquires evidence nor re-ranks designs after discarding unstable models.
 */
import {rolloutWithResolution} from '../trajectory/resolution.mjs';
import {UNITS} from '../science/torque-discovery.mjs';

export const QUALIFICATION_SCHEMA = 'worldlaw.trajectory-plan-qualification/v1';
export class TrajectoryPlanQualificationError extends Error {
  constructor(message, code = 'invalid_plan') {super(message); this.name = 'TrajectoryPlanQualificationError'; this.code = code;}
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireThat = (condition, message, code) => {if (!condition) throw new TrajectoryPlanQualificationError(message, code);};
function finite(value, name, low, high, code = 'invalid_plan') {
  requireThat(typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high, `${name} must be finite between ${low} and ${high}.`, code);
  return value;
}
function integer(value, name, low, high, code) {
  finite(value, name, low, high, code); requireThat(Number.isInteger(value), `${name} must be an integer.`, code); return value;
}
function fingerprint(value) {
  const serialized = JSON.stringify(value); let hash = 14695981039346656037n;
  for (let i = 0; i < serialized.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(serialized.charCodeAt(i))) * 1099511628211n);
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
function options(raw) {
  requireThat(object(raw) && Object.keys(raw).every(key => ['maxTotalSteps', 'absoluteToleranceRad', 'relativeTolerance'].includes(key)),
    'Supply numerical screening settings only; no observation or challenge data is accepted.', 'invalid_options');
  return {
    maxTotalSteps: integer(raw.maxTotalSteps ?? 750000, 'maxTotalSteps', 1, 3000000, 'invalid_options'),
    absoluteToleranceRad: finite(raw.absoluteToleranceRad ?? .0001, 'absoluteToleranceRad', 0, 1, 'invalid_options'),
    relativeTolerance: finite(raw.relativeTolerance ?? .1, 'relativeTolerance', 0, 1, 'invalid_options'),
  };
}
function ensemble(discovery, plan) {
  requireThat(object(discovery) && discovery.schema === 'worldlaw.discovery/v1' && object(discovery.units) &&
    Object.entries(UNITS).every(([key, unit]) => discovery.units[key] === unit),
    'This adapter qualifies known-inertia torque plans only.', 'invalid_discovery');
  requireThat(Array.isArray(discovery.candidates) && discovery.candidates.length >= 1 && discovery.candidates.length <= 128 &&
    Array.isArray(discovery.competitive) && discovery.competitive.length >= 1 && discovery.competitive.length <= 128,
    'Supply the original bounded training candidate and competitive sets.', 'invalid_discovery');
  const competitiveIds = new Set(Array.from(discovery.competitive, model => model?.id));
  requireThat(competitiveIds.size === discovery.competitive.length && !competitiveIds.has(undefined), 'Competitive model IDs must be unique.', 'invalid_discovery');
  const ranked = discovery.candidates.filter(model => competitiveIds.has(model?.id));
  requireThat(ranked.length === competitiveIds.size, 'Competitive models must belong to the training candidate list.', 'invalid_discovery');
  const count = integer(plan.options.maxModels, 'plan maxModels', 1, 16);
  const models = ranked.slice(0, count).map(model => {
    requireThat(object(model) && model.schema === 'worldlaw.torque-model/v1' && typeof model.id === 'string' &&
      model.id.length >= 1 && model.id.length <= 240 && Array.isArray(model.terms) && model.terms.length <= 7,
      'The plan must reference executable torque models.', 'invalid_discovery');
    return {schema: model.schema, id: model.id, terms: Array.from(model.terms, term => {
      requireThat(object(term) && typeof term.id === 'string' && term.id.length <= 32, 'Invalid model term.', 'invalid_discovery');
      return {id: term.id, coefficient: finite(term.coefficient, 'coefficient', -1e18, 1e18, 'invalid_discovery')};
    })};
  });
  const declared = Array.isArray(discovery.trainingRuns) ? discovery.trainingRuns : discovery.diagnostics?.derivation;
  requireThat(Array.isArray(declared) && declared.length >= 1 && declared.length <= 8, 'Training run identities are required.', 'invalid_discovery');
  const trainingRunIds = Array.from(declared, run => run?.id ?? run?.runId);
  requireThat(trainingRunIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 160) &&
    new Set(trainingRunIds).size === trainingRunIds.length, 'Training run identities must be unique nonempty strings.', 'invalid_discovery');
  requireThat(object(plan.provenance) && JSON.stringify(plan.provenance.modelIds) === JSON.stringify(models.map(model => model.id)) &&
    plan.provenance.modelFingerprint === fingerprint(models) && JSON.stringify(plan.provenance.trainingRunIds) === JSON.stringify(trainingRunIds),
    'The plan belongs to a different training model revision; plan again before screening.', 'stale_plan');
  return {models, trainingRunIds};
}
function schedule(plan) {
  const duration = finite(plan.options.duration, 'duration', .1, 30);
  const sampleInterval = finite(plan.options.sampleInterval, 'sampleInterval', .005, 1);
  const maxStep = finite(plan.options.maxStep, 'maxStep', .0001, .1);
  const ratio = duration / sampleInterval, intervals = Math.round(ratio);
  requireThat(intervals >= 1 && intervals <= 2000 && Math.abs(ratio - intervals) <= 32 * Number.EPSILON * Math.max(1, ratio),
    'The plan needs 2–2001 uniformly scheduled samples.');
  // Match the original planner's relative timestamp convention exactly.
  const times = Array.from({length: intervals + 1}, (_, i) => i === intervals ? duration : Number((i * sampleInterval).toFixed(12)));
  let coarseSteps = 0, refinedSteps = 0;
  for (let i = 1; i < times.length; i++) {
    coarseSteps += Math.max(1, Math.ceil((times[i] - times[i - 1]) / maxStep));
    refinedSteps += Math.max(1, Math.ceil((times[i] - times[i - 1]) / (maxStep / 2)));
  }
  requireThat(Number.isSafeInteger(coarseSteps + refinedSteps) && coarseSteps + refinedSteps <= 1000000,
    'One coarse/refined comparison exceeds the solver step limit.', 'resource_limit');
  return {times, maxStep, coarseSteps, refinedSteps, combinedSteps: coarseSteps + refinedSteps};
}
function validateDesign(row, plan) {
  requireThat(object(row) && ['evaluated', 'ineligible'].includes(row.status), 'Plan rows need a supported evaluation status.');
  integer(row.index, 'design index', 0, 80);
  finite(row.initialPosition, 'initialPosition', -1e4, 1e4); finite(row.initialRate, 'initialRate', -1e4, 1e4);
  for (const key of ['duration', 'sampleInterval', 'inertia', 'command']) requireThat(row[key] === plan.options[key], `The ${key} design setting differs from the plan.`, 'stale_plan');
  if (row.status === 'evaluated') finite(row.disagreementRad, 'disagreementRad', 0, 2e6);
}
function score(rows) {
  const count = rows[0].length - 1, models = rows.length;
  if (models < 2) return 0;
  let norm = 0;
  for (let i = 1; i <= count; i++) for (let a = 0; a < models; a++) for (let b = a + 1; b < models; b++) {
    norm = Math.hypot(norm, rows[a][i].predicted - rows[b][i].predicted);
  }
  return norm / Math.sqrt(count * models * (models - 1) / 2);
}
function pairwiseSensitivity(checks) {
  if (checks.length < 2) return 0;
  let norm = 0, pairs = 0;
  for (let a = 0; a < checks.length; a++) for (let b = a + 1; b < checks.length; b++) {
    norm = Math.hypot(norm, checks[a].positionRMSEDifference + checks[b].positionRMSEDifference); pairs++;
  }
  return norm / Math.sqrt(pairs);
}

/**
 * Accept only a previously computed plan and its training discovery. Future
 * positions, held-out errors and instrument truth are never read. Qualification
 * is a sensitivity screen, not convergence, feasibility or physical validation.
 */
export function qualifyTrajectoryPlan(discovery, plan, requestedOptions = {}) {
  const settings = options(requestedOptions);
  requireThat(object(plan) && plan.schema === 'worldlaw.trajectory-plan/v1' && plan.method === 'rms_pairwise_position_disagreement' &&
    object(plan.options) && Array.isArray(plan.ranked) && plan.ranked.length >= 1 && plan.ranked.length <= 81,
    'Supply a computed finite trajectory plan.');
  requireThat(['proposed', 'uninformative', 'no_feasible_design'].includes(plan.status), 'Unsupported planner status.');
  finite(plan.options.inertia, 'inertia', 1e-12, 1e12); finite(plan.options.command, 'command', -1e4, 1e4);
  const threshold = finite(plan.options.minDisagreement, 'minDisagreement', 0, 1e6);
  const {models, trainingRunIds} = ensemble(discovery, plan), scheduled = schedule(plan);
  const designs = Array.from(plan.ranked, row => {validateDesign(row, plan); return row;});
  requireThat(new Set(designs.map(row => row.index)).size === designs.length, 'Design indices must be unique.');
  if (plan.selected !== null) {
    const selectedRow = designs.find(row => row.index === plan.selected?.index);
    requireThat(selectedRow?.status === 'evaluated' && ['initialPosition', 'initialRate', 'duration', 'sampleInterval', 'inertia', 'command', 'disagreementRad']
      .every(key => plan.selected[key] === selectedRow[key]), 'The selected design does not match its ranked plan row.', 'stale_plan');
  } else requireThat(plan.status === 'no_feasible_design', 'Only a no-feasible-design plan may omit its selection.');
  const evaluatedCount = designs.filter(row => row.status === 'evaluated').length;
  const informativeSelection = models.length >= 2 && plan.selected !== null && plan.selected.disagreementRad > threshold;
  requireThat(plan.status === 'proposed' ? informativeSelection : plan.status === 'uninformative' ?
    plan.selected !== null && !informativeSelection : plan.selected === null && evaluatedCount === 0,
    'Planner status does not match its model count, selected score, threshold, or eligible designs.', 'invalid_plan');
  const reservedSteps = evaluatedCount * models.length * scheduled.combinedSteps;
  requireThat(Number.isSafeInteger(reservedSteps) && reservedSteps <= settings.maxTotalSteps,
    `Screening the complete evaluated grid needs ${reservedSteps} RK4 steps; the limit is ${settings.maxTotalSteps}. No partial screening was performed.`, 'resource_limit');

  let attemptedComparisons = 0, completedComparisons = 0;
  const candidateQualifications = designs.map(design => {
    if (design.status === 'ineligible') return {index: design.index, status: 'ineligible', reason: 'original_planner_refusal', modelChecks: [], pairwiseSensitivityRad: null};
    const run = {id: `unobserved-screen-${design.index}`, label: 'Unobserved numerical screening schedule', kind: 'synthetic',
      source: {label: 'Private prediction placeholders; no acquired observations'}, inertia: design.inertia, initialRate: design.initialRate,
      samples: scheduled.times.map(time => ({time, position: design.initialPosition, command: design.command}))};
    const predictions = [], modelChecks = [];
    for (const model of models) {
      attemptedComparisons++;
      try {
        const received = rolloutWithResolution(model, run, {maxStep: scheduled.maxStep, maxSteps: scheduled.combinedSteps});
        const resolution = received.resolution;
        if (resolution.status !== 'compared') {
          modelChecks.push({modelId: model.id, status: 'unavailable', reason: resolution.reason, failure: resolution.failure ?? null});
        } else {
          completedComparisons++; predictions.push(received.rollout.rows);
          modelChecks.push({modelId: model.id, status: 'compared', positionRMSEDifference: resolution.positionRMSEDifference,
            maxAbsPositionDifference: resolution.maxAbsPositionDifference, combinedSteps: resolution.combinedSteps});
        }
      } catch (error) {
        modelChecks.push({modelId: model.id, status: 'failed', failure: {code: error.code ?? 'prediction_failed', message: error.message ?? String(error)}});
      }
    }
    const common = {index: design.index, disagreementRad: design.disagreementRad, modelChecks, pairwiseSensitivityRad: null};
    if (modelChecks.some(check => check.status !== 'compared')) return {...common, status: 'numerically_unresolved', reason: 'not_all_models_compared'};
    const recomputedDisagreementRad = score(predictions);
    if (Math.abs(recomputedDisagreementRad - design.disagreementRad) > 1e-10 * Math.max(1, design.disagreementRad)) {
      return {...common, status: 'numerically_unresolved', reason: 'plan_prediction_mismatch', recomputedDisagreementRad};
    }
    const sensitivity = pairwiseSensitivity(modelChecks);
    const allowanceRad = settings.absoluteToleranceRad + settings.relativeTolerance * design.disagreementRad;
    const thresholdMarginRad = design.disagreementRad - threshold;
    const thresholdStable = thresholdMarginRad <= 0 || thresholdMarginRad > sensitivity;
    const passes = sensitivity <= allowanceRad && thresholdStable;
    return {...common, status: passes ? 'screen_passed' : 'numerically_unresolved',
      reason: sensitivity > allowanceRad ? 'step_sensitivity_exceeds_allowance' : !thresholdStable ? 'proposal_threshold_sensitive' : null,
      pairwiseSensitivityRad: sensitivity, allowanceRad, thresholdMarginRad, recomputedDisagreementRad};
  });
  const selectedQualification = plan.selected ? candidateQualifications.find(row => row.index === plan.selected.index) : null;
  const status = plan.status !== 'proposed' ? 'no_proposal' : selectedQualification?.status === 'screen_passed' ? 'screen_passed' : 'numerically_unresolved';
  return {schema: QUALIFICATION_SCHEMA, status, selectedQualification, candidateQualifications, options: settings,
    selectionBasis: 'unchanged_training_only_plan', recommendationChanged: false,
    provenance: {trainingRunIds, modelIds: models.map(model => model.id), modelFingerprint: plan.provenance.modelFingerprint},
    diagnostics: {evaluatedDesignCount: evaluatedCount, comparedModelCount: models.length, attemptedComparisons, completedComparisons,
      reservedSteps, maxTotalSteps: settings.maxTotalSteps, coarseMaxStep: scheduled.maxStep, refinedMaxStep: scheduled.maxStep / 2,
      originalPlanStatus: plan.status, predictionsAreObservations: false, acquisitionPerformed: false,
      criterion: 'Pairwise RMS two-step sensitivity <= absolute allowance + relative allowance * score, and a proposed score clears its threshold by more than that sensitivity.',
      sensitivityMeaning: 'Upper bound on change of the sampled pairwise RMS disagreement between these two executions; not a bound on true integration error.',
      limitations: ['Passing two step sizes is a numerical sensitivity screen, not convergence, physical validity, calibrated uncertainty or detection power.',
        'Both steps can share numerical bias or miss stiff dynamics and discontinuities.',
        'Only the original scheduled timestamps are compared; between-sample excursions and aliasing remain possible.',
        'Original envelope checks cover the original scheduled predictions; this screen does not establish continuous or refined-rate feasibility.',
        'The original training shortlist remains fixed. Omitted competitive models and absent true dynamics can change the recommendation.',
        'No failed or unchecked model is dropped to form a survivor-only disagreement score.',
        'The original plan and ranking are unchanged; an unresolved recommendation needs a new plan with a smaller step or a different declared design.']}};
}
