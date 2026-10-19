/** Experimental training-run cross-validation. Never imports reserved challenge evidence into ranking. */
import {pathToFileURL} from 'node:url';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {springRun, gravityRun} from './integral-discovery-92be.mjs';

const mean = values => values.reduce((sum, value) => sum + value / values.length, 0);
const standardError = values => values.length < 2 ? 0 : Math.hypot(...values.map(value => value - mean(values))) /
  Math.sqrt((values.length - 1) * values.length);
const order = (a, b) => a.meanMSE - b.meanMSE || a.termCount - b.termCount || a.trainingRank - b.trainingRank;

/**
 * Bounded experiment: at most four supplied training runs; all <=99 subsets for maxTerms<=4.
 * Every fold fit excludes the entire evaluated training run. Model structures are the common
 * declared library, with their coefficients independently refitted on the remaining runs.
 */
export function trainingRunStability(trainingRuns, options = {}) {
  if (!Array.isArray(trainingRuns) || trainingRuns.length < 3 || trainingRuns.length > 4) throw new Error('This experiment needs three or four training runs.');
  const config = {noiseSigma: .01, maxTerms: 4, ...options};
  if (config.maxTerms > 4) throw new Error('This experiment is bounded to at most four terms.');
  const complete = discoverIntegral(trainingRuns, config);
  const folds = trainingRuns.map((_, omit) => discoverIntegral(trainingRuns.filter((_, i) => i !== omit), config));
  const foldMaps = folds.map(result => new Map(result.candidates.map(model => [model.id, model])));
  const rows = complete.candidates.map((model, trainingRank) => {
    const foldResults = trainingRuns.map((run, i) => {
      const foldModel = foldMaps[i].get(model.id);
      if (!foldModel) return {runId: run.id, status: 'unestimable', positionRMSE: null, terms: null};
      try {
        const forward = rollout(foldModel, run, {maxStep: .025, maxSteps: 20000});
        return {runId: run.id, status: 'ok', positionRMSE: forward.metrics.positionRMSE, terms: foldModel.terms};
      } catch (error) {return {runId: run.id, status: 'failed', error: error.code ?? 'prediction_failed', positionRMSE: null, terms: foldModel.terms};}
    });
    const errors = foldResults.map(result => result.positionRMSE === null ? null : result.positionRMSE ** 2);
    const estimable = errors.every(value => value !== null && Number.isFinite(value));
    const coefficientStability = model.terms.map(term => {
      const estimates = foldResults.map(result => result.terms?.find(value => value.id === term.id)?.coefficient ?? null);
      const finite = estimates.every(value => value !== null && Number.isFinite(value));
      return {id: term.id, foldCoefficients: estimates, signConsistent: finite && new Set(estimates.map(Math.sign)).size === 1,
        mean: finite ? mean(estimates) : null};
    });
    return {modelId: model.id, termCount: model.terms.length, trainingRank, estimable,
      meanMSE: estimable ? mean(errors) : null, standardErrorMSE: estimable ? standardError(errors) : null,
      foldResults, coefficientStability};
  });
  const estimable = rows.filter(row => row.estimable).sort(order);
  if (!estimable.length) throw new Error('No common executable candidate across all training-run folds.');
  const best = estimable[0], threshold = best.meanMSE + best.standardErrorMSE;
  const oneSE = estimable.filter(row => row.meanMSE <= threshold)
    .sort((a, b) => a.termCount - b.termCount || order(a, b))[0];
  const signConsistent = estimable.filter(row => row.coefficientStability.every(term => term.signConsistent))[0] ?? best;
  return {schema: 'worldlaw.integral-stability-experiment/v1', selectionEvidence: 'training_runs_only',
    independentRunFolds: trainingRuns.length, noiseSigmaUnits: 'rad', originalModel: complete.selected,
    minimumCvModel: complete.candidates.find(model => model.id === best.modelId),
    oneStandardErrorModel: complete.candidates.find(model => model.id === oneSE.modelId),
    signConsistentModel: complete.candidates.find(model => model.id === signConsistent.modelId),
    oneStandardErrorThresholdMSE: threshold, candidates: rows,
    limitations: ['All retained coefficients are refitted on the complete training set after structure selection.',
      'Three or four run folds do not calibrate uncertainty; the standard-error threshold is a complexity heuristic.',
      'Fold predictions include measurement and initial-state errors as well as model errors.',
      'An unexcited remaining fold can make otherwise useful structures unestimable.',
      'Reserved challenge observations are not accepted by this ranking API.']};
}

function evaluateCase(family, makeRun, sigma, seed, parameters = {}, bias = 0) {
  const source = options => {
    const command = options.command ?? 0, gain = parameters.gain ?? 1.3;
    const run = makeRun({...parameters, ...options, command: command + bias / gain});
    // The independent oracle's shifted equilibrium implements an additive torque,
    // while recorded actuator command remains the original value.
    return {...run, samples: run.samples.map(row => ({...row, command}))};
  };
  const training = [
    source({id: 'train-a', position: .8, rate: .3, command: .1, sigma, seed}),
    source({id: 'train-b', position: -1.3, rate: -.2, command: -.3, sigma, seed: seed + 100}),
    source({id: 'train-c', position: 1.65, rate: .6, command: .35, sigma, seed: seed + 200}),
  ];
  const stability = trainingRunStability(training, {noiseSigma: Math.max(1e-6, sigma)});
  // Reserved challenge creation/evaluation follows and cannot affect ranking.
  const reservedChallenge = source({id: `${family}-reserved-challenge`, position: 2.15, rate: -.65, command: -.18, duration: 8});
  const evaluation = Object.fromEntries(['originalModel', 'minimumCvModel', 'oneStandardErrorModel', 'signConsistentModel'].map(key => {
    const model = stability[key];
    try {return [key, {id: model.id, terms: model.terms, positionRMSE: rollout(model, reservedChallenge, {maxStep: .005}).metrics.positionRMSE}];}
    catch (error) {return [key, {id: model.id, terms: model.terms, positionRMSE: null, error: error.code ?? 'prediction_failed'}];}
  }));
  return {family, sigma, seed, parameters, trueBias: bias,
    trueTerms: `command+rate+${family === 'spring' ? 'spring' : 'gravity'}${bias ? '+bias' : ''}`, ...evaluation,
    selectedFoldDiagnostics: stability.candidates.filter(candidate => Object.values(evaluation).some(value => value.id === candidate.modelId))};
}

export async function runStabilityComparison() {
  const rows = [], freshSeedAudit = [], trueFourthTermAudit = [];
  for (const [family, makeRun] of [['spring', springRun], ['gravity', gravityRun]]) {
    for (const sigma of [0, .0001, .001, .01]) for (const seed of [11, 29, 73]) rows.push(evaluateCase(family, makeRun, sigma, seed));
    const settings = [
      {seed: 101, parameters: {inertia: .65, stiffness: 1.7, damping: .12, gain: .85}},
      {seed: 307, parameters: {inertia: 1.1, stiffness: 3.4, damping: .4, gain: 1.8}},
      {seed: 911, parameters: {inertia: .9, stiffness: 2.6, damping: .28, gain: 1.15}},
    ];
    for (const sigma of [.001, .01]) for (const {seed, parameters} of settings) freshSeedAudit.push(evaluateCase(family, makeRun, sigma, seed, parameters));
    for (const bias of [.005, .08]) for (const seed of [101, 307]) trueFourthTermAudit.push(evaluateCase(family, makeRun, .001, seed, {}, bias));
  }
  return {schema: 'worldlaw.integral-stability-comparison/v1', syntheticOnly: true,
    design: 'Three declared strategies were evaluated; all structures chosen with training-only run folds, never reserved challenge outcomes.',
    rows, freshSeedAudit, trueFourthTermAudit};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await runStabilityComparison(), null, 2));
