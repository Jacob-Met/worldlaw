/** Reproducible measured-input receipt. Challenge residuals never rank candidates. */
import {readFileSync} from 'node:fs';
import {normalizeAngularBundle, discoverAngular, rolloutAngular} from '../../src/trajectory/angular-discovery.mjs';
const raw = JSON.parse(readFileSync(new URL('../physical-pasco-92be.json', import.meta.url)));
const bundle = normalizeAngularBundle(raw);
const discovery = discoverAngular(bundle.trainingRuns, {noiseSigma: .01, maxTerms: 4});
const report = {input: 'examples/physical-pasco-92be.json', method: discovery.method,
  trainingIds: bundle.trainingRuns.map(run => run.id), challengeIds: bundle.challengeRuns.map(run => run.id),
  physicalInertia: null, absoluteTorqueIdentified: false, selectionUsesChallenge: false,
  assumedPositionNoiseSigmaRad: .01, selected: discovery.selected,
  diagnostics: discovery.diagnostics, challengeResultsInTrainingRank: []};
for (const model of discovery.candidates.slice(0, 8)) for (const run of bundle.challengeRuns) {
  try {
    const result = rolloutAngular(model, run, {maxStep: .005});
    report.challengeResultsInTrainingRank.push({modelId: model.id, runId: run.id, status: 'finite', metrics: result.metrics, integrationSteps: result.diagnostics.steps});
  } catch (error) {
    report.challengeResultsInTrainingRank.push({modelId: model.id, runId: run.id, status: 'failed', code: error.code, message: error.message});
  }
}
console.log(JSON.stringify(report, null, 2));
