/** Frozen-setting comparison; measured held-out data never choose a setting or rank. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {discoverAngular, rolloutAngular, normalizeAngularBundle} from '../src/trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {springRun, gravityRun} from './integral-discovery-92be.mjs';
export const FROZEN_WEAK_OPTIONS = Object.freeze({noiseSigma: .01, maxTerms: 4, windowDuration: 1, windowStride: .5, rateWindowSize: 9});
const angular = run => ({id: run.id, label: run.label, kind: run.kind, inertia: null, dynamics: 'unforced_scalar_rotation', initialRate: run.initialRate,
  samples: run.samples.map(({time, position}) => ({time, position})), source: {...run.source, recordingId: run.id}});
const receive = (model, run) => {
  try {return {status: 'finite', ...rolloutAngular(model, run, {maxStep: .005}).metrics};}
  catch (error) {return {status: 'failed', code: error.code, message: error.message};}
};
/** Development grid: synthetic validation and measured TRAINING only. */
export function trainingWindowStudy() {
  const measuredTraining = JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json', import.meta.url))).trainingRuns;
  return [.25, .5, 1, 2].map(windowDuration => {
    const synthetic = [], options = {...FROZEN_WEAK_OPTIONS, windowDuration, windowStride: windowDuration / 2};
    for (const [family, make] of [['spring', springRun], ['gravity', gravityRun]]) for (const sigma of [0, .001, .01]) for (const dt of [.01, .025]) {
      const runs = [angular(make({id: 'a', position: .8, rate: .3, sigma, dt, seed: 11})), angular(make({id: 'b', position: -1.4, rate: -.2, sigma, dt, seed: 29}))];
      const d = discoverAngularWeak(runs, {...options, noiseSigma: Math.max(.00001, sigma)});
      const challenge = angular(make({id: 'development-analytic-challenge', position: 2.1, rate: -.5, dt: .025, duration: 8}));
      synthetic.push({family, sigma, dt, model: d.selected.id, train: d.selected.metrics.rmse, receive: receive(d.selected, challenge)});
    }
    const fitted = discoverAngularWeak(measuredTraining, options);
    return {windowDuration, synthetic, measuredTraining: {model: fitted.selected.id, coefficients: fitted.selected.terms,
      rmse: fitted.selected.metrics.rmse, noiseUnits: fitted.diagnostics.trainingRmseInNoiseUnits,
      forward: measuredTraining.map(run => ({runId: run.id, result: receive(fitted.selected, run)}))}};
  });
}
export function analyticComparison() {
  const rows = [];
  for (const [family, make] of [['spring', springRun], ['gravity', gravityRun]]) for (const sigma of [0, .0001, .001, .01])
    for (const dt of [.01, .025]) for (const seed of [101, 307, 911]) {
      const training = [angular(make({id: 'train-a', position: .8, rate: .3, sigma, dt, seed})),
        angular(make({id: 'train-b', position: -1.4, rate: -.2, sigma, dt, seed: seed + 1000}))];
      const challenge = angular(make({id: 'analytic-challenge', position: 2.1, rate: -.5, dt: .025, duration: 8}));
      const settings = {...FROZEN_WEAK_OPTIONS, noiseSigma: Math.max(1e-5, sigma)};
      const weak = discoverAngularWeak(training, settings), cumulative = discoverAngular(training, {noiseSigma: settings.noiseSigma, maxTerms: 4});
      rows.push({family, sigma, dt, seed, weakModel: weak.selected.id, cumulativeModel: cumulative.selected.id,
        weakTrainingRad: weak.selected.metrics.rmse, cumulativeTrainingRad: cumulative.selected.metrics.whitenedRmse,
        weak: receive(weak.selected, challenge), cumulative: receive(cumulative.selected, challenge)});
    }
  const stresses = [];
  const run = angular(springRun({id: 'wrong-initial-rate', duration: 8})); run.initialRate += .25;
  const challenge = angular(springRun({id: 'rate-challenge', position: -.8, rate: -.5, duration: 8}));
  for (const [method, fit] of [['weak', discoverAngularWeak], ['cumulative', discoverAngular]]) {
    const d = fit([run], {terms: ['rate', 'spring', 'bias'], maxTerms: 3, noiseSigma: .001});
    stresses.push({case: 'wrong_training_initial_rate_plus_.25', method, model: d.selected.id, receive: receive(d.selected, challenge)});
  }
  const coarse = [angular(springRun({id: 'fast-coarse-a', dt: .125, duration: 8, stiffness: 35, damping: .2})),
    angular(springRun({id: 'fast-coarse-b', position: -.8, rate: -.5, dt: .125, duration: 8, stiffness: 35, damping: .2}))];
  const coarseChallenge = angular(springRun({id: 'fast-challenge', position: 1.6, rate: .4, dt: .025, duration: 8, stiffness: 35, damping: .2}));
  for (const [method, fit] of [['weak', discoverAngularWeak], ['cumulative', discoverAngular]]) {
    const d = fit(coarse, {terms: ['rate', 'spring'], maxTerms: 2, noiseSigma: .001});
    stresses.push({case: 'fast_sampling_.125_seconds', method, model: d.selected.id, coefficients: d.selected.terms, receive: receive(d.selected, coarseChallenge)});
  }
  const cubic = [angular(gravityRun({id: 'cubic-a', position: .6, cubic: .8})), angular(gravityRun({id: 'cubic-b', position: -.9, cubic: .8}))];
  const cubicChallenge = angular(gravityRun({id: 'cubic-challenge', position: 2.4, rate: -.6, cubic: .8, duration: 8}));
  for (const [method, fit] of [['weak', discoverAngularWeak], ['cumulative', discoverAngular]]) {
    const d = fit(cubic, {noiseSigma: .001, maxTerms: 4});
    stresses.push({case: 'unsupported_cubic_restoration', method, model: d.selected.id, adequacy: d.diagnostics.adequacy, receive: receive(d.selected, cubicChallenge)});
  }
  return {schema: 'worldlaw.angular-weak-comparison/v1', settings: {...FROZEN_WEAK_OPTIONS}, rows, stresses};
}
export function measuredReceipt() {
  const bundle = normalizeAngularBundle(JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json', import.meta.url))));
  const d = discoverAngularWeak(bundle.trainingRuns, FROZEN_WEAK_OPTIONS);
  return {schema: 'worldlaw.angular-weak-measured-receipt/v1', settingsFrozenBeforeThisReceive: true, selectionUsesChallenge: false,
    trainingIds: bundle.trainingRuns.map(run => run.id), challengeIds: bundle.challengeRuns.map(run => run.id),
    selected: d.selected, diagnostics: d.diagnostics,
    trainingForward: bundle.trainingRuns.map(run => ({runId: run.id, result: receive(d.selected, run)})),
    challengeInTrainingRank: d.candidates.slice(0, 8).flatMap(model => bundle.challengeRuns.map(run => ({modelId: model.id, runId: run.id, result: receive(model, run)})))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? 'analytic';
  if (mode === 'analytic') console.log(JSON.stringify(analyticComparison(), null, 2));
  else if (mode === 'measured') console.log(JSON.stringify(measuredReceipt(), null, 2));
  else if (mode === 'development') console.log(JSON.stringify(trainingWindowStudy(), null, 2));
  else throw new Error('Use development, analytic or measured.');
}
