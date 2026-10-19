/** Synthetic pendulum instrument; no fitted-model, discovery, or forward-solver imports. */
const ID = 'worldlaw.virtual-pendulum/v1';
const UNITS = Object.freeze({time: 's', position: 'rad', command: 'N·m', inertia: 'kg·m²', initialRate: 'rad/s'});
export const VIRTUAL_PENDULUM_INSTRUMENT = Object.freeze({
  id: ID, version: 1, kind: 'synthetic', inertia: .8, command: 0, units: UNITS,
  allowedInitialPosition: Object.freeze({min: -2.4, max: 2.4}),
  allowedInitialRate: Object.freeze({min: -2, max: 2}),
  allowedDuration: Object.freeze({min: .64, max: 20}),
  allowedSampleInterval: Object.freeze({min: .01, max: .1}),
  maxSamples: 2001, maxIntegrationStep: .0005, maxIntegrationSteps: 42000,
  meaning: 'Controlled synthetic release instrument; bounds are computational limits, not hardware safety authorization.',
});
export class VirtualExperimentError extends Error {
  constructor(message, code = 'invalid_request') {super(message); this.name = 'VirtualExperimentError'; this.code = code;}
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function insist(condition, message, code) {if (!condition) throw new VirtualExperimentError(message, code);}
function bounded(value, name, min, max) {
  insist(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    `${name} must be finite and between ${min} and ${max}.`);
  return Object.is(value, -0) ? 0 : value;
}
function requestOptions(raw) {
  insist(record(raw), 'Supply an explicit virtual acquisition request.');
  const keys = ['initialPosition', 'initialRate', 'seed', 'duration', 'sampleInterval', 'noiseSigma'];
  insist(Object.keys(raw).every(key => keys.includes(key)), 'The instrument accepts only initialPosition, initialRate, seed, duration, sampleInterval and noiseSigma; learned laws or physical parameter overrides are not inputs.');
  const result = {
    initialPosition: bounded(raw.initialPosition, 'initialPosition (rad)', -2.4, 2.4),
    initialRate: bounded(raw.initialRate, 'initialRate (rad/s)', -2, 2),
    seed: bounded(raw.seed, 'seed', 0, 4294967295),
    duration: bounded(raw.duration ?? 8, 'duration (s)', .64, 20),
    sampleInterval: bounded(raw.sampleInterval ?? .04, 'sampleInterval (s)', .01, .1),
    noiseSigma: bounded(raw.noiseSigma ?? .00002, 'noiseSigma (rad)', 0, .05),
  };
  insist(Number.isInteger(result.seed), 'seed must be an explicitly supplied unsigned 32-bit integer.');
  const ratio = result.duration / result.sampleInterval, count = Math.round(ratio);
  insist(Math.abs(ratio - count) <= 32 * Number.EPSILON * Math.max(1, ratio), 'duration must contain a whole number of sample intervals; no silent duration rounding.');
  insist(count >= 16 && count + 1 <= 2001, 'A virtual run must contain 17–2001 samples.', 'resource_limit');
  const substeps = Math.ceil(result.sampleInterval / .0005);
  insist(count * substeps <= VIRTUAL_PENDULUM_INSTRUMENT.maxIntegrationSteps,
    'The requested acquisition exceeds the complete integration budget.', 'resource_limit');
  return {...result, intervalCount: count, substeps};
}
function random(seed) {
  let state = seed;
  return () => {state = (Math.imul(1664525, state) + 1013904223) >>> 0; return (state + .5) / 4294967296;};
}
// Canonical text is the authoritative recording identity. This small deterministic
// identifier is only a readable run label; it is not a cryptographic authenticity proof.
function shortId(text) {
  let hash = 14695981039346656037n;
  for (let i = 0; i < text.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 1099511628211n);
  return `virtual-pendulum-${hash.toString(16).padStart(16, '0')}`;
}
function identity(options) {
  const {initialPosition, initialRate, seed, noiseSigma, duration, sampleInterval} = options;
  // Zero-noise outputs do not acquire an independent identity from a changed seed.
  return `${ID}:${JSON.stringify([initialPosition, initialRate, noiseSigma ? seed : null, noiseSigma, duration, sampleInterval])}`;
}
function recognized(run) {
  return run.source.instrumentId === ID || run.source.generator === 'scripts/generate-trajectory-fixtures-92be.mjs';
}
function checkHistory(options, recordingId, raw) {
  insist(record(raw) && Object.keys(raw).every(key => key === 'existingRuns'), 'Acquisition context accepts only existingRuns.', 'invalid_history');
  insist(Array.isArray(raw.existingRuns) && raw.existingRuns.length <= 64,
    'Pass every retained training, challenge and acquired run as existingRuns (at most 64); use [] only for a new empty instrument history.', 'invalid_history');
  for (const run of Array.from(raw.existingRuns)) {
    insist(record(run) && record(run.source) && typeof run.id === 'string' && ['synthetic', 'measured', 'unknown'].includes(run.kind),
      'Existing evidence must contain ordinary run identities, kinds and source metadata.', 'invalid_history');
    insist(run.source.recordingId !== recordingId, 'This exact synthetic acquisition is already retained; replay is not independent evidence.', 'repeated_evidence');
    if (!recognized(run)) continue;
    insist(run.kind === 'synthetic' && Number.isInteger(run.source.seed) && run.source.seed >= 0 && run.source.seed <= 4294967295 &&
      Number.isFinite(run.source.positionNoiseSigma) && run.source.positionNoiseSigma >= 0,
      'Recognized virtual evidence has incomplete seed/noise provenance.', 'invalid_history');
    if (options.noiseSigma > 0 && run.source.positionNoiseSigma > 0) insist(run.source.seed !== options.seed,
      'This seed reuses an existing position-noise stream; choose a new seed for a separately acquired run.', 'reused_noise_stream');
    // Same exact noiseless initial-value problem remains repeated synthetic
    // evidence under relabeling, a changed seed, or a new sampling duration/grid.
    if (options.noiseSigma === 0 && run.source.positionNoiseSigma === 0) {
      const own = run.source.instrumentId === ID;
      const compatibleFixture = run.source.oracle?.inertia === .8 && run.source.oracle?.rate === -.24 &&
        run.source.oracle?.gravity === -2.2 && run.source.oracle?.bias === 0;
      const first = run.samples?.[0];
      if (own || compatibleFixture) insist(!(first?.position === options.initialPosition && run.initialRate === options.initialRate),
        'A new seed or sampling grid does not make the same noiseless release independent evidence.', 'repeated_evidence');
    }
  }
}

/**
 * Acquire one whole synthetic release. Pass all retained evidence explicitly so
 * replayed recordings/noise streams cannot silently count as independent runs.
 * Fresh pure calls with existingRuns:[] reproduce the same evidence and identity.
 */
export function acquireVirtualPendulum(request, context) {
  const options = requestOptions(request), recordingId = identity(options);
  checkHistory(options, recordingId, context);
  const noise = random(options.seed), samples = [];
  const {initialPosition, initialRate, duration, sampleInterval, noiseSigma, seed, intervalCount, substeps} = options;
  let position = initialPosition, rate = initialRate;
  // Independent explicit physical equation, matching the unforced fixture instrument.
  const acceleration = (theta, omega) => (-.24 * omega - 2.2 * Math.sin(theta)) / .8;
  const step = sampleInterval / substeps;
  for (let index = 0; index <= intervalCount; index++) {
    const error = index === 0 ? 0 : noiseSigma * (Math.sqrt(-2 * Math.log(noise())) * Math.cos(2 * Math.PI * noise()));
    const time = index === intervalCount ? duration : Number((index * sampleInterval).toFixed(12));
    insist(Number.isFinite(position + error) && Math.abs(position + error) <= 1e6, 'Sensor output exceeded the finite instrument range.', 'numerical_failure');
    samples.push({time, position: position + error, command: 0});
    if (index === intervalCount) break;
    for (let j = 0; j < substeps; j++) {
      const ap = rate, av = acceleration(position, rate);
      const bp = rate + step * av / 2, bv = acceleration(position + step * ap / 2, bp);
      const cp = rate + step * bv / 2, cv = acceleration(position + step * bp / 2, cp);
      const dp = rate + step * cv, dv = acceleration(position + step * cp, dp);
      position += step * (ap + 2 * bp + 2 * cp + dp) / 6;
      rate += step * (av + 2 * bv + 2 * cv + dv) / 6;
      insist(Number.isFinite(position) && Number.isFinite(rate) && Math.abs(position) <= 1e6 && Math.abs(rate) <= 1e6,
        'Synthetic integration exceeded its finite execution range.', 'numerical_failure');
    }
  }
  return {
    id: shortId(recordingId), label: `Virtual pendulum release · θ₀=${initialPosition} rad · ω₀=${initialRate} rad/s`,
    kind: 'synthetic', units: {...UNITS}, inertia: .8, initialRate, samples,
    source: {
      label: 'Independent explicit-equation synthetic pendulum instrument', instrumentId: ID, recordingId,
      generator: 'src/trajectory/virtual-experiment.mjs', seed, positionNoiseSigma: noiseSigma,
      initialPosition, duration, sampleInterval,
      provenance: 'synthetic_virtual_instrument_not_physical_measurement',
      acquisition: 'Complete fine-step RK4 release with fixed instrument coefficients; no learned candidate is evaluated as truth.',
      commandConvention: 'samples[i].command=0 N·m held on [time_i,time_i+1); final command does not drive a completed interval.',
      initialState: 'Initial angle and rate are supplied by the controlled instrument; t0 has exactly zero position noise.',
      noise: {algorithm: 'lcg32_1664525_1013904223_box_muller_cosine_v1', distribution: 'seeded_iid_gaussian_angle_perturbations',
        initialNoise: 0, noiseStreamId: `${ID}:position-noise:${seed}`, seedMeaning: 'Reusing a seed reuses a deterministic noise stream; distinct seeds are controlled pseudorandom realizations, not physical independence.'},
      oracle: {inertia: .8, command: 0, rate: -.24, gravity: -2.2, bias: 0},
      numerical: {method: 'independent_explicit_equation_RK4', maxStep: step, steps: intervalCount * substeps,
        meaning: 'High-resolution numerical reference, not exact physical truth or a calibrated error bound.'},
      independence: 'Canonical recording identity and supplied-history checks prevent ordinary replay/reused-seed counting; they do not authenticate edited provenance or establish transfer to another apparatus.',
      rights: 'Generated for this repository; no external media or personal information.',
    },
  };
}
