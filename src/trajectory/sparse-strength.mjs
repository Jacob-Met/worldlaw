// Predictions are computed before the independent virtual sensor is sampled.
import {rollout} from './forward.mjs';
import {acquireVirtualPendulumReadings, VIRTUAL_PENDULUM_INSTRUMENT} from './virtual-experiment.mjs';

const issuedPlans = new WeakSet();
function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

const scales = Object.freeze([.75, .875, 1, 1.125, 1.25]);
const releases = Object.freeze([{initialPosition: 1.15, initialRate: 0}, {initialPosition: -.90, initialRate: .35}]);
const duration = 2, sampleInterval = .05, inertia = .8;
const times = Array.from({length: 41}, (_, i) => i / 20);
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function scaledModel(model, scale) {
  return {schema: model.schema, id: model.id, units: {...model.units},
    terms: model.terms.map(({id, coefficient}) => ({id, coefficient: coefficient * scale}))};
}

function predict(model, release, step) {
  // rollout integrates from the controlled first angle. The subsequent position
  // placeholders belong to a forecast grid and never become measured evidence.
  const run = {id: 'sparse-strength-grid', label: 'Prospective forecast', kind: 'synthetic',
    source: {label: 'Unmeasured virtual schedule'}, inertia, initialRate: release.initialRate,
    samples: times.map(time => ({time, position: release.initialPosition, command: 0}))};
  return rollout(model, run, {maxStep: step}).rows.map(row => row.predicted);
}

export function planSparseStrength(model, noiseSigma = .012, design = 'dispersion') {
  requireValue(Number.isFinite(noiseSigma) && noiseSigma > 0 && noiseSigma <= .05, 'Supply a positive declared position noise up to .05 rad.');
  requireValue(design === 'dispersion' || design === 'uniform', 'Unknown sampling policy.');
  const candidates = scales.map(scale => scaledModel(model, scale));
  const planned = releases.map(release => {
    const predictions = candidates.map(candidate => {
      const original = predict(candidate, release, .005), refined = predict(candidate, release, .0025);
      const discrepancy = Math.max(...original.map((v, i) => Math.abs(v - refined[i])));
      requireValue(discrepancy <= noiseSigma * .01, 'Forecast integration error exceeds one percent of the declared sensor noise.');
      return refined;
    });
    const spread = times.slice(1).map((_, i) => {
      const values = predictions.map(rows => rows[i + 1]);
      return {index: i + 1, range: Math.max(...values) - Math.min(...values)};
    });
    requireValue(spread.some(row => row.range > noiseSigma * .01), 'The offered strengths have indistinguishable forecasts.');
    const indices = design === 'uniform' ? [10, 20, 30, 40] :
      spread.sort((a, b) => b.range - a.range || a.index - b.index).slice(0, 4).map(row => row.index).sort((a, b) => a-b);
    return {request: {...release, duration, sampleInterval, noiseSigma, sampleIndices: indices},
      predictions: predictions.map(rows => indices.map(i => rows[i]))};
  });
  const plan = {schema: 'worldlaw.sparse-strength-plan/v1', model: scaledModel(model, 1),
    inertia, design, noiseSigma, scales: [...scales], releases: planned};
  issuedPlans.add(plan);
  return freezeTree(plan);
}

// This layer accepts observation values and protocol metadata only. It never
// consults a virtual instrument's law, unobserved positions, or challenge data.
export function fitSparseStrength(plan, records) {
  requireValue(issuedPlans.has(plan) && Array.isArray(records) &&
    records.length >= 1 && records.length <= plan.releases.length, 'Supply the planned sparse releases in order.');
  const identities = new Set(), streams = new Set(), sums = scales.map(() => 0);
  let count = 0;
  for (const [j, record] of records.entries()) {
    const {request, predictions} = plan.releases[j], source = record?.source, units = record?.units;
    requireValue(record?.schema === 'worldlaw.virtual-pendulum-sparse/v1' && record.kind === 'synthetic' &&
      units?.time === 's' && units.position === 'rad' && units.command === 'N·m' && units.initialRate === 'rad/s' &&
      units.inertia === 'kg·m²' && record.inertia === plan.inertia &&
      record.initialPosition === request.initialPosition && record.initialRate === request.initialRate &&
      source?.duration === duration && source.sampleInterval === sampleInterval && source.positionNoiseSigma === plan.noiseSigma,
      'Sparse observation units, release state or sensor settings disagree with its plan.');
    requireValue(typeof source.recordingId === 'string' && source.recordingId.length && !identities.has(source.recordingId) &&
      typeof source.noise?.noiseStreamId === 'string' && source.noise.noiseStreamId.length && !streams.has(source.noise.noiseStreamId),
      'Each release needs a distinct recording and noise stream.');
    requireValue(typeof source.instrumentId === 'string' && source.instrumentId.length > 0 &&
      source.instrumentId === records[0].source.instrumentId, 'Both releases must belong to the same instrument.');
    identities.add(source.recordingId); streams.add(source.noise.noiseStreamId);
    requireValue(source.noise.selectedOnly === true && record.measurementCount === request.sampleIndices.length &&
      source.measuredSampleCount === record.measurementCount && record.readings?.length === record.measurementCount &&
      source.noise.measurementDrawCount === record.measurementCount && source.sampleIndices?.length === record.measurementCount,
      'Sparse counts differ from the prospective budget.');
    for (const [i, reading] of record.readings.entries()) {
      const index = request.sampleIndices[i];
      requireValue(reading.sampleIndex === index && source.sampleIndices[i] === index &&
        Math.abs(reading.time - times[index]) < 1e-12 && reading.command === 0 &&
        Number.isFinite(reading.position), 'Reading does not match its preselected time or command.');
      for (const [k, rows] of predictions.entries()) sums[k] += ((reading.position - rows[i]) / plan.noiseSigma) ** 2;
      count++;
    }
  }
  requireValue(sums.every(Number.isFinite), 'The finite strength profile overflowed.');
  const minimum = Math.min(...sums), weights = sums.map(x => Math.exp(-.5 * (x-minimum)));
  const sum = weights.reduce((a,b) => a+b,0), best = sums.indexOf(minimum);
  const profile = scales.map((scale, i) => ({scale, chiSquare: sums[i], conditionalWeight: weights[i] / sum}));
  // Simultaneous confidence set when an offered scale is correct and the
  // known independent Gaussian observation model and predictions hold.
  // A conservative chi-square tail bound applies to that *fixed* true scale.
  const logTail = Math.log(100), limit = count + 2*Math.sqrt(count*logTail) + 2*logTail;
  const compatibleScales = profile.filter(row => row.chiSquare <= limit).map(row => row.scale);
  const unique = sums.filter(x => Math.abs(x-minimum) <= 1e-10*Math.max(1, minimum)).length === 1;
  const status = !compatibleScales.length ? 'all_offered_scales_rejected' : !unique ? 'tied_grid_minimum' : 'conditional_grid_fit';
  return {status, readings: count, releases: records.length, profile, compatibleScales,
    selectedScale: status === 'conditional_grid_fit' ? scales[best] : null,
    revisedModel: status === 'conditional_grid_fit' ? {...scaledModel(plan.model, scales[best]), id: scales[best] === 1 ? plan.model.id : plan.model.id + '@strength-' + scales[best]} : null};
}

export function acquireStrengthStudy(model, noiseSigma, seeds, existingRuns = []) {
  requireValue(Array.isArray(seeds) && seeds.length === 2 && new Set(seeds).size === 2,
    'Two independent sensor seeds are required.');
  const plan = planSparseStrength(model, noiseSigma);
  const records = [];
  for (const [i, release] of plan.releases.entries()) {
    records.push(acquireVirtualPendulumReadings({...release.request, seed: seeds[i]}, {existingRuns: [...existingRuns, ...records]}));
  }
  return {schema:'worldlaw.sparse-strength-study/v1', instrument: VIRTUAL_PENDULUM_INSTRUMENT.id,
    plan, seeds:[...seeds], records, fit:fitSparseStrength(plan, records)};
}

export function replayStrengthStudy(receipt, model, existingRuns = []) {
  requireValue(receipt?.schema === 'worldlaw.sparse-strength-study/v1', 'Unknown strength receipt.');
  const rebuilt = acquireStrengthStudy(model, receipt.plan?.noiseSigma, receipt.seeds, existingRuns);
  const canonical = value => JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  requireValue(canonical(receipt) === canonical(rebuilt), 'Receipt differs from its source-bound replay.');
  return rebuilt;
}
