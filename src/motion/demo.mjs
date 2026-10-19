/** A generated image sequence, not recorded physical evidence. Tracking consumes only its pixels. */
export const DEMO_VERSION = 'worldlaw.motion-demo/v1';
export const DEMO_WIDTH = 640;
export const DEMO_HEIGHT = 400;
export const DEMO_PIVOT = Object.freeze({x: 320, y: 92});
const RATE = 30, DURATION = 6, RADIUS = 197;
const texture = Array.from({length: 25 * 25}, (_, i) => {
  const x = i % 25, y = Math.floor(i / 25);
  const hash = ((Math.floor(x / 3) * 73856093) ^ (Math.floor(y / 3) * 19349663) ^ 41597) >>> 0;
  return x < 2 || y < 2 || x > 22 || y > 22 ? 220 : 45 + (hash % 180);
});

export function demoMarkerAt(time) {
  const angle = .67 * Math.exp(-.065 * time) * Math.cos(1.65 * time);
  return {x: DEMO_PIVOT.x + RADIUS * Math.sin(angle), y: DEMO_PIVOT.y + RADIUS * Math.cos(angle)};
}

function paint(data, width, x, y, color) {
  const i = (y * width + x) * 4;
  data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
}

function disc(data, cx, cy, radius, color) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(DEMO_HEIGHT - 1, Math.ceil(cy + radius)); y++)
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(DEMO_WIDTH - 1, Math.ceil(cx + radius)); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) paint(data, DEMO_WIDTH, x, y, color);
}

const base = new Uint8ClampedArray(DEMO_WIDTH * DEMO_HEIGHT * 4);
for (let y = 0; y < DEMO_HEIGHT; y++) for (let x = 0; x < DEMO_WIDTH; x++) {
  const grid = x % 40 === 0 || y % 40 === 0;
  paint(base, DEMO_WIDTH, x, y, grid ? [39, 65, 48] : [20, 46, 34]);
}

export function renderDemoFrame(requestedTime, {occlusion = true} = {}) {
  if (!Number.isFinite(requestedTime) || requestedTime < 0 || requestedTime > DURATION)
    throw new Error('Synthetic frame time must be between 0 and 6 seconds.');
  const time = Math.min(DURATION, Math.floor(requestedTime * RATE + 1e-7) / RATE);
  const data = new Uint8ClampedArray(base), marker = demoMarkerAt(time);
  const dx = marker.x - DEMO_PIVOT.x, dy = marker.y - DEMO_PIVOT.y;
  const minX = Math.max(0, Math.floor(Math.min(marker.x, DEMO_PIVOT.x) - 5));
  const maxX = Math.min(DEMO_WIDTH - 1, Math.ceil(Math.max(marker.x, DEMO_PIVOT.x) + 5));
  for (let y = DEMO_PIVOT.y - 5; y <= Math.min(DEMO_HEIGHT - 1, Math.ceil(marker.y + 5)); y++) for (let x = minX; x <= maxX; x++) {
    const t = Math.max(0, Math.min(1, ((x - DEMO_PIVOT.x) * dx + (y - DEMO_PIVOT.y) * dy) / (RADIUS * RADIUS)));
    if ((x - DEMO_PIVOT.x - t * dx) ** 2 + (y - DEMO_PIVOT.y - t * dy) ** 2 < 16)
      paint(data, DEMO_WIDTH, x, y, [156, 172, 124]);
  }
  disc(data, DEMO_PIVOT.x, DEMO_PIVOT.y, 13, [72, 94, 66]);
  disc(data, DEMO_PIVOT.x, DEMO_PIVOT.y, 5, [212, 229, 171]);
  disc(data, marker.x, marker.y, 21, [139, 163, 100]);
  for (let y = Math.ceil(marker.y - 11); y <= Math.floor(marker.y + 11); y++) for (let x = Math.ceil(marker.x - 11); x <= Math.floor(marker.x + 11); x++) {
    const u = x - marker.x + 12, v = y - marker.y + 12;
    const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
    const a = texture[iy * 25 + ix] * (1 - fx) + texture[iy * 25 + ix + 1] * fx;
    const b = texture[(iy + 1) * 25 + ix] * (1 - fx) + texture[(iy + 1) * 25 + ix + 1] * fx;
    const value = a * (1 - fy) + b * fy;
    paint(data, DEMO_WIDTH, x, y, [value, value, value]);
  }
  if (occlusion && time >= 2.25 && time < 2.7) {
    for (let y = 220; y < 345; y++) for (let x = 165; x < 335; x++)
      paint(data, DEMO_WIDTH, x, y, x < 169 || x > 330 ? [117, 108, 82] : [65, 70, 53]);
  }
  return {width: DEMO_WIDTH, height: DEMO_HEIGHT, data, time, requestedTime, timeBasis: 'synthetic-time', frameIndex: Math.round(time * RATE)};
}

export function createDemoSource({occlusion = true} = {}) {
  const source = {
    kind: 'synthetic-video', label: `Synthetic marked pendulum${occlusion ? ' with occlusion' : ' / clear view'}`,
    width: DEMO_WIDTH, height: DEMO_HEIGHT, duration: DURATION,
    metadata: {generator: DEMO_VERSION, framesPerSecond: RATE, occlusion,
      calibration: {pivot: DEMO_PIVOT, firstMarker: demoMarkerAt(0)},
      provenance: 'Generated pixel frames. No recording of a physical mechanism.',
      motion: 'theta(t)=0.67*exp(-0.065*t)*cos(1.65*t); image radius=197px',
      occlusionInterval: occlusion ? [2.25, 2.7] : null},
  };
  return {source, width: DEMO_WIDTH, height: DEMO_HEIGHT, duration: DURATION,
    async frameAt(seconds, {signal} = {}) {
      if (signal?.aborted) throw new DOMException('Frame request cancelled.', 'AbortError');
      return renderDemoFrame(seconds, {occlusion});
    }, dispose() {}};
}
