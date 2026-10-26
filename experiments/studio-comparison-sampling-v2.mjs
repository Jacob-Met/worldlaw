/** Independent analytic countercourse for Studio output sampling.
 * This authors hypothetical competing scalar laws, not fitted observations.
 * It does not change solver policy, UI, source evidence, or the reviewed feature.
 * Run: node experiments/studio-comparison-sampling-v2.mjs --out experiments/studio-comparison-sampling-v2.local-draft
 * The parent rerun can label provenance with WORLDLAW_SAMPLING_CONTEXT=renpo-receiving.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareStudioDynamics, STUDIO_COMPARISON_LIMITS } from '../src/science/studio-dynamics-comparison.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TWO_PI = 2 * Math.PI;
const BASE_DT = 0.02;
const GRIDS = [0.02, 0.01, 0.005, 0.0025, 0.00125, 0.000625];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const model = (id, frequencyHz) => ({
  schema: 'worldlaw.torque-model/v1',
  id,
  equation: `τ = ${-((TWO_PI * frequencyHz) ** 2)} θ`,
  terms: [{ id: 'spring', coefficient: -((TWO_PI * frequencyHz) ** 2) }],
});

// Exact harmonic solution for I=1, u=0; independent of the maintained solver.
function analytic(frequencyHz, initial, time) {
  const omega = TWO_PI * frequencyHz;
  return {
    position: initial.position * Math.cos(omega * time) + initial.rate / omega * Math.sin(omega * time),
    rate: -initial.position * omega * Math.sin(omega * time) + initial.rate * Math.cos(omega * time),
  };
}

function analyticDifference(scenario, time) {
  const a = analytic(scenario.frequenciesHz[0], scenario.initial, time);
  const b = analytic(scenario.frequenciesHz[1], scenario.initial, time);
  return { time, position: Math.abs(a.position - b.position), rate: Math.abs(a.rate - b.rate) };
}

function distanceToGrid(time, dt, duration) {
  return Math.min(Math.abs(time - Math.round(time / dt) * dt), Math.abs(duration - time));
}

function analyticWitnesses(scenario) {
  const count = Math.max(1000, Math.ceil(scenario.duration * Math.max(...scenario.frequenciesHz) * 512));
  const h = scenario.duration / count;
  let position = { time: 0, value: 0 }, rate = { time: 0, value: 0 };
  let evaluatedTimes = 0;
  for (let index = 1; index < count; index++) {
    const time = index * h;
    if (distanceToGrid(time, BASE_DT, scenario.duration) < 1e-12) continue;
    evaluatedTimes += 1;
    const difference = analyticDifference(scenario, time);
    if (difference.position > position.value) position = { time, value: difference.position };
    if (difference.rate > rate.value) rate = { time, value: difference.rate };
  }
  for (const witness of [position, rate]) {
    witness.distanceToCoarseOutput = distanceToGrid(witness.time, BASE_DT, scenario.duration);
  }
  const derivativeBounds = scenario.frequenciesHz.map(frequency => {
    const omega = TWO_PI * frequency;
    return {
      velocity: Math.abs(scenario.initial.position) * omega + Math.abs(scenario.initial.rate),
      acceleration: Math.abs(scenario.initial.position) * omega * omega + Math.abs(scenario.initial.rate) * omega,
    };
  });
  return {
    referenceOutputInterval: BASE_DT,
    position,
    rate,
    analyticSearchInterval: h,
    searchEvaluations: evaluatedTimes,
    attemptedSearchTimes: count - 1,
    skippedCoarseGridTimes: count - 1 - evaluatedTimes,
    samplingGapEstimate: {
      position: derivativeBounds.reduce((sum, value) => sum + value.velocity, 0) * h,
      rate: derivativeBounds.reduce((sum, value) => sum + value.acceleration, 0) * h,
      interpretation: 'Conservative Lipschitz search-gap estimate for the analytic witness scan, in ordinary floating point. Witness values are evaluated analytic differences, not certified global maxima or interpolated solver output.',
    },
    prescribedWitnesses: (scenario.witnessTimes || []).map(time => analyticDifference(scenario, time)),
    proof: scenario.proof || null,
  };
}

function metrics(scenario, comparison) {
  let numericalPositionError = 0, numericalRateError = 0;
  let analyticSampledPositionSeparation = 0, analyticSampledRateSeparation = 0;
  const outcomes = comparison.results.map((row, index) => {
    if (row.status !== 'completed') return { id: row.id, status: row.status, error: row.error, actualEvaluations: null, reservedEvaluations: row.reservedEvaluations ?? null };
    for (const point of row.trajectory) {
      const expected = analytic(scenario.frequenciesHz[index], scenario.initial, point.time);
      numericalPositionError = Math.max(numericalPositionError, Math.abs(point.position - expected.position));
      numericalRateError = Math.max(numericalRateError, Math.abs(point.rate - expected.rate));
      const difference = analyticDifference(scenario, point.time);
      analyticSampledPositionSeparation = Math.max(analyticSampledPositionSeparation, difference.position);
      analyticSampledRateSeparation = Math.max(analyticSampledRateSeparation, difference.rate);
    }
    const d = row.diagnostics;
    const actualEvaluations = d.derivativeEvaluations + d.outputEvaluations;
    return {
      id: row.id,
      status: row.status,
      samples: row.trajectory.length,
      method: d.method,
      actualEvaluations,
      reservedEvaluations: row.reservedEvaluations,
      trials: d.trials,
      acceptedSteps: d.acceptedSteps,
      rejectedSteps: d.rejectedSteps,
      derivativeEvaluations: d.derivativeEvaluations,
      outputEvaluations: d.outputEvaluations,
    };
  });
  const completed = outcomes.filter(row => row.status === 'completed');
  const preflightRefusal = comparison.status === 'refused' && Boolean(comparison.error);
  const knownWork = completed.reduce((sum, row) => sum + row.actualEvaluations, 0);
  const complete = comparison.status === 'completed';
  return {
    status: comparison.status,
    completedCount: comparison.completedCount,
    refusedCount: comparison.refusedCount,
    globalRefusal: comparison.error || null,
    numericalSampledPositionSeparation: comparison.summary?.maxPositionSpread ?? null,
    numericalSampledRateSeparation: comparison.summary?.maxRateSpread ?? null,
    analyticSampledPositionSeparation: complete ? analyticSampledPositionSeparation : null,
    analyticSampledRateSeparation: complete ? analyticSampledRateSeparation : null,
    maximumNumericalPositionError: completed.length ? numericalPositionError : null,
    maximumNumericalRateError: completed.length ? numericalRateError : null,
    errorScope: complete ? 'Every law at every returned output time.' : 'Completed laws only; no error or separation claim for the full set.',
    work: {
      maxTotalEvaluations: comparison.work?.maxTotalEvaluations ?? STUDIO_COMPARISON_LIMITS.maxTotalEvaluations,
      maxTotalSamples: comparison.work?.maxTotalSamples ?? STUDIO_COMPARISON_LIMITS.maxTotalSamples,
      totalRequestedSamples: comparison.work?.totalSamples ?? null,
      perModelEvaluationLimit: comparison.work?.perModelEvaluationLimit ?? null,
      maxTrialsPerAdaptiveModel: comparison.work?.adaptiveMaxTrials ?? null,
      proposedReservedEvaluations: comparison.work?.totalReservedEvaluations ?? null,
      actualEvaluations: preflightRefusal ? 0 : complete ? knownWork : null,
      actualEvaluationsLowerBound: preflightRefusal ? 0 : knownWork,
      actualEvaluationsUpperBound: preflightRefusal ? 0 : comparison.work?.totalReservedEvaluations ?? null,
      interpretation: preflightRefusal
        ? 'Whole request refused before numerical execution. Prospective reservation is not spent work.'
        : complete
          ? 'Actual derivative and output evaluations from maintained diagnostics; model-preparation overhead and wall-clock duration are separate.'
          : 'The maintained executor does not return partial diagnostics after failure. Only completed-path work is measured; the reservation is an upper bound, not a fabricated failure count.',
    },
    outcomes,
  };
}

function execute(scenario, dt, duration = scenario.duration) {
  const discovery = {
    schema: 'worldlaw.discovery/v1',
    competitive: scenario.frequenciesHz.map((frequency, index) => model(`${scenario.id}-${index + 1}`, frequency)),
  };
  const initial = { ...scenario.initial };
  const settings = { duration, dt, inertia: 1, command: 0 };
  const before = JSON.stringify({ discovery, initial, settings });
  const started = performance.now();
  // Deliberately omit the optional policy: no ceiling increase or hidden subset.
  const comparison = compareStudioDynamics(discovery, initial, settings);
  const elapsedMs = performance.now() - started;
  if (JSON.stringify({ discovery, initial, settings }) !== before) throw new Error('Experiment source was mutated.');
  return { dt, duration, elapsedMs, sourceUnchanged: true, ...metrics(scenario, comparison) };
}

const scenarios = [
  {
    id: 'integer-cycle-alias',
    role: 'Primary deliberately discriminating countercourse.',
    frequenciesHz: [50, 100], initial: { position: 1, rate: 0 }, duration: 0.2,
    witnessTimes: [0.005, 0.01],
    proof: 'At t=n*0.02 s, both exact laws have position 1 rad and rate 0 rad/s. At t=0.01 s their positions are -1 and +1 rad: exactly 2 rad apart, which is also the amplitude upper bound. Output equality therefore hides a real analytic intersample difference.',
  },
  {
    id: 'held-back-frequency-and-release',
    role: 'Held-back frequency pair, amplitude and nonzero release rate; chosen before execution.',
    frequenciesHz: [150, 250], initial: { position: 0.37, rate: -0.8 }, duration: 0.2,
    witnessTimes: [0.00375, 0.005],
    proof: 'At t=n*0.02 s both exact laws return to the common release. At t=n*0.01 s they also coincide, alternating release signs. At t=0.005 s their exact rates differ by 0.37*2*pi*(150+250) rad/s, independent of the nonzero initial-rate contribution because both cosine factors vanish. Agreement of two successive output grids is therefore not an alias-free certificate.',
  },
  {
    id: 'resolved-low-frequency-control',
    role: 'Changed-input control: lower, noninteger-cycle frequencies should already show separation on 20 ms outputs.',
    frequenciesHz: [3.1, 7.3], initial: { position: 0.6, rate: -0.2 }, duration: 0.2,
  },
];

const sourceHashes = {};
for (const path of [
  'experiments/studio-comparison-sampling.mjs',
  'experiments/studio-comparison-sampling-v2.mjs',
  'src/science/studio-dynamics-comparison.mjs',
  'src/science/studio-dynamics.mjs',
  'src/science/torque-discovery.mjs',
]) sourceHashes[path] = sha256(await readFile(resolve(ROOT, path)));

const courses = scenarios.map(scenario => ({
  ...scenario,
  oracle: analyticWitnesses(scenario),
  grids: GRIDS.map(dt => execute(scenario, dt)),
}));
const refusalCourses = [
  {
    name: 'aggregate-sample-ceiling',
    expectation: '20002 requested outputs for two laws exceed the unchanged 20000-sample ceiling; refuse the complete set before integration.',
    ...execute(scenarios[0], 0.00002),
  },
  {
    name: 'long-fast-work-exhaustion',
    expectation: 'A longer fast motion may exhaust the unchanged equal-share adaptive budget. Preserve every refusal and do not increase the policy.',
    ...execute(scenarios[1], BASE_DT, 4),
  },
];

const primary = courses[0], heldBack = courses[1], control = courses[2];
const discriminator = {
  primaryCompletedAt20ms: primary.grids[0].status === 'completed',
  primarySampledAngleNearlyEqual: primary.grids[0].numericalSampledPositionSeparation !== null && primary.grids[0].numericalSampledPositionSeparation < 1e-4,
  primarySampledRateNearlyEqual: primary.grids[0].numericalSampledRateSeparation !== null && primary.grids[0].numericalSampledRateSeparation < 0.02,
  primaryAnalyticHiddenPositionAtLeastOneRadian: primary.oracle.prescribedWitnesses.some(witness => witness.position >= 1),
  primaryFinerGridRevealsPositionDifference: primary.grids.slice(1).some(row => row.status === 'completed' && row.numericalSampledPositionSeparation > 1),
  heldBack20msAnd10msComplete: heldBack.grids[0].status === 'completed' && heldBack.grids[1].status === 'completed',
  heldBack20msAnd10msPositionsNearlyEqual: heldBack.grids.slice(0, 2).every(row => row.numericalSampledPositionSeparation !== null && row.numericalSampledPositionSeparation < 1e-4),
  heldBack20msAnd10msRatesNearlyEqual: heldBack.grids.slice(0, 2).every(row => row.numericalSampledRateSeparation !== null && row.numericalSampledRateSeparation < 0.02),
  heldBackFinerGridRevealsPositionDifference: heldBack.grids.slice(2).some(row => row.status === 'completed' && row.numericalSampledPositionSeparation > 0.4),
  allFastCoursesAgreeWithIndependentOracle: [primary, heldBack].every(course => course.grids.every(row => row.status === 'completed'
    && row.maximumNumericalPositionError < 1e-4 && row.maximumNumericalRateError < 0.02)),
  lowFrequencyControlAlreadySeparates: control.grids[0].status === 'completed' && control.grids[0].numericalSampledPositionSeparation > 0.1,
  sampleRefusalRetainsBothOriginalLaws: refusalCourses[0].status === 'refused' && refusalCourses[0].outcomes.length === 2 && refusalCourses[0].work.actualEvaluations === 0,
  longFastWorkRefusalRetainsBothOriginalLaws: refusalCourses[1].status === 'refused'
    && refusalCourses[1].outcomes.length === 2 && refusalCourses[1].outcomes.every(row => row.error?.code === 'step_limit'),
};
const result = {
  schema: 'worldlaw.studio-comparison-sampling/v1',
  experimentRevision: 'v2-analytic-search-counts',
  precedingExperimentSHA256: '0655269c5b5f2b47a7402a781649e851f91d103a07e836a6a926c18291d1267c',
  generatedAt: new Date().toISOString(),
  context: process.env.WORLDLAW_SAMPLING_CONTEXT || 'local-draft',
  reviewedFeature: { pr: 'https://github.com/Jacob-Met/worldlaw/pull/337', head: '3af6c7a9b8cbfc4c958a6ff84fbeb29cf8666652' },
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  policy: STUDIO_COMPARISON_LIMITS,
  sourceHashes,
  hypothesis: 'The fixed 20 ms Studio output grid can conceal substantially different valid harmonic motions even when the adaptive integrator accurately resolves them internally.',
  oracle: 'q(t)=q0*cos(2*pi*f*t)+(v0/(2*pi*f))*sin(2*pi*f*t); v(t)=-q0*(2*pi*f)*sin(2*pi*f*t)+v0*cos(2*pi*f*t). Scalar inertia1, zero command, spring coefficient-(2*pi*f)^2.',
  discriminator,
  qualification: Object.values(discriminator).every(Boolean) ? 'discriminating-countercourse' : 'unresolved-or-counterexample-to-expectation',
  courses,
  refusalCourses,
  limits: [
    'Hypothetical authored laws; no fitted observations, physical acquisition, probability or model-ranking evidence.',
    'Analytic witnesses demonstrate actual intersample differences; the dense analytic scan does not assert a certified global maximum.',
    'Numerical accuracy is measured against the independent formula only at returned times. No interpolation or unreported internal solver states are used.',
    'Per-run work and sample ceilings remain unchanged. Failed-run actual evaluation counts remain unknown unless refusal occurs before execution.',
    'Elapsed times are measurements from this specific execution environment, not performance promises.',
    'Finer output can expose these courses but agreement across one or several grids does not certify general freedom from aliasing.',
  ],
};

const n = value => value === null || value === undefined ? '—' : Number(value).toPrecision(6);
let report = `# Studio output-sampling countercourse\n\nExecution context: **${result.context}**. Qualification: **${result.qualification}**.\n\nThis experiment uses authored hypothetical oscillator laws and the unchanged maintained comparison/executor. It does not modify the reviewed feature or create observations.\n\n`;
for (const course of courses) {
  report += `## ${course.id}\n\n${course.role} Frequencies: ${course.frequenciesHz.join(' / ')} Hz. Release: ${course.initial.position} rad, ${course.initial.rate} rad/s. Duration: ${course.duration} s.\n\n`;
  if (course.proof) report += `${course.proof}\n\n`;
  report += `An analytic intersample witness has angle separation **${n(course.oracle.position.value)} rad** at ${n(course.oracle.position.time)} s and another has rate separation **${n(course.oracle.rate.value)} rad/s** at ${n(course.oracle.rate.time)} s. These witness values are separate from the numerical output grid.\n\n`;
  report += '| Output ms | Status | Sampled Δangle rad | Sampled Δrate rad/s | Max angle error rad | Max rate error rad/s | Actual evaluations | Returned/requested samples |\n|---:|---|---:|---:|---:|---:|---:|---:|\n';
  for (const row of course.grids) report += `| ${n(row.dt * 1000)} | ${row.status} | ${n(row.numericalSampledPositionSeparation)} | ${n(row.numericalSampledRateSeparation)} | ${n(row.maximumNumericalPositionError)} | ${n(row.maximumNumericalRateError)} | ${n(row.work.actualEvaluations)} | ${row.work.totalRequestedSamples} |\n`;
  report += '\n';
}
report += '## Bounded refusal courses\n\n';
for (const row of refusalCourses) {
  report += `- **${row.name}: ${row.status}**, ${row.completedCount} completed / ${row.refusedCount} refused. ${row.expectation} Measured complete-run evaluations: ${n(row.work.actualEvaluations)}; known lower / upper bounds: ${n(row.work.actualEvaluationsLowerBound)} / ${n(row.work.actualEvaluationsUpperBound)}. Errors: ${row.outcomes.map(outcome => outcome.error?.code || 'none').join(', ')}.\n`;
}
report += '\n## Decision supported by this course\n\n';
report += result.qualification === 'discriminating-countercourse'
  ? 'The result supports a consumer investigation that lets a person deliberately refine the common output grid and inspect or play the resulting intermediate states slowly, within the existing shared work and sample ceilings. An automatic green “resolved” badge after two agreeing grids would be unsupported: the held-back course defeats that inference. The existing 20 ms image can remain a default, but it is insufficient for deciding that competing fast laws produce the same motion. This is a proposal for a usable resolution investigation, not a claim that a finer default solves arbitrary aliasing.\n'
  : 'The expected discriminator did not fully qualify. Inspect the recorded refusals and analytic errors before choosing a consumer change; do not relabel an unresolved run as a capability improvement.\n';
report += '\n## Limits and provenance\n\n' + result.limits.map(value => `- ${value}\n`).join('');
report += `\nSource hashes and per-law work/refusal detail are retained in the paired JSON. Parent receiving should rerun the identical file through Renpō and preserve its separate context and exact source hashes.\n`;

const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0) {
  if (!process.argv[outIndex + 1]) throw new Error('--out requires a filename prefix.');
  const prefix = resolve(process.argv[outIndex + 1]);
  await mkdir(dirname(prefix), { recursive: true });
  await writeFile(prefix + '.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile(prefix + '.md', report);
  console.log(JSON.stringify({ qualification: result.qualification, context: result.context, json: prefix + '.json', markdown: prefix + '.md', discriminator }, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
