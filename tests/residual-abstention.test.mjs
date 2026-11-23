import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidualCalibration,assessResidual,residualScore} from '../src/trajectory/residual-abstention.mjs';

const policyId = 'same-frozen-acquisition-fitting-and-stopping-policy';
function reference(n) {
  return {policyId, alpha:0.1, maxRounds:2, roundScoresByWorld:
    Array.from({length:n},(_,i)=>({worldId:'world-'+i,scores:[i,20-i]}))};
}
function assess(cal,round,score) { return assessResidual(cal,{policyId,round,score}); }

test('minimum RMS retains every rival, validates and excludes the imposed initial sample',()=>{
  const r = residualScore([[100,6,8],[-100,0,0]],[0,0,0],2);
  assert.equal(r.rowsUsed,2);
  assert.equal(r.score,0);
  assert.ok(Math.abs(r.candidateScores[0]-Math.sqrt(12.5))<1e-12);
  assert.equal(r.candidateScores[1],0);
  assert.deepEqual(residualScore([[2,1e300,1e300]], [0,0,0],1).candidateScores,[1e300]);
  for(const invalid of [[[0,0,0],[0,0]], [[0,0,0],[NaN,0,0]], [[0,0,0],[0,,0]], []]){
    assert.throws(()=>residualScore(invalid,[0,0,0],1));
  }
  assert.throws(()=>residualScore([[0,0]],[NaN,0],1));
  assert.throws(()=>residualScore([[0,0]],[0,0],0));
});

test('round-specific conservative rank includes ties; two-look corrected threshold and exact resolution',()=>{
  const raw=reference(19), c=createResidualCalibration(raw);
  raw.roundScoresByWorld[18].scores[0]=100; // copied before the test world arrives
  assert.equal(assess(c,1,19).n,19);
  assert.equal(assess(c,1,19).threshold,0.05);
  assert.equal(assess(c,1,19).p,0.05);
  assert.equal(assess(c,1,19).status,'abstain');
  assert.equal(assess(c,1,18).p,0.1); // largest calibration score ties target
  assert.equal(assess(c,1,18).status,'not_rejected');
  assert.equal(assess(c,2,19).atLeast,2);
  assert.equal(assess(c,2,19).p,3/20);
  const small=createResidualCalibration(reference(18));
  assert.equal(assess(small,1,10000).status,'insufficient_calibration');
  assert.equal(assess(small,1,0).status,'insufficient_calibration');
});

test('reject policy mismatch, invalid round, overlapping IDs, partial references and scores',()=>{
  const raw=reference(19), c=createResidualCalibration(raw);
  assert.deepEqual(assess(JSON.parse(JSON.stringify(c)),2,19),assess(c,2,19));
  assert.throws(()=>assessResidual(c,{policyId:'another',round:1,score:1}));
  assert.throws(()=>assessResidual(c,{policyId,round:1,score:1,worldId:'world-4'}));
  for (const r of [0,3,1.5]) assert.throws(()=>assess(c,r,1));
  for (const s of [-1,Infinity,NaN]) assert.throws(()=>assess(c,1,s));
  for (const mutation of [rows=>{rows[0]=rows[1];}, rows=>{rows[0].scores.pop();},
      rows=>{rows[0].scores[1]=NaN;}, rows=>{delete rows[0].scores[1];}]) {
    const data=structuredClone(raw);
    mutation(data.roundScoresByWorld);
    assert.throws(()=>createResidualCalibration(data));
  }
});
