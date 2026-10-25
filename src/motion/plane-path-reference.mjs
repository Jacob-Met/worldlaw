/** Conditional reference inference in a caller-declared metric plane.
 * The maintained classifier fits one original continuous course. No physical
 * pivot, camera calibration or reference uncertainty is established here.
 */
import {classifyPath} from './vendor/mechanism-core.mjs';
import {validateNotebook, calibrateNotebook} from './measurement.mjs';
import {pathReferenceCourses, PATH_REFERENCE_METHOD} from './path-reference.mjs';
import {admitMetricPlane, metricPoint, PLANE_CONVENTION} from './metric-plane.mjs';

export const PLANE_PATH_REFERENCE_METHOD = 'worldlaw.rectified-path-reference/v1';
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const bounded = (value, name, minimum, maximum) => {
  insist(Number.isFinite(value) && value >= minimum && value <= maximum,
    `${name} must be a finite number from ${minimum} to ${maximum}.`);
  return value;
};
const span = points => Math.hypot(
  Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
  Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)));
function pairSpan(points) {
  let total = 0, count = 0;
  for (let i = 0; i < points.length; i++) for (let j = 0; j < i; j++) {
    total += (points[i].x - points[j].x) ** 2 + (points[i].y - points[j].y) ** 2;
    count++;
  }
  return Math.sqrt(total / count);
}
function normalization(pairs) {
  const plane = pairs.map(p => p.plane), image = pairs.map(p => p.image);
  const scale = pairSpan(image) / pairSpan(plane);
  insist(Number.isFinite(scale) && scale > 0, 'The declared reference spans must support a finite common scale.');
  // The classifier uses axis-aligned spread. Fix its orientation to an original
  // reference pair so a mere rotation of declared plane axes cannot change its
  // gates. Choose that pair by original image geometry, independent of supplied
  // plane coordinates or pair ordering.
  const ordered = [...pairs].sort((a, b) => a.image.x - b.image.x || a.image.y - b.image.y);
  let anchor = null, largest = -1;
  for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
    const length = Math.hypot(ordered[j].image.x - ordered[i].image.x, ordered[j].image.y - ordered[i].image.y);
    if (length > largest) { largest = length; anchor = [ordered[i], ordered[j]]; }
  }
  const dx = anchor[1].plane.x - anchor[0].plane.x, dy = anchor[1].plane.y - anchor[0].plane.y;
  const length = Math.hypot(dx, dy);
  insist(Number.isFinite(length) && length > 0, 'The original reference pair must define a plane direction.');
  const axes = {x: {x: dx / length, y: dy / length}, y: {x: -dy / length, y: dx / length}};
  const origin = {x: plane.reduce((sum, p) => sum + p.x / 4, 0),
    y: plane.reduce((sum, p) => sum + p.y / 4, 0)};
  return {scale, origin, axes, imageDirectionPair: anchor.map(p => ({...p.image})),
    meaning: 'Original image reference pair RMS / declared plane reference pair RMS, oriented by the longest original image-reference pair; classifier units are reference-normalized pixels, not measured source pixels.'};
}
function projectedArc(plane, circle, points) {
  const tau = 2 * Math.PI;
  const angles = points.map(p => (Math.atan2(p.y - circle.center.y, p.x - circle.center.x) + tau) % tau).sort((a, b) => a - b);
  let largest = -1, start = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + tau;
    if (next - angles[i] > largest) { largest = next - angles[i]; start = next % tau; }
  }
  return Array.from({length: 129}, (_, i) => {
    const a = start + (tau - largest) * i / 128;
    const p = metricPoint(plane.inverse, {x: circle.center.x + circle.radius * Math.cos(a),
      y: circle.center.y + circle.radius * Math.sin(a)});
    return {x: p.x, y: p.y};
  });
}

export function proposePlanePathReference(input, declaration, options = {}) {
  const nb = validateNotebook(input), plane = admitMetricPlane(declaration, nb.source);
  insist(nb.calibration?.pivotMode !== 'tracked',
    'Keep the independently tracked pivot. Rectified path inference requires an explicitly fixed reference.');
  const request = {maxGapSeconds: bounded(options.maxGapSeconds ?? .25, 'Maximum source gap', .001, 86400),
    maxResidualPixels: bounded(options.maxResidualPixels ?? 2, 'Maximum projected radial discrepancy', 0, 100)};
  const courses = pathReferenceCourses(nb, request);
  insist(courses.length, 'Track or mark a visible marker before inferring its reference.');
  if (options.courseId === undefined || options.courseId === null) {
    insist(courses.length === 1, 'Choose one continuous source course; gaps are never bridged for fitting.');
    request.courseId = courses[0].id;
  } else {
    insist(Number.isInteger(options.courseId) && options.courseId >= 0, 'Choose a continuous source course.');
    request.courseId = options.courseId;
  }
  const course = courses.find(c => c.id === request.courseId);
  insist(course, 'The selected continuous source course no longer exists.');
  const rows = course.sourceIndices.map(i => nb.measurements[i]);
  const normalized = normalization(plane.input.pairs);
  const points = rows.map(row => metricPoint(plane.matrix, row.point));
  const comparison = classifyPath(points.map((p, i) => {
    const dx = p.x - normalized.origin.x, dy = p.y - normalized.origin.y;
    return {x: (dx * normalized.axes.x.x + dy * normalized.axes.x.y) * normalized.scale,
      y: (dx * normalized.axes.y.x + dy * normalized.axes.y.y) * normalized.scale, status: rows[i].status};
  }));
  const base = {method: PLANE_PATH_REFERENCE_METHOD, classifierMethod: PATH_REFERENCE_METHOD,
    request, course, comparison, declaration: plane.input, normalization: normalized,
    snapshot: JSON.stringify(nb), planeSnapshot: JSON.stringify(plane.input),
    trainingSourceIndices: comparison.trainingIndices.map(i => course.sourceIndices[i]),
    checkSourceIndices: comparison.validationIndices.map(i => course.sourceIndices[i]),
    status: 'unresolved', reason: comparison.reason, maximumResidualPixels: null,
    residualDefinition: 'Distance from an original pixel to the inverse projection of its radial projection onto the fitted plane circle; not the nearest image-conic distance.'};
  if (comparison.reason === 'insufficient_points') return base;
  if (span(rows.map(r => r.point)) < 12) return {...base, reason: 'insufficient_image_spread'};
  if (comparison.status !== 'supported' || comparison.selected !== 'circular')
    return {...base, reason: comparison.selected === 'linear' ? 'linear_path' : comparison.reason};
  const circle = {center: {
    x: (comparison.circle.center.x * normalized.axes.x.x + comparison.circle.center.y * normalized.axes.y.x) / normalized.scale + normalized.origin.x,
    y: (comparison.circle.center.x * normalized.axes.x.y + comparison.circle.center.y * normalized.axes.y.y) / normalized.scale + normalized.origin.y},
  radius: comparison.circle.radius / normalized.scale};
  if (comparison.circle.radius < 2) return {...base, reason: 'insufficient_radius'};
  let pivot, residuals, projectedPath;
  try {
    const center = metricPoint(plane.inverse, circle.center);
    pivot = {x: center.x, y: center.y};
    residuals = points.map((p, i) => {
      const dx = p.x - circle.center.x, dy = p.y - circle.center.y, distance = Math.hypot(dx, dy);
      insist(distance > 0, 'An original point coincides with the proposed plane center.');
      const radial = metricPoint(plane.inverse, {x: circle.center.x + dx * circle.radius / distance,
        y: circle.center.y + dy * circle.radius / distance});
      return Math.hypot(radial.x - rows[i].point.x, radial.y - rows[i].point.y);
    });
    projectedPath = projectedArc(plane, circle, points);
  } catch {
    return {...base, planeCircle: circle, reason: 'projected_path_not_finite'};
  }
  const maximumResidualPixels = Math.max(...residuals);
  const result = {...base, planeCircle: circle, residuals, maximumResidualPixels};
  if (maximumResidualPixels > request.maxResidualPixels)
    return {...result, reason: 'radial_discrepancy_exceeds_declaration'};
  if (pivot.x < 0 || pivot.x > nb.source.width - 1 || pivot.y < 0 || pivot.y > nb.source.height - 1)
    return {...result, reason: 'inferred_reference_outside_image'};
  return {...result, pivot, projectedPath, status: 'candidate', reason: null};
}

export function applyPlanePathReference(input, declaration, preview, reference = {}) {
  const nb = validateNotebook(input), plane = admitMetricPlane(declaration, nb.source);
  insist(preview?.snapshot === JSON.stringify(nb) && preview.planeSnapshot === JSON.stringify(plane.input),
    'Source evidence or plane calibration changed. Infer the reference again before applying it.');
  const fresh = proposePlanePathReference(nb, plane.input, preview.request);
  insist(fresh.status === 'candidate', 'The original rectified course does not support an applicable circular reference.');
  const next = calibrateNotebook(nb, {...(nb.calibration || {}), ...reference,
    pivot: fresh.pivot, pivotMode: 'fixed', plane: plane.input,
    convention: PLANE_CONVENTION, maxGapSeconds: fresh.request.maxGapSeconds});
  next.revisions = [...next.revisions, {
    type: 'path-reference', method: PLANE_PATH_REFERENCE_METHOD, classifierMethod: PATH_REFERENCE_METHOD,
    source: structuredClone(nb.source), settings: fresh.request, pivot: fresh.pivot,
    plane: plane.input, planeCircle: fresh.planeCircle, normalization: fresh.normalization,
    sourceObservations: fresh.course.sourceIndices.map(sourceIndex => ({sourceIndex,
      ...structuredClone(nb.measurements[sourceIndex])})),
    trainingSourceIndices: fresh.trainingSourceIndices, checkSourceIndices: fresh.checkSourceIndices,
    maximumResidualPixels: fresh.maximumResidualPixels, residualDefinition: fresh.residualDefinition,
    interpretation: 'Explicitly accepted conditional fixed reference fitted from the same original marker observations after caller-declared plane rectification. Not a measured physical pivot. Angle-noise propagation conditions on this point and plane as exact, excluding their uncertainty.'
  }].slice(-512);
  return validateNotebook(next);
}
