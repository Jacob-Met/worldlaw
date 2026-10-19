/** Finite duration comparison composed from the established angular recording planner. */
import {createAngularTrajectoryPlanner} from './angular-planner.mjs';

export const ANGULAR_DURATION_PLAN_SCHEMA = 'worldlaw.angular-duration-plan/v1';
export class AngularDurationPlanningError extends Error {
  constructor(message, code = 'invalid_duration_search', options) {super(message, options); this.name = 'AngularDurationPlanningError'; this.code = code;}
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const insist = (condition, message, code) => {if (!condition) throw new AngularDurationPlanningError(message, code);};
function integer(value, label, maximum) {
  insist(Number.isSafeInteger(value) && value >= 1 && value <= maximum, `${label} must be an integer from 1 through ${maximum}.`, 'invalid_options');
  return value;
}

/**
 * Compare the original finite-grid winner at each declared duration. A duration
 * whose winner fails screening is retained as unresolved, not silently replaced
 * with a different model subset or a newly chosen runner-up. All work is bounded
 * before any call to the injected implementation; no acquisitions occur.
 */
export function createAngularDurationPlanner(basePlanner) {
  const planAngular = createAngularTrajectoryPlanner(basePlanner);
  return function planAngularDurations(discovery, requestedDesign, requestedDurations, rawOptions = {}) {
    insist(object(requestedDesign) && !Object.hasOwn(requestedDesign, 'duration'),
      'Supply shared release bounds without a duration, plus a separate finite duration list.');
    insist(Array.isArray(requestedDurations) && requestedDurations.length >= 1 && requestedDurations.length <= 6,
      'Supply one through six finite candidate durations in seconds.');
    const durations = Array.from(requestedDurations, duration => {
      insist(typeof duration === 'number' && Number.isFinite(duration) && duration >= .1 && duration <= 30,
        'Every duration must be finite between 0.1 and 30 seconds.'); return duration;
    }).sort((a, b) => a - b);
    insist(new Set(durations).size === durations.length, 'Candidate durations must be distinct.');
    const sampleInterval = requestedDesign.sampleInterval ?? .04;
    insist(typeof sampleInterval === 'number' && Number.isFinite(sampleInterval) && sampleInterval >= .005 && sampleInterval <= 1,
      'sampleInterval must be finite between 0.005 and 1 second.');
    for (const duration of durations) {
      const ratio = duration / sampleInterval, count = Math.round(ratio);
      insist(count >= 1 && count <= 2000 && Math.abs(ratio - count) <= 32 * Number.EPSILON * Math.max(1, ratio),
        'Every duration must contain a whole number of sample intervals and at most 2001 scheduled samples.');
    }
    insist(object(rawOptions) && Object.keys(rawOptions).every(key => ['maxReservedSteps', 'screeningOptions'].includes(key)),
      'Only a complete-search step reservation and numerical screening options are accepted.', 'invalid_options');
    const screeningOptions = rawOptions.screeningOptions ?? {};
    insist(object(screeningOptions), 'screeningOptions must be an object.', 'invalid_options');
    const plannerBudget = integer(requestedDesign.maxTotalSteps ?? 250000, 'Per-duration planner budget', 2000000);
    const screeningBudget = integer(screeningOptions.maxTotalSteps ?? 750000, 'Per-duration screening budget', 3000000);
    const maxReservedSteps = integer(rawOptions.maxReservedSteps ?? 3000000, 'maxReservedSteps', 6000000);
    // Reserving each component's full allowed budget is deliberately conservative.
    // It does not rely on mutable backend schedule estimates or partial successes.
    const reservedUpperBound = durations.length * (plannerBudget + screeningBudget);
    insist(reservedUpperBound <= maxReservedSteps,
      `The complete duration comparison reserves at most ${reservedUpperBound} RK4 steps; the limit is ${maxReservedSteps}. No durations were evaluated.`, 'resource_limit');
    const plans = [];
    for (const duration of durations) {
      try {plans.push(planAngular(discovery, {...requestedDesign, duration}, screeningOptions));}
      catch (cause) {
        const failure = new AngularDurationPlanningError(`No duration recommendation was issued: the ${duration}-second design was refused (${cause.code ?? 'evaluation_failed'}).`,
          'duration_evaluation_refused', {cause});
        failure.failedDuration = duration; failure.completedDurationCount = plans.length; throw failure;
      }
    }
    const referenceModels = JSON.stringify(plans[0].provenance);
    insist(plans.every(plan => JSON.stringify(plan.provenance) === referenceModels),
      'Every duration must use the same training revision and fixed considered model ensemble; no comparison was issued.', 'inconsistent_ensemble');
    const eligible = plans.filter(plan => plan.status === 'proposed');
    eligible.sort((a, b) => b.selected.disagreementRad - a.selected.disagreementRad || a.options.duration - b.options.duration);
    const selectedPlan = eligible[0] ?? null;
    const status = selectedPlan ? 'proposed' : plans.some(plan => plan.status === 'numerically_unresolved') ? 'numerically_unresolved' :
      plans.every(plan => plan.status === 'no_feasible_design') ? 'no_feasible_design' : 'uninformative';
    const actualReservedSteps = plans.reduce((sum, plan) => sum + plan.diagnostics.reservedSteps + plan.qualification.diagnostics.reservedSteps, 0);
    return {schema: ANGULAR_DURATION_PLAN_SCHEMA, status, durationUnit: 's', scoreUnits: 'rad',
      method: 'maximum_screened_per_duration_winner_disagreement', durations, selectedPlan,
      recordingRequest: selectedPlan?.recordingRequest ?? null, trainingFit: plans[0].trainingFit,
      physicalInertia: null, absoluteTorqueIdentified: false,
      durationResults: plans.map(plan => ({duration: plan.options.duration, status: plan.status, plannerStatus: plan.plannerStatus,
        initialPosition: plan.selected?.initialPosition ?? null, initialRate: plan.selected?.initialRate ?? null,
        disagreementRad: plan.selected?.disagreementRad ?? null, qualificationStatus: plan.qualification.status,
        selectedScreenStatus: plan.qualification.selectedQualification?.status ?? 'not_evaluated',
        numericalScreenReason: plan.qualification.selectedQualification?.reason ?? null,
        pairwiseSensitivityRad: plan.qualification.selectedQualification?.pairwiseSensitivityRad ?? null,
        trainingRangeCheck: plan.selected?.trainingRangeCheck ?? null,
        consideredModelCount: plan.diagnostics.consideredModelCount, omittedCompetitiveCount: plan.diagnostics.omittedCompetitiveCount,
        evaluatedDesignCount: plan.diagnostics.evaluatedDesignCount, refusedDesignCount: plan.diagnostics.refusedDesignCount,
        reservedSteps: plan.diagnostics.reservedSteps + plan.qualification.diagnostics.reservedSteps})),
      diagnostics: {durationCount: durations.length, eligibleDurationCount: eligible.length, maxReservedSteps, reservedUpperBound, actualReservedSteps,
        plannerBudgetPerDuration: plannerBudget, screeningBudgetPerDuration: screeningBudget,
        budgetMeaning: 'Preflight reserves the sum of every component budget. Actual scheduled work is separately reported; early numeric failures can execute less work.',
        acquisitionPerformed: false, predictionsAreObservations: false, physicalSetupVerified: false,
        limitations: ['Only the original finite-grid winner for each declared duration is compared; numerically unresolved winners do not trigger hidden re-ranking within that duration.',
          'The score is sampled RMS angular disagreement, not information gain per second, recording cost, sensor detection probability or a continuous-time optimum.',
          'Longer recordings can increase model separation while also increasing mismatch, drift, collection cost and initial-state sensitivity.',
          'All original angular assumptions, training mismatch, shortlist omissions, extrapolation and numerical screening limits remain in effect.',
          'An exported protocol is a manual recording request, not acquired observations or authorization for physical hardware.']}};
  };
}
