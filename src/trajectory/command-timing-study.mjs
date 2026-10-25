/** Training-only finite command-delay comparisons using maintained inference/rollout. */
import {validateBundle, MAX_TEXT_LENGTH} from './data.mjs';
import {discoverIntegral} from './integral-discovery.mjs';
import {rolloutWithResolution} from './resolution.mjs';
import {prepareCommandTimeline, normalizeCommandTiming, CommandTimingError} from './command-timeline.mjs';

export const COMMAND_TIMING_SCHEMA = 'worldlaw.command-timing-inputs/v1';
export const COMMAND_RESPONSE_SCHEMA = 'worldlaw.command-response-inputs/v1';
const TERM_IDS = ['command', 'rate', 'spring', 'gravity', 'bias'];
const requireThat = (ok, message, code) => { if (!ok) throw new CommandTimingError(message, code); };
const finite = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

export function normalizeTimingStudyOptions(raw = {}) {
  requireThat(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'Delay-study settings must be an object.');
  const delays = raw.delays ?? [0, .05, .1, .15, .2];
  requireThat(Array.isArray(delays) && delays.length >= 1 && delays.length <= 17 && delays.every(x => finite(x, 0, 30)) &&
    new Set(delays).size === delays.length && delays.includes(0), 'Offer distinct nonnegative delays, including zero, at most 17 values and 30 seconds.');
  const responseTimes=raw.responseTimes??[0];
  requireThat(Array.isArray(responseTimes)&&responseTimes.length>=1&&responseTimes.length<=9&&responseTimes.includes(0)&&
    new Set(responseTimes).size===responseTimes.length&&responseTimes.every(x=>x===0||finite(x,1e-5,30)),
    'Offer 1–9 distinct response times including zero; positive response times must be 0.00001–30 seconds.');
  requireThat(delays.length*responseTimes.length>=2&&delays.length*responseTimes.length<=64,
    'The complete delay × response-time family must contain 2–64 alternatives.');
  const beforeStart = raw.beforeStart;
  // One explicitly declared constant prehistory applies to every offered run.
  normalizeCommandTiming({delaySeconds: Math.max(...delays),responseTimeSeconds:Math.max(...responseTimes), beforeStart});
  const terms = raw.terms ?? ['command', 'rate', 'spring', 'bias'];
  requireThat(Array.isArray(terms) && terms.length > 0 && terms.length <= TERM_IDS.length && terms.includes('command') &&
    new Set(terms).size === terms.length && terms.every(id => TERM_IDS.includes(id)),
    'Offer distinct terms including command, drawn from command, rate, spring, gravity and bias.');
  const options = {delays: [...delays],...(responseTimes.some(x=>x>0)?{responseTimes:[...responseTimes]}:{}), beforeStart, terms: [...terms], noiseSigma: raw.noiseSigma ?? .001,
    maxTerms: raw.maxTerms ?? terms.length, ambiguityDelta: raw.ambiguityDelta ?? 6,
    maxStep: raw.maxStep ?? .01, maxTotalSteps: raw.maxTotalSteps ?? 500000};
  requireThat(finite(options.noiseSigma, 1e-8, 1000), 'Assumed position noise must be 1e-8–1000 rad.');
  requireThat(Number.isInteger(options.maxTerms) && options.maxTerms >= 1 && options.maxTerms <= terms.length, 'Term limit must be within the offered library.');
  requireThat(finite(options.ambiguityDelta, 0, 100), 'Ambiguity score difference must be 0–100.');
  requireThat(finite(options.maxStep, 1e-5, .1), 'Maximum solver step must be 0.00001–0.1 seconds.');
  requireThat(Number.isSafeInteger(options.maxTotalSteps) && options.maxTotalSteps >= 1 && options.maxTotalSteps <= 1000000,
    'The complete study solver budget must be 1–1,000,000 RK4 steps.');
  return options;
}

function reserveWork(bundle, options) {
  // A deterministic input-size cap for the complete finite fitting family, not a timing estimate.
  let fitColumnUnits = 0;
  for (let mask = 0; mask < 1 << options.terms.length; mask++) {
    let k = 0; for (let i = 0; i < options.terms.length; i++) if (mask & 1 << i) k++;
    if (k <= options.maxTerms) fitColumnUnits += (k + 1) ** 2;
  }
  const equations = bundle.trainingRuns.reduce((n, run) => n + run.samples.length - 1, 0);
  const responseTimes=options.responseTimes??[0];
  const fittingUnits = equations * options.delays.length * responseTimes.length * fitColumnUnits;
  requireThat(fittingUnits <= 20000000, 'The complete delay/term/input family exceeds the 20,000,000 fitting-size units. Reduce the explicit family or supply shorter complete runs.', 'study_work_limit');
  let totalSteps = 0;
  const plans = options.delays.flatMap(delaySeconds => responseTimes.map(responseTimeSeconds => {
    const commandTiming = {delaySeconds, beforeStart: options.beforeStart,...(options.responseTimes?{responseTimeSeconds}:{})};
    // Reserve a resolved coarse forcing course, then a genuinely twice-finer one.
    const maxStep=responseTimeSeconds>0?Math.min(options.maxStep,responseTimeSeconds/4):options.maxStep;
    const perRun = bundle.challengeRuns.map(run => {
      const timeline = prepareCommandTimeline(run.samples, commandTiming);
      let coarse = 0, refined = 0;
      const intervals = delaySeconds > 0 || responseTimeSeconds > 0 ? timeline.intervals : run.samples.slice(1).map((sample,index)=>[{duration:sample.time-run.samples[index].time}]);
      for (const segments of intervals) for (const segment of segments) {
        coarse += Math.max(1, Math.ceil(segment.duration / maxStep));
        refined += Math.max(1, Math.ceil(segment.duration / (maxStep / 2)));
      }
      const reserved = coarse + refined;
      requireThat(Number.isSafeInteger(reserved) && reserved <= options.maxTotalSteps - totalSteps,
        'The complete delay × challenge × two-resolution request exceeds its shared RK4 budget. No partial family was fitted or run.', 'study_work_limit');
      totalSteps += reserved;
      return {runId: run.id, reserved};
    });
    return {delaySeconds,responseTimeSeconds, commandTiming,maxStep, perRun};
  }));
  return {fittingUnits, fitUnitMeaning: 'original equation count × complete response-family count × sum of (term count + 1)² over admitted subsets',
    reservedSteps: totalSteps, maxTotalSteps: options.maxTotalSteps, plans};
}

export function compareCommandTiming(rawBundle, rawOptions = {}) {
  const bundle = validateBundle(rawBundle);
  const options = normalizeTimingStudyOptions(rawOptions);
  const work = reserveWork(bundle, options); // Complete request checked before fitting any candidate.
  const candidates = work.plans.map(plan => {
    const identity={delaySeconds:plan.delaySeconds,...(options.responseTimes?{responseTimeSeconds:plan.responseTimeSeconds,solverMaxStep:plan.maxStep}:{})};
    try {
      const discovery = discoverIntegral(bundle.trainingRuns, {terms: options.terms, maxTerms: options.maxTerms,
        noiseSigma: options.noiseSigma, ambiguityDelta: options.ambiguityDelta, commandTiming: plan.commandTiming});
      return {...identity, status: 'fitted', discovery, model: discovery.selected,
        score: discovery.selected.metrics.score, receiving: []};
    } catch (error) {
      return {...identity, status: 'fit_failed', score: null,
        error: {code: error.code ?? 'fit_failed', message: error.message}, receiving: []};
    }
  });
  // Selection is complete before challenge angles are used for any residual.
  const fitted = candidates.filter(c => c.status === 'fitted');
  const bestScore = fitted.length ? Math.min(...fitted.map(c => c.score)) : null;
  const competitive=fitted.filter(c => c.score-bestScore<=options.ambiguityDelta);
  const competitiveDelays = [...new Set(competitive.map(c=>c.delaySeconds))];
  const selected = fitted.slice().sort((a, b) => a.score - b.score || a.delaySeconds - b.delaySeconds || (a.responseTimeSeconds??0)-(b.responseTimeSeconds??0))[0] ?? null;
  let usedSteps = 0;
  candidates.forEach((candidate, index) => {
    if (candidate.status !== 'fitted') return;
    candidate.receiving = bundle.challengeRuns.map((run, runIndex) => {
      try {
        const received = rolloutWithResolution(candidate.model, run, {maxStep: work.plans[index].maxStep,
          maxSteps: work.plans[index].perRun[runIndex].reserved, commandTiming: work.plans[index].commandTiming});
        usedSteps += received.rollout.diagnostics.steps + (received.resolution.stepsRefined ?? 0);
        return {runId: run.id, status: 'executed', ...received};
      } catch (error) {
        return {runId: run.id, status: 'failed', error: {code: error.code ?? 'rollout_failed', message: error.message}};
      }
    });
    // No mean over survivors: any failed run keeps the complete-course score unavailable.
    if (candidate.receiving.every(r => r.status === 'executed')) {
      let norm = 0, count = 0;
      for (const r of candidate.receiving) {norm = Math.hypot(norm, Math.sqrt(r.rollout.metrics.count) * r.rollout.metrics.positionRMSE); count += r.rollout.metrics.count;}
      candidate.challengeRMSE = norm / Math.sqrt(count);
    } else candidate.challengeRMSE = null;
  });
  return {schema: options.responseTimes?'worldlaw.command-response-study/v1':'worldlaw.command-timing-study/v1', bundle, options, candidates,
    selectedDelay: selected?.delaySeconds ?? null, competitiveDelays,
    ...(options.responseTimes?{selectedResponse:selected?{delaySeconds:selected.delaySeconds,responseTimeSeconds:selected.responseTimeSeconds}:null,
      competitiveResponses:competitive.map(c=>({delaySeconds:c.delaySeconds,responseTimeSeconds:c.responseTimeSeconds}))}:{}),
    selectionBasis: 'training_integrated_displacement_score_only',
    work: {fittingUnits: work.fittingUnits, fitUnitMeaning: work.fitUnitMeaning, reservedSteps: work.reservedSteps,
      maxTotalSteps: work.maxTotalSteps, completedSteps: usedSteps, failedRunStepsNotMeasured: candidates.some(c => c.receiving.some(r => r.status === 'failed'))},
    qualifications: [
      ...(options.responseTimes?['The gradual-response hypothesis is first order: tau × appliedCommand′ + appliedCommand = delayed recorded command, with the pre-recording command as initial equilibrium.',
        'Each positive response time reserves coarse RK4 steps no larger than tau/4 and an independently executed twice-finer course. Neither numerical agreement nor a preferred pair identifies an actuator mechanism.']:[]),
      'Finite declared delay/term comparison; neither continuous optimization nor a calibrated probability.',
      'The same explicitly declared constant pre-recording command applies to every run for at least the largest delay.',
      'A command delay can represent clock misalignment, actuator latency or a compensating model error; this comparison cannot identify its physical cause.',
      'Observed angles, original timestamps, source labels, inertia and supplied initial rates remain unchanged.',
      'Changing settings after inspecting challenge results is exploratory reuse, not blind validation.',
      'Two solver resolutions test sensitivity; agreement is not an error bound or physical validation.',
      'Absent command excitation can leave every delay tied; a displayed first choice does not establish identified timing.',
    ]};
}

export function exportCommandTimingInputs(report) {
  const bundle = validateBundle(report.bundle), options = normalizeTimingStudyOptions(report.options);
  const text = JSON.stringify({schema: options.responseTimes?COMMAND_RESPONSE_SCHEMA:COMMAND_TIMING_SCHEMA, bundle, options}, null, 2);
  requireThat(text.length <= MAX_TEXT_LENGTH, 'The source-only timing notebook exceeds 3 MB.');
  return text;
}

export function restoreCommandTimingInputs(text) {
  requireThat(typeof text === 'string' && text.length <= MAX_TEXT_LENGTH, 'Timing input files must be JSON smaller than 3 MB.');
  let raw; try {raw = JSON.parse(text.replace(/^\uFEFF/, ''));} catch {throw new CommandTimingError('The timing JSON could not be read.');}
  requireThat([COMMAND_TIMING_SCHEMA,COMMAND_RESPONSE_SCHEMA].includes(raw?.schema), 'Expected a WORLDLAW command-timing or command-response input notebook.');
  const gradual=Array.isArray(raw.options?.responseTimes)&&raw.options.responseTimes.some(x=>x>0);
  requireThat(raw.schema===COMMAND_RESPONSE_SCHEMA?gradual:!gradual,
    'Gradual response declarations require worldlaw.command-response-inputs/v1 and an explicit positive response-time family.');
  return compareCommandTiming(raw.bundle, raw.options);
}
