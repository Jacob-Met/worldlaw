/** Run every independently generated course through maintained production code.
 * Usage: node experiments/position-covariance-receiving.mjs INPUT.json RECEIPT.json
 */
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {rolloutAngular} from '../src/trajectory/angular-discovery.mjs';
import {weakWindows} from '../src/trajectory/weak-operator.mjs';
import {comparePositionNoiseCovariance} from '../src/predictive-selection/covariance.mjs';

const [inputPath, receiptPath] = process.argv.slice(2);
if (!inputPath || !receiptPath) throw Error('Supply original generated inputs and a receipt path.');
const bytes = await readFile(inputPath), inputs = JSON.parse(bytes), results = [];
for (const course of inputs.cases) {
  const before = JSON.stringify(course), discovery = discoverAngularWeak([course.training], course.options);
  const model = discovery.selected, started = performance.now();
  const comparison = comparePositionNoiseCovariance(model, [course.training], {
    windowDuration: course.options.windowDuration, windowStride: course.options.windowStride
  });
  const elapsedMs = performance.now() - started;
  const original = rolloutAngular(model, course.challenge, {maxStep: .0025});
  const compared = comparison.refinedModel ? rolloutAngular(comparison.refinedModel, course.challenge, {maxStep: .0025}) : null;
  assert.equal(JSON.stringify(course), before, 'Original observations and separate release are immutable.');
  results.push({kind: course.kind, index: course.index, selected: model.id, status: comparison.status,
    iterations: comparison.iterations.length, elapsedMs, reservation: comparison.reservation,
    originalPositionRMSE: original.metrics.positionRMSE, comparedPositionRMSE: compared?.metrics.positionRMSE ?? null,
    originalCoefficients: model.terms.map(t => t.coefficient),
    comparedCoefficients: comparison.refinedModel?.terms.map(t => t.coefficient) ?? null,
    error: comparison.error ?? null});
}

// Perturb source positions, rebuilding both target and every feature. This is
// distinct from the separately maintained dense-GLS/irregular-clock peer oracle.
const insist = (condition, message) => {if (!condition) throw Error(message);};
const sample = inputs.cases.find(c => c.kind === 'gravity');
const options = {...sample.options, terms: ['rate', 'spring', 'gravity', 'cosine', 'cubic', 'bias']};
const coefficients = [-.2, -.7, -3, .2, -.1, .05];
const rows = weakWindows(sample.training, options, null, insist, {includePositionDerivatives: true});
const residual = values => values.map(row => row.target - row.columns.reduce((sum, x, j) => sum + coefficients[j] * x, 0));
let points = 0, maximumDifference = 0;
for (const index of [0, 5, 33, 200, 400, 600]) {
  const plus = structuredClone(sample.training), minus = structuredClone(sample.training), epsilon = 1e-6;
  plus.samples[index].position += epsilon; minus.samples[index].position -= epsilon;
  const a = residual(weakWindows(plus, options, null, insist)), b = residual(weakWindows(minus, options, null, insist));
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j], k = index - row.firstIndex;
    const analytic = k < 0 || k >= row.positionWeights.length ? 0 : row.positionWeights[k] - row.featurePositionDerivatives.reduce((sum, g, i) => sum + coefficients[i] * g[k], 0);
    const numeric = (a[j] - b[j]) / (2 * epsilon), difference = Math.abs(numeric - analytic);
    maximumDifference = Math.max(maximumDifference, difference); points++;
    assert.ok(difference < 2e-8, JSON.stringify({index, row: j, analytic, numeric, difference}));
  }
}
const summary = [...new Set(results.map(r => r.kind))].map(kind => {
  const all = results.filter(r => r.kind === kind), complete = all.filter(r => r.status === 'converged');
  const mean = key => complete.length ? complete.reduce((sum, r) => sum + r[key], 0) / complete.length : null;
  return {kind, count: all.length, converged: complete.length,
    originalMeanPositionRMSE: mean('originalPositionRMSE'), comparedMeanPositionRMSE: mean('comparedPositionRMSE'),
    wins: complete.filter(r => r.comparedPositionRMSE < r.originalPositionRMSE).length,
    unresolved: all.filter(r => r.status !== 'converged').map(r => ({index: r.index, status: r.status, error: r.error}))};
});
const times = results.map(r => r.elapsedMs).sort((a, b) => a - b);
const receipt = {method: 'Production complete residual position-covariance comparison; fixed before the forty unfamiliar oracle courses',
  inputSha256: createHash('sha256').update(bytes).digest('hex'), oracle: inputs.oracle, oracleEnvironment: inputs.environment,
  runtime: process.version, summary, derivativeCheck: {points, maximumDifference},
  timing: {count: times.length, medianMs: (times[19] + times[20]) / 2, minimumMs: times[0], maximumMs: times.at(-1)},
  limitations: ['Authored independent numerical courses, not measured acquisition or blind physical validation.',
    'Correlated noise violates the independence assumption; externally forced courses deliberately violate the fitted unforced model.',
    'Every course is retained. Convergence, average improvement and coefficient accuracy are different claims.'], results};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({summary, derivativeCheck: receipt.derivativeCheck, timing: receipt.timing}, null, 2));
