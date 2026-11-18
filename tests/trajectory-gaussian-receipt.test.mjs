import test from 'node:test';
import assert from 'node:assert/strict';
import {compareGaussianInterventions,GAUSSIAN_FROZEN_SEED_BASES,GAUSSIAN_NOISE_LEVELS,
  GAUSSIAN_RECEIPT_SCHEMA} from '../experiments/gaussian-intervention-comparison.mjs';

test('noise-aware and incumbent release policies are compared only after both commit prospective releases',()=>{
  const receipt=compareGaussianInterventions();
  assert.equal(receipt.schema,GAUSSIAN_RECEIPT_SCHEMA);
  assert.equal(receipt.rows.length,16);
  assert.equal(receipt.grouped.length,4);
  assert.deepEqual(receipt.frozenSeedBases,[...GAUSSIAN_FROZEN_SEED_BASES]);
  assert.deepEqual(receipt.noiseLevels,[...GAUSSIAN_NOISE_LEVELS]);
  for(const group of receipt.grouped){
    assert.equal(group.caseCount,4);
    for(const policy of ['legacy','gaussian']){
      assert.equal(group[policy].proposed+group[policy].refused,4);
      assert.equal(group[policy].finite+group[policy].numericalFailures,group[policy].proposed);
    }
  }
  for(const row of receipt.rows){
    assert.ok(GAUSSIAN_NOISE_LEVELS.includes(row.noiseSigma));
    assert.ok(GAUSSIAN_FROZEN_SEED_BASES.includes(row.seed));
    assert.equal(row.legacy.plan.power,undefined);
    if(row.gaussian.plan.power){
      assert.ok(row.gaussian.plan.power.readings.length<=8);
      assert.ok(row.gaussian.plan.power.readings.every(r=>Number.isFinite(r.time)&&Number.isInteger(r.sampleIndex)));
      assert.ok(!Object.hasOwn(row.gaussian.plan.power,'observed'));
      assert.ok(!Object.hasOwn(row.gaussian.plan.power,'challenge'));
    }
    for(const policy of [row.legacy,row.gaussian]){
      assert.equal(Boolean(policy.refit),policy.plan.status==='proposed');
      if(!policy.refit)continue;
      assert.equal(policy.refit.samplesAcquired,201);
      assert.ok(typeof policy.refit.recordingId==='string');
      assert.ok(['finite','failed'].includes(policy.refit.received.status));
      if(policy.refit.received.status==='finite')assert.ok(Number.isFinite(policy.refit.received.positionRMSE));
      else assert.equal(policy.refit.received.positionRMSE,null);
    }
  }
});
