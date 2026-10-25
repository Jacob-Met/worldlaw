const EPS = 1e-9;

export function assertFinitePoint(point, label = "point") {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must contain finite x/y coordinates`);
  }
}

function solve3(matrix, vector) {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < EPS) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col];
    for (let j = col; j < 4; j += 1) a[col][j] /= scale;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j < 4; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[3]);
}

export function fitCircle(points) {
  if (points.length < 5) return { supported: false, reason: "need_at_least_5_points" };
  points.forEach((point, i) => assertFinitePoint(point, `points[${i}]`));
  // Fit in a centered, dimensionless coordinate system. Raw x^2/y^2 normal
  // equations lose the small curvature signal when an otherwise ordinary arc
  // is translated far from the origin. This is a numerical change only: the
  // returned model, residuals, and coverage remain in the caller's coordinates.
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const originX = minX / 2 + maxX / 2; const originY = minY / 2 + maxY / 2;
  const scale = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(scale)) return { supported: false, reason: "invalid_circle" };
  if (!(scale > 0)) return { supported: false, reason: "ill_conditioned_circle" };
  let sx = 0; let sy = 0; let sxx = 0; let syy = 0; let sxy = 0;
  let sz = 0; let sxz = 0; let syz = 0;
  for (const point of points) {
    const x = (point.x - originX) / scale; const y = (point.y - originY) / scale;
    const z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    sz += z; sxz += x * z; syz += y * z;
  }
  const solution = solve3(
    [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, points.length]],
    [-sxz, -syz, -sz],
  );
  if (!solution) return { supported: false, reason: "ill_conditioned_circle" };
  const [a, b, c] = solution;
  const localCenter = { x: -a / 2, y: -b / 2 };
  const radiusSquared = localCenter.x ** 2 + localCenter.y ** 2 - c;
  if (!(radiusSquared > EPS) || !Number.isFinite(radiusSquared)) {
    return { supported: false, reason: "invalid_circle" };
  }
  const center = { x: originX + localCenter.x * scale, y: originY + localCenter.y * scale };
  const radius = Math.sqrt(radiusSquared) * scale;
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(radius) || !(radius > 0)) {
    return { supported: false, reason: "invalid_circle" };
  }
  const distances = points.map((point) => Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - radius));
  if (distances.some((distance) => !Number.isFinite(distance))) return { supported: false, reason: "invalid_circle" };
  const largestResidual = distances.reduce((largest, distance) => Math.max(largest, distance), 0);
  const rmse = largestResidual === 0 ? 0 : largestResidual * Math.sqrt(distances.reduce((sum, distance) => sum + (distance / largestResidual) ** 2, 0) / distances.length);
  const angles = points.map((point) => Math.atan2(point.y - center.y, point.x - center.x));
  const ordered = angles.map((angle) => angle < 0 ? angle + 2 * Math.PI : angle).sort((x, y) => x - y);
  let largestGap = ordered[0] + 2 * Math.PI - ordered.at(-1);
  for (let i = 1; i < ordered.length; i += 1) largestGap = Math.max(largestGap, ordered[i] - ordered[i - 1]);
  const coverage = 2 * Math.PI - largestGap;
  return { supported: true, kind: "circular", center, radius, rmse, coverageRadians: coverage };
}

export function fitLine(points) {
  if (points.length < 3) return { supported: false, reason: "need_at_least_3_points" };
  points.forEach((point, i) => assertFinitePoint(point, `points[${i}]`));
  const origin = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  let xx = 0; let xy = 0; let yy = 0;
  for (const point of points) {
    const x = point.x - origin.x; const y = point.y - origin.y;
    xx += x * x; xy += x * y; yy += y * y;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -direction.y, y: direction.x };
  const distances = points.map((point) => Math.abs((point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y));
  const projections = points.map((point) => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
  const travel = Math.max(...projections) - Math.min(...projections);
  return { supported: true, kind: "linear", origin, direction, normal, travel, rmse: rms(distances) };
}

export function geometricResidual(model, point) {
  assertFinitePoint(point);
  if (model.kind === "circular") return Math.abs(Math.hypot(point.x - model.center.x, point.y - model.center.y) - model.radius);
  if (model.kind === "linear") return Math.abs((point.x - model.origin.x) * model.normal.x + (point.y - model.origin.y) * model.normal.y);
  throw new TypeError("unknown model kind");
}

export function rms(values) {
  if (!values.length) return Number.NaN;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function spread(points) {
  const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

export function classifyPath(observations, options = {}) {
  const accepted = observations.filter((row) => row.status === "accepted" || row.status === "manual");
  const points = accepted.map(({ x, y }) => ({ x, y }));
  const minimumPoints = options.minimumPoints ?? 8;
  const minimumSpread = options.minimumSpread ?? 12;
  const minimumCircleCoverage = options.minimumCircleCoverage ?? 0.65;
  const ambiguityRatio = options.ambiguityRatio ?? 1.18;
  const maximumNormalizedRmse = options.maximumNormalizedRmse ?? 0.04;
  for (const [name, value] of Object.entries({ minimumPoints, minimumSpread, minimumCircleCoverage, ambiguityRatio, maximumNormalizedRmse })) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
  }
  if (points.length < minimumPoints) return unresolved("insufficient_points", observations, accepted);
  if (spread(points) < minimumSpread) return unresolved("insufficient_spread", observations, accepted);
  const validationIndices = points.map((_, i) => i).filter((i) => i % 4 === 3);
  const trainingIndices = points.map((_, i) => i).filter((i) => i % 4 !== 3);
  const training = trainingIndices.map((i) => points[i]);
  const validation = validationIndices.map((i) => points[i]);
  const trainingScale = spread(training);
  if (trainingScale < minimumSpread) return unresolved("insufficient_training_spread", observations, accepted);
  const circle = fitCircle(training); const line = fitLine(training);
  if (circle.supported) circle.validationRmse = rms(validation.map((point) => geometricResidual(circle, point)));
  if (line.supported) line.validationRmse = rms(validation.map((point) => geometricResidual(line, point)));
  const result = { status: "unresolved", reason: "unsupported_models", circle, line, trainingIndices, validationIndices, counts: countRows(observations) };
  if (validation.length < 2) return result;
  const scale = trainingScale;
  if (!circle.supported && line.supported && line.validationRmse / scale <= maximumNormalizedRmse) {
    if (line.rmse / scale > maximumNormalizedRmse) return { ...result, reason: "training_fit_failed" };
    return { ...result, status: "supported", reason: null, selected: "linear", ratio: null };
  }
  if (!circle.supported || !line.supported) return result;
  const best = circle.validationRmse <= line.validationRmse ? circle : line;
  const other = best === circle ? line : circle;
  if (best.validationRmse / scale > maximumNormalizedRmse || best.rmse / scale > maximumNormalizedRmse) return { ...result, reason: "neither_model_fits" };
  if (best === circle && circle.coverageRadians < minimumCircleCoverage) {
    return { ...result, reason: "short_arc", ratio: other.validationRmse / Math.max(best.validationRmse, EPS) };
  }
  const ratio = other.validationRmse / Math.max(best.validationRmse, EPS);
  if (!Number.isFinite(ratio) || ratio < ambiguityRatio) return { ...result, reason: "ambiguous_models", ratio };
  return { ...result, status: "supported", reason: null, selected: best.kind, ratio };
}

function countRows(rows) {
  const counts = { submitted: rows.length, attempted: 0, accepted: 0, manual: 0, rejected: 0 };
  for (const row of rows) {
    if (row.status !== "missing") counts.attempted += 1;
    if (row.status === "accepted") counts.accepted += 1;
    else if (row.status === "manual") counts.manual += 1;
    else if (row.status !== "missing") counts.rejected += 1;
  }
  return counts;
}

function unresolved(reason, all, accepted) {
  return { status: "unresolved", reason, circle: null, line: null, trainingIndices: [], validationIndices: [], counts: countRows(all), acceptedCount: accepted.length };
}

export function evaluateRig(model, phase, edits = {}) {
  if (!Number.isFinite(phase)) throw new TypeError("phase must be finite");
  if (model.kind === "circular") {
    assertFinitePoint(model.center, "circle center");
    const radius = edits.radius ?? model.radius;
    if (!(radius > 0) || !Number.isFinite(radius)) throw new RangeError("radius must be finite and positive");
    const startAngle = edits.startAngle ?? 0;
    if (!Number.isFinite(startAngle)) throw new TypeError("startAngle must be finite");
    const output = { x: model.center.x + radius * Math.cos(startAngle + phase), y: model.center.y + radius * Math.sin(startAngle + phase) };
    assertFinitePoint(output, "rig output"); return output;
  }
  if (model.kind === "linear") {
    assertFinitePoint(model.origin, "line origin"); assertFinitePoint(model.direction, "line direction");
    const directionLength = Math.hypot(model.direction.x, model.direction.y);
    if (Math.abs(directionLength - 1) > 1e-6) throw new RangeError("line direction must be normalized");
    const travel = edits.travel ?? model.travel;
    if (!(travel > 0) || !Number.isFinite(travel)) throw new RangeError("travel must be finite and positive");
    const displacement = Math.sin(phase) * travel / 2;
    const output = { x: model.origin.x + model.direction.x * displacement, y: model.origin.y + model.direction.y * displacement };
    assertFinitePoint(output, "rig output"); return output;
  }
  throw new TypeError("unknown model kind");
}

function patchStats(frame, width, x, y, half) {
  let sum = 0; let sumSquared = 0; let count = 0;
  for (let py = y - half; py <= y + half; py += 1) for (let px = x - half; px <= x + half; px += 1) {
    const value = frame[py * width + px]; sum += value; sumSquared += value * value; count += 1;
  }
  const mean = sum / count; return { mean, variance: sumSquared / count - mean * mean, count };
}

export function trackTemplate(frames, width, height, start, options = {}) {
  if (!Array.isArray(frames) || frames.length < 2) throw new TypeError("at least two frames are required");
  const half = options.patchHalf ?? 4; const radius = options.searchRadius ?? 12;
  if (![width, height, start?.x, start?.y, half, radius].every(Number.isInteger)) throw new TypeError("dimensions, seed, patch, and search settings must be integers");
  if (width < 3 || height < 3 || half < 1 || radius < 1) throw new RangeError("invalid frame or tracker dimensions");
  if (start.x - half < 0 || start.x + half >= width || start.y - half < 0 || start.y + half >= height) throw new RangeError("seed patch must be contained in the frame");
  for (const [index, frame] of frames.entries()) if (!(frame instanceof Uint8Array) || frame.length !== width * height) throw new RangeError(`frame ${index} has invalid byte length`);
  const minimumVariance = options.minimumVariance ?? 18; const maximumSad = options.maximumSad ?? 24;
  const minimumMargin = options.minimumMargin ?? 0.35; const stopOnReject = options.stopOnReject ?? true;
  if (![minimumVariance, maximumSad, minimumMargin].every((value) => Number.isFinite(value) && value >= 0)) throw new RangeError("tracker thresholds must be finite and nonnegative");
  const observations = [{ frame: 0, x: start.x, y: start.y, status: "manual", score: 1 }];
  let current = { ...start };
  const templateStats = patchStats(frames[0], width, start.x, start.y, half);
  if (templateStats.variance < minimumVariance) {
    observations.push({ frame: 1, status: "rejected", reason: "low_texture" });
    for (let rest = 2; rest < frames.length; rest += 1) observations.push({ frame: rest, status: "missing", reason: "unattempted_after_rejection" });
    return observations;
  }
  for (let frameIndex = 1; frameIndex < frames.length; frameIndex += 1) {
    let best = null; let second = null;
    const minY = Math.max(half, current.y - radius); const maxY = Math.min(height - half - 1, current.y + radius);
    const minX = Math.max(half, current.x - radius); const maxX = Math.min(width - half - 1, current.x + radius);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        let sad = 0; let count = 0;
        for (let py = -half; py <= half; py += 1) for (let px = -half; px <= half; px += 1) {
          sad += Math.abs(frames[0][(start.y + py) * width + start.x + px] - frames[frameIndex][(y + py) * width + x + px]); count += 1;
        }
        const score = sad / count; const candidate = { x, y, score };
        if (!best || score < best.score) { second = best; best = candidate; } else if (!second || score < second.score) second = candidate;
      }
    }
    const margin = second ? second.score - best.score : Infinity;
    const searchBoundary = best && (best.x === minX || best.x === maxX || best.y === minY || best.y === maxY);
    if (!best || !second || !Number.isFinite(best.score) || !Number.isFinite(margin) || best.score > maximumSad || margin <= Math.max(minimumMargin, EPS) || searchBoundary) {
      const reason = searchBoundary ? "search_boundary" : (!best || !Number.isFinite(best?.score) || best.score > maximumSad ? "poor_match" : "ambiguous_match");
      observations.push({ frame: frameIndex, status: "rejected", reason, candidatePoint: best });
      if (stopOnReject) {
        for (let rest = frameIndex + 1; rest < frames.length; rest += 1) observations.push({ frame: rest, status: "missing", reason: "unattempted_after_rejection" });
        break;
      }
      continue;
    }
    current = { x: best.x, y: best.y };
    observations.push({ frame: frameIndex, x: best.x, y: best.y, status: "accepted", score: best.score, margin });
  }
  return observations;
}

export function syntheticSequence(kind, options = {}) {
  const width = options.width ?? 96; const height = options.height ?? 96; const count = options.count ?? 32;
  const frames = []; const truth = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1); let x; let y;
    if (kind === "circular") {
      const start = options.startAngle ?? -1.2; const arc = options.arc ?? 2.4; const radius = options.radius ?? 27;
      const a = start + t * arc; x = (options.centerX ?? 48) + radius * Math.cos(a); y = (options.centerY ?? 49) + radius * Math.sin(a);
    } else {
      x = (options.lineStartX ?? 20) + (options.lineDx ?? 58) * t;
      y = (options.lineStartY ?? 31) + (options.lineDy ?? 24) * t;
    }
    x = Math.round(x); y = Math.round(y); truth.push({ frame: i, x, y, status: i === 0 ? "manual" : "accepted" });
    const frame = new Uint8Array(width * height).fill(22);
    for (let py = -3; py <= 3; py += 1) for (let px = -3; px <= 3; px += 1) frame[(y + py) * width + x + px] = ((px + py) & 1) ? 245 : 115;
    frames.push(frame);
  }
  return { width, height, frames, truth };
}
