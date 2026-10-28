import {outputIntervalCount} from './output-grid.mjs';
/**
 * Studio numerical execution. Uses the maintained torque evaluator; never fits
 * observations or resets a predicted state from observed positions.
 */
import {prepareTorquePredictor, simulate, DiscoveryError} from './torque-discovery.mjs';

const STATE_BOUND = 1e6;
const MAX_TRIALS = 100000;
const DEFAULTS = Object.freeze({
  duration: 4, dt: 0.01, inertia: 1, command: 0,
  relativeTolerance: 1e-8, positionTolerance: 1e-10,
  rateTolerance: 1e-10, maxTrials: 50000,
});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message, code) => { throw new DiscoveryError(message, code); };
function requireThat(ok, message, code = 'invalid_input') { if (!ok) fail(message, code); }
function finite(value, label, bound) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound,
    label + ' must be finite with magnitude at most ' + bound + '.');
  return value;
}
function settings(options) {
  requireThat(record(options), 'Dynamics settings must be an object.');
  const out = Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, options[key] === undefined ? fallback : options[key]]));
  finite(out.duration, 'duration', 1000); finite(out.dt, 'dt', 1);
  finite(out.inertia, 'inertia', 1e12); finite(out.command, 'command', 1e6);
  requireThat(out.duration > 0 && out.dt > 0 && out.inertia > 0 && outputIntervalCount(out.duration, out.dt) <= 10000,
    'Dynamics needs positive duration, display interval and inertia, with at most 10000 output intervals.');
  for (const key of ['relativeTolerance', 'positionTolerance', 'rateTolerance']) {
    finite(out[key], key, 0.01);
    requireThat(out[key] >= 1e-14, key + ' must be at least 1e-14.');
  }
  requireThat(Number.isSafeInteger(out.maxTrials) && out.maxTrials >= 1 && out.maxTrials <= MAX_TRIALS,
    'maxTrials must be an integer from 1 through ' + MAX_TRIALS + '.');
  return out;
}
function checkState(position, rate) {
  requireThat(Number.isFinite(position) && Number.isFinite(rate) &&
    Math.abs(position) <= STATE_BOUND && Math.abs(rate) <= STATE_BOUND,
    'Dynamics exceeded the finite position/rate state envelope.', 'numerical_failure');
}
const hasDiscontinuousFriction = model => model.terms.some(term => term.id === 'coulomb' && term.coefficient !== 0);

/**
 * Classical RK4 step doubling: compare one full step with two half steps.
 * Their difference / 15 estimates the fine-step local error for sufficiently
 * smooth resolved dynamics. It is NOT an enclosure or global-error guarantee.
 * Accepted state is the actual two-half-step result, without extrapolation.
 * A failed trial can shrink; exhausted work/precision refuses the entire run.
 */
export function simulateAdaptiveDynamics(model, initial, options = {}) {
  const torque = prepareTorquePredictor(model);
  const s = settings(options);
  requireThat(!hasDiscontinuousFriction(model),
    'Smooth adaptive execution does not reinterpret discontinuous Coulomb friction.', 'unsupported_nonsmooth');
  let position = finite(initial?.position, 'initial.position', STATE_BOUND);
  let rate = finite(initial?.rate, 'initial.rate', STATE_BOUND);
  let derivativeEvaluations = 0, acceptedSteps = 0, rejectedSteps = 0, trials = 0;
  let smallestStep = Infinity, largestStep = 0, largestAcceptedErrorRatio = 0;
  const derivative = (q, v) => {
    derivativeEvaluations++;
    checkState(q, v);
    const acceleration = torque(s.command, q, v) / s.inertia;
    requireThat(Number.isFinite(acceleration), 'Dynamics acceleration became nonfinite.', 'numerical_failure');
    return [v, acceleration];
  };
  const advance = (q, v, h) => {
    const a = derivative(q, v);
    const b = derivative(q + h * a[0] / 2, v + h * a[1] / 2);
    const c = derivative(q + h * b[0] / 2, v + h * b[1] / 2);
    const d = derivative(q + h * c[0], v + h * c[1]);
    const result = [q + h * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6,
      v + h * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6];
    checkState(...result);
    return result;
  };
  const sample = time => ({time, position, rate, jointTorque: torque(s.command, position, rate)});
  const trajectory = [sample(0)];
  const outputIntervals = outputIntervalCount(s.duration, s.dt);
  let nextStep = s.dt;
  for (let i = 1; i <= outputIntervals; i++) {
    const targetTime = i === outputIntervals ? s.duration : i * s.dt;
    const interval = targetTime - trajectory.at(-1).time;
    let elapsed = 0;
    while (elapsed < interval) {
      requireThat(trials < s.maxTrials, 'Adaptive dynamics exhausted its complete-run work budget; no partial prediction returned.', 'step_limit');
      const remaining = interval - elapsed, requestedStep = nextStep, h = Math.min(requestedStep, remaining);
      requireThat(h > 0 && elapsed + h > elapsed && h / 2 > 0,
        'Adaptive dynamics cannot resolve another advancing step; no partial prediction returned.', 'step_underflow');
      trials++;
      let fine, errorRatio = Infinity;
      try {
        const coarse = advance(position, rate, h);
        const half = advance(position, rate, h / 2);
        fine = advance(half[0], half[1], h / 2);
        const positionScale = s.positionTolerance + s.relativeTolerance * Math.max(Math.abs(position), Math.abs(fine[0]));
        const rateScale = s.rateTolerance + s.relativeTolerance * Math.max(Math.abs(rate), Math.abs(fine[1]));
        errorRatio = Math.max(Math.abs(fine[0] - coarse[0]) / 15 / positionScale,
          Math.abs(fine[1] - coarse[1]) / 15 / rateScale);
      } catch (error) {
        if (!(error instanceof DiscoveryError)) throw error;
        // All model/input/options admission happened before entering the loop.
        // Invalid intermediate states from an overlarge trial may be retried.
        if (!['invalid_input', 'numerical_failure'].includes(error.code)) throw error;
      }
      if (Number.isFinite(errorRatio) && errorRatio <= 1) {
        [position, rate] = fine;
        acceptedSteps++;
        smallestStep = Math.min(smallestStep, h); largestStep = Math.max(largestStep, h);
        largestAcceptedErrorRatio = Math.max(largestAcceptedErrorRatio, errorRatio);
        elapsed = h === remaining ? interval : elapsed + h;
        const factor = errorRatio === 0 ? 4 : Math.max(0.2, Math.min(4, 0.9 * errorRatio ** -0.2));
        // A forced output boundary must not seed the next interval with a
        // tiny remainder step unrelated to the resolved dynamics.
        nextStep = Math.min(s.dt, (h < requestedStep ? requestedStep : h) * factor);
      } else {
        rejectedSteps++;
        const factor = Number.isFinite(errorRatio) ? Math.max(0.1, Math.min(0.5, 0.9 * errorRatio ** -0.2)) : 0.25;
        nextStep = h * factor;
      }
    }
    trajectory.push(sample(targetTime));
  }
  return {
    schema: 'worldlaw.studio-dynamics/v1', trajectory,
    diagnostics: {
      method: 'adaptive_RK4_step_doubling', acceptedSteps, rejectedSteps, trials,
      derivativeEvaluations, outputEvaluations: trajectory.length,
      maxTrials: s.maxTrials, outputInterval: s.dt,
      smallestStep, largestStep, largestAcceptedErrorRatio,
      relativeTolerance: s.relativeTolerance,
      positionToleranceRad: s.positionTolerance, rateToleranceRadPerSecond: s.rateTolerance,
      localErrorEstimate: 'full_step_vs_two_half_steps_divided_by_15',
      globalErrorBound: null, observationsResetState: false,
      interpretation: 'Local numerical error estimate for smooth resolved dynamics, not a global error bound, stiffness certificate or physical validation.',
    },
  };
}

/** Ordinary Studio policy: automatic refinement for smooth laws; original
 * explicitly labelled sign-law RK4 for discontinuous Coulomb equations.
 * No failed adaptive calculation silently substitutes a fixed-step result.
 */
export function executeStudioDynamics(model, initial, options = {}) {
  prepareTorquePredictor(model);
  const s = settings(options);
  if (!hasDiscontinuousFriction(model)) return simulateAdaptiveDynamics(model, initial, s);
  const trajectory = simulate(model, initial, s);
  return {
    schema: 'worldlaw.studio-dynamics/v1', trajectory,
    diagnostics: {
      method: 'classical_RK4', acceptedSteps: trajectory.length - 1,
      rejectedSteps: 0, outputInterval: s.dt, globalErrorBound: null,
      interpretation: 'Fixed-step RK4 retained for the discontinuous sign-rate law. No local error control or sticking interpretation is claimed.',
    },
  };
}

