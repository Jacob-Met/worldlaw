import {outputIntervalCount} from './output-grid.mjs';
import { executeStudioDynamics } from './studio-dynamics.mjs';

export const STUDIO_COMPARISON_LIMITS = Object.freeze({
  maxTotalEvaluations: 240000,
  maxTotalSamples: 20000,
});

const ADAPTIVE_EVALUATIONS_PER_TRIAL = 12;
const FIXED_EVALUATIONS_PER_INTERVAL = 4;

function refusal(message, code = 'comparison_refused') {
  return { message, code };
}

function isFixed(candidate) {
  return Array.isArray(candidate?.terms)
    && candidate.terms.some(term => term?.id === 'coulomb'
      && Number.isFinite(term.coefficient) && term.coefficient !== 0);
}

function requestedLimit(policy, key) {
  const value = policy[key] === undefined ? STUDIO_COMPARISON_LIMITS[key] : policy[key];
  if (!Number.isSafeInteger(value) || value < 1 || value > STUDIO_COMPARISON_LIMITS[key]) {
    throw refusal(`${key} must be an integer from 1 to ${STUDIO_COMPARISON_LIMITS[key]}.`, 'invalid_policy');
  }
  return value;
}

function inspectTrajectory(trajectory, intervals, duration, dt) {
  if (!Array.isArray(trajectory) || trajectory.length !== intervals + 1) {
    return refusal('The law did not return every requested sample time.', 'comparison_grid');
  }
  for (let index = 0; index <= intervals; index += 1) {
    const sample = trajectory[index];
    const expectedTime = index === intervals ? duration : index * dt;
    if (!sample || sample.time !== expectedTime
      || !Number.isFinite(sample.position) || !Number.isFinite(sample.rate)
      || !Number.isFinite(sample.jointTorque)
      || (index > 0 && !(sample.time > trajectory[index - 1].time))) {
      return refusal('The law did not return finite states on the exact common time grid.', 'comparison_grid');
    }
  }
  return null;
}

function sampledSpread(results) {
  let maxPositionSpread = 0;
  let maxRateSpread = 0;
  let maxPositionSpreadTime = 0;
  let maxRateSpreadTime = 0;
  for (let sampleIndex = 0; sampleIndex < results[0].trajectory.length; sampleIndex += 1) {
    let minPosition = Infinity;
    let maxPosition = -Infinity;
    let minRate = Infinity;
    let maxRate = -Infinity;
    for (const result of results) {
      const sample = result.trajectory[sampleIndex];
      minPosition = Math.min(minPosition, sample.position);
      maxPosition = Math.max(maxPosition, sample.position);
      minRate = Math.min(minRate, sample.rate);
      maxRate = Math.max(maxRate, sample.rate);
    }
    const positionSpread = maxPosition - minPosition;
    const rateSpread = maxRate - minRate;
    if (positionSpread > maxPositionSpread) {
      maxPositionSpread = positionSpread;
      maxPositionSpreadTime = results[0].trajectory[sampleIndex].time;
    }
    if (rateSpread > maxRateSpread) {
      maxRateSpread = rateSpread;
      maxRateSpreadTime = results[0].trajectory[sampleIndex].time;
    }
  }
  return {
    maxPositionSpread,
    maxPositionSpreadTime,
    maxRateSpread,
    maxRateSpreadTime,
    interpretation: 'Maximum differences at the returned sample times only; not a continuous-time bound, probability, or physical validation of any law.',
  };
}

/** Execute every competitive law with one initial state and one exact output grid.
 * Admission reserves model evaluations (derivative plus output-torque evaluations)
 * equally across the ORIGINAL candidate count. Unused shares are never borrowed.
 * The maintained executor remains responsible for numerical integration/validation.
 */
export function compareStudioDynamics(discovery, initial, settings = {}, policy = {}) {
  const candidates = Array.isArray(discovery?.competitive) ? discovery.competitive.slice() : [];
  const rows = candidates.map((candidate, index) => ({
    index,
    id: candidate?.id ?? null,
    equation: candidate?.equation ?? null,
  }));
  const base = {
    schema: 'worldlaw.studio-dynamics-comparison/v1',
    candidateCount: candidates.length,
    initial: initial && typeof initial === 'object' ? { ...initial } : initial,
    settings: settings && typeof settings === 'object' ? { ...settings } : settings,
  };
  let work;
  const refuseAll = error => ({
    ...base,
    status: 'refused',
    completedCount: 0,
    refusedCount: candidates.length,
    results: rows.map(row => ({ ...row, status: 'refused', error: { ...error } })),
    error,
    ...(work ? { work } : {}),
  });

  if (candidates.length === 0) {
    return refuseAll(refusal('The discovery contains no competitive laws.', 'invalid_input'));
  }
  if (!initial || typeof initial !== 'object' || Array.isArray(initial)
    || !settings || typeof settings !== 'object' || Array.isArray(settings)
    || !policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return refuseAll(refusal('Initial state, settings, and policy must be objects.', 'invalid_input'));
  }

  let maxTotalEvaluations;
  let maxTotalSamples;
  try {
    maxTotalEvaluations = requestedLimit(policy, 'maxTotalEvaluations');
    maxTotalSamples = requestedLimit(policy, 'maxTotalSamples');
  } catch (error) {
    return refuseAll(error);
  }
  const duration = settings.duration === undefined ? 4 : settings.duration;
  const dt = settings.dt === undefined ? 0.01 : settings.dt;
  const requestedMaxTrials = settings.maxTrials === undefined ? 50000 : settings.maxTrials;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1000
    || !Number.isFinite(dt) || dt <= 0 || dt > 1
    || !Number.isInteger(requestedMaxTrials) || requestedMaxTrials < 1 || requestedMaxTrials > 100000) {
    return refuseAll(refusal('Invalid duration, sample interval, or maximum trial count.', 'invalid_input'));
  }
  const intervals = outputIntervalCount(duration, dt);
  if (!Number.isSafeInteger(intervals) || intervals < 1 || intervals > 10000) {
    return refuseAll(refusal('The requested grid exceeds the maintained executor interval limit.', 'step_limit'));
  }
  const samplesPerModel = intervals + 1;
  const totalSamples = samplesPerModel * candidates.length;
  const perModelEvaluationLimit = Math.floor(maxTotalEvaluations / candidates.length);
  const adaptiveMaxTrials = Math.min(requestedMaxTrials,
    Math.floor((perModelEvaluationLimit - samplesPerModel) / ADAPTIVE_EVALUATIONS_PER_TRIAL));
  const fixedCost = FIXED_EVALUATIONS_PER_INTERVAL * intervals + samplesPerModel;
  const fixed = candidates.map(isFixed);
  const reservations = fixed.map(value => value
    ? fixedCost
    : Math.max(0, adaptiveMaxTrials) * ADAPTIVE_EVALUATIONS_PER_TRIAL + samplesPerModel);
  work = {
    maxTotalEvaluations,
    maxTotalSamples,
    totalSamples,
    samplesPerModel,
    perModelEvaluationLimit,
    adaptiveMaxTrials: Math.max(0, adaptiveMaxTrials),
    totalReservedEvaluations: reservations.reduce((sum, value) => sum + value, 0),
    evaluationUnit: 'One derivative evaluation or one returned-sample torque evaluation.',
    description: `All ${candidates.length} original laws receive the same ${perModelEvaluationLimit}-evaluation ceiling; ${samplesPerModel} common output samples per law. Adaptive trials reserve 12 derivative evaluations each, including rejected trials; fixed RK4 reserves 4 per interval. Output torque evaluations are included. Unused shares are not borrowed.`,
  };
  if (totalSamples > maxTotalSamples) {
    return refuseAll(refusal(`The complete comparison requires ${totalSamples} samples; its limit is ${maxTotalSamples}. Reduce duration or increase the sample interval.`, 'comparison_sample_limit'));
  }
  if (fixed.some(value => value ? fixedCost > perModelEvaluationLimit : adaptiveMaxTrials < intervals)) {
    return refuseAll(refusal('The equal per-law evaluation share cannot cover the complete requested grid. Reduce duration or increase the sample interval.', 'comparison_work_limit'));
  }

  const commonInitial = { ...initial };
  const commonSettings = {
    ...settings,
    duration,
    dt,
    maxTrials: Math.max(1, adaptiveMaxTrials),
  };
  base.initial = { ...commonInitial };
  base.settings = { ...commonSettings };
  const results = candidates.map((candidate, index) => {
    const row = rows[index];
    try {
      const executed = executeStudioDynamics(candidate, { ...commonInitial }, { ...commonSettings });
      const gridError = inspectTrajectory(executed.trajectory, intervals, duration, dt);
      if (gridError) return { ...row, status: 'refused', error: gridError };
      return {
        ...row,
        status: 'completed',
        trajectory: executed.trajectory,
        diagnostics: executed.diagnostics,
        reservedEvaluations: reservations[index],
      };
    } catch (error) {
      return {
        ...row,
        status: 'refused',
        error: refusal(error?.message || String(error), error?.code || 'comparison_failure'),
        reservedEvaluations: reservations[index],
      };
    }
  });
  const completedCount = results.filter(result => result.status === 'completed').length;
  const complete = completedCount === candidates.length;
  return {
    ...base,
    status: complete ? 'completed' : completedCount === 0 ? 'refused' : 'incomplete',
    completedCount,
    refusedCount: candidates.length - completedCount,
    results,
    work,
    ...(complete ? { summary: sampledSpread(results) } : {}),
  };
}
