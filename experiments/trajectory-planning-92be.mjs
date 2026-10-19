/** Independent acquisition comparison; reserved challenge never enters planning. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
export const DESIGN = Object.freeze({inertia: .8, bounds: {initialPosition: {min: -2.2, max: 2.2}, initialRate: {min: -.6, max: .6}},
  duration: 8, sampleInterval: .04, command: 0, positionCount: 9, rateCount: 3, maxModels: 8, maxStep: .01, maxTotalSteps: 250000,
  predictionBounds: {position: {min: -3.2, max: 3.2}, rate: {min: -8, max: 8}}});
const FIT = Object.freeze({noiseSigma: .01, maxTerms: 4});
const fit = runs => discoverIntegral(runs, FIT);
const received = (model, challenge) => {
  try {return {status: 'finite', ...rollout(model, challenge, {maxStep: .005}).metrics};}
  catch (error) {return {status: 'failed', code: error.code};}
};
function acquireAndRefit(training, challenge, request, seed, noiseSigma) {
  const acquired = acquireVirtualPendulum({...request, seed, noiseSigma}, {existingRuns: [...training, challenge]});
  const revised = fit([...training, acquired]);
  return {request, recordingId: acquired.source.recordingId, sampleCount: acquired.samples.length,
    selectedModel: revised.selected.id, coefficients: revised.selected.terms, competitiveCount: revised.competitive.length,
    receive: received(revised.selected, challenge)};
}
export function originalFixtureReceipt() {
  const b = JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url)));
  const initial = fit(b.trainingRuns), plan = planTrajectoryExperiment(initial, DESIGN);
  const challenge = b.challengeRuns[0];
  return {schema: 'worldlaw.trajectory-planning-original/v1', selectedBefore: initial.selected.id,
    before: received(initial.selected, challenge), planned: {status: plan.status, release: plan.selected.acquisitionRequest,
      disagreementRad: plan.selected.disagreementRad, provenance: plan.provenance},
    strategies: {
      planned: acquireAndRefit(b.trainingRuns, challenge, plan.selected.acquisitionRequest, 10001, .00002),
      passiveSmall: acquireAndRefit(b.trainingRuns, challenge, {initialPosition: .06, initialRate: 0, duration: 8, sampleInterval: .04}, 10002, .00002),
      fixedWide: acquireAndRefit(b.trainingRuns, challenge, {initialPosition: 1.2, initialRate: 0, duration: 8, sampleInterval: .04}, 10003, .00002),
    }};
}
export function freshSeedComparison() {
  const rows = [];
  for (const noiseSigma of [.00002, .0005, .002, .01]) for (const seed of [20003, 30011, 40013, 50021]) {
    const a = acquireVirtualPendulum({initialPosition: .06, initialRate: 0, duration: 6.4, sampleInterval: .04, seed, noiseSigma}, {existingRuns: []});
    const b = acquireVirtualPendulum({initialPosition: -.045, initialRate: .025, duration: 6.4, sampleInterval: .04, seed: seed + 1, noiseSigma}, {existingRuns: [a]});
    const training = [a, b], initial = fit(training), plan = planTrajectoryExperiment(initial, DESIGN);
    // The reserved recording is generated only after the planner has returned.
    const challenge = acquireVirtualPendulum({initialPosition: 1.9, initialRate: 0, duration: 8, sampleInterval: .04, seed: seed + 2, noiseSigma}, {existingRuns: training});
    rows.push({noiseSigma, seed, initialModel: initial.selected.id, before: received(initial.selected, challenge),
      plan: {status: plan.status, disagreementRad: plan.selected?.disagreementRad ?? null, initialPosition: plan.selected?.initialPosition ?? null, initialRate: plan.selected?.initialRate ?? null},
      planned: plan.status === 'proposed' ? acquireAndRefit(training, challenge, plan.selected.acquisitionRequest, seed + 3, noiseSigma) : null,
      passiveSmall: acquireAndRefit(training, challenge, {initialPosition: .06, initialRate: 0, duration: 8, sampleInterval: .04}, seed + 4, noiseSigma),
      fixedWide: acquireAndRefit(training, challenge, {initialPosition: 1.2, initialRate: 0, duration: 8, sampleInterval: .04}, seed + 5, noiseSigma)});
  }
  return rows;
}
export function retainedFailures() {
  const b = JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json', import.meta.url))), d = fit(b.trainingRuns);
  const restricted = planTrajectoryExperiment(d, {...DESIGN, bounds: {initialPosition: {min: -.08, max: .08}, initialRate: {min: -.03, max: .03}}});
  const largerEnsemble = planTrajectoryExperiment(d, {...DESIGN, maxModels: 16, maxTotalSteps: 500000});
  const summarize = plan => ({status: plan.status, disagreementRad: plan.selected?.disagreementRad ?? null,
    selected: plan.selected?.acquisitionRequest ?? null, diagnostics: plan.diagnostics});
  return {restrictedRelease: {...summarize(restricted), after: restricted.status === 'proposed' ? acquireAndRefit(b.trainingRuns, b.challengeRuns[0], restricted.selected.acquisitionRequest, 60001, .00002) : null},
    largerCandidateEnsemble: summarize(largerEnsemble),
    sharedModelBias: 'A single or identical wrong model yields zero disagreement regardless of its future physical error; the planner cannot discover omitted truths from consensus.',
    samplingAlias: 'Retained unit case: harmonic candidates complete one/two periods between scheduled samples. Sampled positions satisfy ±.01 rad, but an exact intermediate excursion reaches1/(2π)rad. Sampled bounds/disagreement miss this.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({schema: 'worldlaw.trajectory-planning-comparison/v1', syntheticOnly: true, design: DESIGN, fitSettings: FIT,
    original: originalFixtureReceipt(), fresh: freshSeedComparison(), failures: retainedFailures()}, null, 2));
}
