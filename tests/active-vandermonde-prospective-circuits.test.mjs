import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  designActiveVandermondeNonlinear as design,
  replayActiveVandermondeNonlinear as replay,
  evaluateActiveVandermondeReadings as evaluate,
  ACTIVE_VANDERMONDE_READINGS_SCHEMA as readingsSchema,
} from '../src/science/active-vandermonde-nonlinear.mjs';
import {sealActivePlan} from '../src/science/active-experiment-record.mjs';

const request = {
  schema: 'worldlaw.active-vandermonde-nonlinear/v1',
  stateDimension: 1, horizon: 3, maxDegree: 2, noiseBound: '1',
  amplitudes: ['-2','-1','0','1','2'],
  plant: {A: [['2']], bUnit: ['1'], C: ['1'], pulseTicks: [1]},
  hypotheses: [
    {id: 'off', coefficients: ['0','0','0']},
    {id: 'on', coefficients: ['7','0','0']},
  ],
};
const old = JSON.parse(readFileSync(new URL('./fixtures/vandermonde-conservative-plan.json', import.meta.url)));

test('complete circuits certify separation that the historical basis and pair sums miss', () => {
  const plan = design(request);
  assert.equal(old.invariantNoiseBound, '4');
  assert.equal(old.pairwiseSeparations[0].certified, false);
  assert.equal(plan.invariantNoiseBound, '3');
  assert.deepEqual(plan.initialStateEliminator, ['0','-2','1']);
  assert.equal(plan.pairwiseSeparations[0].requiredSeparation, '6');
  assert.equal(plan.status, 'certified_vandermonde_separation_and_identification');
  // Matching primal and dual witnesses. h-O/6 = (-1/6,-1/3,1/3).
  const O = [1,2,4], h = [0,0,1], w = [0,-2,1];
  assert.equal(O.reduce((s,x,i) => s+x*w[i], 0), 0);
  assert.equal(h.reduce((s,x,i) => s+x*w[i], 0), 1);
  assert.equal(Math.max(...h.map((x,i) => Math.abs(6*x-O[i]))), 2);
});

test('a shared readout at the exact boundary keeps both catalog laws', () => {
  const touching = structuredClone(request);
  touching.hypotheses[1].coefficients[0] = '6';
  const plan = design(touching);
  assert.equal(plan.status, 'vandermonde_design_noise_limited');
  // x0=0 gives [0,0,0]. x0=-1 with response 6 gives [-1,-2,2].
  const episodes = plan.amplitudes.map((amplitude, episode) => ({
    episode, amplitude, readings: ['-1/2','-1','1'].map((value,tick) => ({tick,value})),
  }));
  const result = evaluate(touching, plan, {schema: readingsSchema, acquisition: 'synthetic',
    source: 'exact shared boundary fixture', episodes});
  assert.deepEqual(result.consistentHypothesisIds, ['off','on']);
  const invisible = structuredClone(request);
  invisible.plant.observationTicks = [0,1];
  assert.throws(() => design(invisible), /unobservable initial-state subspace/);
});

test('a historical plan replays byte-for-byte with its original source and digest', async () => {
  const bytes = JSON.stringify(request);
  assert.deepEqual(replay(request, old), old);
  const fresh = await sealActivePlan(bytes);
  const {createHash} = await import('node:crypto');
  const digest = createHash('sha256').update(JSON.stringify(old)).digest('hex');
  const saved = {...old, sourceSHA256: fresh.sourceSHA256, planSHA256: digest};
  const restored = await sealActivePlan(bytes, {prior: saved});
  assert.equal(restored.planSHA256, digest);
  assert.deepEqual(restored.initialStateEliminator, old.initialStateEliminator);
  assert.notEqual(digest, fresh.planSHA256);
  const changed = {...old, forcedResponseGain: '2'};
  assert.throws(() => replay(request, changed), /does not match frozen plan/);
});
