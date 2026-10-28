/** Optional forecasts for the complete finite joint timing-and-law family.
 * Internal API: prepare from a maintained compareCommandTiming report, not from
 * saved derived answers. Source-only notebook imports still refit normally.
 */
import {validateBundle} from './data.mjs';
import {normalizeTimingStudyOptions} from './command-timing-study.mjs';
import {prepareCommandTimeline} from './command-timeline.mjs';
import {rolloutWithResolution} from './resolution.mjs';

const plans = new WeakMap();
const BASIS = 'global_training_integrated_displacement_score_only';
const QUALIFICATION = 'Finite retained timing-and-law predictions, not a probability or confidence interval. Only complete original-grid forecasts enter the displayed span; missing forecasts remain listed. Pointwise boundaries can come from different laws. Rank-deficient subsets and continuous coefficient ambiguities are not represented by this finite family.';
const fail = (message, code = 'invalid_timing_law_report') => { const error = new Error(message); error.code = code; throw error; };
const insist = (ok, message, code) => { if (!ok) fail(message, code); };
const timingKey = candidate => JSON.stringify([candidate.delaySeconds, candidate.responseTimeSeconds ?? 0]);
const modelKey = (candidate, model) => JSON.stringify([candidate.delaySeconds, candidate.responseTimeSeconds ?? 0, model.id]);
const modelIdentity = model => JSON.stringify({schema: model?.schema, id: model?.id,
  terms: model?.terms?.map(term => ({id: term.id, coefficient: term.coefficient}))});
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Matches the public forward solver's actual interval splitting and two step
// resolutions. Delayed command events split intervals even between observations.
function timingWork(bundle, options, delaySeconds, responseTimeSeconds) {
  const commandTiming = {delaySeconds, beforeStart: options.beforeStart,
    ...(options.responseTimes ? {responseTimeSeconds} : {})};
  const maxStep = responseTimeSeconds > 0 ? Math.min(options.maxStep, responseTimeSeconds / 4) : options.maxStep;
  const perRun = bundle.challengeRuns.map(run => {
    const timeline = prepareCommandTimeline(run.samples, commandTiming);
    const intervals = delaySeconds > 0 || responseTimeSeconds > 0 ? timeline.intervals
      : run.samples.slice(1).map((sample, i) => [{duration: sample.time - run.samples[i].time}]);
    let coarse = 0, refined = 0;
    for (const segments of intervals) for (const segment of segments) {
      coarse += Math.max(1, Math.ceil(segment.duration / maxStep));
      refined += Math.max(1, Math.ceil(segment.duration / (maxStep / 2)));
    }
    insist(Number.isSafeInteger(coarse + refined), 'The complete timing-and-law workload cannot be represented.');
    return {runId: run.id, coarse, refined, reserved: coarse + refined};
  });
  return {commandTiming, maxStep, perRun};
}

function completeForecast(receiving, run) {
  if (receiving?.status !== 'executed') return receiving?.error?.message ?? 'No executed prediction for this recording.';
  const rows = receiving.rollout?.rows;
  if (!Array.isArray(rows) || rows.length !== run.samples.length) return 'The prediction does not cover the complete original recording.';
  if (rows.some((row, i) => row.time !== run.samples[i].time || !Number.isFinite(row.predicted)))
    return 'The prediction is not finite on the exact original timestamp grid.';
  return null;
}

function retainedReceiving(candidate, model, run, work, runWork) {
  const original = candidate.receiving.find(receiving => receiving.runId === run.id);
  const origin = {runId: run.id, origin: 'reused', reservedSteps: runWork.reserved};
  // Failed original receipts are evidence. Do not silently rerun them as part of
  // this diagnostic or reclaim their potentially unmeasured work reservation.
  if (!original || original.status !== 'executed') return {...origin, status: 'failed',
    error: original?.error ?? {code: 'missing_original_receipt', message: 'No original representative forecast receipt.'}};
  const invalid = completeForecast(original, run);
  const rollout = original.rollout, diagnostics = rollout?.diagnostics;
  const sameTiming = timingKey(diagnostics?.commandTiming ?? {}) === timingKey(work.commandTiming)
    && diagnostics?.commandTiming?.beforeStart === work.commandTiming.beforeStart;
  const sameSource = rollout?.rows?.every((row, i) => row.observed === run.samples[i]?.position
    && row.command === run.samples[i]?.command)
    && rollout?.rows?.[0]?.predicted === run.samples[0].position
    && rollout?.rows?.[0]?.rate === run.initialRate;
  if (invalid || rollout.modelId !== model.id || rollout.runId !== run.id || !sameTiming || !sameSource
      || diagnostics?.maxStep !== work.maxStep || diagnostics?.maxSteps !== runWork.reserved) {
    return {...origin, status: 'failed', error: {code: 'original_receipt_mismatch',
      message: invalid ?? 'The original receipt does not match this model, recording and solver request.'}};
  }
  return {...original, ...origin};
}

/** Snapshot an internally produced timing report; preparation performs no fits or rollouts. */
export function prepareTimingLawForecasts(report) {
  insist(report && ['worldlaw.command-timing-study/v1', 'worldlaw.command-response-study/v1'].includes(report.schema)
    && report.selectionBasis === 'training_integrated_displacement_score_only', 'Expected a maintained command-timing study report.');
  // Clone once, before planning. Later edits to the caller's report, coefficients,
  // source arrays or existing receipts cannot change this plan's execution.
  const snapshot = structuredClone({bundle: report.bundle, options: report.options, work: report.work,
    candidates: report.candidates.map(candidate => ({delaySeconds: candidate.delaySeconds,
      responseTimeSeconds: candidate.responseTimeSeconds ?? 0, status: candidate.status, score: candidate.score,
      model: candidate.model, receiving: candidate.receiving ?? [], error: candidate.error,
      discovery: candidate.discovery ? {candidates: candidate.discovery.candidates, selected: candidate.discovery.selected,
        options: candidate.discovery.options, method: candidate.discovery.method,
        fitEquationCount: candidate.discovery.fitEquationCount, diagnostics: candidate.discovery.diagnostics} : null}))});
  const bundle = validateBundle(snapshot.bundle), options = normalizeTimingStudyOptions(snapshot.options);
  const offered = options.delays.flatMap(delaySeconds => (options.responseTimes ?? [0]).map(responseTimeSeconds => ({delaySeconds, responseTimeSeconds})));
  const byTiming = new Map(snapshot.candidates.map(candidate => [timingKey(candidate), candidate]));
  insist(byTiming.size === snapshot.candidates.length && byTiming.size === offered.length
    && offered.every(candidate => byTiming.has(timingKey(candidate))), 'The report must retain every offered timing exactly once.');
  const works = new Map(offered.map(candidate => [timingKey(candidate), timingWork(bundle, options, candidate.delaySeconds, candidate.responseTimeSeconds)]));
  const originalReservedSteps = [...works.values()].reduce((sum, work) => sum + work.perRun.reduce((n, run) => n + run.reserved, 0), 0);
  insist(Number.isSafeInteger(originalReservedSteps) && snapshot.work?.reservedSteps === originalReservedSteps
    && snapshot.work.maxTotalSteps === options.maxTotalSteps, 'The original whole-study work reservation must match its source and solver settings.');

  const excludedFitCounts = {rankDeficientCandidates: 0, unexecutableCandidates: 0, examinedCandidates: 0,
    executableCandidates: 0, fitFailedTimings: 0, offeredTimings: offered.length};
  const fitFailures = [], all = [];
  let scoreContract;
  for (const candidate of snapshot.candidates) {
    if (candidate.status !== 'fitted') {
      insist(candidate.status === 'fit_failed', 'An offered timing has no completed fit status.');
      excludedFitCounts.fitFailedTimings++;
      fitFailures.push({timingKey: timingKey(candidate), delaySeconds: candidate.delaySeconds,
        responseTimeSeconds: candidate.responseTimeSeconds, error: candidate.error});
      continue;
    }
    const discovery = candidate.discovery;
    insist(Array.isArray(discovery?.candidates) && discovery.candidates.length > 0, 'A fitted timing has no retained executable laws.');
    const contract = JSON.stringify({method: discovery.method, equationCount: discovery.fitEquationCount,
      scoreMethod: discovery.diagnostics?.scoreMethod, covariance: discovery.diagnostics?.covarianceTreatment,
      noiseSigma: discovery.options?.noiseSigma, maxTerms: discovery.options?.maxTerms,
      terms: discovery.options?.terms, rowStride: discovery.options?.rowStride});
    if (scoreContract === undefined) scoreContract = contract;
    insist(contract === scoreContract, 'Joint training scores must share their equation, noise and fitting conventions.');
    insist(discovery.options?.noiseSigma === options.noiseSigma
      && discovery.options?.maxTerms === options.maxTerms
      && JSON.stringify(discovery.options?.terms) === JSON.stringify(options.terms), 'Retained fits must use the declared timing-study settings.');
    for (const key of ['rankDeficientCandidates', 'unexecutableCandidates', 'examinedCandidates'])
      excludedFitCounts[key] += count(discovery.diagnostics?.[key]);
    const ids = new Set();
    for (const model of discovery.candidates) {
      insist(model?.schema === 'worldlaw.torque-model/v1' && typeof model.id === 'string'
        && !ids.has(model.id) && Array.isArray(model.terms) && Number.isFinite(model.metrics?.score), 'Retained law identities and scores must be distinct and finite within each timing.');
      ids.add(model.id);
      const representative = modelIdentity(model) === modelIdentity(candidate.model);
      all.push({candidate, model, representative});
      excludedFitCounts.executableCandidates++;
    }
    const minimum = Math.min(...discovery.candidates.map(model => model.metrics.score));
    insist(candidate.score === minimum && candidate.model?.metrics?.score === minimum
      && modelIdentity(candidate.model) === modelIdentity(discovery.selected)
      && discovery.candidates.some(model => modelIdentity(model) === modelIdentity(candidate.model)),
    'Each original timing representative must remain its unchanged training-selected law.');
  }
  const globalBestScore = all.length ? Math.min(...all.map(item => item.model.metrics.score)) : null;
  const members = all.filter(item => item.model.metrics.score - globalBestScore <= options.ambiguityDelta).map(item => {
    const {candidate, model, representative} = item;
    return {key: modelKey(candidate, model), timingKey: timingKey(candidate), delaySeconds: candidate.delaySeconds,
      responseTimeSeconds: candidate.responseTimeSeconds, modelId: model.id, equation: model.equation,
      terms: model.terms, score: model.metrics.score, scoreDelta: model.metrics.score - globalBestScore,
      localScoreDelta: model.metrics.score - candidate.score, isTimingRepresentative: representative,
      candidate, model, execution: works.get(timingKey(candidate))};
  });
  const additionalReservedSteps = members.filter(member => !member.isTimingRepresentative)
    .reduce((sum, member) => sum + member.execution.perRun.reduce((n, run) => n + run.reserved, 0), 0);
  const totalReservedSteps = originalReservedSteps + additionalReservedSteps;
  insist(Number.isSafeInteger(totalReservedSteps), 'The complete timing-and-law reservation cannot be represented.');
  const status = !members.length ? 'empty' : totalReservedSteps > options.maxTotalSteps ? 'budget_exceeded' : 'ready';
  const work = {originalReservedSteps, additionalReservedSteps, totalReservedSteps, maxTotalSteps: options.maxTotalSteps,
    reusedMemberCount: members.filter(member => member.isTimingRepresentative).length,
    additionalMemberCount: members.filter(member => !member.isTimingRepresentative).length,
    originalCompletedSteps: snapshot.work.completedSteps,
    originalFailedRunStepsNotMeasured: snapshot.work.failedRunStepsNotMeasured === true,
    originalRefinementFailuresNotMeasured: snapshot.candidates.some(candidate =>
      candidate.receiving.some(receiving => Boolean(receiving.resolution?.failure)))};
  const summary = freeze({status, selectionBasis: BASIS, globalBestScore, ambiguityDelta: options.ambiguityDelta,
    members: members.map(({candidate, model, execution, ...member}) => member), excludedFitCounts, fitFailures, work,
    qualification: QUALIFICATION, ...(status === 'budget_exceeded' ? {reason:
      `The complete timing-and-law request needs ${totalReservedSteps} reserved RK4 steps (${additionalReservedSteps} additional); the declared shared limit is ${options.maxTotalSteps}. No additional forecasts were run.`}
      : status === 'empty' ? {reason: 'No executable laws were retained by the completed training fits.'} : {})});
  plans.set(summary, {bundle, options, members, summary, result: null});
  return summary;
}

/** Execute the admitted complete additional family once, retaining every outcome. */
export function executeTimingLawForecasts(plan) {
  const state = plans.get(plan);
  insist(state, 'Use the original opaque plan returned by prepareTimingLawForecasts.', 'invalid_timing_law_plan');
  if (state.result) return state.result;
  insist(plan.status !== 'budget_exceeded', plan.reason, 'family_work_limit');
  let completedAdditionalSteps = 0, additionalFailedRunStepsNotMeasured = false;
  const members = state.members.map(member => {
    const {candidate, model, execution, ...identity} = member;
    const receiving = state.bundle.challengeRuns.map((run, index) => {
      const runWork = execution.perRun[index];
      if (member.isTimingRepresentative) return retainedReceiving(candidate, model, run, execution, runWork);
      try {
        const received = rolloutWithResolution(model, run, {commandTiming: execution.commandTiming,
          maxStep: execution.maxStep, maxSteps: runWork.reserved});
        completedAdditionalSteps += received.rollout.diagnostics.steps + (received.resolution.stepsRefined ?? 0);
        if (received.resolution.failure) additionalFailedRunStepsNotMeasured = true;
        return {runId: run.id, status: 'executed', origin: 'additional', reservedSteps: runWork.reserved, ...received};
      } catch (error) {
        additionalFailedRunStepsNotMeasured = true;
        return {runId: run.id, status: 'failed', origin: 'additional', reservedSteps: runWork.reserved,
          error: {code: error.code ?? 'rollout_failed', message: error.message}};
      }
    });
    return {...identity, model, receiving};
  });
  state.result = freeze({...plan, bundle: state.bundle, members,
    work: {...plan.work, completedAdditionalSteps, additionalFailedRunStepsNotMeasured}});
  return state.result;
}

/** Whole-forecast inclusion: never narrow the span using row-wise survivors. */
export function timingLawComparison(result, runId) {
  const run = result.bundle.challengeRuns.find(candidate => candidate.id === runId);
  insist(run, 'The family comparison needs an original challenge recording.', 'invalid_timing_law_run');
  const available = [], unavailable = [], refinementUnavailable = [];
  let refinementComparedCount = 0;
  for (const member of result.members) {
    const receiving = member.receiving.find(receipt => receipt.runId === runId);
    const reason = completeForecast(receiving, run);
    if (reason) unavailable.push({key: member.key, modelId: member.modelId, reason});
    else {
      available.push({key: member.key, rows: receiving.rollout.rows});
      if (receiving.resolution?.status === 'compared') refinementComparedCount++;
      else refinementUnavailable.push({key: member.key, reason: receiving.resolution?.failure?.message
        ?? receiving.resolution?.reason ?? 'No completed refinement comparison.'});
    }
  }
  const rows = available.length ? run.samples.map((sample, index) => {
    let low = Infinity, high = -Infinity;
    for (const forecast of available) { low = Math.min(low, forecast.rows[index].predicted); high = Math.max(high, forecast.rows[index].predicted); }
    return {time: sample.time, low, high};
  }) : [];
  return {runId, candidateCount: result.members.length, candidateKeys: result.members.map(member => member.key),
    availableCount: available.length, availableKeys: available.map(member => member.key), refinementComparedCount,
    unavailable, refinementUnavailable, rows,
    complete: available.length > 0 && available.length === result.members.length, qualification: QUALIFICATION};
}
