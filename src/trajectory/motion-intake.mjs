/** Motion notebooks into the maintained angular-law consumer; no new fitter. */
import {validateNotebook, deriveAngles, exportAngular} from '../motion/measurement.mjs';
import {normalizeAngularBundle, ANGULAR_BUNDLE_SCHEMA, ANGULAR_UNITS} from './angular-discovery.mjs';

export const MOTION_INTAKE_SCHEMA = 'worldlaw.motion-trajectory-source/v1';
export const MAX_MOTION_INPUT_BYTES = 2_000_000;
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
      observationIndices: indices,
      omittedCourseCount: metadata.excludedSegments.length,
      reference: referenceSummary,
      initialRate: {value: initialRate(declaration.initialRate), unit: 'rad/s',
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
    samples: angular.samples.map(({time, position}) => ({time, position}))
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
