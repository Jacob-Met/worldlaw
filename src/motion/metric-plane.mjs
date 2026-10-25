/** Source-bound metric-plane declaration. Original image observations remain authoritative. */
import {fitPlaneHomography, applyPlaneHomography, requireFinitePlaneDomain,
  requirePlaneDifferential} from './vendor/plane-homography.mjs';

export const METRIC_PLANE_SCHEMA = 'worldlaw.metric-plane/v1';
export const PLANE_CONVENTION = 'plane_positive_y_zero_positive_x';
export const PLANE_ASSUMPTIONS = Object.freeze(['samePlane', 'fixedCamera', 'metricCoordinates', 'negligibleLensDistortion']);
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const inRaster = (p, source) => p && [p.x, p.y].every(Number.isFinite)
  && p.x >= 0 && p.y >= 0 && p.x <= source.width - 1 && p.y <= source.height - 1;

/** Fit every time from the four retained declarations, never from a cached matrix. */
export function admitMetricPlane(input, source) {
  insist(input?.schema === METRIC_PLANE_SCHEMA, 'Choose a worldlaw.metric-plane/v1 declaration.');
  insist(/^[a-f0-9]{64}$/i.test(source?.sha256 || ''),
    'Metric-plane calibration requires an identified original video (SHA-256).');
  insist(typeof input.source?.sha256 === 'string'
    && input.source.sha256.toLowerCase() === source.sha256.toLowerCase()
    && input.source.width === source.width && input.source.height === source.height,
  'The metric-plane declaration belongs to different source bytes or decoded dimensions.');
  insist(Number.isFinite(input.referenceTime) && input.referenceTime >= 0
    && input.referenceTime <= source.duration, 'Declare a reference time within the original recording.');
  insist(typeof input.basis === 'string' && input.basis.trim().length > 0 && input.basis.length <= 1000,
    'Describe the basis for the shared plane, its metric coordinates and fixed camera (up to 1,000 characters).');
  insist(typeof input.coordinateUnit === 'string' && input.coordinateUnit.trim().length > 0
    && input.coordinateUnit.length <= 32, 'Name the common length unit used by both plane axes.');
  insist(PLANE_ASSUMPTIONS.every(name => input.assumptions?.[name] === true),
    'Explicitly declare one fixed camera, a shared motion plane, equal length units on both axes, and negligible lens distortion.');
  insist(Array.isArray(input.pairs) && input.pairs.length === 4,
    'Supply exactly four original image points and their declared metric-plane coordinates.');
  const pairs = input.pairs.map(pair => {
    insist(inRaster(pair?.image, source), 'Every image reference must lie inside the decoded source raster.');
    insist(pair?.plane && [pair.plane.x, pair.plane.y].every(value =>
      Number.isFinite(value) && Math.abs(value) <= 8192),
    'Every metric-plane reference must be finite and within ±8,192 common length units.');
    return {image: {x: pair.image.x, y: pair.image.y}, plane: {x: pair.plane.x, y: pair.plane.y}};
  });
  const fitted = fitPlaneHomography(pairs);
  requireFinitePlaneDomain(fitted.matrix, source.width, source.height);
  const inverse = fitPlaneHomography(pairs.map(pair => ({image: pair.plane, plane: pair.image})));
  const probes = [{x: 0, y: 0}, {x: source.width - 1, y: 0},
    {x: source.width - 1, y: source.height - 1}, {x: 0, y: source.height - 1},
    {x: (source.width - 1) / 2, y: (source.height - 1) / 2}, ...pairs.map(pair => pair.image)];
  for (const point of probes) {
    requirePlaneDifferential(fitted.matrix, point);
    const roundTrip = applyPlaneHomography(inverse.matrix, applyPlaneHomography(fitted.matrix, point));
    insist(Math.hypot(roundTrip.x - point.x, roundTrip.y - point.y) <= 1e-5,
      'The plane declaration does not support a stable source-pixel round trip.');
  }
  return {
    input: {schema: METRIC_PLANE_SCHEMA,
      source: {sha256: source.sha256.toLowerCase(), width: source.width, height: source.height},
      referenceTime: input.referenceTime, basis: input.basis.trim(), coordinateUnit: input.coordinateUnit.trim(),
      assumptions: Object.fromEntries(PLANE_ASSUMPTIONS.map(name => [name, true])), pairs},
    matrix: fitted.matrix, inverse: inverse.matrix,
    referenceResidual: {rms: fitted.rmsPlanePx, maximum: fitted.maxPlanePx, unit: input.coordinateUnit.trim()},
    qualification: 'Four exact correspondences do not independently verify the plane, metric aspect ratio, camera stability, lens model or physical calibration.'
  };
}

/** First-order differential in original pixels; declaration/corner uncertainty is excluded. */
export function metricPoint(matrix, point) {
  requirePlaneDifferential(matrix, point);
  const mapped = applyPlaneHomography(matrix, point);
  const w = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  return {...mapped, jacobian: [
    (matrix[0] - mapped.x * matrix[6]) / w, (matrix[1] - mapped.x * matrix[7]) / w,
    (matrix[3] - mapped.y * matrix[6]) / w, (matrix[4] - mapped.y * matrix[7]) / w
  ]};
}

export function metricPair(plane, marker, pivot, markerSigma, pivotSigma = 0) {
  const a = metricPoint(plane.matrix, marker), b = metricPoint(plane.matrix, pivot);
  const dx = a.x - b.x, dy = a.y - b.y, radius = Math.hypot(dx, dy);
  insist(Number.isFinite(radius) && radius > 0, 'The rectified marker and pivot must remain distinct.');
  const gradient = [dy / radius ** 2, -dx / radius ** 2];
  const sensitivity = point => Math.hypot(
    gradient[0] * point.jacobian[0] + gradient[1] * point.jacobian[2],
    gradient[0] * point.jacobian[1] + gradient[1] * point.jacobian[3]);
  const positionSigma = Math.hypot(markerSigma * sensitivity(a), pivotSigma * sensitivity(b));
  insist(Number.isFinite(positionSigma), 'The rectified angle-noise estimate is not finite.');
  return {marker: {x: a.x, y: a.y}, pivot: {x: b.x, y: b.y}, radius,
    rawAngle: Math.atan2(dx, dy), positionSigma};
}

/** A deliberately incomplete template: absent measurements cannot be applied. */
export function metricPlaneTemplate(source, referenceTime = 0) {
  insist(/^[a-f0-9]{64}$/i.test(source?.sha256 || ''), 'Choose an identified original video before creating a calibration template.');
  return {schema: METRIC_PLANE_SCHEMA,
    source: {sha256: source.sha256.toLowerCase(), width: source.width, height: source.height},
    referenceTime, coordinateUnit: '', basis: '',
    assumptions: Object.fromEntries(PLANE_ASSUMPTIONS.map(name => [name, false])),
    pairs: Array.from({length: 4}, () => ({image: {x: null, y: null}, plane: {x: null, y: null}}))};
}

