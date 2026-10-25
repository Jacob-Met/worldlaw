/** Browser adaptation of HAMON Engine camera_calib.cpp normalized eight-parameter
 * solver, blob ddd61724f69fef32f8bf55ac9d7671a6cbf114c7. The native implementation
 * remains the arithmetic owner. Additional finite/domain guards serve this consumer.
 * Four correspondence residuals cannot independently verify a plane declaration. */
const EPS = 1e-12;
const multiply = (a, b) => Array.from({ length: 9 }, (_, i) => {
  let s = 0; for (let k = 0; k < 3; k++) s += a[Math.floor(i / 3) * 3 + k] * b[k * 3 + i % 3]; return s;
});
function normalize(points) {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  const d = points.reduce((s, p) => s + Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2), 0) / points.length;
  if (d < EPS) throw RangeError('Coincident plane references');
  return { x, y, scale: Math.SQRT2 / d };
}
function solve(m, rhs) {
  const a = m.map((r, i) => [...r, rhs[i]]);
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    if (Math.abs(a[pivot][c]) < EPS) throw RangeError('Degenerate plane references');
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = c + 1; r < 8; r++) {
      const f = a[r][c] / a[c][c]; if (f === 0) continue;
      for (let j = c; j < 9; j++) a[r][j] -= f * a[c][j];
    }
  }
  const x = Array(8).fill(0);
  for (let r = 7; r >= 0; r--) {
    let s = a[r][8]; for (let j = r + 1; j < 8; j++) s -= a[r][j] * x[j]; x[r] = s / a[r][r];
  }
  return x;
}
export function applyPlaneHomography(h, p) {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (!Number.isFinite(w) || Math.abs(w) < EPS) throw RangeError('Point lies near the projective horizon');
  const q = { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
  if (![q.x, q.y].every(v => Number.isFinite(v) && Math.abs(v) <= 1e6)) throw RangeError('Rectified coordinate exceeds supported range');
  return q;
}
export function fitPlaneHomography(correspondences) {
  if (!Array.isArray(correspondences) || correspondences.length < 4 || correspondences.length > 32) throw RangeError('Use 4–32 plane correspondences');
  const pairs = correspondences.map(p => {
    for (const q of [p?.image, p?.plane]) if (!q || ![q.x, q.y].every(v => Number.isFinite(v) && Math.abs(v) <= 8192)) throw RangeError('Plane references require finite coordinates within ±8192');
    return { image: { ...p.image }, plane: { ...p.plane } };
  });
  const s = normalize(pairs.map(p => p.image)), d = normalize(pairs.map(p => p.plane));
  const m = Array.from({ length: 8 }, () => Array(8).fill(0)), rhs = Array(8).fill(0);
  for (const p of pairs) {
    const x = (p.image.x - s.x) * s.scale, y = (p.image.y - s.y) * s.scale;
    const u = (p.plane.x - d.x) * d.scale, v = (p.plane.y - d.y) * d.scale;
    const a = [x, y, 1, 0, 0, 0, -u * x, -u * y], b = [0, 0, 0, x, y, 1, -v * x, -v * y];
    for (let i = 0; i < 8; i++) { for (let j = 0; j < 8; j++) m[i][j] += a[i] * a[j] + b[i] * b[j]; rhs[i] += a[i] * u + b[i] * v; }
  }
  const hn = [...solve(m, rhs), 1];
  const h = multiply(multiply([1 / d.scale, 0, d.x, 0, 1 / d.scale, d.y, 0, 0, 1], hn), [s.scale, 0, -s.scale * s.x, 0, s.scale, -s.scale * s.y, 0, 0, 1]);
  const scale = Math.abs(h[8]) > EPS ? h[8] : Math.max(...h.map(Math.abs));
  if (!(Math.abs(scale) > EPS)) throw RangeError('Degenerate plane transform');
  const matrix = h.map(v => v / scale);
  if (!matrix.every(Number.isFinite)) throw RangeError('Nonfinite plane transform');
  const residuals = pairs.map(p => { const q = applyPlaneHomography(matrix, p.image); return Math.hypot(q.x - p.plane.x, q.y - p.plane.y); });
  return { matrix, residuals, rmsPlanePx: Math.sqrt(residuals.reduce((s, v) => s + v * v, 0) / residuals.length), maxPlanePx: Math.max(...residuals) };
}
/** Affine denominator extrema are at raster corners. One strict sign excludes
 * a horizon anywhere in the declared source raster, including unobserved rows. */
export function requireFinitePlaneDomain(matrix, width, height) {
  const corners = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const w = corners.map(p => matrix[6] * p.x + matrix[7] * p.y + matrix[8]);
  const scale = Math.max(...w.map(Math.abs));
  if (!scale || !w.every(v => Number.isFinite(v) && Math.abs(v) / scale > 1e-8 && Math.sign(v) === Math.sign(w[0]))) throw RangeError('Projective horizon crosses or approaches the source raster');
  corners.forEach(p => applyPlaneHomography(matrix, p));
  // Keep native fitting arithmetic unchanged, but admit only a two-dimensional
  // consumer map. A singular H can fit many collinear destination references
  // exactly, without a pole. Assess its local differential at the raster center;
  // det(J)/||J||_F^2 is invariant to destination translation/uniform scale and H
  // rescaling. The explicit floor also refuses extreme anisotropic collapse.
  requirePlaneDifferential(matrix, { x: (width - 1) / 2, y: (height - 1) / 2 });
}
/** Preserve the maintained scale-invariant near-collapse guard at a supplied
 * domain point. Domain admission separately proves there is no horizon. */
export function requirePlaneDifferential(matrix, center) {
  const mapped = applyPlaneHomography(matrix, center);
  const denominator = matrix[6] * center.x + matrix[7] * center.y + matrix[8];
  const j = [(matrix[0] - mapped.x * matrix[6]) / denominator, (matrix[1] - mapped.x * matrix[7]) / denominator,
    (matrix[3] - mapped.y * matrix[6]) / denominator, (matrix[4] - mapped.y * matrix[7]) / denominator];
  const magnitude = Math.max(...j.map(Math.abs));
  const n = j.map(v => v / magnitude), norm2 = n.reduce((s, v) => s + v * v, 0);
  const ratio = Math.abs(n[0] * n[3] - n[1] * n[2]) / norm2;
  if (!Number.isFinite(ratio) || ratio <= 1e-10) throw RangeError('Singular or near-collapsed plane transform');
}
