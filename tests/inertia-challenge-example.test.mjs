import test from 'node:test';
import assert from 'node:assert/strict';
import {createInertiaChallengeExample} from '../src/coupling/inertia-challenge-example.mjs';
import {challengeInertia,readInertiaChallenge,exportInertiaChallenge} from '../src/coupling/inertia-challenge.mjs';

test('authored changed motion separates unchanged physics from a missing-force inertia alias',()=>{
 const positive=createInertiaChallengeExample(),negative=createInertiaChallengeExample({omittedForce:true}),original=JSON.stringify(negative);
 const p=challengeInertia(positive.training,positive.challenge,positive.settings),n=challengeInertia(negative.training,negative.challenge,negative.settings);
 assert.equal(p.primary.status,'within_declared_tolerance');assert.ok(p.primary.rmseNm<1e-6);
 assert.equal(n.primary.status,'exceeds_declared_tolerance');assert.ok(Math.abs(n.primary.rmseNm-.8141494179519615)<1e-10);
 assert.ok(Math.abs(n.coefficients[0]-1.5)<1e-6);assert.ok(Math.abs(n.coefficients[2]-1.3)<1e-6);
 assert.ok(n.training.primary.meanTorqueBalanceRmse<1e-7);
 assert.equal(n.diagnostics.challengeFitted,false);assert.equal(JSON.stringify(negative),original);
 assert.deepEqual(readInertiaChallenge(exportInertiaChallenge(negative.training,negative.challenge,negative.settings)),negative);
});
