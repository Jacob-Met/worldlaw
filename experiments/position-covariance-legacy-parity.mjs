/** Exact default/v2 output parity against a separately materialized baseline. */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createPredictiveChallenge, exportPredictiveChallenge} from '../src/predictive-selection/session.mjs';
import {covarianceBundle, covarianceRun, covarianceOptions} from '../tests/fixtures/covariance-course.mjs';
if (!process.env.BASELINE_SESSION) throw Error('Supply BASELINE_SESSION from the pinned original tree.');
const old = await import(pathToFileURL(process.env.BASELINE_SESSION));
let comparisons = 0;
for (let i = 0; i < 4; i++) {
  const b = covarianceBundle();
  b.trainingRuns = [covarianceRun('earlier-a', .7 + i * .2, .15 - i * .03, {seed: 70 + i}), covarianceRun('earlier-b', -.5 - i * .1, -.1, {seed: 190 + i})];
  b.challengeRuns = [covarianceRun('separate-release', 1.2 - i * .1, -.3, {noise: 0})];
  for (const refinement of [null, {sweeps: 1}]) {
    const previous = old.createPredictiveChallenge(b, covarianceOptions, refinement);
    const current = createPredictiveChallenge(b, covarianceOptions, refinement);
    assert.deepEqual(current, previous);
    assert.equal(exportPredictiveChallenge(current), old.exportPredictiveChallenge(previous));
    comparisons++;
  }
}
console.log(JSON.stringify({comparisons, qualification: 'Exact complete state and source-notebook bytes, four varied inputs across unchanged v1 and optional forward-refined v2.'}));
