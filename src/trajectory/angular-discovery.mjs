/** Experimental angular-acceleration discovery with an explicitly unknown torque scale. */
import {discoverIntegral} from './integral-discovery.mjs';
import {rollout} from './forward.mjs';

export const ANGULAR_BUNDLE_SCHEMA = 'worldlaw.angular-bundle/v1';
export const ANGULAR_UNITS = Object.freeze({time: 's', position: 'rad', initialRate: 'rad/s'});
export const ANGULAR_MODEL_UNITS = Object.freeze({position: 'rad', rate: 'rad/s', angularAcceleration: 'rad/s²'});
export const ANGULAR_COEFFICIENT_UNITS = Object.freeze({rate: '1/s', coulomb: 'rad/s²', spring: '1/s²', gravity: 'rad/s²', quadratic: '1/rad', bias: 'rad/s²', cubic: '1/(rad²·s²)'});
const IDS = Object.keys(ANGULAR_COEFFICIENT_UNITS);
export const DEFAULT_ANGULAR_TERMS = Object.freeze(IDS.filter(id => id !== 'cubic'));
const SCALE_MEANING = 'angular_acceleration_only_absolute_torque_unknown';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class AngularDataError extends Error {
  constructor(message, code = 'invalid_angular_evidence') {super(message); this.name = 'AngularDataError'; this.code = code;}
}
const insist = (condition, message, code) => {if (!condition) throw new AngularDataError(message, code);};
function finite(value, label, bound = 1e6, code) {
  insist(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound, `${label} must be finite with magnitude at most ${bound}.`, code);
  return value;
}
function text(value, label, limit = 240) {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= limit, `${label} needs nonempty text of at most ${limit} characters.`);
  return value.trim();
}
function checkAngularUnits(value) {
  insist(object(value) && Object.entries(ANGULAR_UNITS).every(([key, unit]) => value[key] === unit) && Object.keys(value).length === 3,
    'Declare only s, rad, and rad/s angular input units; no physical torque units or per-run conversion is inferred.', 'unsupported_units');
}
function sourceCopy(value) {
  insist(object(value), 'An angular run needs a source object.');
  let serialized;
  try {serialized = JSON.stringify(value);} catch {throw new AngularDataError('Source metadata must be ordinary JSON.');}
  insist(typeof serialized === 'string' && serialized.length <= 32000, 'Source metadata must be a JSON object of at most 32 KB.');
  const source = JSON.parse(serialized); insist(object(source), 'Source metadata must serialize to an object.');
  source.label = text(source.label, 'Source label');
  if (source.recordingId !== undefined) source.recordingId = text(source.recordingId, 'Recording id');
  return source;
}
function normalizeRun(raw, minimum = 5) {
  insist(object(raw), 'Each angular run must be an object.');
  const id = text(raw.id, 'Run id', 120);
  if (raw.units !== undefined) checkAngularUnits(raw.units);
  insist(raw.inertia === null, 'Unknown physical inertia must remain explicitly null; this mode never claims a known torque scale.', 'unknown_scale_required');
  insist(raw.dynamics === 'unforced_scalar_rotation', 'This experimental mode requires a declared unforced scalar rotation.');
  insist(['measured', 'synthetic', 'unknown'].includes(raw.kind), 'Run kind must be measured, synthetic, or unknown.');
  insist(Array.isArray(raw.samples) && raw.samples.length >= minimum && raw.samples.length <= 4096,
    `Each angular run needs ${minimum}–4096 samples.`);
  const samples = Array.from(raw.samples, (row, i) => {
    insist(object(row), `Sample ${i} must be an object.`);
    insist(row.command === undefined && row.jointTorque === undefined, 'Angular evidence must not contain a fabricated torque command or torque observation.');
    return {time: finite(row.time, 'Sample time', 1e12), position: finite(row.position, 'Sample position')};
  });
  for (let i = 1; i < samples.length; i++) insist(samples[i].time > samples[i - 1].time, 'Sample times must strictly increase.');
  insist(samples.at(-1).time - samples[0].time <= 300, 'The interactive angular run limit is 300 seconds.', 'resource_limit');
  return {id, label: text(raw.label ?? id, 'Run label'), kind: raw.kind, dynamics: raw.dynamics, inertia: null,
    initialRate: finite(raw.initialRate, 'Recorded or explicitly supplied initialRate'), source: sourceCopy(raw.source), samples};
}
function runList(values, minimum = 5) {
  insist(Array.isArray(values) && values.length >= 1 && values.length <= 8, 'Provide one to eight angular runs.');
  const runs = Array.from(values, run => normalizeRun(run, minimum));
  insist(new Set(runs.map(run => run.id)).size === runs.length, 'Run ids must be distinct.', 'shared_evidence');
  insist(runs.reduce((sum, run) => sum + run.samples.length, 0) <= 8192, 'At most 8192 samples are supported.', 'resource_limit');
  return runs;
}
/** Shared angular evidence boundary; performs no fitting or torque conversion. */
export function normalizeAngularRuns(trainingRuns) { return runList(trainingRuns); }
function repeatedEvidence(training, challenges) {
  const recordings = new Set(training.map(run => run.source.recordingId).filter(Boolean));
  const windows = new Map();
  // Short quantized position sequences can genuinely recur across recordings.
  // PASCO's independent repetitions share 12 consecutive values at 0.001 rad
  // resolution. Use longer partial-copy screening, while still rejecting a
  // complete reused run/subset. Neither heuristic proves evidence independence.
  const partialWindow = 32;
  const key = (run, start, size) => JSON.stringify(run.samples.slice(start, start + size).map(row => row.position));
  for (const run of training) for (let start = 0; start <= run.samples.length - partialWindow; start++) {
    const k = key(run, start, partialWindow); if (!windows.has(k)) windows.set(k, []); windows.get(k).push({run, start});
  }
  const sameClock = (a, startA, b, startB, size) => {
    for (let i = 0; i < size; i++) {
      const x = a.samples[startA + i].time, y = b.samples[startB + i].time;
      const xa = a.samples[startA].time, yb = b.samples[startB].time;
      const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(x), Math.abs(y), Math.abs(xa), Math.abs(yb));
      if (Math.abs((x - xa) - (y - yb)) > tolerance) return false;
    }
    return true;
  };
  for (const run of challenges) {
    insist(!run.source.recordingId || !recordings.has(run.source.recordingId), 'Challenge evidence shares a declared recording with training.', 'shared_evidence');
    for (const train of training) {
      const [short, long] = run.samples.length <= train.samples.length ? [run, train] : [train, run];
      const needle = key(short, 0, short.samples.length);
      for (let start = 0; start <= long.samples.length - short.samples.length; start++) {
        if (long.samples[start].position !== short.samples[0].position) continue;
        insist(!(key(long, start, short.samples.length) === needle && sameClock(short, 0, long, start, short.samples.length)),
          'Challenge evidence repeats a complete training run or contiguous subset.', 'shared_evidence');
      }
    }
    for (let start = 0; start <= run.samples.length - partialWindow; start++) {
      insist(!(windows.get(key(run, start, partialWindow)) ?? []).some(prior => sameClock(prior.run, prior.start, run, start, partialWindow)),
        'Challenge evidence contains a copied training subwindow.', 'shared_evidence');
    }
  }
}
export function normalizeAngularBundle(raw) {
  insist(object(raw) && raw.schema === ANGULAR_BUNDLE_SCHEMA, `Expected ${ANGULAR_BUNDLE_SCHEMA}.`, 'unsupported_schema');
  checkAngularUnits(raw.units);
  for (const key of ['trainingRuns', 'challengeRuns']) insist(Array.isArray(raw[key]) && raw[key].length >= 1 && raw[key].length <= 4, 'Provide one to four runs per evidence role.');
  const trainingRuns = runList(raw.trainingRuns, 17), challengeRuns = runList(raw.challengeRuns, 2);
  const all = [...trainingRuns, ...challengeRuns];
  insist(new Set(all.map(run => run.id)).size === all.length, 'Every training and challenge run needs a distinct id.', 'shared_evidence');
  insist(all.reduce((sum, run) => sum + run.samples.length, 0) <= 8192, 'At most 8192 total samples are supported.', 'resource_limit');
  repeatedEvidence(trainingRuns, challengeRuns);
  return {schema: ANGULAR_BUNDLE_SCHEMA, label: text(raw.label ?? 'Angular observations with unknown torque scale', 'Bundle label'),
    units: {...ANGULAR_UNITS}, trainingRuns, challengeRuns};
}

// PRIVATE NUMERICAL CONVERSION. The shared solver divides by a reference factor;
// setting that factor to one represents alpha directly. It is not a measurement
// of physical inertia. Synthetic command=0 is solely an unused kernel argument.
// These objects never leave this module, and command is excluded from the library.
const numericalRun = run => ({...run, inertia: 1, samples: run.samples.map(row => ({...row, command: 0}))});
function angularModel(model) {
  return {schema: 'worldlaw.angular-model/v1', id: model.id,
    terms: model.terms.map(term => ({...term, coefficientUnit: ANGULAR_COEFFICIENT_UNITS[term.id]})),
    equation: model.equation.replace(/^τ = /, 'α = '), units: {...ANGULAR_MODEL_UNITS}, scaleMeaning: SCALE_MEANING,
    physicalInertia: null, absoluteTorqueIdentified: false, method: 'double_integral_angular_acceleration_regression',
    domain: {position: {...model.domain.position}, rate: {...model.domain.rate}}, metrics: {...model.metrics}};
}
export function discoverAngular(trainingRuns, requestedOptions = {}) {
  insist(object(requestedOptions), 'Angular discovery options must be an object.', 'invalid_options');
  const terms = requestedOptions.terms ?? DEFAULT_ANGULAR_TERMS;
  insist(Array.isArray(terms) && terms.length > 0 && new Set(terms).size === terms.length && Array.from(terms).every(id => IDS.includes(id)),
    'Only known autonomous angular terms are available; command is excluded.', 'invalid_options');
  const runs = runList(trainingRuns), settings = {...requestedOptions, terms: [...terms], maxTerms: requestedOptions.maxTerms ?? Math.min(4, terms.length)};
  const fitted = discoverIntegral(runs.map(numericalRun), settings);
  const candidates = fitted.candidates.map(angularModel), byId = new Map(candidates.map(model => [model.id, model]));
  const {commandConvention, ...kernelDiagnostics} = fitted.diagnostics;
  const diagnostics = {...kernelDiagnostics, forcingAssumption: 'no_actuator_channel_autonomous_model_assumption',
    quadrature: 'exact_for_piecewise_linear_angular_features',
    initialRateAssumption: 'supplied_rate_used_as_initial_state_without_future_challenge_estimation',
    scaleMeaning: SCALE_MEANING, absoluteTorqueIdentified: false,
    columnNorms: fitted.diagnostics.columnNorms.map(({id, norm}) => ({id, norm, units: `rad per (${ANGULAR_COEFFICIENT_UNITS[id]})`})),
    limitations: [
      'Finite autonomous scalar angular-acceleration library only; no arbitrary-law or mechanism-topology discovery.',
      'Physical inertia is unknown; coefficients describe angular acceleration and never identify absolute torque.',
      'Unforced scalar rotation is a declared experimental assumption; absent actuator data cannot verify zero external forcing.',
      'Initial rate is supplied sensor evidence or a declared estimate, not an exact calibrated truth or a fitted challenge parameter.',
      'Shared initial-position noise is partly transformed; noisy regressors, quadrature, rate smoothing and correlated errors remain.',
      'Training score and competitive-model spread are heuristics, not calibrated uncertainty.',
      'No coefficient-sign, passivity, or mechanism-topology constraints are imposed; a selected rate term need not dissipate energy.',
      'Different recordings of one apparatus do not establish transfer to unseen mechanisms.',
      'Held-out future positions never enter fitting or the supplied initial velocity.',
    ]};
  return {schema: 'worldlaw.angular-discovery/v1', scope: 'finite_library_autonomous_angular_acceleration', method: 'double_integral_angular_acceleration_regression',
    units: {...ANGULAR_MODEL_UNITS}, residualUnits: 'rad', noiseSigmaUnits: 'rad', scaleMeaning: SCALE_MEANING,
    physicalInertia: null, absoluteTorqueIdentified: false,
    selected: byId.get(fitted.selected.id), candidates, competitive: fitted.competitive.map(model => byId.get(model.id)),
    trainingRuns: runs, options: fitted.options, fitEquationCount: fitted.fitEquationCount, diagnostics};
}
function numericalModel(model) {
  insist(object(model) && model.schema === 'worldlaw.angular-model/v1' && model.scaleMeaning === SCALE_MEANING &&
    model.physicalInertia === null && model.absoluteTorqueIdentified === false && Array.isArray(model.terms),
    'Expected an executable angular model with explicitly unknown physical torque scale.', 'invalid_model');
  insist(object(model.units) && Object.entries(ANGULAR_MODEL_UNITS).every(([key, value]) => model.units[key] === value) &&
    Object.keys(model.units).length === 3, 'Angular model units must identify position, rate, and angular acceleration only.', 'invalid_model');
  insist(model.terms.length <= IDS.length && new Set(model.terms.map(term => term?.id)).size === model.terms.length, 'Model terms must be unique.', 'invalid_model');
  const terms = Array.from(model.terms, term => {
    insist(object(term) && IDS.includes(term.id) && term.coefficientUnit === ANGULAR_COEFFICIENT_UNITS[term.id], 'Unknown term or incorrect angular coefficient units.', 'invalid_model');
    return {id: term.id, coefficient: finite(term.coefficient, 'Angular coefficient', 1e18, 'invalid_model')};
  });
  return {schema: 'worldlaw.torque-model/v1', id: model.id, terms};
}
/** Execute alpha directly via the shared numerical kernel; never export its unit proxy. */
export function rolloutAngular(model, run, options = {}) {
  const normalized = normalizeRun(run, 2), result = rollout(numericalModel(model), numericalRun(normalized), options);
  const {commandConvention, ...diagnostics} = result.diagnostics;
  return {schema: 'worldlaw.angular-rollout/v1', modelId: result.modelId, runId: result.runId,
    rows: result.rows.map(({command, ...row}) => row), metrics: {...result.metrics}, units: {...ANGULAR_MODEL_UNITS, time: 's'},
    diagnostics: {...diagnostics, scaleMeaning: SCALE_MEANING, physicalInertia: null, absoluteTorqueIdentified: false,
      forcingAssumption: 'unforced_scalar_rotation_declared_not_verified_by_missing_actuator_data',
      limitations: [...diagnostics.limitations.filter(text => !text.includes('command, inertia')),
        'Residuals include angular-model, sensor, initial-state, unrecorded-forcing and numerical errors.',
        'Physical torque and inertia remain unidentified.']}};
}
