#!/usr/bin/env node
/** Compare two already recorded six-world development courses. Never opens a protected cohort. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw new Error('Supply the two extracted development directories');
const read = (root, ...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf8'));
const summaries = [baseline, candidate].map(root => read(root, 'development-summary.json'));
for (const summary of summaries) {
  assert.equal(summary.worldsExpected, 6);
  assert.equal(summary.worlds.length, 6);
  assert.equal(summary.calibrationOpened, false);
  assert.equal(summary.evaluationOpened, false);
}
assert.equal(summaries[0].protocolSHA256, summaries[1].protocolSHA256);
assert.deepEqual(summaries[0].worlds.map(w => w.seed), summaries[1].worlds.map(w => w.seed));
assert.equal(summaries[1].activePolicy, 'active_joint');

function describe(root, world) {
  const folder = 'world-' + world.seed;
  if (!world.metrics) return {failure:world.error, strict:false};
  const raw = read(root, folder, 'world-summary.json');
  const truth = read(root, folder, 'truth-opened-after-forecast.json').truth.terms;
  const forecast = read(root, folder, 'holdout-all-forecasts.json').forecasts.weak_active;
  const held = read(root, folder, 'holdout-observations.json').samples;
  const ids = (forecast.model?.terms ?? []).map(t => t.id);
  const rounds = raw.arms.active.receipts.map(round => {
    const saved = read(root, folder, 'active', 'round-' + round.round + '-plan.stdout.json').plan;
    return {round:round.round, selectedAfter:round.selectedAfter?.id ?? null,
      steps:round.planWork?.completedSteps ?? null, rivals:saved.predictions.map(m => m.modelId),
      objective:saved.objective, amplitudes:saved.request.segments.map(segment => segment.amplitude)};
  });
  let worst = null;
  if (forecast.status === 'predicted') {
    assert.equal(forecast.positions.length, held.length);
    for (let i = 1; i < held.length; i++) {
      const observed = held[i].position, predicted = forecast.positions[i];
      const error = Math.abs(observed - predicted);
      if (!worst || error > worst.error) worst = {time:held[i].time, observed, predicted, error};
    }
  }
  return {strict:world.metrics.weak_active.coldLawSuccess, metrics:world.metrics.weak_active,
    missing:Object.keys(truth).filter(t => !ids.includes(t)), extra:ids.filter(t => !(t in truth)),
    armStatus:raw.arms.active.status, armFailure:raw.arms.active.error, rounds, worst};
}

const rows = summaries[0].worlds.map((baseWorld, i) => {
  const newWorld = summaries[1].worlds[i], folder = 'world-' + baseWorld.seed;
  if (baseWorld.metrics && newWorld.metrics) {
    const base = read(baseline, folder, 'world-summary.json'), changed = read(candidate, folder, 'world-summary.json');
    assert.deepEqual(base.arms.active.sourceEvidenceHashes, changed.arms.active.sourceEvidenceHashes);
    assert.equal(base.heldReceipt.sha256, changed.heldReceipt.sha256);
    for (const key of ['weak_source','sindy_source','weak_random','sindy_random']) {
      assert.deepEqual(base.metrics[key], changed.metrics[key]);
    }
  }
  return {seed:baseWorld.seed, family:baseWorld.family, actuator:baseWorld.actuator,
    baseline:describe(baseline, baseWorld), candidate:describe(candidate, newWorld)};
});
console.log(JSON.stringify({schema:'worldlaw.continuous-rival-comparison/v1',
  protocolSHA256:summaries[0].protocolSHA256, worlds:rows.length,
  baselineStrict:rows.filter(w => w.baseline.strict).length,
  candidateStrict:rows.filter(w => w.candidate.strict).length, rows}, null, 2));
