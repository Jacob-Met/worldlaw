/** Free-running held-out trajectory evaluation. Dependency-free browser ESM. */
import { predict, TERMS } from '../science/torque-discovery.mjs';
import { normalizeCommandTiming, prepareCommandTimeline } from './command-timeline.mjs';

const STATE_BOUND = 1e6;
const SAMPLE_LIMIT = 10000;
const STEP_LIMIT = 1000000;
const TERM_IDS = new Set(TERMS.map(term => term.id));

export class TrajectoryRolloutError extends Error {
  constructor(message, code = 'invalid_run', options) {
    super(message, options);
    this.name = 'TrajectoryRolloutError';
    this.code = code;
  }
}

function requireThat(value, message, code) {
  if (!value) throw new TrajectoryRolloutError(message, code);
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function finite(value, label, code, bound = Infinity) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound,
    `${label} must be finite${bound < Infinity ? ` with magnitude at most ${bound}` : ''}.`, code);
  return value;
}
function text(value, label, code) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= 512,
    `${label} must be a nonempty string of at most 512 characters.`, code);
  return value;
}

function copyModel(model) {
  requireThat(record(model) && model.schema === 'worldlaw.torque-model/v1' && Array.isArray(model.terms),
    'Expected an executable worldlaw.torque-model/v1 model.', 'invalid_model');
  requireThat(model.terms.length <= TERM_IDS.size, 'Too many model terms.', 'invalid_model');
  const seen = new Set();
  const terms = Array.from(model.terms, term => {
    requireThat(record(term) && TERM_IDS.has(term.id) && !seen.has(term.id),
      'Model terms must be unique known torque-library terms.', 'invalid_model');
    seen.add(term.id);
    return { id: term.id, coefficient: finite(term.coefficient, 'Model coefficient', 'invalid_model', 1e18) };
  });
  return {
    schema: model.schema,
    id: model.id === undefined ? terms.map(term => term.id).join('+') || 'zero' : text(model.id, 'Model ID', 'invalid_model'),
    terms,
  };
}

function copyRun(run) {
  requireThat(record(run), 'Run must be an object.', 'invalid_run');
  const id = text(run.id, 'Run ID', 'invalid_run');
  text(run.label, 'Run label', 'invalid_run');
  requireThat(['synthetic', 'measured', 'unknown'].includes(run.kind),
    'Run kind must be synthetic, measured, or unknown.', 'invalid_run');
  requireThat(record(run.source), 'Run source must be an object.', 'invalid_run');
  text(run.source.label, 'Run source label', 'invalid_run');
  const inertia = finite(run.inertia, 'Run inertia', 'invalid_run', 1e12);
  requireThat(inertia > 0, 'Run inertia must be positive in kg·m².', 'invalid_run');
  const initialRate = finite(run.initialRate, 'Run initialRate', 'invalid_run', STATE_BOUND);
  requireThat(Array.isArray(run.samples) && run.samples.length >= 2 && run.samples.length <= SAMPLE_LIMIT,
    `Run needs between 2 and ${SAMPLE_LIMIT} samples.`, 'invalid_run');
  let previous;
  const samples = Array.from(run.samples, (sample, index) => {
    requireThat(record(sample), `Sample ${index} must be an object.`, 'invalid_run');
    const time = finite(sample.time, `Sample ${index} time`, 'invalid_run');
    if (index) requireThat(time > previous && Number.isFinite(time - previous),
      'Sample timestamps must strictly increase with finite intervals.', 'invalid_run');
    previous = time;
    return {
      time,
      position: finite(sample.position, `Sample ${index} position`, 'invalid_run', STATE_BOUND),
      command: finite(sample.command, `Sample ${index} command`, 'invalid_run', STATE_BOUND),
    };
  });
  requireThat(Number.isFinite(samples.at(-1).time - samples[0].time),
    'Run duration must be finite.', 'invalid_run');
  return { id, inertia, initialRate, samples };
}

function checkedOptions(options) {
  requireThat(record(options), 'Rollout options must be an object.', 'invalid_options');
  const maxStep = options.maxStep === undefined ? 0.01 : finite(options.maxStep, 'maxStep', 'invalid_options');
  const maxSteps = options.maxSteps === undefined ? 200000 : options.maxSteps;
  requireThat(maxStep > 0, 'maxStep must be positive in seconds.', 'invalid_options');
  requireThat(Number.isSafeInteger(maxSteps) && maxSteps >= 1 && maxSteps <= STEP_LIMIT,
    `maxSteps must be an integer between 1 and ${STEP_LIMIT}.`, 'invalid_options');
  return { maxStep, maxSteps };
}

function checkedState(position, rate) {
  requireThat(Number.isFinite(position) && Number.isFinite(rate),
    'Trajectory state became nonfinite.', 'numerical_failure');
  requireThat(Math.abs(position) <= STATE_BOUND && Math.abs(rate) <= STATE_BOUND,
    `Trajectory exceeded the executable state bound of ±${STATE_BOUND}.`, 'runaway_state');
}

/**
 * Integrate θ′=ω, ω′=predict(model,{command,position,rate})/inertia.
 * samples[i].command is held on [samples[i].time, samples[i+1].time).
 * Observed positions after t0 are used only for residuals, never for state updates.
 */
export function rollout(model, run, options = {}) {
  const executable = copyModel(model);
  const evidence = copyRun(run);
  const { maxStep, maxSteps } = checkedOptions(options);
  const commandTiming = options.commandTiming === undefined ? null : normalizeCommandTiming(options.commandTiming);
  const timeline = commandTiming?.delaySeconds > 0 ? prepareCommandTimeline(evidence.samples, commandTiming) : null;

  // Preflight the entire run: reject resource excess before producing any rows.
  // Equal subdivisions of local intervals avoid accumulating large epoch times.
  let requiredSteps = 0;
  const intervals = evidence.samples.slice(1).map((sample, index) => {
    const segments = timeline?.intervals[index] ?? [{duration: sample.time - evidence.samples[index].time, command: evidence.samples[index].command}];
    return segments.map(({duration, command}) => {
      const steps = Math.max(1, Math.ceil(duration / maxStep));
      requireThat(Number.isSafeInteger(steps) && steps >= 1 && steps <= maxSteps - requiredSteps,
        `Trajectory requires more than the allowed ${maxSteps} integration steps.`, 'step_limit');
      requiredSteps += steps;
      return { steps, step: duration / steps, command };
    });
  });

  const derivative = (position, rate, command) => {
    checkedState(position, rate);
    let acceleration;
    try {
      acceleration = predict(executable, { command, position, rate }) / evidence.inertia;
    } catch (cause) {
      throw new TrajectoryRolloutError('Executable torque prediction failed during rollout.', 'numerical_failure', { cause });
    }
    requireThat(Number.isFinite(acceleration), 'Trajectory acceleration became nonfinite.', 'numerical_failure');
    return { position: rate, rate: acceleration };
  };

  let position = evidence.samples[0].position;
  let rate = evidence.initialRate;
  let residualNorm = 0;
  let maxAbsError = 0;
  const initial = evidence.samples[0];
  const rows = [{ time: initial.time, observed: initial.position, predicted: position, rate, residual: 0, command: initial.command }];
  for (let i = 0; i < intervals.length; i++) {
    for (const { steps, step: h, command } of intervals[i]) {
    for (let j = 0; j < steps; j++) {
      const a = derivative(position, rate, command);
      const b = derivative(position + (h * a.position) / 2, rate + (h * a.rate) / 2, command);
      const c = derivative(position + (h * b.position) / 2, rate + (h * b.rate) / 2, command);
      const d = derivative(position + h * c.position, rate + h * c.rate, command);
      // Scale each derivative before summing; do not divide h before multiplication,
      // which would lose representable increments for subnormal sample intervals.
      position += (h * a.position) / 6 + (h * b.position) / 3 + (h * c.position) / 3 + (h * d.position) / 6;
      rate += (h * a.rate) / 6 + (h * b.rate) / 3 + (h * c.rate) / 3 + (h * d.rate) / 6;
      checkedState(position, rate);
    }
    }
    const sample = evidence.samples[i + 1];
    const residual = sample.position - position;
    residualNorm = Math.hypot(residualNorm, residual);
    maxAbsError = Math.max(maxAbsError, Math.abs(residual));
    rows.push({ time: sample.time, observed: sample.position, predicted: position, rate, residual, command: sample.command });
  }

  return {
    schema: 'worldlaw.trajectory-rollout/v1', modelId: executable.id, runId: evidence.id, rows,
    metrics: {
      count: rows.length - 1,
      positionRMSE: residualNorm / Math.sqrt(rows.length - 1),
      maxAbsError,
      finalAbsError: Math.abs(rows.at(-1).residual),
    },
    diagnostics: {
      steps: requiredSteps, method: 'classical_RK4', maxStep, maxSteps,
      commandConvention: 'samples[i].command held on [samples[i].time, samples[i+1].time)',
      ...(commandTiming ? {commandTiming, appliedCommandAtSamples: timeline?.commandsAtSamples ?? evidence.samples.map(row => row.command),
        delayedCommandEvents: timeline?.events ?? [], commandConvention: 'delayed left-sample held command; exact delayed changes partition the RK4 steps'} : {}),
      initialRateSource: 'run.initialRate', observationsResetState: false, initialSampleExcludedFromMetrics: true,
      stateMagnitudeLimit: STATE_BOUND, positionUnit: 'rad', rateUnit: 'rad/s',
      numericalErrorEstimate: null, physicalValidity: 'not_established_by_finite_rollout',
      limitations: [
        'Fixed-step RK4 has no automatic local-error or stiffness estimate.',
        'Coulomb sign changes and other nonsmooth behavior can require smaller steps.',
        'Residuals combine model, initial-state, observation, command, inertia, and integration errors.',
        'A finite rollout is not evidence of physical validity, parameter identifiability, or calibrated uncertainty.',
      ],
    },
  };
}
