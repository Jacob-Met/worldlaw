/** Fixed-template, bounded-search image measurements. No DOM or external dependencies. */
export const TRACKER_VERSION = 'worldlaw.patch-ncc/v1';
export const COLOR_TRACKER_VERSION = 'worldlaw.patch-color-ncc/v1';

const MAX_FRAME_PIXELS = 16_777_216;
const MAX_PATCH_SAMPLE_COMPARISONS = 20_000_000;
const EPSILON = 1e-12;

function finite(value, name, minimum, maximum, integer = false) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  if ((integer && !Number.isInteger(value)) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be ${integer ? 'an integer ' : ''}between ${minimum} and ${maximum}.`);
  }
  return value;
}

function validatePoint(point, name) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${name} must contain finite x and y pixel coordinates.`);
  }
}

function validateFrame(frame) {
  if (!frame || !Number.isInteger(frame.width) || !Number.isInteger(frame.height)
    || frame.width < 1 || frame.height < 1 || frame.width * frame.height > MAX_FRAME_PIXELS) {
    throw new RangeError(`Frame dimensions must be positive integers with at most ${MAX_FRAME_PIXELS} pixels.`);
  }
  if (!(frame.data instanceof Uint8ClampedArray || frame.data instanceof Uint8Array)
    || frame.data.length !== frame.width * frame.height * 4) {
    throw new TypeError('Frame data must be a byte array containing exactly width × height × 4 RGBA values.');
  }
}

function grayscale(frame, left, top, right, bottom, color = false) {
  const width = right - left + 1;
  const height = bottom - top + 1;
  const data = new Float32Array(width * height);
  const redGreen = color ? new Float32Array(data.length) : null;
  const blueYellow = color ? new Float32Array(data.length) : null;
  for (let y = top, i = 0; y <= bottom; y += 1) {
    for (let x = left, p = (y * frame.width + left) * 4; x <= right; x += 1, p += 4, i += 1) {
      // Transparent input is composited on black; hidden RGB cannot provide evidence.
      data[i] = (0.299 * frame.data[p] + 0.587 * frame.data[p + 1] + 0.114 * frame.data[p + 2])
        * frame.data[p + 3] / 255;
      if (color) {
        const alpha = frame.data[p + 3] / 255;
        redGreen[i] = (frame.data[p] - frame.data[p + 1]) * alpha;
        blueYellow[i] = (frame.data[p + 2] - (frame.data[p] + frame.data[p + 1]) / 2) * alpha;
      }
    }
  }
  return { data, redGreen, blueYellow, width, height, left, top };
}

function sample(gray, x, y, channel = gray.data) {
  const localX = x - gray.left;
  const localY = y - gray.top;
  const left = Math.floor(localX);
  const top = Math.floor(localY);
  const right = Math.min(left + 1, gray.width - 1);
  const bottom = Math.min(top + 1, gray.height - 1);
  const fx = localX - left;
  const fy = localY - top;
  return (channel[top * gray.width + left] * (1 - fx) + channel[top * gray.width + right] * fx) * (1 - fy)
    + (channel[bottom * gray.width + left] * (1 - fx) + channel[bottom * gray.width + right] * fx) * fy;
}

function inside(frame, point, radius) {
  return point.x >= radius && point.x <= frame.width - radius - 1
    && point.y >= radius && point.y <= frame.height - radius - 1;
}

function templateOptions(options) {
  const patchRadius = finite(options.patchRadius ?? 7, 'patchRadius', 2, 24, true);
  const minTextureStd = finite(options.minTextureStd ?? 5, 'minTextureStd', 0, 127.5);
  const appearance = options.appearance ?? 'luminance';
  if (!['luminance', 'color'].includes(appearance)) throw new TypeError('appearance must be luminance or color.');
  return Object.freeze({ patchRadius, minTextureStd, appearance });
}

/** Capture a fixed, opaque template. Ordinary initialization failures are explicit states. */
export function createTemplate(frame, point, options = {}) {
  validateFrame(frame);
  validatePoint(point, 'point');
  const settings = templateOptions(options);
  const color = settings.appearance === 'color', channels = color ? 3 : 1;
  const sourcePoint = Object.freeze({ x: point.x, y: point.y });
  if (!inside(frame, point, settings.patchRadius)) {
    return { status: 'out-of-bounds', template: null, point: sourcePoint, textureStd: null,
      reason: 'The complete patch must fit inside the image.', settings };
  }
  const gray = grayscale(frame, Math.floor(point.x - settings.patchRadius),
    Math.floor(point.y - settings.patchRadius), Math.ceil(point.x + settings.patchRadius),
    Math.ceil(point.y + settings.patchRadius), color);
  const values = [];
  let sum = 0;
  for (let dy = -settings.patchRadius; dy <= settings.patchRadius; dy += 1) {
    for (let dx = -settings.patchRadius; dx <= settings.patchRadius; dx += 1) {
      const value = sample(gray, point.x + dx, point.y + dy);
      values.push(value);
      if (color) values.push(sample(gray, point.x + dx, point.y + dy, gray.redGreen),
        sample(gray, point.x + dx, point.y + dy, gray.blueYellow));
      sum += value;
    }
  }
  const count = values.length / channels, mean = sum / count;
  // Center luminance only. Retaining color differences preserves observed hue.
  // For opaque pixels, a common neutral offset cancels before quantization/clipping.
  const centered = values.map((value, i) => i % channels === 0 ? value - mean : value);
  const energy = centered.reduce((total, value) => total + value * value, 0);
  const textureEnergy = centered.reduce((total, value, i) => total + (i % channels === 0 ? value * value : 0), 0);
  const textureStd = Math.sqrt(textureEnergy / count);
  if (textureEnergy <= EPSILON || textureStd < settings.minTextureStd) {
    return { status: 'low-texture', template: null, point: sourcePoint, textureStd,
      reason: 'The selected patch does not contain enough brightness variation.', settings };
  }
  const normalizedValues = Object.freeze(centered.map(value => value / Math.sqrt(energy)));
  const template = Object.freeze({ version: color ? COLOR_TRACKER_VERSION : TRACKER_VERSION, ...settings,
    size: settings.patchRadius * 2 + 1, sourcePoint, frameWidth: frame.width,
    frameHeight: frame.height, textureStd, normalizedValues });
  return { status: 'ready', template, point: sourcePoint, textureStd, reason: null, settings };
}

function validateTemplate(template) {
  if (!template || ![TRACKER_VERSION, COLOR_TRACKER_VERSION].includes(template.version) || !Array.isArray(template.normalizedValues)) {
    throw new TypeError('A ready template from createTemplate is required.');
  }
  finite(template.patchRadius, 'template.patchRadius', 2, 24, true);
  const color = template.version === COLOR_TRACKER_VERSION, channels = color ? 3 : 1;
  if ((template.appearance ?? 'luminance') !== (color ? 'color' : 'luminance'))
    throw new TypeError('Template appearance must match its algorithm version.');
  if (template.size !== template.patchRadius * 2 + 1
    || template.normalizedValues.length !== template.size ** 2 * channels
    || !template.normalizedValues.every(Number.isFinite)) {
    throw new TypeError('Template dimensions or normalized values are invalid.');
  }
  finite(template.minTextureStd, 'template.minTextureStd', 0, 127.5);
  const energy = template.normalizedValues.reduce((total, value) => total + value * value, 0);
  const sum = template.normalizedValues.reduce((total, value, i) => total + (i % channels === 0 ? value : 0), 0);
  const textureEnergy = template.normalizedValues.reduce((total, value, i) => total + (i % channels === 0 ? value * value : 0), 0);
  if (textureEnergy <= EPSILON || Math.abs(energy - 1) > 1e-6 || Math.abs(sum) > 1e-6) {
    throw new TypeError('Template luminance must have zero mean and all features together must have unit energy.');
  }
}

function trackingOptions(template, options) {
  const searchRadius = finite(options.searchRadius ?? 24, 'searchRadius', 2, 128, true);
  const exclusionRadius = finite(options.exclusionRadius ?? Math.min(3, searchRadius - 1),
    'exclusionRadius', 1, searchRadius - 1);
  const subpixel = options.subpixel ?? true;
  if (typeof subpixel !== 'boolean') throw new TypeError('subpixel must be a boolean.');
  return Object.freeze({ searchRadius, exclusionRadius, subpixel, appearance: template.appearance ?? 'luminance',
    minScore: finite(options.minScore ?? 0.75, 'minScore', 0, 1),
    minMargin: finite(options.minMargin ?? 0.06, 'minMargin', 0, 2),
    minTextureStd: finite(options.minTextureStd ?? template.minTextureStd, 'minTextureStd', 0, 127.5) });
}

function scorePatch(gray, template, x, y, fractional = false) {
  let sum = 0;
  let squareSum = 0;
  let dot = 0;
  let index = 0;
  let colorEnergy = 0;
  const color = template.version === COLOR_TRACKER_VERSION;
  const radius = template.patchRadius;
  for (let dy = -radius; dy <= radius; dy += 1) {
    const row = (y + dy - gray.top) * gray.width;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const value = fractional ? sample(gray, x + dx, y + dy)
        : gray.data[row + x + dx - gray.left];
      sum += value;
      squareSum += value * value;
      dot += template.normalizedValues[index] * value;
      index += 1;
      if (color) {
        const rg = fractional ? sample(gray, x + dx, y + dy, gray.redGreen)
          : gray.redGreen[row + x + dx - gray.left];
        const by = fractional ? sample(gray, x + dx, y + dy, gray.blueYellow)
          : gray.blueYellow[row + x + dx - gray.left];
        colorEnergy += rg * rg + by * by;
        dot += template.normalizedValues[index] * rg + template.normalizedValues[index + 1] * by;
        index += 2;
      }
    }
  }
  const count = template.size ** 2;
  const textureEnergy = Math.max(0, squareSum - sum * sum / count);
  return { x, y, textureStd: Math.sqrt(textureEnergy / count),
    score: textureEnergy <= EPSILON ? null : Math.max(-1, Math.min(1, dot / Math.sqrt(textureEnergy + colorEnergy))) };
}

function peakOffset(left, middle, right) {
  if (![left, middle, right].every(Number.isFinite)) return 0;
  const curvature = left - 2 * middle + right;
  if (curvature >= -EPSILON) return 0;
  return Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / curvature));
}

/**
 * Search actual image patches. `point` is non-null only for accepted evidence;
 * `candidatePoint` is diagnostic and must never be treated as an observation.
 */
export function trackTemplate(frame, template, predictedPoint, options = {}) {
  validateFrame(frame);
  validateTemplate(template);
  validatePoint(predictedPoint, 'predictedPoint');
  const settings = trackingOptions(template, options);
  const result = { version: template.version, status: 'lost', point: null, candidatePoint: null,
    score: null, runnerUpScore: null, ambiguityMargin: null, textureStd: null,
    searchClipped: false, searchBoundary: false, subpixelRefined: false, settings,
    reason: null, candidateCount: 0 };
  if (frame.width !== template.frameWidth || frame.height !== template.frameHeight) {
    return { ...result, reason: 'frame-size-changed' };
  }
  const radius = template.patchRadius;
  const requested = { left: Math.ceil(predictedPoint.x - settings.searchRadius),
    right: Math.floor(predictedPoint.x + settings.searchRadius),
    top: Math.ceil(predictedPoint.y - settings.searchRadius),
    bottom: Math.floor(predictedPoint.y + settings.searchRadius) };
  const bounds = { left: Math.max(radius, requested.left),
    right: Math.min(frame.width - radius - 1, requested.right),
    top: Math.max(radius, requested.top), bottom: Math.min(frame.height - radius - 1, requested.bottom) };
  result.searchClipped = Object.keys(bounds).some(key => bounds[key] !== requested[key]);
  if (bounds.left > bounds.right || bounds.top > bounds.bottom) {
    return { ...result, reason: 'search-outside-image' };
  }
  if ((bounds.right - bounds.left + 1) * (bounds.bottom - bounds.top + 1)
    * template.size ** 2 > MAX_PATCH_SAMPLE_COMPARISONS) {
    throw new RangeError('Search exceeds 20 million patch sample comparisons; reduce searchRadius or patchRadius.');
  }
  // This bounds pixel pairs. Color uses exactly three features per pixel pair,
  // hence at most 60 million feature pairs and no larger search region.
  const gray = grayscale(frame, bounds.left - radius, bounds.top - radius,
    bounds.right + radius, bounds.bottom + radius, template.version === COLOR_TRACKER_VERSION);
  const columns = bounds.right - bounds.left + 1;
  const candidates = [];
  let best = null;
  let maxTextureStd = 0;
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      const candidate = scorePatch(gray, template, x, y);
      maxTextureStd = Math.max(maxTextureStd, candidate.textureStd);
      if (candidate.textureStd < settings.minTextureStd) candidate.score = null;
      candidates.push(candidate);
      if (candidate.score !== null && (!best || candidate.score > best.score)) best = candidate;
    }
  }
  result.candidateCount = candidates.length;
  if (!best) return { ...result, status: 'low-texture', textureStd: maxTextureStd, reason: 'search-has-no-texture' };

  // Choose the competing location around the integer-grid peak. The final margin
  // below compares its score with the retained (possibly refined) best score.
  let runnerUp = null;
  for (const candidate of candidates) {
    if (candidate.score !== null
      && (candidate.x - best.x) ** 2 + (candidate.y - best.y) ** 2 > settings.exclusionRadius ** 2
      && (!runnerUp || candidate.score > runnerUp.score)) runnerUp = candidate;
  }
  result.searchBoundary = (best.x === requested.left && requested.left >= radius)
    || (best.x === requested.right && requested.right <= frame.width - radius - 1)
    || (best.y === requested.top && requested.top >= radius)
    || (best.y === requested.bottom && requested.bottom <= frame.height - radius - 1);

  if (settings.subpixel && best.x > bounds.left && best.x < bounds.right
    && best.y > bounds.top && best.y < bounds.bottom) {
    const index = (best.y - bounds.top) * columns + best.x - bounds.left;
    const dx = peakOffset(candidates[index - 1].score, best.score, candidates[index + 1].score);
    const dy = peakOffset(candidates[index - columns].score, best.score, candidates[index + columns].score);
    if (dx !== 0 || dy !== 0) {
      const refined = scorePatch(gray, template, best.x + dx, best.y + dy, true);
      if (refined.score !== null && refined.score > best.score && refined.textureStd >= settings.minTextureStd) {
        best = refined;
        result.subpixelRefined = true;
      }
    }
  }
  result.candidatePoint = { x: best.x, y: best.y };
  result.score = best.score;
  result.textureStd = best.textureStd;
  result.runnerUpScore = runnerUp?.score ?? null;
  result.ambiguityMargin = runnerUp ? best.score - runnerUp.score : null;
  if (best.score < settings.minScore) return { ...result, reason: 'score-below-threshold' };
  if (!runnerUp) return { ...result, status: 'ambiguous', reason: 'insufficient-alternative-patches' };
  if (result.ambiguityMargin <= Math.max(settings.minMargin, EPSILON)) return { ...result, status: 'ambiguous', reason: 'competing-match' };
  if (result.searchBoundary) return { ...result, status: 'ambiguous', reason: 'search-boundary' };
  return { ...result, status: 'accepted', point: { ...result.candidatePoint }, reason: null };
}

