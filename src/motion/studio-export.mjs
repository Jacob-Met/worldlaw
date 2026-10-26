/** Compact scalar inputs with explicitly retained upstream Motion evidence. */
import {validateNotebook, prepareStudioDerivation, deriveStudioAngularEvidence, MAX_MEASUREMENTS} from './measurement.mjs';
import {serializeMotionNotebook, MAX_MOTION_NOTEBOOK_FILE_BYTES} from './notebook-output.mjs';
import {validateDataset, parseObservationText, MAX_TEXT_LENGTH} from '../data.mjs';

export const MOTION_STUDIO_SOURCE_SCHEMA = 'worldlaw.motion-studio-source/v1';
export const MOTION_SNAPSHOT_SCHEMA = 'worldlaw.motion-notebook-snapshot/v1';
export const MAX_STUDIO_EXPORT_BYTES = 2_000_000;
const encoder = new TextEncoder();
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const digest = async bytes => {
  insist(globalThis.crypto?.subtle, 'This browser cannot identify the Motion snapshot. Open Motion Lab on its local server.');
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
};
const sorted = value => Array.isArray(value) ? value.map(sorted) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const equal = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const match = (a, b, name) => insist(equal(a, b), `Motion Studio ${name} does not match its retained inputs.`);
const counts = (rows, key) => rows.reduce((result, row) => {
  const value = row[key] ?? 'not_declared'; result[value] = (result[value] ?? 0) + 1; return result;
}, {});

function sourceIdentity(source) {
  const result = Object.fromEntries(['kind', 'label', 'width', 'height', 'duration'].map(key => [key, source[key]]));
  if (source.sha256 != null) result.sha256 = source.sha256.toLowerCase();
  for (const key of ['nativeWidth', 'nativeHeight']) if (integer(source[key], 1, 40_000_000)) result[key] = source[key];
  return result;
}

function referenceSummary(notebook, eventsSha256) {
  const events = notebook.revisions.filter(event => event && ['calibration', 'path-reference'].includes(event.type));
  const fits = events.filter(event => event.type === 'path-reference');
  const active = [...fits].reverse().find(event => event.pivot?.x === notebook.calibration.pivot.x
    && event.pivot?.y === notebook.calibration.pivot.y);
  const result = {recordedEventCount: events.length, pathFitEventCount: fits.length, eventsSha256,
    retention: 'Full reference events and fit membership remain in the identified Motion notebook. A summary and digest do not independently authenticate that history.'};
  if (active) {
    result.activePathFit = {method: typeof active.method === 'string' ? active.method.slice(0, 160) : 'not_declared'};
    if (Number.isFinite(active.maximumResidualPixels)) result.activePathFit.maximumResidualPixels = active.maximumResidualPixels;
    if (Array.isArray(active.sourceObservations)) result.activePathFit.originalObservationCount = active.sourceObservations.length;
  }
  if (fits.length) result.conditioning = {fitPrecedesDownstreamSplit: true,
    independence: 'A reference fit used source marker observations before the downstream derivative train/check split. That split alone does not establish independently calibrated reference evidence. Inspect the retained full Motion notebook.'};
  return result;
}

/** Capture, derive, and hash before returning a bounded file accepted by Studio. */
export async function prepareStudioExport(input, options = {}) {
  const evidence = prepareStudioDerivation(input, options);
  const {notebook, angular, derived, split, inertia, command, noise, rows} = evidence;
  const notebookText = serializeMotionNotebook(notebook), bytes = encoder.encode(notebookText);
  const referenceEvents = notebook.revisions.filter(event => event && ['calibration', 'path-reference'].includes(event.type));
  const [sha256, eventsSha256] = await Promise.all([digest(bytes), digest(encoder.encode(JSON.stringify(referenceEvents)))]);
  const notebookIdentity = {schema: MOTION_SNAPSHOT_SCHEMA, sha256, byteLength: bytes.byteLength,
    notebookSchema: notebook.schema,
    meaning: 'Exact UTF-8 bytes of the serialized Motion export snapshot, not the original uploaded file or an authentication of physical evidence.'};
  const segment = angular.source.metadata.selectedSegment, indices = segment.sourceIndices;
  insist(indices.every((index, i) => index === indices[0] + i), 'The selected Motion course must retain a contiguous original measurement range.');
  const metadata = {schema: MOTION_STUDIO_SOURCE_SCHEMA, notebookIdentity,
    originalSource: sourceIdentity(notebook.source), notebookSchema: notebook.schema,
    calibration: notebook.calibration,
    selectedSegment: {id: segment.id, startTime: segment.startTime, endTime: segment.endTime,
      count: segment.count, startReason: segment.startReason},
    measurementRange: {start: indices[0], count: indices.length},
    originalMeasurementCount: notebook.measurements.length,
    excludedCourseCount: angular.source.metadata.excludedSegments.length,
    angularSamples: {columns: ['time', 'position'], units: {time: 's', position: 'rad'},
      rows: angular.samples.map(({time, position}) => [time, position]),
      meaning: 'Exact derived angular inputs. Original pixel points, per-row clocks and tracking diagnostics remain in the identified Motion notebook.'},
    statusCounts: counts(rows, 'status'), clockCounts: counts(rows, 'timeBasis'),
    reference: referenceSummary(notebook, eventsSha256), diagnostics: angular.source.metadata.diagnostics,
    dynamics: {inertia, command, confirmation: 'caller_declared_constant_inertia_and_aligned_applied_torque'},
    noise,
    derivation: {settings: derived.settings, diagnostics: derived.diagnostics, split: split.split, trainingFraction: .7},
    retention: 'Save the matching Motion notebook for original point measurements, quality, tracker configuration, gaps, corrections, source metadata and revision history. Retain the original video separately for pixels. These details are not embedded in this Studio download.',
    scientificBoundary: 'Scalar constant-inertia model with caller calibration. Differentiation amplifies noise and introduces bias. Angular replay checks numerical consistency; matching notebook bytes checks content identity. Neither authenticates video pixels, physical forces, calibrated uncertainty or independent validation.'};
  const dataset = validateDataset({schema: 'worldlaw.observations/v1', source: {
    label: ('Motion Lab derived torque — ' + notebook.source.label).slice(0, 240),
    kind: 'derived_from_video_angular_position',
    units: {command: 'N·m', position: 'rad', rate: 'rad/s', jointTorque: 'N·m'}, metadata},
  observations: split.observations, heldOut: split.heldOut});
  const fits = text => text.length <= MAX_TEXT_LENGTH && encoder.encode(text).byteLength <= MAX_STUDIO_EXPORT_BYTES;
  let text = JSON.stringify(dataset, null, 2) + '\n';
  if (!fits(text)) text = JSON.stringify(dataset) + '\n';
  insist(fits(text), 'The complete Studio handoff exceeds the 2 MB observation-file limit. No measurements were discarded.');
  parseObservationText(text);
  return {dataset, text, notebookText, notebookIdentity};
}

function checkCounts(value, allowed, count, name) {
  insist(object(value) && Object.keys(value).every(key => allowed.includes(key))
    && Object.values(value).every(n => integer(n, 1, count))
    && Object.values(value).reduce((sum, n) => sum + n, 0) === count,
  `Motion Studio ${name} must account for every selected measurement.`);
}

/** Verify angular-input -> torque consistency, without claiming original pixel custody. */
export function replayStudioExport(input) {
  const dataset = validateDataset(input), metadata = dataset.source.metadata;
  insist(metadata?.schema === MOTION_STUDIO_SOURCE_SCHEMA, 'Expected compact Motion Studio provenance.');
  const table = metadata.angularSamples;
  match(table?.columns, ['time', 'position'], 'angular columns');
  match(table?.units, {time: 's', position: 'rad'}, 'angular units');
  insist(Array.isArray(table.rows) && integer(table.rows.length, 1, MAX_MEASUREMENTS), 'Motion Studio needs a bounded selected angular course.');
  const count = table.rows.length, range = metadata.measurementRange;
  insist(integer(metadata.originalMeasurementCount, count, MAX_MEASUREMENTS)
    && integer(range?.start, 0, metadata.originalMeasurementCount - count) && range.count === count,
  'Motion Studio original measurement range is invalid.');
  const identity = metadata.notebookIdentity;
  insist(identity?.schema === MOTION_SNAPSHOT_SCHEMA && /^[a-f0-9]{64}$/.test(identity.sha256 ?? '')
    && integer(identity.byteLength, 1, MAX_MOTION_NOTEBOOK_FILE_BYTES)
    && identity.notebookSchema === metadata.notebookSchema, 'Motion Studio needs an identified full notebook snapshot.');
  // Validate the retained source/calibration schema without inventing raw points.
  const declaration = validateNotebook({schema: metadata.notebookSchema, source: metadata.originalSource,
    calibration: metadata.calibration, measurements: [], revisions: []});
  insist(declaration.calibration && declaration.calibration.pivotMode !== 'tracked', 'Motion Studio requires a fixed angular reference.');
  checkCounts(metadata.statusCounts, ['accepted', 'manual'], count, 'status summary');
  checkCounts(metadata.clockCounts, ['decoded-media-time', 'requested-seek-time', 'synthetic-time', 'user-supplied', 'not_declared'], count, 'clock summary');
  if (declaration.source.kind === 'local-video') insist(metadata.clockCounts['decoded-media-time'] === count,
    'Motion Studio local-video derivation requires decoded media timestamps.');
  const samples = table.rows.map(row => {
    insist(Array.isArray(row) && row.length === 2 && row.every(Number.isFinite)
      && row[0] >= 0 && row[0] <= declaration.source.duration + 1e-6,
    'Motion Studio angular rows need finite original times and positions.');
    return {time: row[0], position: row[1]};
  });
  const selected = metadata.selectedSegment;
  insist(selected?.count === count && selected.startTime === samples[0].time && selected.endTime === samples.at(-1).time
    && integer(selected.id, 0, MAX_MEASUREMENTS - 1) && typeof selected.startReason === 'string',
  'Motion Studio selected-course declaration does not match its angular inputs.');
  insist(metadata.derivation?.trainingFraction === .7, 'Motion Studio requires its maintained source-window split.');
  const dynamics = metadata.dynamics, settings = metadata.derivation.settings;
  insist(dynamics?.confirmation === 'caller_declared_constant_inertia_and_aligned_applied_torque', 'Motion Studio needs the original dynamics declaration.');
  insist(['maximum_declared_angular_sigma', 'caller_override'].includes(metadata.noise?.origin)
    && metadata.noise.value === settings?.positionSigma && settings?.inertia === dynamics.inertia,
  'Motion Studio resolved noise and dynamics must match the derivative settings.');
  const {derived, split} = deriveStudioAngularEvidence(samples, {inertia: dynamics.inertia, command: dynamics.command,
    positionSigma: settings.positionSigma, windowSize: settings.windowSize, confirmKnownDynamics: true});
  match(derived.settings, settings, 'derivative settings');
  match(derived.diagnostics, metadata.derivation.diagnostics, 'derivative diagnostics');
  match(split.split, metadata.derivation.split, 'source-window split');
  match(split.observations, dataset.observations, 'training observations');
  match(split.heldOut, dataset.heldOut, 'held-out observations');
  return {observations: split.observations, heldOut: split.heldOut, split: split.split,
    qualification: 'Exact scalar replay from retained angular inputs only; original notebook and video have not been verified.'};
}

/** Match the retained snapshot and recompute its complete compact handoff. */
export async function verifyStudioExportSource(input, notebookText) {
  const replay = replayStudioExport(input), dataset = validateDataset(input), metadata = dataset.source.metadata;
  insist(typeof notebookText === 'string', 'Supply the exact saved Motion notebook text.');
  const bytes = encoder.encode(notebookText), identity = metadata.notebookIdentity;
  insist(bytes.byteLength <= MAX_MOTION_NOTEBOOK_FILE_BYTES && bytes.byteLength === identity.byteLength,
    'The Motion notebook byte length does not match the identified export snapshot.');
  insist(await digest(bytes) === identity.sha256, 'The Motion notebook SHA-256 does not match the identified export snapshot.');
  let raw;
  try { raw = JSON.parse(notebookText); } catch { throw new Error('The identified Motion notebook is not valid JSON.'); }
  const prepared = await prepareStudioExport(validateNotebook(raw), {inertia: metadata.dynamics.inertia,
    command: metadata.dynamics.command, windowSize: metadata.derivation.settings.windowSize,
    ...(metadata.noise.origin === 'caller_override' ? {positionSigma: metadata.noise.value} : {}),
    segmentId: metadata.selectedSegment.id, confirmKnownDynamics: true});
  match(prepared.dataset, dataset, 'source snapshot replay');
  return {...replay, notebookIdentity: prepared.notebookIdentity,
    qualification: 'The exact Motion export snapshot and its angular/derivative lineage match. Original video pixels and physical authenticity have not been verified.'};
}
