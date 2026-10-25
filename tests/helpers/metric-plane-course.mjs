/** Authored independent projective controls, not physical observations. */
import {createNotebook, calibrateNotebook} from '../../src/motion/measurement.mjs';

export const CAMERAS = [
  [170, 20, 320, 10, 120, 90, .08, -.04, 1],
  [125, -30, 325, 25, 165, 85, -.055, .065, 1],
  [195, 8, 295, -14, 105, 125, .06, .025, 1],
  [100, 35, 285, 32, 180, 75, -.035, -.045, 1]
];
export function project(matrix, point) {
  // Direct known-camera projection, independent of the maintained fitter.
  const w = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  return {x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / w,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / w};
}
export function course({camera = CAMERAS[0], sha = 'a', amplitude = .75, moving = false, noise = 0, duration = 4, count = 81} = {}) {
  const source = {kind: 'synthetic-video', label: 'Authored projective oscillator ' + sha,
    sha256: sha.repeat(64), width: 640, height: 480, duration};
  const position = t => amplitude * Math.exp(-.08 * t) * Math.cos(1.6 * t);
  const pivotAt = t => ({x: moving ? .08 * t : 0, y: moving ? .03 * t : 0});
  let notebook = calibrateNotebook(createNotebook({source}), {pivot: project(camera, pivotAt(0)),
    pivotMode: moving ? 'tracked' : 'fixed', pixelSigma: noise, ...(moving ? {pivotPixelSigma: noise * 2} : {}),
    maxGapSeconds: duration / (count - 1) * 1.1});
  const truth = [];
  notebook.measurements = Array.from({length: count}, (_, i) => {
    const time = i * duration / (count - 1), angle = position(time), pivot = pivotAt(time);
    truth.push(angle);
    return {time, status: 'manual', timeBasis: 'synthetic-time',
      point: project(camera, {x: pivot.x + Math.sin(angle), y: pivot.y + Math.cos(angle)}),
      ...(moving ? {pivotMeasurement: {status: 'manual', point: project(camera, pivot)}} : {})};
  });
  const declaration = {schema: 'worldlaw.metric-plane/v1', source: {sha256: source.sha256, width: 640, height: 480},
    referenceTime: 0, coordinateUnit: 'm', basis: 'Authored independent projective camera with known common-plane coordinates; no physical source.',
    assumptions: {samePlane: true, fixedCamera: true, metricCoordinates: true, negligibleLensDistortion: true},
    pairs: [{x: -.8, y: 0}, {x: .8, y: 0}, {x: .8, y: 1.6}, {x: -.8, y: 1.6}]
      .map(plane => ({image: project(camera, plane), plane}))};
  return {notebook, declaration, truth, camera};
}
