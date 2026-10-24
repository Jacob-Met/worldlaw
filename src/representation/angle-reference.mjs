/** Coordinate hypotheses composed with the maintained weak fitter and solver. */
import {normalizeAngularRuns, normalizeAngularBundle, AngularDataError} from '../trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../trajectory/angular-weak.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';

export const REFERENCE_SCHEMA = 'worldlaw.angle-reference-investigation/v1';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const insist = (ok, message) => {if (!ok) throw new AngularDataError(message, 'invalid_reference_investigation');};
const copy = value => JSON.parse(JSON.stringify(value));

function options(raw = {}) {
  insist(object(raw) && Object.keys(raw).every(k => ['offsets', 'fit', 'solver'].includes(k)), 'Unknown reference search settings.');
  const offsets = raw.offsets ?? Array.from({length: 21}, (_, i) => (i - 10) / 20);
  insist(Array.isArray(offsets) && offsets.length >= 1 && offsets.length <= 41 &&
    Array.from(offsets).every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= Math.PI) &&
    new Set(offsets).size === offsets.length && offsets.includes(0), 'Offer 1–41 distinct angle offsets within ±π, including zero.');
  const fit = raw.fit ?? {};
  insist(object(fit) && Object.keys(fit).every(k => ['terms','maxTerms','noiseSigma','ambiguityDelta','windowDuration','windowStride','rateWindowSize'].includes(k)), 'Unknown weak-fit settings.');
  const solver = {maxStep: .01, maxSteps: 100000, ...(raw.solver ?? {})};
  insist(object(raw.solver ?? {}) && Object.keys(solver).every(k => ['maxStep', 'maxSteps'].includes(k)) &&
    Number.isFinite(solver.maxStep) && solver.maxStep > 0 && solver.maxStep <= .1 &&
    Number.isInteger(solver.maxSteps) && solver.maxSteps >= 1 && solver.maxSteps <= 100000, 'Solver requires maxStep in (0, .1] and 1–100000 combined steps per run.');
  return {offsets: [...offsets].sort((a, b) => a - b), fit: copy(fit), solver};
}

function shift(run, offset) {
  return {...run, samples: run.samples.map(row => ({...row, position: row.position - offset}))};
}

/** This function deliberately cannot see challenge runs. No physical zero is identified. */
export function searchAngleReference(trainingRuns, requested = {}) {
  const runs = normalizeAngularRuns(trainingRuns), settings = options(requested);
  const candidates = [], failures = [];
  for (const offset of settings.offsets) {
    try {
      const fitted = discoverAngularWeak(runs.map(run => shift(run, offset)), settings.fit);
      const model = fitted.selected, offsetPenalty = offset === 0 ? 0 : Math.log(model.metrics.count);
      candidates.push({offset, model, score: model.metrics.score + offsetPenalty, offsetPenalty,
        fitDiagnostics: fitted.diagnostics, fitOptions: fitted.options});
    } catch (error) {
      if (!(error instanceof AngularDataError)) throw error;
      failures.push({offset, code: error.code, message: error.message});
    }
  }
  insist(candidates.some(c => c.offset === 0), `Unshifted baseline could not be fitted: ${failures.find(f => f.offset === 0)?.message ?? 'unknown failure'}`);
  candidates.sort((a,b) => a.score - b.score || Math.abs(a.offset) - Math.abs(b.offset) || a.offset - b.offset);
  const selected = candidates[0], baseline = candidates.find(c => c.offset === 0);
  const competitive = candidates.filter(c => c.score - selected.score <= selected.fitOptions.ambiguityDelta);
  const boundary = selected.offset !== 0 && (selected.offset === settings.offsets[0] || selected.offset === settings.offsets.at(-1));
  return {schema: 'worldlaw.angle-reference-search/v1', selected, baseline, candidates, failures,
    competitiveOffsets: competitive.map(c => c.offset), settings,
    status: failures.length ? 'incomplete_search' : selected.fitDiagnostics.adequacy === 'residual_mismatch' ? 'residual_mismatch' :
      boundary ? 'search_boundary' : competitive.length > 1 ? 'ambiguous_reference' : selected.offset === 0 ? 'unshifted_preferred' : 'shifted_hypothesis',
    scoreImprovement: baseline.score - selected.score,
    interpretation: 'θ_model = θ_recorded − offset. A coordinate hypothesis, not a measured sensor correction or physical cause.',
    limitations: [
      'Only the declared offset grid and maintained finite angular library are searched; a grid winner is not a continuous optimum.',
      'Nonzero offsets pay log(n) for one extra fitted coordinate parameter. This score is a heuristic, not a calibrated likelihood or interval.',
      'A spring plus bias can absorb an offset exactly; other structures can be nearly equivalent over a short angular range.',
      'An angle-reference error, tilted restoring law and omitted physics cannot be identified uniquely from this comparison.',
      'Training selection and offset are frozen before challenge predictions. Previously used recordings remain exploratory, not blind validation.',
      'No physical inertia, absolute torque, sensor calibration or hardware operation is established.',
    ]};
}

/** Compare training runs without pooling scores, coefficients, or challenge data.
 * Each run gets its own relative competitive set; absolute weak scores across
 * different run lengths are not comparable. This never replaces the pooled fit.
 */
export function auditAngleReferenceRuns(trainingRuns, requested = {}) {
  const runs = normalizeAngularRuns(trainingRuns), settings = options(requested);
  const summaries = runs.map(run => {
    const positions = run.samples.map(row => row.position);
    const summary = {runId: run.id, label: run.label, kind: run.kind,
      source: copy(run.source), positionSpan: Math.max(...positions) - Math.min(...positions)};
    try {
      const search = searchAngleReference([run], settings), best = search.selected;
      const candidates = search.candidates.map(c => ({offset: c.offset, modelId: c.model.id,
        scoreDelta: c.score - best.score, trainingRmseInNoiseUnits: c.fitDiagnostics.trainingRmseInNoiseUnits,
        adequacy: c.fitDiagnostics.adequacy, identifiability: c.fitDiagnostics.identifiability}));
      const supportedOffsets = candidates.filter(c => c.scoreDelta <= best.fitOptions.ambiguityDelta &&
        c.adequacy !== 'residual_mismatch' && c.identifiability === 'finite_library_local_only').map(c => c.offset).sort((a,b)=>a-b);
      const blockers = [];
      if (search.failures.length) blockers.push('incomplete_search');
      if (best.fitDiagnostics.adequacy === 'residual_mismatch') blockers.push('model_inadequacy');
      if (best.fitDiagnostics.identifiability !== 'finite_library_local_only' ||
          summary.positionSpan <= 6 * best.fitOptions.noiseSigma) blockers.push('insufficient_excitation');
      if ([settings.offsets[0],settings.offsets.at(-1)].includes(best.offset)) blockers.push('grid_boundary');
      return {...summary, selectedOffset: best.offset, modelId: best.model.id, competitiveOffsets: search.competitiveOffsets,
        supportedOffsets, trainingRmseInNoiseUnits: best.fitDiagnostics.trainingRmseInNoiseUnits,
        noiseSigma: best.fitOptions.noiseSigma, blockers, candidates, failures: search.failures};
    } catch (error) {
      if (!(error instanceof AngularDataError)) throw error;
      return {...summary, selectedOffset: null, modelId: null, competitiveOffsets: [], supportedOffsets: [],
        blockers: ['run_fit_unavailable'], candidates: [], failures: [{code: error.code, message: error.message}]};
    }
  });
  const blockers = summaries.flatMap(run => run.blockers.map(reason => ({runId: run.runId, reason})));
  let status, sharedOffsets = null;
  if (runs.length < 2) status = 'insufficient_runs';
  else if (settings.offsets.length < 2) status = 'insufficient_grid';
  else if (blockers.some(b => ['run_fit_unavailable','incomplete_search'].includes(b.reason))) status = 'run_fit_unavailable';
  else if (blockers.some(b => b.reason === 'model_inadequacy')) status = 'model_inadequacy';
  else if (blockers.some(b => b.reason === 'insufficient_excitation')) status = 'insufficient_excitation';
  else if (blockers.some(b => b.reason === 'grid_boundary')) status = 'grid_boundary';
  else {
    sharedOffsets = settings.offsets.filter(offset => summaries.every(run => run.supportedOffsets.includes(offset)));
    status = sharedOffsets.length === 0 ? 'incompatible_run_references' : sharedOffsets.length === 1 ? 'shared_grid_reference' : 'ambiguous_shared_reference';
  }
  const nextObservation = status === 'incompatible_run_references'
    ? 'Measure the angle zero against an independent fixed reference for each run, and repeat a matched release. Different laws, forces or reference changes can all cause this disagreement.'
    : status === 'model_inadequacy'
      ? 'Investigate missing dynamics or measurement error in the listed training runs before attributing mismatch to a reference change.'
      : status === 'insufficient_excitation' || status === 'ambiguous_shared_reference'
        ? 'Obtain a separately authorized run spanning a wider angular range, or an independent angle-reference measurement. The current motion does not isolate one shared reference.'
        : status === 'grid_boundary' || status === 'insufficient_grid'
          ? 'The declared coordinate grid does not establish an interior comparison. Inspect the reference range before interpreting a shared coordinate.'
          : status === 'insufficient_runs' || status === 'run_fit_unavailable'
            ? 'Supply at least two usable training runs with enough weak windows; inspect each retained refusal.'
            : 'A common grid reference survives these training comparisons. Challenge it with independent reference measurements; agreement does not certify calibration or a shared physical law.';
  return {schema: 'worldlaw.reference-consistency/v1', status, sharedOffsets, blockers, runs: summaries,
    method: 'intersection_of_run_specific_supported_competitive_offset_sets', nextObservation,
    limits: [
      'Run-specific absolute scores are never compared; each competitive set is relative to that run and its declared noise assumption.',
      'Adequate residuals and numerical rank are necessary gates, not proof of sufficient scientific excitation or model validity.',
      'Position span at most six assumed noise sigmas is conservatively treated as insufficient excitation; this is a declared heuristic.',
      'Different coefficients and structures may survive at the same reference. Shared coordinates do not imply one shared law.',
      'Disjoint finite-grid sets do not identify sensor drift: changed dynamics, omitted forcing, model bias or sampling can also cause disagreement.',
      'Run labels and recording identifiers are supplied provenance, not independent authentication of separate acquisition.',
      'This training-only diagnostic neither changes the pooled selected model nor uses challenge observations.',
    ]};
}

/** Return predictions to the original observation coordinates, without resetting. */
export function predictAngleReference(candidate, run, solver = {}) {
  insist(object(candidate) && Number.isFinite(candidate.offset) && Math.abs(candidate.offset) <= Math.PI, 'Invalid coordinate hypothesis.');
  const result = rolloutAngularWithResolution(candidate.model, shift(run, candidate.offset), solver);
  return {...result, rollout: {...result.rollout,
    rows: result.rollout.rows.map(row => ({...row, observed: row.observed + candidate.offset, predicted: row.predicted + candidate.offset})),
    coordinateTransform: {offset: candidate.offset, meaning: 'predictions and observations returned to recorded angle coordinates'}}};
}

export function investigateAngleReference(rawBundle, requested = {}) {
  const bundle = normalizeAngularBundle(rawBundle), search = searchAngleReference(bundle.trainingRuns, requested);
  const consistency = auditAngleReferenceRuns(bundle.trainingRuns, search.settings);
  const comparisons = bundle.challengeRuns.map(run => {
    const execute = candidate => {
      try {return predictAngleReference(candidate, run, search.settings.solver);}
      catch (error) {return {error: {code: error.code ?? 'prediction_failed', message: error.message}};}
    };
    return {runId: run.id, baseline: execute(search.baseline), selected: execute(search.selected)};
  });
  return {schema: REFERENCE_SCHEMA, bundle, search, consistency, comparisons};
}

/** Save only inputs. Reopening always recomputes every derived claim. */
export function exportReferenceInvestigation(result) {
  insist(result?.schema === REFERENCE_SCHEMA, 'Expected an angle-reference investigation.');
  const text = JSON.stringify({schema: REFERENCE_SCHEMA, bundle: result.bundle, settings: result.search.settings});
  insist(new TextEncoder().encode(text).length <= 3000000, 'Reference notebook exceeds 3 MB.');
  return text;
}
export function reopenReferenceInvestigation(text) {
  insist(typeof text === 'string' && new TextEncoder().encode(text).length <= 3000000, 'Reference notebook must be JSON of at most 3 MB.');
  let value; try {value = JSON.parse(text);} catch {throw new AngularDataError('Reference notebook is not valid JSON.');}
  insist(object(value) && value.schema === REFERENCE_SCHEMA && Object.keys(value).every(k => ['schema','bundle','settings'].includes(k)), 'Unsupported reference notebook.');
  return investigateAngleReference(value.bundle, value.settings);
}
