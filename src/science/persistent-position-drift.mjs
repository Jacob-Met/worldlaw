/** Three actions on a single hidden position/drift system, with one reading per tick. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseIntegratorReading} from './active-integrator-two-pulse.mjs';

const {Q, Z, add, sub, mul, div, fmt} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
const unit = Q(1n);
const cmp = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
const schema = 'worldlaw.persistent-position-drift-witness/v1';
const ids = ['A', 'B', 'C', 'D'];
export const pulseMenu = Object.freeze(['off', 0, 1, 2]);

// Law k responds to the first k on-commands. All four laws coast on 'off'.
const rate = (law, command) => Q(command !== 'off' && command < law ? 16n : 0n);
const need = (ok, message) => { if (!ok) throw Error('Position/drift experiment: ' + message); };

function intersectLower(range, value) {
  if (range.lower === null || cmp(value, range.lower) > 0) range.lower = value;
}

function intersectUpper(range, value) {
  if (range.upper === null || cmp(value, range.upper) < 0) range.upper = value;
}

const nonempty = ({lower, upper}) => lower === null || upper === null || cmp(lower, upper) <= 0;
function member({lower, upper}) {
  if (lower !== null && lower.n > 0n) return lower;
  if (upper !== null && upper.n < 0n) return upper;
  return Z();
}
const serialize = q => q === null ? null : fmt(q);

// With z_t = y_t - accumulated forcing, the joint region consists of all
// (p,v) such that z_t - 1 <= p + t*v <= z_t + 1 at every observed tick.
// Eliminate p by comparing each lower intercept with every upper intercept.
// For any surviving v the intercept intervals have a common member, including
// when they touch at just one point. Retain the strips, not merely their box.
function region(law, commands, readings) {
  let forcing = Z();
  const centers = readings.map((y, t) => {
    if (t > 0) forcing = add(forcing, rate(law, commands[t - 1]));
    return sub(y, forcing);
  });
  const state = positionDriftStateRegion(centers, unit);
  return state === null ? null : {law: ids[law], ...state};
}

// Shared exact receiver kernel. Centers are readings minus accumulated forcing.
export function positionDriftStateRegion(centers, error) {
  const drift = {lower: null, upper: null};
  const diameter = add(error, error);
  for (let j = 1; j < centers.length; j++) {
    for (let i = 0; i < j; i++) {
      const difference = sub(centers[j], centers[i]);
      const dt = Q(BigInt(j - i));
      intersectLower(drift, div(sub(difference, diameter), dt));
      intersectUpper(drift, div(add(difference, diameter), dt));
    }
  }
  if (!nonempty(drift)) return null;
  const v = member(drift);
  const intercept = {lower: null, upper: null};
  const strips = centers.map((z, t) => {
    const lo = sub(z, error), hi = add(z, error);
    const tv = mul(Q(BigInt(t)), v);
    intersectLower(intercept, sub(lo, tv));
    intersectUpper(intercept, sub(hi, tv));
    return {tick: t, lower: fmt(lo), upper: fmt(hi)};
  });
  need(nonempty(intercept), 'internal inconsistent intercept projection');
  return {strips, driftRange: [serialize(drift.lower), serialize(drift.upper)],
    initialWitness: [fmt(member(intercept)), fmt(v)]};
}

export function positionDriftRegions(commands, values) {
  need(Array.isArray(commands) && commands.every(c => pulseMenu.includes(c)) && commands.length <= 3,
    'expected up to three registered commands');
  need(Array.isArray(values) && values.length === commands.length + 1, 'expected one reading at every tick');
  const readings = values.map(parseIntegratorReading);
  return ids.map((_, k) => region(k, commands, readings)).filter(Boolean);
}

function choose(regions, tick) {
  if (!regions.length || tick === 3) return {kind: 'stop'};
  if (tick === 0) return {kind: 'pulse', command: 'off'};
  if (tick === 1) return {kind: 'pulse', command: 1};
  const low = regions.every(r => r.law === 'A' || r.law === 'B');
  const high = regions.every(r => r.law === 'C' || r.law === 'D');
  need(low !== high, 'the registered second-difference intervals must be disjoint');
  return {kind: 'pulse', command: low ? 0 : 2};
}

// Reconstruct every action and full per-law state region from the source
// readings. An impossible prefix stops immediately, including at a fork.
export function observePositionDrift(values) {
  need(Array.isArray(values) && values.length >= 1 && values.length <= 4, 'expected one to four readings');
  const readings = values.map(value => fmt(parseIntegratorReading(value)));
  const rounds = [], commands = [];
  for (let tick = 0; tick < readings.length; tick++) {
    const regions = positionDriftRegions(commands, readings.slice(0, tick + 1));
    const next = choose(regions, tick);
    rounds.push({tick, regions, next});
    if (tick + 1 < readings.length) {
      need(next.kind === 'pulse', 'a reading followed a stopped experiment');
      commands.push(next.command);
    }
  }
  return {schema, readings, commands, rounds};
}

function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}

export function replayPositionDrift(record) {
  need(record?.schema === schema, 'unrecognized record schema');
  const reconstructed = observePositionDrift(record.readings);
  need(same(record, reconstructed), 'saved actions, state regions, or witnesses differ from exact replay');
  return reconstructed;
}

// For on-only tapes, a drift offset of -16 hides A/D at every tick. With
// coasting and <=3 pulses, some on-command is absent; its adjacent laws agree.
export function fixedPositionDriftCollision(commands) {
  need(Array.isArray(commands) && commands.length <= 3 && commands.every(c => pulseMenu.includes(c)),
    'expected a registered fixed tape of at most three commands');
  if (!commands.includes('off')) return [{law:'A', start:[0,0]}, {law:'D', start:[0,-16]}];
  const missing = [0,1,2].find(c => !commands.includes(c));
  return [{law:ids[missing], start:[0,0]}, {law:ids[missing + 1], start:[0,0]}];
}
