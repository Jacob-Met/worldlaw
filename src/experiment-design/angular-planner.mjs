/** Manual angular recording design, composed with an injected finite-grid planner. */
import {ANGULAR_MODEL_UNITS, ANGULAR_COEFFICIENT_UNITS, ANGULAR_UNITS} from '../trajectory/angular-discovery.mjs';
import {UNITS as NUMERICAL_KERNEL_UNITS} from '../science/torque-discovery.mjs';
import {qualifyTrajectoryPlan} from './qualify-trajectory-plan.mjs';

export const ANGULAR_PLAN_SCHEMA = 'worldlaw.angular-trajectory-plan/v1';
export const ANGULAR_RECORDING_REQUEST_SCHEMA = 'worldlaw.angular-recording-request/v1';
const SCALE_MEANING = 'angular_acceleration_only_absolute_torque_unknown';
const DYNAMICS = 'unforced_scalar_rotation';
const IDS = Object.keys(ANGULAR_COEFFICIENT_UNITS);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
export class AngularPlanningError extends Error {
  constructor(message, code = 'invalid_angular_design') {super(message); this.name = 'AngularPlanningError'; this.code = code;}
}
const insist = (condition, message, code) => {if (!condition) throw new AngularPlanningError(message, code);};
function id(value, label) {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= 160, `${label} needs nonempty text of at most 160 characters.`, 'invalid_angular_discovery');
  return value;
}
function angularUnits(value) {
  return object(value) && Object.keys(value).length === 3 && Object.entries(ANGULAR_MODEL_UNITS).every(([key, unit]) => value[key] === unit);
}
function normalizedModel(model) {
  insist(object(model) && model.schema === 'worldlaw.angular-model/v1' && angularUnits(model.units) &&
    model.scaleMeaning === SCALE_MEANING && model.physicalInertia === null && model.absoluteTorqueIdentified === false &&
    Array.isArray(model.terms) && model.terms.length <= IDS.length,
    'Expected an executable angular-acceleration model with explicitly unknown physical torque scale.', 'invalid_angular_discovery');
  const terms = Array.from(model.terms, term => {
    insist(object(term) && IDS.includes(term.id) && term.coefficientUnit === ANGULAR_COEFFICIENT_UNITS[term.id] &&
      typeof term.coefficient === 'number' && Number.isFinite(term.coefficient) && Math.abs(term.coefficient) <= 1e18,
      'Autonomous angular model terms need their declared angular coefficient units.', 'invalid_angular_discovery');
    return {id: term.id, coefficient: term.coefficient, coefficientUnit: term.coefficientUnit};
  });
  insist(new Set(terms.map(term => term.id)).size === terms.length, 'Angular model terms must be unique.', 'invalid_angular_discovery');
  return {schema: model.schema, id: id(model.id, 'Model id'), terms, units: {...ANGULAR_MODEL_UNITS},
    scaleMeaning: SCALE_MEANING, physicalInertia: null, absoluteTorqueIdentified: false};
}
function normalizedDiscovery(raw) {
  insist(object(raw) && raw.schema === 'worldlaw.angular-discovery/v1' && angularUnits(raw.units) &&
    raw.scaleMeaning === SCALE_MEANING && raw.physicalInertia === null && raw.absoluteTorqueIdentified === false,
    'Supply a training-derived angular discovery with unknown physical inertia.', 'invalid_angular_discovery');
  insist(Array.isArray(raw.candidates) && raw.candidates.length >= 1 && raw.candidates.length <= 64 &&
    Array.isArray(raw.competitive) && raw.competitive.length >= 1 && raw.competitive.length <= 64,
    'Provide bounded training candidates and their competitive set.', 'invalid_angular_discovery');
  const candidates = Array.from(raw.candidates, normalizedModel), byId = new Map(candidates.map(model => [model.id, model]));
  insist(byId.size === candidates.length, 'Training candidate IDs must be unique.', 'invalid_angular_discovery');
  const competitiveIds = Array.from(raw.competitive, model => id(model?.id, 'Competitive model id'));
  insist(new Set(competitiveIds).size === competitiveIds.length && competitiveIds.every(modelId => byId.has(modelId)),
    'Competitive angular models must belong to the training candidate set.', 'invalid_angular_discovery');
  const selectedId = id(raw.selected?.id, 'Selected training model id');
  insist(byId.has(selectedId), 'Selected angular model must belong to the candidate set.', 'invalid_angular_discovery');
  insist(Array.isArray(raw.trainingRuns) && raw.trainingRuns.length >= 1 && raw.trainingRuns.length <= 8,
    'Provide declared angular training-run identities.', 'invalid_angular_discovery');
  const trainingRunIds = Array.from(raw.trainingRuns, run => id(run?.id, 'Training run id'));
  insist(new Set(trainingRunIds).size === trainingRunIds.length, 'Training run IDs must be unique.', 'invalid_angular_discovery');
  const allowedAdequacy = ['residual_mismatch', 'not_falsified_on_training'];
  const adequacy = allowedAdequacy.includes(raw.diagnostics?.adequacy) ? raw.diagnostics.adequacy : 'unknown';
  const trainingDomain = {};
  for (const key of ['position', 'rate']) {
    const range = raw.selected?.domain?.[key];
    trainingDomain[key] = object(range) && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max ?
      {min: range.min, max: range.max} : null;
  }
  return {candidates, competitiveIds, selectedId, trainingRunIds, trainingDomain,
    trainingFit: {adequacy, method: typeof raw.method === 'string' ? raw.method.slice(0, 160) : 'unknown',
      residualUnits: raw.residualUnits === 'rad' ? 'rad' : 'unknown',
      noiseSigma: typeof raw.options?.noiseSigma === 'number' && Number.isFinite(raw.options.noiseSigma) ? raw.options.noiseSigma : null,
      trainingRmseInNoiseUnits: typeof raw.diagnostics?.trainingRmseInNoiseUnits === 'number' &&
        Number.isFinite(raw.diagnostics.trainingRmseInNoiseUnits) && raw.diagnostics.trainingRmseInNoiseUnits >= 0 ? raw.diagnostics.trainingRmseInNoiseUnits : null,
      meaning: 'Training-fit adequacy is carried from discovery. Numerical screening and model disagreement do not establish physical adequacy.'}};
}
function design(raw) {
  const allowed = ['inertia', 'dynamics', 'bounds', 'duration', 'sampleInterval', 'positionCount', 'rateCount',
    'maxModels', 'maxStep', 'maxTotalSteps', 'predictionBounds', 'minDisagreement'];
  insist(object(raw) && raw.inertia === null && raw.dynamics === DYNAMICS,
    'Declare inertia:null and unforced_scalar_rotation; no physical torque scale is inferred.');
  insist(Object.keys(raw).every(key => allowed.includes(key)),
    'Angular designs accept release and recording bounds only; command, torque, and future observations are not inputs.');
  const {inertia, dynamics, ...rest} = raw;
  return rest;
}
function fingerprint(value) {
  const text = JSON.stringify(value); let hash = 14695981039346656037n;
  for (let i = 0; i < text.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 1099511628211n);
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
function rangeCheck(value, domain) {
  const initialFields = ['position', 'rate'].filter(key => domain[key] &&
    (value[key === 'position' ? 'initialPosition' : 'initialRate'] < domain[key].min ||
      value[key === 'position' ? 'initialPosition' : 'initialRate'] > domain[key].max));
  const unknownFields = ['position', 'rate'].filter(key => !domain[key]);
  const predictedFields = value.predictions ? ['position', 'rate'].filter(key => domain[key] && value.predictions.some(prediction =>
    prediction.rows.some(row => row[key] < domain[key].min || row[key] > domain[key].max))) : null;
  return {initialFields, predictedFields, unknownFields,
    meaning: 'Comparison to training state ranges only; neither a physical feasibility assessment nor evidence of model validity outside them.'};
}
function publicDesign(value, domain) {
  if (value === null) return null;
  const fields = pick(value, ['index', 'initialPosition', 'initialRate', 'duration', 'sampleInterval', 'status', 'disagreementRad', 'maxPositionRangeRad']);
  const failures = (value.failures ?? []).map(failure => ({modelId: failure.modelId, code: failure.code,
    message: failure.code === 'prediction_bounds' ? 'An angular prediction leaves the caller-declared sampled position/rate envelope.' :
      'An angular trajectory prediction was refused; the failure code identifies its numerical or resource cause.'}));
  const predictions = value.predictions?.map(prediction => ({modelId: prediction.modelId,
    rows: prediction.rows.map(row => ({time: row.time, position: row.position, rate: row.rate}))}));
  return {...fields, failures, ...(predictions ? {predictions} : {}), inertia: null, trainingRangeCheck: rangeCheck(value, domain)};
}
function recordingRequest(selected, trainingRunIds, trainingFit) {
  return {schema: ANGULAR_RECORDING_REQUEST_SCHEMA, kind: 'requested_protocol_not_observed_evidence',
    units: {...ANGULAR_UNITS}, dynamics: DYNAMICS, inertia: null,
    initialPosition: selected.initialPosition, initialRate: selected.initialRate,
    duration: selected.duration, sampleInterval: selected.sampleInterval,
    initialStateMeaning: 'Requested release target; record the actual starting position and independently supplied or measured initial angular rate.',
    sourceTrainingRunIds: [...trainingRunIds], trainingAdequacy: trainingFit.adequacy,
    trainingRangeCheck: selected.trainingRangeCheck,
    acquisitionPerformed: false, physicalSetupVerified: false,
    requirements: ['Use the same declared apparatus and angular reference as the training recordings; preserve unwrapped position in radians and time in seconds.',
      'The unforced scalar-rotation assumption must be declared by the experimenter; missing actuator data does not verify absence of forcing.',
      'Supply an independently recorded complete run with its own source and recording identity; do not turn forecast positions into observations.',
      'Record calibration, actual initial state and any departure from this requested release or sampling schedule.',
      'The finite release bounds and sampled prediction envelopes are caller declarations, not verified physical feasibility or hardware authorization.']};
}

/**
 * The injected function is the existing owner's finite-grid plan implementation.
 * Only a private normalized numerical proxy reaches it. This mirrors the angular
 * forward adapter: alpha is executed numerically without identifying inertia or
 * torque. The complete public output is rebuilt in angular units before return.
 */
export function createAngularTrajectoryPlanner(basePlanner) {
  insist(typeof basePlanner === 'function', 'Inject the existing finite-grid planner function.', 'invalid_planner');
  return function planAngularTrajectoryExperiment(rawDiscovery, requestedDesign, screeningOptions = {}) {
    const angular = normalizedDiscovery(rawDiscovery), requested = design(requestedDesign);
    const proxyModels = angular.candidates.map(model => ({schema: 'worldlaw.torque-model/v1', id: model.id,
      terms: model.terms.map(({id, coefficient}) => ({id, coefficient})), units: {...NUMERICAL_KERNEL_UNITS}}));
    const byId = new Map(proxyModels.map(model => [model.id, model]));
    const proxy = {schema: 'worldlaw.discovery/v1', units: {...NUMERICAL_KERNEL_UNITS}, selected: byId.get(angular.selectedId),
      candidates: proxyModels, competitive: angular.competitiveIds.map(modelId => byId.get(modelId)),
      trainingRuns: angular.trainingRunIds.map(runId => ({id: runId}))};
    const planned = basePlanner(proxy, {...requested, inertia: 1, command: 0});
    const screened = qualifyTrajectoryPlan(proxy, planned, screeningOptions);
    const models = angular.candidates.filter(model => planned.provenance.modelIds.includes(model.id));
    const provenance = {trainingRunIds: [...angular.trainingRunIds], modelIds: models.map(model => model.id),
      modelFingerprint: fingerprint(models), evidenceRevision: fingerprint({trainingRunIds: angular.trainingRunIds, models}),
      fingerprintMeaning: 'Deterministic angular-model and declared-ID change detector; not cryptographic provenance or source authentication.'};
    const selected = publicDesign(planned.selected, angular.trainingDomain), ranked = planned.ranked.map(row => publicDesign(row, angular.trainingDomain));
    const publicOptions = pick(planned.options, ['duration', 'sampleInterval', 'positionCount', 'rateCount',
      'maxModels', 'maxStep', 'maxTotalSteps', 'minDisagreement']);
    const range = value => ({min: value.min, max: value.max});
    publicOptions.bounds = {initialPosition: range(planned.options.bounds.initialPosition), initialRate: range(planned.options.bounds.initialRate)};
    publicOptions.predictionBounds = planned.options.predictionBounds ?
      {position: range(planned.options.predictionBounds.position), rate: range(planned.options.predictionBounds.rate)} : null;
    const selectedScreenStatus = screened.selectedQualification?.status ?? 'not_evaluated';
    const status = selectedScreenStatus === 'numerically_unresolved' ? 'numerically_unresolved' : planned.status;
    const qualification = {...screened, schema: 'worldlaw.angular-plan-qualification/v1', provenance: {...provenance},
      units: {position: 'rad', rate: 'rad/s', time: 's'}, scaleMeaning: SCALE_MEANING,
      physicalInertia: null, absoluteTorqueIdentified: false};
    return {schema: ANGULAR_PLAN_SCHEMA, status, plannerStatus: planned.status, method: planned.method, scoreUnits: 'rad',
      units: {...ANGULAR_MODEL_UNITS, time: 's'}, scaleMeaning: SCALE_MEANING, physicalInertia: null, absoluteTorqueIdentified: false,
      dynamics: DYNAMICS, selectionBasis: 'training_competitive_angular_models_only',
      options: {...publicOptions, inertia: null, dynamics: DYNAMICS}, selected, ranked, provenance,
      trainingFit: angular.trainingFit, trainingDomain: angular.trainingDomain, qualification,
      recordingRequest: status === 'proposed' ? recordingRequest(selected, angular.trainingRunIds, angular.trainingFit) : null,
      diagnostics: {...pick(planned.diagnostics, ['designCount', 'evaluatedDesignCount', 'refusedDesignCount',
        'competitiveModelCount', 'consideredModelCount', 'omittedCompetitiveCount', 'modelSelection',
        'attemptedRollouts', 'completedRollouts', 'scheduledSamplesPerRollout', 'stepsPerRollout', 'reservedSteps',
        'maxTotalSteps', 'integrationMethod', 'initialSampleExcludedFromScore', 'predictionBoundsEvaluation', 'thresholdMeaning']),
        physicalInertia: null, absoluteTorqueIdentified: false,
        acquisitionPerformed: false, predictionsAreObservations: false, physicalSetupVerified: false,
        numericalScreening: selectedScreenStatus,
        limitations: ['Equal-weight model disagreement is a finite-ensemble heuristic, not calibrated information gain, uncertainty or detection power.',
          'Only the declared grid and the bounded training shortlist are compared; omitted models and missing dynamics can change the recommendation.',
          'Any considered model failure or sampled-envelope violation makes its original design ineligible; surviving models are never scored alone.',
          'Prediction envelopes and disagreement use scheduled timestamps only; between-sample excursions and aliasing remain possible.',
          'Numerical step screening does not prove convergence or bound true numerical error.',
          'Physical inertia and absolute torque remain unknown. Predictions and disagreement are angular quantities only.',
          'Unforced scalar rotation and transfer to this proposed release are declared assumptions, not verified facts.',
          'A training residual mismatch is retained even when a numerically resolved informative proposal exists.',
          'This produces a manual recording request only; no acquisition instrument, physical control or physical feasibility check is connected.']}};
  };
}
