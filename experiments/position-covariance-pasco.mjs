/** The maintained measured-data bundle, received through the actual consumer. */
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createPredictiveChallenge, exportPredictiveChallenge, importPredictiveChallenge} from '../src/predictive-selection/session.mjs';
const output = process.argv[2]; if (!output) throw Error('Supply a receipt path.');
const bytes = await readFile(new URL('../examples/physical-pasco-92be.json', import.meta.url));
const bundle = JSON.parse(bytes), results = [];
for (const [label, options] of [
  ['maintained-default', {}],
  ['explicit-smooth-library', {terms: ['rate', 'spring', 'gravity', 'bias', 'cubic', 'cosine'], maxTerms: 3}]
]) {
  const plain = createPredictiveChallenge(bundle, options), compared = createPredictiveChallenge(bundle, options, null, {});
  assert.deepEqual(compared.selection, plain.selection);
  assert.deepEqual(compared.results.filter(r => !r.modelId.endsWith('~position-covariance')), plain.results);
  assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(compared)), compared);
  results.push({label, options: compared.selection.options, selected: compared.selection.selectedId,
    covarianceStatus: compared.covariance.status, error: compared.covariance.error ?? null,
    iterations: compared.covariance.iterations?.length ?? 0, reservation: compared.covariance.reservation ?? null,
    coefficients: compared.covariance.refinedModel?.terms ?? null,
    results: compared.results.map(r => ({model: r.modelId, status: r.status, numericalStatus: r.numericalStatus,
      positionRMSE: r.rollout?.metrics.positionRMSE ?? null}))});
}
assert.equal(results[0].covarianceStatus, 'refused');
assert.equal(results[0].error.code, 'unsupported_position_derivative');
assert.equal(results[1].covarianceStatus, 'converged');
const receipt = {bundle: 'examples/physical-pasco-92be.json', sha256: createHash('sha256').update(bytes).digest('hex'),
  runtime: process.version,
  qualification: 'Existing maintained measured-data recordings, reused during development; not newly acquired, independently blind, or physical-law validation.',
  conclusion: 'The explicit smooth comparison improves this smooth-library selection, but remains worse than the maintained nonsmooth default. No library or model is silently replaced.', results};
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt, null, 2));
