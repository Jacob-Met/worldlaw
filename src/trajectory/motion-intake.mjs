/** Motion notebooks into the maintained angular-law consumer; no new fitter. */
import {validateNotebook, deriveAngles, exportAngular} from '../motion/measurement.mjs';
import {normalizeAngularBundle, ANGULAR_BUNDLE_SCHEMA, ANGULAR_UNITS} from './angular-discovery.mjs';
import {estimateAngularPrelude} from '../science/angular-prelude.mjs';

export const MOTION_INTAKE_SCHEMA = 'worldlaw.motion-trajectory-source/v1';
export const MAX_MOTION_INPUT_BYTES = 2_000_000;
export const MOTION_PREFIX_START_SCHEMA = 'worldlaw.motion-source-prefix/v1';
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const encoder = new TextEncoder();
const hash = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)),
  value => value.toString(16).padStart(2, '0')).join('');
const boundedText = (value, name, max = 500) => {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    name + ' needs nonempty text of at most ' + max + ' characters.');
  return value.trim();
};
function bytesFrom(input) {
  const bytes = typeof input === 'string' ? encoder.encode(input) :
    input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  insist(bytes && bytes.byteLength <= MAX_MOTION_INPUT_BYTES, 'Choose a Motion notebook no larger than 2 MB.');
  return bytes;
}
export async function inspectMotionRecording(input) {
  const bytes = bytesFrom(input);
  let raw;
  try { raw = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes).replace(/^\uFEFF/, '')); }
  catch { throw new Error('The Motion notebook must contain valid UTF-8 JSON.'); }
  const notebook = validateNotebook(raw);
  insist(notebook.calibration, 'The Motion recording needs an accepted angular reference before comparing laws.');
  insist(notebook.calibration.pivotMode !== 'tracked',
    'This autonomous scalar intake requires a fixed image reference. A moving pivot can add unrepresented forcing.');
  insist(typeof notebook.source.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(notebook.source.sha256),
    'Use a Motion notebook with an identified original video (SHA-256).');
  const angles = deriveAngles(notebook);
  insist(angles.segments.length, 'The Motion notebook has no continuous accepted angular course.');
  return {notebook, angles, inputSha256: await hash(bytes), inputByteLength: bytes.byteLength,
    courses: angles.segments.map(segment => ({...segment, sourceIndices: [...segment.sourceIndices]}))};
}
function initialRate(value) {
  insist(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e6,
    'Supply a finite starting angular rate in rad/s; it is never estimated from future challenge observations.');
  return value;
}
/** Provisional source inspection only; applying a pair reparses its original bytes. */
export function previewMotionStart(inspection, {role, segmentId, start} = {}) {
  insist(role === 'training' || role === 'challenge', 'Choose the training or challenge role for this source prefix.');
  insist(start && typeof start === 'object' && !Array.isArray(start) && start.mode === 'source-prefix',
    'Choose the explicit source-prefix starting-rate mode.');
  insist(Object.keys(start).every(key => ['mode', 'originSampleIndex', 'windowSize', 'positionSigma'].includes(key)),
    'Source-prefix preparation accepts only an origin, trailing window and noise assumption.');
  const notebook = validateNotebook(inspection?.notebook);
  insist(notebook.calibration?.pivotMode !== 'tracked', 'A source-prefix start requires the same fixed angular reference as Motion intake.');
  const angular = exportAngular(notebook, {segmentId}), course = angular.source.metadata.selectedSegment;
  const originIndex = start.originSampleIndex, windowSize = start.windowSize;
  insist(Number.isInteger(windowSize) && windowSize >= 5 && windowSize <= 31 && windowSize % 2 === 1,
    'Choose an explicit odd trailing window from 5 through 31 samples.');
  insist(Number.isInteger(originIndex) && originIndex >= windowSize - 1 && originIndex < angular.samples.length,
    'Choose an interior origin with its complete trailing window inside this continuous course.');
  const forecastSampleCount = angular.samples.length - originIndex;
  insist(forecastSampleCount >= (role === 'training' ? 17 : 2), role === 'training'
    ? 'The chosen origin must leave at least 17 training samples.' : 'The chosen origin must leave at least two challenge samples.');
  const first = originIndex - windowSize + 1;
  const prefixSamples = angular.samples.slice(first, originIndex + 1)
    .map(({time, position, positionSigma}) => ({time, position, positionSigma}));
  const originSample = angular.samples[originIndex];
  const positionSigma = start.positionSigma === undefined
    ? Math.max(...prefixSamples.map(row => row.positionSigma)) : start.positionSigma;
  const noiseOrigin = start.positionSigma === undefined ? 'maximum_motion_window_sigma'
    : positionSigma === null ? 'polynomial_residual_proxy' : 'caller_override';
  const report = estimateAngularPrelude(prefixSamples, originSample, {windowSizes: [windowSize], positionSigma});
  const estimated = report.estimates[0];
  insist(estimated.status === 'estimated', 'The chosen source window cannot supply a starting-rate estimate: ' + (estimated.reason ?? estimated.status));
  initialRate(estimated.rate);
  const indices = angular.source.metadata.measurementIndices;
  const preparation = {schema: MOTION_PREFIX_START_SCHEMA, mode: 'source-prefix',
    method: 'worldlaw.trailing-local-cubic-motion-start/v1', estimatorSchema: report.schema,
    origin: {courseSampleIndex: originIndex, measurementIndex: indices[originIndex],
      time: originSample.time, position: originSample.position},
    windowSize, prefixSamples, prefixSourceIndices: indices.slice(first, originIndex + 1),
    omittedBeforeWindowCount: first, omittedBeforeForecastCount: originIndex,
    settings: report.settings, noise: {origin: noiseOrigin, positionSigma},
    estimate: {rate: estimated.rate, rateSigma: estimated.rateSigma,
      conditionEstimate: estimated.conditionEstimate, localResidualScale: estimated.localResidualScale},
    uncertaintySource: report.uncertaintySource,
    persistence: 'Explicitly adopted starting-rate input. Generic Trajectory notebook replay reuses the saved scalar and refits from saved inputs; it does not re-estimate this rate or reopen the original Motion notebook. Rebuilding this pair from Motion derives the rate again.',
    qualification: 'The window ends at the original forecast-origin angle; strictly later receiving angles do not enter this estimate. The original measured origin angle is retained, not replaced by a polynomial fitted position. Calibration, clocks and source authenticity remain conditional.',
    limitations: report.limitations};
  return {rate: estimated.rate, rateSigma: estimated.rateSigma, forecastSampleCount,
    originalCourse: {...course, sourceIndices: [...course.sourceIndices]}, preparation};
}
async function makeRun(declaration, role, assumptions) {
  insist(declaration && typeof declaration === 'object', 'Supply both Motion recordings.');
  const input = await inspectMotionRecording(declaration.input);
  const {notebook: nb, inputSha256, inputByteLength} = input;
  insist(['measured', 'synthetic', 'unknown'].includes(declaration.kind),
    'Declare whether each recording is measured, authored synthetic, or of unknown origin.');
  if (nb.source.kind === 'synthetic' || nb.source.kind === 'synthetic-video')
    insist(declaration.kind === 'synthetic', 'A Motion source declared synthetic must remain synthetic.');
  const angular = exportAngular(nb, {segmentId: declaration.segmentId});
  const metadata = angular.source.metadata;
  const indices = metadata.measurementIndices;
  insist(indices.every(i => nb.measurements[i].timeBasis === 'decoded-media-time' ||
    (declaration.kind === 'synthetic' && nb.measurements[i].timeBasis === 'synthetic-time')),
    'Use decoded media timestamps for each selected observation. Nominal seek times cannot qualify a dynamics run.');
  insist(angular.samples.length >= (role === 'training' ? 17 : 2),
    role === 'training' ? 'Select a training course with at least 17 accepted samples.' :
      'Select a challenge course with at least two accepted samples.');
  let preparedStart = null;
  if (declaration.start !== undefined) {
    insist(declaration.initialRate === undefined && declaration.initialRateBasis === undefined,
      'Choose either a supplied starting rate or an explicitly adopted source-prefix estimate, not both.');
    preparedStart = previewMotionStart(input, {role, segmentId: declaration.segmentId, start: declaration.start});
  }
  const adoptedOrigin = preparedStart?.preparation.origin.courseSampleIndex ?? 0;
  const referenceEvents = nb.revisions.filter(event => event && ['calibration', 'path-reference'].includes(event.type));
  const fitEvents = referenceEvents.filter(event => event.type === 'path-reference');
  const latestFit = [...fitEvents].reverse().find(event =>
    event.pivot?.x === nb.calibration.pivot.x && event.pivot?.y === nb.calibration.pivot.y);
  const referenceSummary = {
    recordedEventCount: referenceEvents.length,
    pathFitEventCount: fitEvents.length,
    eventsSha256: await hash(encoder.encode(JSON.stringify(referenceEvents))),
    activePathFit: latestFit ? {method: latestFit.method, settings: latestFit.settings,
      pivot: latestFit.pivot, maximumResidualPixels: latestFit.maximumResidualPixels,
      originalObservationCount: latestFit.sourceObservations?.length ?? null,
      interpretation: latestFit.interpretation} : null,
    retention: 'Original point measurements, revisions and reference-fit membership remain in the identified Motion input file. Retain the separately identified original video for pixel reinspection.',
    ...(metadata.referenceConditioning ? {conditioning: metadata.referenceConditioning} : {})
  };
  const original = nb.source;
  const source = {
    label: 'Motion Lab — ' + original.label.slice(0, 220),
    recordingId: 'sha256:' + original.sha256.toLowerCase(),
    motion: {
      schema: MOTION_INTAKE_SCHEMA,
      inputSha256, inputByteLength, notebookSchema: nb.schema,
      originalVideo: {label: original.label, kind: original.kind, sha256: original.sha256.toLowerCase(),
        width: original.width, height: original.height, duration: original.duration},
      calibration: nb.calibration,
      selectedCourse: {...metadata.selectedSegment, sourceIndices: undefined},
      observationIndices: preparedStart ? indices.slice(adoptedOrigin) : indices,
      omittedCourseCount: metadata.excludedSegments.length,
      reference: referenceSummary,
      initialRate: preparedStart ? {value: preparedStart.rate, unit: 'rad/s',
        basis: 'Explicitly adopted local-cubic rate from ' + preparedStart.preparation.windowSize
          + ' source samples through course origin ' + adoptedOrigin + '; not a measured sensor rate.',
        qualification: preparedStart.preparation.persistence + ' ' + preparedStart.preparation.qualification,
        preparation: preparedStart.preparation} : {value: initialRate(declaration.initialRate), unit: 'rad/s',
        basis: boundedText(declaration.initialRateBasis, 'Starting-rate basis'),
        qualification: 'Caller supplied; not inferred from future challenge positions or authenticated by the application.'},
      assumptions,
      diagnostics: metadata.diagnostics,
      angleSamples: 'Unchanged Motion-derived times and unwrapped angles. No recentering, interpolation, torque command or physical inertia is introduced.'
    }
  };
  return {
    id: role + '-' + inputSha256.slice(0, 20),
    label: declaration.label ? boundedText(declaration.label, 'Run label', 240) : role + ' — ' + original.label.slice(0, 210),
    kind: declaration.kind, inertia: null, dynamics: 'unforced_scalar_rotation',
    initialRate: source.motion.initialRate.value, source,
    samples: (preparedStart ? angular.samples.slice(adoptedOrigin) : angular.samples).map(({time, position}) => ({time, position}))
  };
}
/** Reparse each original input on every application; cached previews are never authority. */
export async function createMotionAngularBundle({training, challenge, label = 'Separate Motion Lab recordings', assumptions} = {}) {
  insist(assumptions?.unforcedScalarRotation === true,
    'Declare that these recordings represent unforced scalar rotation. Video alone does not establish absent external forcing.');
  insist(assumptions?.sharedAngleFrame === true,
    'Declare the same physical angle zero and direction across recordings, with each camera fixed. Image-angle recordings also require the same camera orientation.');
  const declarations = {
    unforcedScalarRotation: true, sharedAngleFrame: true,
    basis: boundedText(assumptions.basis, 'Shared dynamics and angle-coordinate basis'),
    qualification: 'User declarations, not a physical calibration or an authenticated independence guarantee.'
  };
  const trainingRun = await makeRun(training, 'training', declarations);
  const challengeRun = await makeRun(challenge, 'challenge', declarations);
  // The maintained boundary refuses shared original recording IDs, copied
  // trajectories, wrong units, excessive duration and portable source limits.
  return normalizeAngularBundle({schema: ANGULAR_BUNDLE_SCHEMA,
    label: boundedText(label, 'Comparison label', 240), units: {...ANGULAR_UNITS},
    trainingRuns: [trainingRun], challengeRuns: [challengeRun]});
}
