import assert from 'node:assert/strict';
import {proposeAppliedRestoring} from '../src/trajectory/applied-restoring.mjs';
import {appliedRestoringExample} from '../src/trajectory/applied-restoring-example.mjs';
const reports=[];
for(const family of ['linear','gravity','cubic'])for(const seed of [13,293,991]){
 const result=proposeAppliedRestoring(appliedRestoringExample({family,seed,noise:.001}));assert.equal(result.proposedId,family);
 const c=result.candidates.find(c=>c.id===family);reports.push({authoredFamily:family,seed,status:result.status,proposedId:result.proposedId,inertia:c.finalFit.candidate.inertia,damping:c.finalFit.candidate.damping,validationRMSE:c.validationRMSE,challengeRMSE:c.challenges[0].rollout.metrics.positionRMSE,baselineChallengeRMSE:result.candidates[0].challenges[0].rollout.metrics.positionRMSE});
}
const source=appliedRestoringExample({noise:.001}),original=proposeAppliedRestoring(source),changed=structuredClone(source);for(const run of [...changed.trainingRuns,...changed.challengeRuns])for(const row of run.samples)row.appliedTorque*=1.7;
const calibrated=proposeAppliedRestoring(changed),a=original.candidates[1],b=calibrated.candidates[1];assert.equal(calibrated.proposedId,original.proposedId);assert.ok(Math.abs(b.finalFit.candidate.inertia/a.finalFit.candidate.inertia-1.7)<1e-10);assert.ok(Math.abs(a.challenges[0].rollout.metrics.positionRMSE-b.challenges[0].rollout.metrics.positionRMSE)<1e-10);
const ambiguity=proposeAppliedRestoring(appliedRestoringExample({amplitude:.03,noise:.001})),omitted=proposeAppliedRestoring(appliedRestoringExample({family:'quintic',noise:.001}));assert.equal(ambiguity.status,'ambiguous');assert.equal(omitted.status,'no_family_within_declared_tolerance');
console.log(JSON.stringify({schema:'worldlaw.applied-restoring-counterexamples/v1',authoredOnly:true,reports,wrongCalibration:{scale:1.7,originalInertia:a.finalFit.candidate.inertia,changedInertia:b.finalFit.candidate.inertia,originalChallengeRMSE:a.challenges[0].rollout.metrics.positionRMSE,changedChallengeRMSE:b.challenges[0].rollout.metrics.positionRMSE,meaning:'Identical prediction quality cannot authenticate supplied torque calibration.'},smallAngle:{status:ambiguity.status,competitiveIds:ambiguity.competitiveIds},omittedLaw:{status:omitted.status,bestValidationRMSE:Math.min(...omitted.candidates.map(c=>c.validationRMSE??Infinity))}},null,2));
