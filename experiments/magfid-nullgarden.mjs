import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// The cohort, feature, grouping, seed and two-fold statistic were frozen before
// opening the four final MAGF-ID recordings. No physical randomization is claimed.
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: NULLGARDEN_SOURCE=... node experiments/magfid-nullgarden.mjs TEST_REPORT NEW_OUTPUT_DIR');
const root = resolve(process.env.NULLGARDEN_SOURCE || '');
assert.ok(process.env.NULLGARDEN_SOURCE, 'Provide the independently received Nullgarden checkout');
const here = dirname(fileURLToPath(import.meta.url));
const planBytes = await readFile(resolve(here, '../research/magfid-covariance/nullgarden-control-plan.json'));
const plan = JSON.parse(planBytes);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), plan.nullgarden_commit);
assert.equal(execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'], {encoding:'utf8'}).trim(), '');
const testBytes = await readFile(resolve(args[0]));
const test = JSON.parse(testBytes);
assert.equal(test.partition, 'test');
assert.equal(test.estimator_source_sha256, plan.estimator_sha256);
assert.equal(test.split_sha256, plan.source_split_sha256);
assert.equal(test.recordings.length, 4);
const {makeServer} = await import(pathToFileURL(resolve(root, 'server.mjs')).href);
const {parseCsv} = await import(pathToFileURL(resolve(root, 'src/data.mjs')).href);
const {repeatedCv, fitScore, conditionalOrbitSize, conditionalLabelAssignments} =
  await import(pathToFileURL(resolve(root, 'src/core.mjs')).href);
const output = resolve(args[1]);
await mkdir(output); // An existing result must not be overwritten.
const server = makeServer();
await new Promise((yes, no) => {server.once('error', no); server.listen(0, '127.0.0.1', yes);});
const results = {};
try {
  const post = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
    const value = await response.json();
    assert.equal(response.status, 200, JSON.stringify(value));
    return value;
  };
  for (const variant of ['desync_0.1_seconds', 'shared_colored_error']) {
    const lines = ['sample_id,batch,label,subject_id,covariance_error'];
    for (let recording = 0; recording < 4; recording++) {
      for (const [label, name] of ['unmodified', variant].entries()) {
        const value = test.representations.native_axes[name].model_scores.white_ou.recording_scores[recording];
        assert.ok(Number.isFinite(value));
        const feature = value.toPrecision(12);
        for (let repeat = 0; repeat < 2; repeat++) {
          lines.push(`r${recording}b${label}t${repeat},recording-${recording},${label},r${recording}b${label},${feature}`);
        }
      }
    }
    const csv = lines.join('\n') + '\n';
    await writeFile(resolve(output, variant + '.csv'), csv, {flag:'wx'});
    const intake = await post('/api/dataset', {name:`MAGF-ID: ${variant}`, csv});
    assert.equal(intake.n, 16); assert.equal(intake.nSubjects, 8);
    // The existing HTTP product fixes five folds and its own seed/budget.
    // Preserve its actual refusal; do not pretend this request changes those.
    const http = await post('/api/run', {datasetId:intake.datasetId,
      controls:['within_batch_permutation', 'leave_batch_out', 'batch_only']});
    const ds = parseCsv(csv);
    const statistic = labels => repeatedCv({...ds, y:labels}, (train, heldout) =>
      fitScore(train.map(i => ds.X[i]), train.map(i => labels[i]),
        heldout.map(i => ds.X[i]), plan.model_budget_k),
      {seed:plan.seed, repeats:3, folds:plan.folds});
    const observed = statistic(ds.y);
    const orbit = conditionalOrbitSize(ds.batch, ds.y, 16, ds.subject);
    assert.equal(orbit, 16);
    const nullScores = [];
    let observedAllocations = 0;
    for (const labels of conditionalLabelAssignments(ds.batch, ds.y,
      {maxAssignments:16, subject:ds.subject})) {
      if (labels.every((label, i) => label === ds.y[i])) observedAllocations++;
      nullScores.push(statistic(labels));
    }
    assert.equal(nullScores.length, 16); assert.equal(observedAllocations, 1);
    const valid = observed !== null && Number.isFinite(observed)
      && nullScores.every(value => value !== null && Number.isFinite(value));
    const exactTailFraction = valid ? nullScores.filter(value => value >= observed).length / orbit : null;
    results[variant] = {csv_sha256:digest(csv), intake, http,
      public_core:{seed:plan.seed, folds:plan.folds, repeats:3, k:plan.model_budget_k,
        observed_auc:observed, conditional_orbit_size:orbit, observed_allocations:observedAllocations,
        null_auc:nullScores, exact_conditional_tail_fraction:exactTailFraction,
        valid, independent_recordings:4, branch_subjects:8, technical_rows:16,
        interpretation:'Engineered paired feature diagnostic. Repeated rows are blocked. The two branches of a recording may occupy different subject CV folds; this is not new-recording transfer evidence. The exact label-orbit fraction assumes within-pair exchangeability; no randomized physical intervention or causal p-value is established.'}};
  }
  const receipt = {schema:'worldlaw.magfid-nullgarden-receiving.v1',
    nullgarden_commit:plan.nullgarden_commit, plan_sha256:digest(planBytes),
    source_test_sha256:digest(testBytes), receiver_sha256:digest(await readFile(fileURLToPath(import.meta.url))),
    results};
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {flag:'wx'});
  console.log(JSON.stringify({receipt_sha256:digest(await readFile(resolve(output, 'receipt.json'))),
    results:Object.fromEntries(Object.entries(results).map(([name, result]) => [name, {
      http_naive:result.http.results.naive, http_permutation:result.http.results.within_batch_permutation,
      public_core:result.public_core}]))}));
} finally {await new Promise(yes => server.close(yes));}
