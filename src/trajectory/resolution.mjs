/** Numerical sensitivity check with one shared coarse-plus-refined step budget. */
import { rollout, TrajectoryRolloutError } from './forward.mjs';

const MEANING = 'Difference between free-running predictions at two step resolutions; not a calibrated error bound or evidence of physical validity.';
const LIMITATIONS = [
  'Agreement between two resolutions can miss shared numerical bias or unresolved dynamics.',
  'Discontinuous Coulomb sign changes can invalidate smooth-law RK4 convergence assumptions.',
  'Stiff dynamics can remain inaccurate or unstable at both resolutions.',
  'The comparison does not alter the model, observations, initial conditions, or training ranking.',
];

/**
 * Compare rollout predictions at maxStep and maxStep/2 without using more than
 * maxSteps combined RK4 steps. Initialization is excluded from discrepancy metrics.
 * A failed coarse run still throws; an unavailable refinement never implies agreement.
 */
export function rolloutWithResolution(model, run, options = {}) {
  return compareRolloutResolution(rollout, model, run, options);
}

/** Internal composition helper shared by torque and angular rollout wrappers. */
export function compareRolloutResolution(execute, model, run, options = {}) {
  // Forward owns all model/run/options validation and the dynamics implementation.
  const coarse = execute(model, run, options);
  const { maxStep, maxSteps, steps: stepsCoarse } = coarse.diagnostics;
  const refinedMaxStep = maxStep / 2;
  const availableRefinementSteps = maxSteps - stepsCoarse;
  const resolution = {
    status: 'unavailable', coarseMaxStep: maxStep, refinedMaxStep,
    positionRMSEDifference: null, maxAbsPositionDifference: null,
    stepsCoarse, stepsRefined: null, maxSteps, availableRefinementSteps,
    count: coarse.rows.length - 1, initialSampleExcluded: true,
    differenceDefinition: 'refined.predicted - coarse.predicted at the same sample timestamps',
    meaning: MEANING, limitations: [...LIMITATIONS],
  };
  const unavailable = (reason, failure) => ({
    rollout: coarse,
    resolution: { ...resolution, reason, ...(failure ? { failure } : {}) },
  });
  if (!(refinedMaxStep > 0)) return unavailable('half_step_not_representable');
  if (availableRefinementSteps < 1) return unavailable('combined_step_budget');

  let refined;
  try {
    refined = execute(model, run, { maxStep: refinedMaxStep, maxSteps: availableRefinementSteps });
  } catch (error) {
    if (!(error instanceof TrajectoryRolloutError)) throw error;
    if (error.code === 'step_limit') return unavailable('combined_step_budget');
    // A refinement can expose a runaway trajectory hidden by the coarser method.
    // Keep the completed coarse evidence, but make the missing comparison explicit.
    if (error.code === 'runaway_state' || error.code === 'numerical_failure') {
      return unavailable('refinement_execution_refused', { name: error.name, code: error.code, message: error.message });
    }
    throw error;
  }

  let differenceNorm = 0, maxAbsPositionDifference = 0;
  for (let i = 1; i < coarse.rows.length; i++) {
    const difference = refined.rows[i].predicted - coarse.rows[i].predicted;
    differenceNorm = Math.hypot(differenceNorm, difference);
    maxAbsPositionDifference = Math.max(maxAbsPositionDifference, Math.abs(difference));
  }
  return {
    rollout: coarse,
    resolution: {
      ...resolution, status: 'compared', reason: null,
      positionRMSEDifference: differenceNorm / Math.sqrt(resolution.count),
      maxAbsPositionDifference, stepsRefined: refined.diagnostics.steps,
      combinedSteps: stepsCoarse + refined.diagnostics.steps,
    },
  };
}
