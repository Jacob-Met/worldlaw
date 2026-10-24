import {loadVideo} from './video.mjs';
import {createNotebook, validateNotebook, calibrateNotebook, upsertMeasurement, truncateMeasurements, deriveAngles, exportAngular, exportStudio} from './measurement.mjs';
import {createTemplate, trackTemplate, TRACKER_VERSION, COLOR_TRACKER_VERSION} from './tracker.mjs';
import {createDemoSource, DEMO_PIVOT, demoMarkerAt} from './demo.mjs';

const $ = id => document.getElementById(id);
const canvas = $('evidence-canvas'), context = canvas.getContext('2d');
const accepted = row => row && (row.status === 'accepted' || row.status === 'manual') && row.point;
const trackedPivot = () => state.notebook?.calibration?.pivotMode === 'tracked';
const measuredPair = row => accepted(row) && (!trackedPivot() || accepted(row.pivotMeasurement));
const currentPivot = () => trackedPivot() ? accepted(currentRow()?.pivotMeasurement) || null : state.notebook?.calibration?.pivot;
const fmt = (value, places = 3) => Number.isFinite(value) ? value.toFixed(places) : '—';
const state = {notebook: null, source: null, frame: null, derived: null, mode: null,
  cursor: null, template: null, tracking: false, epoch: 0, seekEpoch: 0,
  controller: null, attachIntent: false, selectedTime: null, segmentId: null,
  seeking: false, seekTarget: null, seekTask: null, seekController: null};

function notice(message) { $('motion-notice').textContent = message; }
function clearError() { $('motion-error').hidden = true; $('motion-error').textContent = ''; }
function showError(error) {
  if (error?.name === 'AbortError') return;
  $('motion-error').textContent = error?.message || String(error);
  $('motion-error').hidden = false;
  $('motion-error').focus({preventScroll: true});
}
function safe(action) { return async event => { clearError(); try { await action(event); } catch (error) { showError(error); } }; }
function finiteInput(id, label, {min = -Infinity, max = Infinity, integer = false} = {}) {
  const input = $(id), value = Number(input.value);
  if (!input.value.trim() || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? 'a whole number' : 'a finite number'} between ${min} and ${max}.`);
  return value;
}
function trackingSettings() {
  const settings = {step: finiteInput('sample-step', 'Sample interval', {min: .02, max: 2}),
    searchRadius: finiteInput('search-radius', 'Search radius', {min: 4, max: 96, integer: true}),
    patchRadius: finiteInput('patch-radius', 'Marker patch radius', {min: 3, max: 24, integer: true}),
    appearance: $('appearance-mode').value};
  if (!['luminance', 'color'].includes(settings.appearance)) throw new Error('Choose a supported patch appearance.');
  if ((settings.searchRadius * 2 + 1) ** 2 * (settings.patchRadius * 2 + 1) ** 2 * ($('pivot-mode').value === 'tracked' ? 2 : 1) > 20_000_000)
    throw new Error('This search and patch combination exceeds the local computation limit. Reduce the search radius or marker patch radius.');
  return settings;
}
function currentRow() {
  const time = state.frame?.time ?? state.selectedTime;
  // A nearby imported row is not evidence for the raster currently displayed.
  return state.notebook?.measurements.find(row => row.time === time) || null;
}
function referenceSettings() {
  return {zeroAngle: finiteInput('zero-angle', 'Angular zero', {min: -180, max: 180}) * Math.PI / 180,
    direction: Number($('angle-direction').value),
    pixelSigma: finiteInput('pixel-sigma', 'Assumed point noise', {min: 0, max: 100}),
    pivotMode: $('pivot-mode').value,
    ...($('pivot-mode').value === 'tracked' ? {pivotPixelSigma: finiteInput('pivot-pixel-sigma', 'Assumed pivot noise', {min: 0, max: 100})} : {})};
}
function restoreReferenceInputs() {
  const calibration = state.notebook?.calibration;
  $('zero-angle').value = String((calibration?.zeroAngle ?? 0) * 180 / Math.PI);
  $('angle-direction').value = String(calibration?.direction ?? 1);
  $('pixel-sigma').value = String(calibration?.pixelSigma ?? 1);
  $('pivot-mode').value = calibration?.pivotMode ?? 'fixed';
  $('pivot-pixel-sigma').value = String(calibration?.pivotPixelSigma ?? 1);
}
function appearanceLabel(tracker) {
  return tracker?.version === COLOR_TRACKER_VERSION ? 'Brightness + color'
    : tracker?.version === TRACKER_VERSION ? 'Brightness texture' : 'Not supplied';
}
function restoreTrackingAppearance() {
  // Restore the most recently recorded algorithm; each existing row keeps its own.
  const tracker = [...(state.notebook?.measurements || [])].reverse().find(row => row.tracker?.version)?.tracker;
  $('appearance-mode').value = tracker?.version === COLOR_TRACKER_VERSION ? 'color' : 'luminance';
}
function stopWork() {
  state.epoch++; state.seekEpoch++; state.controller?.abort(); state.controller = null; state.tracking = false;
  state.seekTarget = null; state.seekController?.abort();
}
function invalidateStudioExport({clearNumbers = false} = {}) {
  $('confirm-physics').checked = false;
  if (clearNumbers) for (const id of ['known-inertia', 'declared-command', 'position-sigma']) $(id).value = '';
  $('studio-export-status').textContent = trackedPivot() ? 'Tracked-pivot measurements export as angular evidence. A translating pivot can add inertial terms that the fixed-pivot torque model does not represent.' : 'No export for the current evidence and assumptions. Enter known inertia and an explicit constant applied torque, then confirm them. Import the resulting JSON in the torque studio.';
}
function commitNotebook(notebook) {
  state.notebook = notebook;
  invalidateStudioExport();
  state.derived = notebook.calibration?.pivot ? deriveAngles(notebook) : null;
  render();
}
function fileDownload(name, content) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function installSource(source, {attach = false, syntheticCalibration = false} = {}) {
  const epoch = state.epoch;
  try {
    if (attach) {
      const expected = state.notebook?.source?.sha256;
      if (!expected || source.source.sha256?.toLowerCase() !== expected.toLowerCase())
        throw new Error('This video does not match the notebook’s recorded SHA-256. Choose the original source file, or use “Choose local video” to start a separate notebook.');
      const saved = state.notebook.source, actual = source.source;
      if (saved.width !== actual.width || saved.height !== actual.height
        || Math.abs(saved.duration - actual.duration) > .001
        || (saved.nativeWidth !== undefined && saved.nativeWidth !== actual.nativeWidth)
        || (saved.nativeHeight !== undefined && saved.nativeHeight !== actual.nativeHeight))
        throw new Error('The matching video has a different decoded geometry or duration from this notebook. Its pixel calibration cannot be attached safely. Start a new notebook to measure the current decoded source.');
    }
    const time = attach ? Math.min(state.selectedTime ?? state.notebook.measurements[0]?.time ?? 0, source.duration) : 0;
    const frame = await source.frameAt(time, {signal: state.controller?.signal});
    if (epoch !== state.epoch) { source.dispose(); return; }
    const notebook = attach ? state.notebook : createNotebook({source: source.source});
    state.source?.dispose(); state.source = source; state.frame = frame; state.selectedTime = frame.time;
    $('track-until').value = String(source.duration); $('track-until').max = String(source.duration);
    state.template = null; state.mode = null; state.cursor = null; state.segmentId = null;
    if (!attach) invalidateStudioExport({clearNumbers: true});
    commitNotebook(notebook); restoreReferenceInputs();
    if (attach) restoreTrackingAppearance(); else $('appearance-mode').value = 'luminance';
    if (syntheticCalibration) {
      const settings = trackingSettings();
      state.notebook = calibrateNotebook(state.notebook, {pivot: {...DEMO_PIVOT}, maxGapSeconds: settings.step * 1.6});
      await applyMarker(demoMarkerAt(0), 'Supplied first-frame calibration for the synthetic image sequence.');
      notice(`Synthetic example loaded. Its pivot and first marker are supplied; tracking will measure the generated pixels.${source.source.metadata.occlusion ? ' The hidden-marker interval deliberately tests rejection.' : ' This version keeps the marker visible throughout.'}`);
    } else if (attach) {
      notice('The source SHA-256 matches. Video reconnected; recorded provenance and measurements are preserved.');
    } else {
      setMode('pivot'); notice('Video decoded locally. Set the fixed pivot, then choose a distinctive visible marker.');
    }
    render();
  } catch (error) { if (source !== state.source) source.dispose(); throw error; }
}

async function openVideo(file, attach) {
  if (!file) return;
  stopWork(); const epoch = state.epoch; state.controller = new AbortController(); render();
  notice('Reading and decoding the local source… The current notebook remains available until the new source is ready.');
  let source;
  try {
    source = await loadVideo(file, {signal: state.controller.signal});
    if (epoch !== state.epoch) { source.dispose(); return; }
    await installSource(source, {attach});
  } finally { if (epoch === state.epoch) { state.controller = null; render(); } }
}

async function openNotebook(file) {
  if (!file) return;
  stopWork(); const epoch = state.epoch; render();
  if (file.size > 8 * 1024 * 1024) throw new Error('Motion notebooks must be at most 8 MB.');
  const parsed = validateNotebook(JSON.parse(await file.text()));
  if (epoch !== state.epoch) return;
  let source = null, frame = null;
  if (parsed.source.kind === 'synthetic-video' && parsed.source.metadata?.generator === 'worldlaw.motion-demo/v1') {
    const candidate = createDemoSource({occlusion: parsed.source.metadata.occlusion !== false});
    const expected = candidate.source, supplied = parsed.source;
    const compatible = supplied.width === expected.width && supplied.height === expected.height
      && supplied.duration === expected.duration
      && ['framesPerSecond', 'occlusion', 'motion', 'occlusionInterval'].every(key => JSON.stringify(supplied.metadata[key]) === JSON.stringify(expected.metadata[key]));
    if (compatible) { source = candidate; frame = await source.frameAt(parsed.measurements[0]?.time ?? 0); }
    else candidate.dispose();
  }
  if (epoch !== state.epoch) { source?.dispose(); return; }
  state.source?.dispose(); state.source = source; state.frame = frame; state.selectedTime = frame?.time ?? parsed.measurements[0]?.time ?? 0;
  $('track-until').value = String(parsed.source.duration); $('track-until').max = String(parsed.source.duration);
  state.mode = null; state.template = null; state.cursor = null; state.segmentId = null;
  invalidateStudioExport({clearNumbers: true}); commitNotebook(parsed); restoreReferenceInputs();
  restoreTrackingAppearance();
  notice(source ? 'Synthetic notebook reopened. Supplied provenance and measurements are preserved; its matching declared generator restores the image sequence.'
    : parsed.source.kind.startsWith('synthetic') ? 'Synthetic notebook reopened with its evidence and provenance. The declared generator or parameters cannot be reproduced here, so no replacement pixels are displayed.'
      : 'Notebook reopened with its evidence and provenance. Reconnect the matching original video to inspect or correct pixels.');
}

async function seek(seconds) {
  if (!state.source || state.tracking) return;
  state.seekTarget = Math.max(0, Math.min(state.source.duration, seconds));
  if (state.seeking) return state.seekTask;
  const epoch = state.epoch, source = state.source;
  state.seeking = true; state.seekController = new AbortController(); render();
  state.seekTask = (async () => {
    try {
      while (state.seekTarget !== null && epoch === state.epoch) {
        const target = state.seekTarget; state.seekTarget = null;
        const frame = await source.frameAt(target, {signal: state.seekController.signal});
        if (epoch !== state.epoch) return;
        if (state.seekTarget === null) { state.frame = frame; state.selectedTime = frame.time; state.mode = null; state.cursor = null; }
      }
    } finally { state.seeking = false; state.seekTask = null; state.seekController = null; render(); }
  })();
  return state.seekTask;
}

function setMode(mode) {
  if (!state.frame || state.tracking || state.seeking) return;
  if (mode !== 'pivot' && !state.notebook?.calibration?.pivot) throw new Error('Set the pivot before choosing the marker.');
  state.mode = mode;
  state.cursor = mode === 'pivot' ? currentPivot() : currentRow()?.point;
  state.cursor = state.cursor ? {...state.cursor} : {x: state.frame.width / 2, y: state.frame.height / 2};
  updateCoordinateInputs(); render();
  if (window.innerWidth <= 620 && document.activeElement !== $('apply-point'))
    canvas.scrollIntoView({block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}
function updateCoordinateInputs() {
  if (!state.cursor) return;
  $('point-x').value = fmt(state.cursor.x, 2); $('point-y').value = fmt(state.cursor.y, 2);
}
async function applyMarker(point, reason = 'User marked the visible source pixels.') {
  const pivot = currentPivot();
  if (trackedPivot() && !pivot) throw new Error('Observe the pivot on this same frame before choosing the marker.');
  if (pivot && Math.hypot(point.x - pivot.x, point.y - pivot.y) < 2)
    throw new Error('Choose a marker at least 2 pixels away from the pivot. A point at the pivot has no measurable rotation angle.');
  const {patchRadius, appearance} = trackingSettings();
  const captured = createTemplate(state.frame, point, {patchRadius, appearance});
  if (captured.status !== 'ready') throw new Error(`Marker not captured: ${captured.reason || captured.status}. Choose a distinctive patch, or increase its radius to include a visible edge.`);
  const row = {time: state.frame.time, requestedTime: state.frame.requestedTime, timeBasis: state.frame.timeBasis,
    ...(Number.isInteger(state.frame.frameIndex) ? {frameIndex: state.frame.frameIndex} : {}),
    point: {...point}, status: 'manual', reason,
    quality: {textureStd: captured.textureStd, patchRadius}, tracker: {version: captured.template.version, patchRadius, appearance},
    ...(currentRow()?.pivotMeasurement ? {pivotMeasurement: currentRow().pivotMeasurement} : {})};
  const next = upsertMeasurement(state.notebook, row);
  state.template = captured.template; state.mode = null; state.cursor = null;
  commitNotebook(next);
}
async function applyPoint(point) {
  if (!state.frame || !state.mode || state.tracking || state.seeking) return;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > state.frame.width - 1 || point.y > state.frame.height - 1)
    throw new Error('The point must be inside the decoded source image.');
  if (state.mode === 'pivot') {
    const {step, patchRadius, appearance} = trackingSettings(), settings = referenceSettings();
    let next = calibrateNotebook(state.notebook, {pivot: {...point}, ...settings, maxGapSeconds: step * 1.6});
    if (settings.pivotMode === 'tracked') {
      const captured = createTemplate(state.frame, point, {patchRadius, appearance});
      if (captured.status !== 'ready') throw new Error(`Pivot not captured: ${captured.reason || captured.status}. Choose a distinctive visible pivot patch.`);
      const row = currentRow() || {time: state.frame.time, requestedTime: state.frame.requestedTime, timeBasis: state.frame.timeBasis,
        ...(Number.isInteger(state.frame.frameIndex) ? {frameIndex: state.frame.frameIndex} : {}),
        status: 'missing', point: null, reason: 'Marker not yet observed on this frame.'};
      next = upsertMeasurement(next, {...row, pivotMeasurement: {status: 'manual', point: {...point},
        reason: 'User observed the visible pivot on this frame.', quality: {textureStd: captured.textureStd, patchRadius},
        tracker: {version: captured.template.version, patchRadius, appearance}}});
    }
    commitNotebook(next);
    setMode('marker'); notice('Pivot observed. Choose the center of a distinctive visible marker on this frame.');
  } else {
    await applyMarker(point); notice('Manual marker anchor saved. Track from this frame, or inspect another time.');
  }
}

async function track() {
  if (!state.source || !state.frame || state.tracking || state.seeking) return;
  const anchor = currentRow();
  if (!accepted(anchor)) throw new Error('Choose or correct a visible marker on this frame before tracking.');
  const settings = trackingSettings(), capture = createTemplate(state.frame, anchor.point, settings);
  if (capture.status !== 'ready') throw new Error(`Cannot start tracking: ${capture.reason || capture.status}. Correct the marker or its patch radius.`);
  if (trackedPivot() && !accepted(anchor.pivotMeasurement)) throw new Error('Observe a visible pivot on this same starting frame before tracking.');
  const pivotCapture = trackedPivot() ? createTemplate(state.frame, anchor.pivotMeasurement.point, settings) : null;
  if (pivotCapture && pivotCapture.status !== 'ready') throw new Error(`Cannot track the pivot: ${pivotCapture.reason || pivotCapture.status}. Correct its visible patch.`);
  const endTime = finiteInput('track-until', 'Tracking end time', {min: state.frame.time, max: state.source.duration});
  if (endTime <= state.frame.time + 1e-6) throw new Error('The tracking end must be later than the current marker frame. Seek an earlier start or increase “Track until”.');
  const remaining = Math.ceil((endTime - state.frame.time) / settings.step);
  if (remaining > 4000) throw new Error('This run would exceed 4,000 samples. Choose an earlier tracking end, increase the sample interval, or seek a later start.');
  // A new template supersedes later evidence. The notebook records the removed
  // rows in its revision history, so the earlier run remains recoverable.
  const prepared = calibrateNotebook(truncateMeasurements(state.notebook, {afterTime: state.frame.time}), {...state.notebook.calibration, maxGapSeconds: settings.step * 1.6});
  const epoch = ++state.epoch; state.seekEpoch++; state.controller = new AbortController();
  const controller = state.controller, source = state.source, start = state.frame.time;
  state.tracking = true; state.mode = null; state.cursor = null;
  invalidateStudioExport();
  state.template = capture.template;
  state.notebook = prepared; state.derived = deriveAngles(prepared);
  let last = {...anchor.point}, lastPivot = pivotCapture ? {...anchor.pivotMeasurement.point} : null,
    previousTime = start, processed = 0, duplicates = 0, rejected = false;
  render(); $('tracking-progress').value = 0;
  notice('Tracking local pixels. A rejected match pauses the run and records a gap.');
  try {
    for (let i = 1; i <= remaining; i++) {
      if (epoch !== state.epoch || controller.signal.aborted) break;
      const requested = Math.min(endTime, start + i * settings.step);
      const frame = await source.frameAt(requested, {signal: controller.signal});
      if (epoch !== state.epoch || controller.signal.aborted) break;
      if (frame.time <= previousTime + 1e-8) { duplicates++; if (requested === endTime) break; continue; }
      const result = trackTemplate(frame, capture.template, last, {searchRadius: settings.searchRadius});
      const pivotResult = pivotCapture ? trackTemplate(frame, pivotCapture.template, lastPivot, {searchRadius: settings.searchRadius}) : null;
      const row = {time: frame.time, requestedTime: frame.requestedTime, timeBasis: frame.timeBasis,
        ...(Number.isInteger(frame.frameIndex) ? {frameIndex: frame.frameIndex} : {}),
        point: result.point, candidatePoint: result.candidatePoint, status: result.status, reason: result.reason,
        quality: {score: result.score, runnerUpScore: result.runnerUpScore, ambiguityMargin: result.ambiguityMargin,
          textureStd: result.textureStd, searchClipped: result.searchClipped},
        tracker: {version: result.version, ...result.settings, patchRadius: settings.patchRadius,
          anchorTime: start, anchorPoint: {...anchor.point}}};
      if (pivotResult) row.pivotMeasurement = {status: pivotResult.status, point: pivotResult.point,
        candidatePoint: pivotResult.candidatePoint, reason: pivotResult.reason,
        quality: {score: pivotResult.score, runnerUpScore: pivotResult.runnerUpScore, ambiguityMargin: pivotResult.ambiguityMargin,
          textureStd: pivotResult.textureStd, searchClipped: pivotResult.searchClipped},
        tracker: {version: pivotResult.version, ...pivotResult.settings, patchRadius: settings.patchRadius,
          anchorTime: start, anchorPoint: {...anchor.pivotMeasurement.point}}};
      state.notebook = upsertMeasurement(state.notebook, row);
      state.frame = frame; state.selectedTime = frame.time; previousTime = frame.time; processed++;
      if (result.status === 'accepted') last = {...result.point};
      else rejected = true;
      if (pivotResult?.status === 'accepted') lastPivot = {...pivotResult.point};
      else if (pivotResult) rejected = true;
      state.derived = deriveAngles(state.notebook); render();
      $('tracking-progress').value = i / Math.max(1, remaining);
      $('tracking-status').textContent = `${processed} frames inspected · ${fmt(frame.time, 2)} / ${fmt(endTime, 2)} s${duplicates ? ` · ${duplicates} repeated decoded frames skipped` : ''}`;
      if (rejected) { const failed = result.status !== 'accepted' ? `marker: ${result.reason || result.status}` : `pivot: ${pivotResult.reason || pivotResult.status}`;
        notice(`Tracking paused at ${fmt(frame.time)} s — ${failed}. No angle is derived for this frame. Accepted individual points remain recorded. Inspect the pixels, then re-anchor the pivot and marker on a clear frame to continue.`); break; }
      if (requested === endTime) break;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!rejected && epoch === state.epoch)
      notice(`Tracking complete. ${processed} decoded frames inspected${duplicates ? `; ${duplicates} repeated frame requests skipped` : ''}. Inspect the overlay and angular evidence before exporting.`);
  } finally {
    if (epoch === state.epoch) { state.tracking = false; state.controller = null; render(); }
  }
}

function renderCanvas() {
  const frame = state.frame;
  $('frame-empty').hidden = Boolean(frame);
  if (!frame) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const synthetic = state.notebook?.source.kind.startsWith('synthetic');
    const heading = !state.notebook ? 'Every measurement starts here.' : synthetic ? 'Synthetic pixels unavailable.' : 'Reconnect the source video.';
    const detail = !state.notebook ? 'A fixed pivot. A visible marker. The source pixels behind the result.' : synthetic ? 'The notebook evidence is available. Its declared image generator cannot be reproduced here.' : 'Your saved measurements are available. Reconnect the matching original file to inspect the pixels.';
    $('frame-empty').querySelector('strong').textContent = heading; $('frame-empty').querySelector('p').textContent = detail;
    canvas.setAttribute('aria-label', `${heading} ${detail}`); return;
  }
  if (canvas.width !== frame.width || canvas.height !== frame.height) { canvas.width = frame.width; canvas.height = frame.height; }
  context.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  const scale = frame.width / 640, radius = Math.max(7, 9 * scale), pivot = currentPivot(), row = currentRow();
  context.lineWidth = Math.max(1.5, 1.5 * scale);
  function cross(point, color, ring = false) {
    context.strokeStyle = color; context.beginPath(); context.moveTo(point.x - radius, point.y); context.lineTo(point.x + radius, point.y); context.moveTo(point.x, point.y - radius); context.lineTo(point.x, point.y + radius); context.stroke();
    if (ring) { context.beginPath(); context.arc(point.x, point.y, radius * 1.35, 0, Math.PI * 2); context.stroke(); }
  }
  if (pivot) {
    cross(pivot, trackedPivot() ? '#7ce8f1' : '#d4ed87', true);
    if (trackedPivot()) { const patch = row.pivotMeasurement.tracker?.patchRadius ?? Number($('patch-radius').value);
      context.strokeRect(pivot.x - patch - 2, pivot.y - patch - 2, patch * 2 + 4, patch * 2 + 4); }
    if (accepted(row)) { context.strokeStyle = '#d4ed87a6'; context.setLineDash([5 * scale, 5 * scale]); context.beginPath(); context.moveTo(pivot.x, pivot.y); context.lineTo(row.point.x, row.point.y); context.stroke(); context.setLineDash([]); }
  }
  if (trackedPivot() && !pivot && row?.pivotMeasurement?.candidatePoint) {
    const candidate = row.pivotMeasurement.candidatePoint;
    context.strokeStyle = '#f6a26e'; context.setLineDash([4, 4]);
    context.strokeRect(candidate.x - 11, candidate.y - 11, 22, 22); context.setLineDash([]);
  }
  if (accepted(row)) {
    const patch = row.tracker?.patchRadius ?? Number($('patch-radius').value);
    context.strokeStyle = row.status === 'manual' ? '#fff9d6' : '#d4ed87';
    context.strokeRect(row.point.x - patch - 2, row.point.y - patch - 2, patch * 2 + 4, patch * 2 + 4); cross(row.point, context.strokeStyle);
  } else if (row?.candidatePoint) {
    context.strokeStyle = '#f6a26e'; context.setLineDash([4, 4]);
    context.strokeRect(row.candidatePoint.x - 11, row.candidatePoint.y - 11, 22, 22); context.setLineDash([]);
  }
  if (state.mode && state.cursor) cross(state.cursor, '#ffffff', true);
  canvas.setAttribute('aria-label', `Source frame at ${fmt(frame.time)} seconds. ${row ? `Measurement: ${row.status}.` : 'Unmeasured frame.'} ${state.mode ? `Choose ${state.mode}. Arrow keys move the crosshair; Enter records the point. Coordinates can also be entered in the calibration panel.` : 'Use the timeline to inspect another time.'}`);
}

function svgNode(name, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes || {})) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderChart() {
  const container = $('angle-chart'), samples = state.derived?.samples || [], valid = samples.filter(row => Number.isFinite(row.position));
  if (!valid.length) { container.replaceChildren(Object.assign(document.createElement('p'), {textContent: 'Set the pivot and marker, then track to reveal the measured angle.'})); container.setAttribute('aria-label', 'No angular measurements yet.'); return; }
  const width = 760, height = 220, left = 48, right = 20, top = 14, bottom = 31;
  const minT = Math.min(0, samples[0].time), maxT = Math.max(samples.at(-1).time, minT + .1);
  let minY = Math.min(...valid.map(row => row.position)), maxY = Math.max(...valid.map(row => row.position));
  const padding = Math.max(.08, (maxY - minY) * .15); minY -= padding; maxY += padding;
  const x = t => left + (t - minT) / (maxT - minT) * (width - left - right);
  const y = a => height - bottom - (a - minY) / (maxY - minY) * (height - top - bottom);
  const svg = svgNode('svg', {viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true'});
  for (let i = 0; i < 4; i++) {
    const angle = minY + (maxY - minY) * i / 3, yy = y(angle);
    svg.append(svgNode('line', {x1: left, x2: width - right, y1: yy, y2: yy, stroke: '#e1e7d7'}));
    svg.append(svgNode('text', {x: left - 9, y: yy + 3, 'text-anchor': 'end', fill: '#8a987a', 'font-size': 9}, fmt(angle, 2)));
  }
  for (let i = 0; i <= 4; i++) {
    const time = minT + (maxT - minT) * i / 4;
    svg.append(svgNode('text', {x: x(time), y: height - 9, 'text-anchor': 'middle', fill: '#8a987a', 'font-size': 9}, `${fmt(time, 2)} s`));
  }
  const grouped = new Map();
  for (const row of samples) {
    if (!Number.isFinite(row.position)) { svg.append(svgNode('line', {x1: x(row.time), x2: x(row.time), y1: top, y2: height - bottom, stroke: '#ca8156', 'stroke-opacity': .55, 'stroke-dasharray': '3 4'})); continue; }
    const key = row.segmentId ?? 'unknown'; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row);
  }
  for (const rows of grouped.values()) svg.append(svgNode('path', {d: rows.map((row, i) => `${i ? 'L' : 'M'}${x(row.time).toFixed(2)},${y(row.position).toFixed(2)}`).join(' '), fill: 'none', stroke: '#789b47', 'stroke-width': 2}));
  for (const row of valid) if (row.status === 'manual' || valid.length < 100) svg.append(svgNode('circle', {cx: x(row.time), cy: y(row.position), r: row.status === 'manual' ? 3.5 : 1.8, fill: row.status === 'manual' ? '#244d36' : '#789b47'}));
  const selected = samples.find(row => Math.abs(row.time - (state.frame?.time ?? state.selectedTime)) < 1e-6);
  if (selected) svg.append(svgNode('line', {x1: x(selected.time), x2: x(selected.time), y1: top, y2: height - bottom, stroke: '#334f34', 'stroke-width': 1, 'stroke-dasharray': '2 3'}));
  container.replaceChildren(svg); container.setAttribute('aria-label', `${valid.length} measured angles in ${grouped.size} continuous segments, from ${fmt(valid[0].time)} to ${fmt(valid.at(-1).time)} seconds. Gaps are not interpolated.`);
}

function renderLedger() {
  const tbody = $('measurement-rows'), rows = state.notebook?.measurements || [], angles = new Map((state.derived?.samples || []).map(row => [row.time, row]));
  if (!rows.length) { tbody.replaceChildren(); const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 4; td.className = 'table-empty'; td.textContent = 'No measurements yet.'; tr.append(td); tbody.append(tr); return; }
  const fragment = document.createDocumentFragment(), selectedTime = state.frame?.time ?? state.selectedTime;
  // Keep the complete ledger navigable; cap a single render around the selected frame for long recordings.
  const selectedIndex = Math.max(0, rows.findIndex(row => Math.abs(row.time - selectedTime) < 1e-6));
  const start = rows.length > 300 ? Math.max(0, Math.min(rows.length - 300, selectedIndex - 150)) : 0;
  for (const row of rows.slice(start, start + 300)) {
    const tr = document.createElement('tr');
    if (!measuredPair(row)) tr.classList.add('rejected'); if (Math.abs(row.time - selectedTime) < 1e-6) tr.classList.add('selected');
    const timeCell = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'measurement-time'; button.textContent = fmt(row.time); button.setAttribute('aria-label', `Inspect ${row.status} measurement at ${fmt(row.time)} seconds`);
    button.disabled = state.tracking; button.addEventListener('click', safe(async () => { state.selectedTime = row.time; if (state.source) await seek(row.time); else render(); })); timeCell.append(button); tr.append(timeCell);
    for (const text of [trackedPivot() ? `marker ${row.status} / pivot ${row.pivotMeasurement?.status ?? 'unobserved'}` : row.status, fmt(angles.get(row.time)?.position, 4), fmt(row.quality?.score, 3)]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    fragment.append(tr);
  }
  tbody.replaceChildren(fragment);
  $('ledger-summary').textContent = rows.length > 300 ? `Showing ${start + 1}–${Math.min(start + 300, rows.length)} of ${rows.length} measurements near the selected time. Seek or use “Next gap” to inspect another region.` : `${rows.length} recorded frames. Match score is pixel correlation, not a probability or a position-error bound.`;
}

function renderInspection() {
  const row = currentRow(), summary = $('inspection-summary'), angle = state.derived?.samples.find(sample => sample.time === row?.time);
  const explanations = {
    'score-below-threshold': 'No candidate patch met the minimum match score. Inspect whether the marker is hidden or has changed appearance.',
    'competing-match': 'Multiple patches look similar, so this position is ambiguous. Pick a more distinctive marker or correct the visible point.',
    'search-boundary': 'The best match reached the search boundary. Inspect the frame, then reduce the sampling interval or increase the search radius before retracking.',
    'search-has-no-texture': 'The search area contains too little brightness variation. The marker may be hidden; seek a clear frame and re-anchor it.',
    'insufficient-alternative-patches': 'There are too few usable patches to judge whether the match is unique.',
    'frame-size-changed': 'The decoded frame dimensions changed; the saved template cannot be compared in the same pixel coordinates.',
    'search-outside-image': 'The search area falls outside the image. Inspect the marker and its search radius.',
    'marker_too_close_to_pivot': 'The marker is too close to the fixed pivot to determine an angle.',
  };
  summary.classList.toggle('bad-state', Boolean(row && (!accepted(row) || angle?.position === null)));
  if (!row) summary.textContent = state.frame ? `This decoded frame at ${fmt(state.frame.time)} s has no measurement. Choose a visible marker or mark the frame missing.` : 'Select a measurement to inspect its status. Reconnect the source video to review or correct its pixels.';
  else summary.textContent = `${fmt(row.time)} s · ${row.status}${row.point ? ` · (${fmt(row.point.x, 2)}, ${fmt(row.point.y, 2)}) px` : ' · no observed position'}${Number.isFinite(angle?.position) ? ` · θ ${fmt(angle.position, 4)} rad` : ''}${Number.isFinite(row.quality?.score) ? ` · match ${fmt(row.quality.score)}` : ''}. ${explanations[angle?.reason || row.reason] || row.reason || ''}${row.candidatePoint && !row.point ? ' The dashed orange candidate is diagnostic only; it is not recorded as a position.' : ''}`;
  if (row && trackedPivot()) summary.textContent += ` Pivot: ${row.pivotMeasurement?.status ?? 'unobserved'}${row.pivotMeasurement?.point ? ` at (${fmt(row.pivotMeasurement.point.x, 2)}, ${fmt(row.pivotMeasurement.point.y, 2)}) px` : ' — no observed pivot, so no angular measurement'}. ${row.pivotMeasurement?.reason ?? ''}`;
  const diagnostics = $('match-diagnostics'); diagnostics.replaceChildren();
  const entries = !row ? [['State', 'No measurement selected']] : [
    ['Recorded time', `${fmt(row.time, 4)} s`],
    ['Requested seek', Number.isFinite(row.requestedTime) ? `${fmt(row.requestedTime, 4)} s` : 'Not supplied'],
    ['Clock basis', {'decoded-media-time': 'Decoded media PTS', 'requested-seek-time': 'Nominal seek only', 'synthetic-time': 'Generated frame time', 'user-supplied': 'User supplied'}[row.timeBasis] || 'Not declared'],
    ['Best match score', fmt(row.quality?.score, 4)], ['Runner-up score', fmt(row.quality?.runnerUpScore, 4)],
    ['Uniqueness margin', fmt(row.quality?.ambiguityMargin, 4)], ['Texture spread', fmt(row.quality?.textureStd, 2)],
    ['Search clipped', row.quality?.searchClipped === undefined ? '—' : row.quality.searchClipped ? 'At image edge' : 'No'],
    ['Template anchor', Number.isFinite(row.tracker?.anchorTime) ? `${fmt(row.tracker.anchorTime, 3)} s` : row.status === 'manual' ? 'Manual anchor' : 'Not supplied'],
    ['Patch appearance', appearanceLabel(row.tracker)],
  ];
  if (row && trackedPivot()) entries.push(['Pivot state', row.pivotMeasurement?.status ?? 'Unobserved'],
    ['Pivot appearance', appearanceLabel(row.pivotMeasurement?.tracker)],
    ['Pivot match score', fmt(row.pivotMeasurement?.quality?.score, 4)],
    ['Pivot runner-up', fmt(row.pivotMeasurement?.quality?.runnerUpScore, 4)],
    ['Pivot uniqueness margin', fmt(row.pivotMeasurement?.quality?.ambiguityMargin, 4)],
    ['Pivot clock', 'Same enclosing decoded frame as marker']);
  for (const [label, value] of entries) { const item = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd'); term.textContent = label; detail.textContent = value; item.append(term, detail); diagnostics.append(item); }
}

function renderSegments() {
  const select = $('segment-select'), segments = state.derived?.segments || [];
  const old = state.segmentId;
  if (segments.length === 1) state.segmentId = segments[0].id;
  else if (!segments.some(segment => String(segment.id) === String(old))) state.segmentId = null;
  const options = [];
  if (segments.length !== 1) options.push(Object.assign(document.createElement('option'), {value: '', textContent: segments.length ? 'Choose a segment explicitly…' : 'No measured segment'}));
  for (const segment of segments) options.push(Object.assign(document.createElement('option'), {value: String(segment.id), textContent: `${segment.id} · ${fmt(segment.startTime, 2)}–${fmt(segment.endTime, 2)} s · ${segment.count} points`}));
  select.replaceChildren(...options); select.value = state.segmentId === null ? '' : String(state.segmentId); select.disabled = !segments.length || state.tracking;
  $('angle-summary').textContent = `${segments.length} continuous evidence segment${segments.length === 1 ? '' : 's'}. Angles unwrap only within each segment. ${segments.length > 1 ? 'Choose a segment explicitly for derivative export; separate segments are never joined.' : 'Rejected points and large time or angle jumps break continuity.'}`;
  const warnings = state.derived?.diagnostics?.warnings || [];
  const descriptions = {pivot_measurement_gaps: 'A marker was observed without an accepted pivot on the same frame. Its pixels remain recorded; no fixed pivot or interpolated angle fills the gap.', time_gap_split: 'A time gap exceeded the declared continuity limit.', angular_step_split: 'An angular jump exceeded the declared limit.', radius_varies_check_pivot_perspective_and_tracking: 'The marker-to-pivot radius varies by more than 15%. Review the pivot, perspective, and marker drift before interpreting this as rigid rotation.', nominal_video_timestamps: 'Some video timestamps are nominal seek positions. The torque export requires decoded frame timestamps and will refuse those segments.'};
  $('angle-diagnostics').hidden = !warnings.length;
  $('angle-diagnostics').textContent = warnings.map(warning => descriptions[warning] || warning).join(' ');
}

function render() {
  const notebook = state.notebook, source = notebook?.source, hasFrame = Boolean(state.frame), calibrated = Boolean(notebook?.calibration?.pivot), busy = state.tracking, measuring = state.tracking || state.seeking;
  const rows = notebook?.measurements || [], valid = rows.filter(measuredPair), gaps = rows.filter(row => !measuredPair(row));
  $('source-kind').textContent = source ? source.kind?.startsWith('synthetic') ? 'Generated pixels · synthetic' : 'Local video · user supplied' : 'No source loaded';
  $('source-name').textContent = source?.label || 'Your mechanism, in view.';
  $('source-detail').textContent = source ? `${source.width} × ${source.height} pixels · ${fmt(source.duration, 2)} s${!state.source ? ' · video disconnected' : ''}. ${trackedPivot() ? 'Both patches are measured in each frame. Common image translation cancels; camera rotation and perspective do not.' : 'Keep the camera fixed and the marker appearance stable; inspect rotating or deforming patterns for drift.'}` : 'Use approximately planar motion and stable image orientation. A tracked pivot can follow image translation; it does not recover camera pose.';
  $('source-provenance').textContent = source ? JSON.stringify(source, null, 2) : 'A loaded source will have a recorded identity.';
  $('attach-video').hidden = !notebook || Boolean(state.source) || source.kind?.startsWith('synthetic');
  $('save-notebook').disabled = !notebook || busy;
  for (const id of ['pick-pivot', 'previous-frame', 'next-frame', 'timeline', 'seek-time', 'seek-frame']) $(id).disabled = !hasFrame || busy;
  $('pick-pivot').disabled = !hasFrame || measuring;
  for (const id of ['pick-marker', 'correct-point', 'mark-missing']) $(id).disabled = !hasFrame || !calibrated || measuring;
  $('apply-reference').disabled = !calibrated || measuring;
  for (const id of ['zero-angle', 'angle-direction', 'pixel-sigma', 'pivot-pixel-sigma', 'pivot-mode']) $(id).disabled = measuring;
  $('pivot-noise-field').hidden = $('pivot-mode').value !== 'tracked';
  $('apply-point').disabled = !state.mode || measuring;
  $('track-motion').disabled = !hasFrame || !calibrated || !measuredPair(currentRow()) || measuring;
  $('track-motion').hidden = busy; $('cancel-tracking').hidden = !busy; $('tracking-progress').hidden = !busy;
  for (const id of ['sample-step', 'search-radius', 'patch-radius']) $(id).disabled = busy;
  $('appearance-mode').disabled = measuring;
  $('track-until').disabled = !hasFrame || busy;
  $('next-gap').disabled = !gaps.length || busy;
  $('pick-pivot').setAttribute('aria-pressed', String(state.mode === 'pivot'));
  $('pick-marker').setAttribute('aria-pressed', String(state.mode === 'marker' || state.mode === 'correct'));
  $('pivot-step').classList.toggle('complete', calibrated); $('pivot-step').classList.toggle('active', state.mode === 'pivot');
  $('marker-step').classList.toggle('complete', valid.length > 0); $('marker-step').classList.toggle('active', state.mode === 'marker' || state.mode === 'correct');
  $('calibration-status').textContent = calibrated ? trackedPivot() ? `Tracked pivot: ${currentPivot() ? `(${fmt(currentPivot().x, 1)}, ${fmt(currentPivot().y, 1)}) px on this frame` : 'not observed on this frame'}. Set pivot to observe or correct its visible patch; every angle needs both points.` : `Fixed pivot: (${fmt(notebook.calibration.pivot.x, 1)}, ${fmt(notebook.calibration.pivot.y, 1)}) px. ${state.mode ? `Now placing ${state.mode === 'pivot' ? 'pivot' : 'marker'}.` : 'Click “Set pivot” to revise the angular reference.'}` : 'Coordinates use the decoded source pixels.';
  $('angle-convention').textContent = calibrated ? `Zero: ${fmt(notebook.calibration.zeroAngle * 180 / Math.PI, 1)}° from image down · positive toward image ${notebook.calibration.direction === 1 ? 'right' : 'left'}. Assumed marker noise: ${fmt(notebook.calibration.pixelSigma, 1)} px${trackedPivot() ? `; independent pivot noise: ${fmt(notebook.calibration.pivotPixelSigma, 1)} px` : ''}.` : 'θ = 0 vertically down · positive toward image right · radians';
  $('apply-point').textContent = state.mode === 'pivot' ? 'Apply pivot' : state.mode ? 'Apply marker' : 'Choose pivot or marker first';
  $('frame-kind').textContent = !source ? 'WAITING FOR SOURCE' : source.kind?.startsWith('synthetic') ? 'SYNTHETIC PIXEL SEQUENCE' : 'LOCAL VIDEO PIXELS';
  $('frame-state').textContent = currentRow() && trackedPivot() ? `Marker ${currentRow().status} · pivot ${currentRow().pivotMeasurement?.status ?? 'unobserved'}` : currentRow()?.status || (hasFrame ? 'Unmeasured frame' : notebook ? 'Reconnect source video' : 'No frame');
  $('frame-time').textContent = hasFrame ? `${state.frame.timeBasis === 'requested-seek-time' ? '≈ ' : ''}${fmt(state.frame.time)} s` : '— s';
  $('frame-time').title = hasFrame ? state.frame.timeBasis === 'requested-seek-time' ? 'Nominal seek position; exact decoded frame timestamp unavailable.' : `Frame clock: ${state.frame.timeBasis}` : '';
  $('frame-size').textContent = hasFrame ? `${state.frame.width} × ${state.frame.height} px` : '— × — px';
  if (state.source) { $('timeline').max = String(state.source.duration); $('seek-time').max = String(state.source.duration); }
  if (hasFrame) { $('timeline').value = String(state.frame.time); if (document.activeElement !== $('seek-time')) $('seek-time').value = fmt(state.frame.time, 3); }
  $('frame-guidance').textContent = state.mode ? `Place ${state.mode === 'pivot' ? 'pivot' : 'marker'}: click, use arrow keys + Enter, or enter coordinates.` : !hasFrame ? 'Select or reconnect a source to inspect the pixels.' : 'Source pixels with measurement overlays. Use the timeline to inspect.';
  $('accepted-count').textContent = String(valid.length); $('manual-count').textContent = String(rows.filter(row => row.status === 'manual').length);
  $('gap-count').textContent = String(gaps.length); $('measured-span').textContent = valid.length > 1 ? `${fmt(valid.at(-1).time - valid[0].time, 2)} s` : '—';
  renderCanvas(); renderChart(); renderLedger(); renderInspection(); renderSegments();
  $('export-angles').disabled = !valid.length || busy;
  $('confirm-physics').disabled = !calibrated || busy || trackedPivot();
  $('export-studio').disabled = !valid.length || busy || trackedPivot() || !$('confirm-physics').checked;
}

$('load-video').addEventListener('click', () => { state.attachIntent = false; $('video-file').value = ''; $('video-file').click(); });
$('attach-video').addEventListener('click', () => { state.attachIntent = true; $('video-file').value = ''; $('video-file').click(); });
$('video-file').addEventListener('change', safe(event => { const attach = state.attachIntent; state.attachIntent = false; return openVideo(event.target.files[0], attach); }));
$('open-notebook').addEventListener('click', () => { $('notebook-file').value = ''; $('notebook-file').click(); });
$('notebook-file').addEventListener('change', safe(event => openNotebook(event.target.files[0])));
$('save-notebook').addEventListener('click', safe(() => { if (state.notebook) { fileDownload('worldlaw-motion-notebook.json', validateNotebook(state.notebook)); notice('Motion notebook saved with source provenance, calibration, measurements, rejected states, and revision history. Media bytes are not included.'); } }));
$('load-demo').addEventListener('click', safe(async () => { stopWork(); await installSource(createDemoSource({occlusion: $('demo-occlusion').checked}), {syntheticCalibration: true}); }));
$('pick-pivot').addEventListener('click', safe(() => setMode('pivot')));
$('appearance-mode').addEventListener('change', safe(() => {
  trackingSettings(); state.template = null;
  notice('Patch appearance changed for the next capture and run. Existing measurements retain their original algorithm and match scores. Color differences require stable source colors; duplicate or uncertain matches still pause.');
}));
$('pivot-mode').addEventListener('change', safe(() => {
  if (state.notebook?.calibration) commitNotebook(calibrateNotebook(state.notebook, {...state.notebook.calibration, ...referenceSettings()}));
  state.template = null;
  if ($('pivot-mode').value === 'tracked') {
    if (state.frame) setMode('pivot');
    notice('Tracked pivot selected. Observe its distinctive visible patch on this frame. Existing marker measurements remain; unobserved pivots are gaps. Camera rotation and perspective remain assumptions.');
  } else notice('Fixed pivot selected. Angles use the single explicitly calibrated image point.');
  render();
}));
$('apply-reference').addEventListener('click', safe(() => {
  if (!state.notebook?.calibration || state.tracking || state.seeking) return;
  commitNotebook(calibrateNotebook(state.notebook, {...state.notebook.calibration, ...referenceSettings()}));
  notice('Angular reference updated. Existing pixel measurements are preserved and their angles are recomputed using your declared reference and point-noise assumption.');
}));
$('pick-marker').addEventListener('click', safe(() => setMode('marker')));
$('correct-point').addEventListener('click', safe(() => { setMode('correct'); notice('Choose the visible marker center. This correction will be recorded as a manual anchor; “Track” captures a fresh template from it.'); canvas.focus(); }));
$('apply-point').addEventListener('click', safe(() => applyPoint({x: finiteInput('point-x', 'X coordinate', {min: 0, max: state.frame.width - 1}), y: finiteInput('point-y', 'Y coordinate', {min: 0, max: state.frame.height - 1})})));
canvas.addEventListener('click', safe(event => {
  if (!state.mode || !state.frame || state.tracking) return;
  const rect = canvas.getBoundingClientRect(), scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
  const x = (event.clientX - rect.left - (rect.width - canvas.width * scale) / 2) / scale;
  const y = (event.clientY - rect.top - (rect.height - canvas.height * scale) / 2) / scale;
  return applyPoint({x, y});
}));
canvas.addEventListener('keydown', safe(async event => {
  if (!state.frame || state.tracking) return;
  if (state.mode) {
    const delta = event.shiftKey ? 10 : 1;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); state.cursor ||= {x: state.frame.width / 2, y: state.frame.height / 2};
      state.cursor.x = Math.max(0, Math.min(state.frame.width - 1, state.cursor.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0)));
      state.cursor.y = Math.max(0, Math.min(state.frame.height - 1, state.cursor.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0)));
      updateCoordinateInputs(); renderCanvas();
    } else if (event.key === 'Enter') { event.preventDefault(); await applyPoint({...state.cursor}); }
    else if (event.key === 'Escape') { state.mode = null; state.cursor = null; render(); }
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); await seek(state.frame.time + (event.key === 'ArrowLeft' ? -1 : 1) * trackingSettings().step); }
}));
$('timeline').addEventListener('input', safe(event => seek(Number(event.target.value))));
$('seek-frame').addEventListener('click', safe(() => seek(finiteInput('seek-time', 'Seek time', {min: 0, max: state.source.duration}))));
$('seek-time').addEventListener('keydown', safe(event => { if (event.key === 'Enter') { event.preventDefault(); return seek(finiteInput('seek-time', 'Seek time', {min: 0, max: state.source.duration})); } }));
$('previous-frame').addEventListener('click', safe(() => seek(state.frame.time - trackingSettings().step)));
$('next-frame').addEventListener('click', safe(() => seek(state.frame.time + trackingSettings().step)));
$('track-motion').addEventListener('click', safe(track));
$('cancel-tracking').addEventListener('click', () => { stopWork(); render(); notice('Tracking stopped. Completed measurements are retained; unprocessed frames remain unmeasured.'); });
$('mark-missing').addEventListener('click', safe(() => { commitNotebook(upsertMeasurement(state.notebook, {time: state.frame.time, requestedTime: state.frame.requestedTime, timeBasis: state.frame.timeBasis, point: null, status: 'missing', reason: 'User marked this frame as missing or not reliably observable.', ...(currentRow()?.pivotMeasurement ? {pivotMeasurement: currentRow().pivotMeasurement} : {})})); state.template = null; notice('Frame marked missing. No angle will be interpolated across this observation.'); }));
$('next-gap').addEventListener('click', safe(async () => { const gaps = state.notebook.measurements.filter(row => !measuredPair(row)); const row = gaps.find(row => row.time > (state.frame?.time ?? state.selectedTime) + 1e-6) || gaps[0]; if (row) { state.selectedTime = row.time; if (state.source) await seek(row.time); else render(); } }));
$('segment-select').addEventListener('change', event => { const selected = state.derived.segments.find(segment => String(segment.id) === event.target.value); state.segmentId = selected?.id ?? null; });
$('confirm-physics').addEventListener('change', render);
for (const id of ['known-inertia', 'declared-command', 'position-sigma']) $(id).addEventListener('input', () => { invalidateStudioExport(); render(); });
$('export-angles').addEventListener('click', safe(() => { fileDownload('worldlaw-angular-evidence.json', exportAngular(state.notebook, state.segmentId === null ? {} : {segmentId: state.segmentId})); notice('Angular evidence exported. Keep the Motion notebook for the full pixel ledger, gaps, calibration, and supplied provenance.'); }));
$('export-studio').addEventListener('click', safe(() => {
  const inertia = finiteInput('known-inertia', 'Known inertia', {min: 1e-12, max: 1e12});
  const command = finiteInput('declared-command', 'Explicit constant applied torque', {min: -1e6, max: 1e6});
  const positionSigma = $('position-sigma').value.trim() ? finiteInput('position-sigma', 'Angle noise assumption', {min: 0, max: 1e6}) : null;
  const exported = exportStudio(state.notebook, {inertia, command, positionSigma, confirmKnownDynamics: $('confirm-physics').checked, ...(state.segmentId === null ? {} : {segmentId: state.segmentId})});
  fileDownload('worldlaw-motion-studio-observations.json', exported);
  $('studio-export-status').textContent = `Exported ${exported.observations?.length ?? 'derived'} observations from the selected continuous segment. Open the torque studio and choose “Import observations”. Inertia, command, and differentiation assumptions are retained in the export.`;
  notice('Studio observation JSON exported. These torque values are derived estimates from measured angles and your declared dynamics.');
}));
window.addEventListener('beforeunload', () => { state.controller?.abort(); state.source?.dispose(); });
render();
