/** Source-observation adapter for MECHANISM's maintained path classifier.
 * A circular image path offers a conditional reference, not a physical joint.
 */
import {classifyPath, geometricResidual} from './vendor/mechanism-core.mjs';
import {validateNotebook, calibrateNotebook} from './measurement.mjs';

export const PATH_REFERENCE_METHOD = 'mechanism.path-classifier/792f876916b5323510c2e8d7ce1f0a2377515afe';
const valid = row => row.status === 'accepted' || row.status === 'manual';
const insist = (condition, message) => { if (!condition) throw new Error(message); };
function bounded(value, name, min, max) {
  insist(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    name + ' must be a finite number from ' + min + ' to ' + max + '.');
  return value;
}
function settings(input = {}) {
  insist(input && typeof input === 'object' && !Array.isArray(input), 'Supply path-reference settings.');
  const result = {
    maxGapSeconds: bounded(input.maxGapSeconds ?? .25, 'Maximum source gap', .001, 86400),
    maxResidualPixels: bounded(input.maxResidualPixels ?? 2, 'Maximum radial discrepancy', 0, 100)
  };
  if (input.courseId !== undefined && input.courseId !== null) {
    insist(Number.isInteger(input.courseId) && input.courseId >= 0, 'Choose a continuous source course.');
    result.courseId = input.courseId;
  }
  return result;
}
function coursesFrom(nb, gap) {
  const courses = [];
  let course = null, previous = null;
  nb.measurements.forEach((row, sourceIndex) => {
    if (!valid(row)) { course = null; previous = null; return; }
    if (!course || row.time - previous.time > gap) {
      course = {id: courses.length, sourceIndices: [], startTime: row.time, endTime: row.time, count: 0};
      courses.push(course);
    }
    course.sourceIndices.push(sourceIndex); course.count++; course.endTime = row.time; previous = row;
  });
  return courses;
}
export function pathReferenceCourses(input, {maxGapSeconds = .25} = {}) {
  const nb = validateNotebook(input);
  bounded(maxGapSeconds, 'Maximum source gap', .001, 86400);
  return coursesFrom(nb, maxGapSeconds);
}
export function proposePathReference(input, options = {}) {
  const nb = validateNotebook(input), request = settings(options);
  insist(nb.calibration?.pivotMode !== 'tracked',
    'Path reference inference requires a fixed camera. Keep the independently tracked pivot, or explicitly select fixed-reference mode.');
  const courses = coursesFrom(nb, request.maxGapSeconds);
  insist(courses.length, 'Track or mark a visible marker before inferring its reference.');
  if (request.courseId === undefined) {
    insist(courses.length === 1, 'Choose one continuous source course; gaps are never bridged for fitting.');
    request.courseId = courses[0].id;
  }
  const course = courses.find(row => row.id === request.courseId);
  insist(course, 'The selected continuous source course no longer exists.');
  const rows = course.sourceIndices.map(i => nb.measurements[i]);
  const comparison = classifyPath(rows.map(row => ({...row.point, status: row.status})));
  const base = {method: PATH_REFERENCE_METHOD, request, course, comparison,
    trainingSourceIndices: comparison.trainingIndices.map(i => course.sourceIndices[i]),
    checkSourceIndices: comparison.validationIndices.map(i => course.sourceIndices[i]),
    // Transient binding: never serialized as a trusted cached conclusion.
    snapshot: JSON.stringify(nb), status: 'unresolved', reason: comparison.reason,
    maximumResidualPixels: null};
  if (comparison.status !== 'supported' || comparison.selected !== 'circular')
    return {...base, reason: comparison.selected === 'linear' ? 'linear_path' : comparison.reason};
  const circle = comparison.circle;
  const residuals = rows.map(row => geometricResidual(circle, row.point));
  const maximumResidualPixels = Math.max(...residuals);
  const result = {...base, maximumResidualPixels, residuals};
  if (maximumResidualPixels > request.maxResidualPixels)
    return {...result, reason: 'radial_discrepancy_exceeds_declaration'};
  if (circle.center.x < 0 || circle.center.x > nb.source.width - 1 ||
      circle.center.y < 0 || circle.center.y > nb.source.height - 1)
    return {...result, reason: 'inferred_reference_outside_image'};
  if (circle.radius < 2) return {...result, reason: 'insufficient_radius'};
  return {...result, status: 'candidate', reason: null, pivot: {...circle.center}, radius: circle.radius};
}
export function applyPathReference(input, preview, reference = {}) {
  const nb = validateNotebook(input);
  insist(preview && preview.snapshot === JSON.stringify(nb),
    'Source evidence or calibration changed. Infer the reference again before applying it.');
  // Recompute from original input. A changed/forged cached pivot cannot become calibration.
  const fresh = proposePathReference(nb, preview.request);
  insist(fresh.status === 'candidate', 'The original course does not support an applicable circular reference.');
  const next = calibrateNotebook(nb, {...(nb.calibration || {}), ...reference,
    pivot: fresh.pivot, pivotMode: 'fixed', maxGapSeconds: fresh.request.maxGapSeconds});
  const event = {
    type: 'path-reference', method: PATH_REFERENCE_METHOD,
    source: structuredClone(nb.source), settings: fresh.request, pivot: fresh.pivot,
    sourceObservations: fresh.course.sourceIndices.map(sourceIndex => {
      const row = nb.measurements[sourceIndex];
      return {sourceIndex, time: row.time, status: row.status, point: {...row.point}};
    }),
    trainingSourceIndices: fresh.trainingSourceIndices, checkSourceIndices: fresh.checkSourceIndices,
    maximumResidualPixels: fresh.maximumResidualPixels,
    interpretation: 'Explicitly accepted fixed image reference fitted from the same marker observations. Not a measured physical pivot; angular noise propagation conditions on this point as exact.'
  };
  next.revisions = [...next.revisions, event].slice(-512);
  return validateNotebook(next);
}
