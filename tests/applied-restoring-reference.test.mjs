import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeAppliedRestoring,proposeAppliedRestoringReference,exportAppliedRestoringReference,reopenAppliedRestoringReference,exportAppliedRestoring,reopenAppliedRestoring} from '../src/trajectory/applied-restoring.mjs';
import {appliedRestoringReferenceExample} from '../src/trajectory/applied-restoring-example.mjs';
const phase=result=>result.candidates.find(c=>c.id==='gravity-reference');
const frozen=result=>({status:result.status,preferredId:result.preferredId,proposedId:result.proposedId,competitiveIds:result.competitiveIds,withinToleranceIds:result.withinToleranceIds,ranking:result.ranking,candidates:result.candidates.map(({challenges,...c})=>c)});

test('unknown reference restores a conditional forecast while retaining original failed alternatives and original coordinates',()=>{
 const source=appliedRestoringReferenceExample({noise:.001}),snapshot=structuredClone(source),old=proposeAppliedRestoring(source),result=proposeAppliedRestoringReference(source),c=phase(result);
 assert.equal(old.status,'no_family_within_declared_tolerance');assert.equal(result.status,'proposed');assert.equal(result.proposedId,'gravity-reference');assert.equal(result.candidates.length,5);
 assert.deepEqual(result.candidates.slice(0,3),old.candidates);assert.deepEqual(source,snapshot);assert.deepEqual(result.source,old.source);
 assert.ok(Math.abs(c.finalFit.candidate.inertia-.7)<.002);assert.ok(Math.abs(c.finalFit.candidate.reference.position-.25)<.001);assert.ok(c.challenges[0].rollout.metrics.positionRMSE<.002);
 assert.ok(result.candidates.find(c=>c.id==='linear-reference').challenges[0].rollout.metrics.positionRMSE>.1);
});

test('sinusoidal coefficients and predictions transform with original angle datum including full-turn periodicity',()=>{
 const baseline=phase(proposeAppliedRestoringReference(appliedRestoringReferenceExample({datumShift:0,noise:.001})));
 for(const datumShift of [-1,.25,.6,1,2*Math.PI]){
  const result=proposeAppliedRestoringReference(appliedRestoringReferenceExample({datumShift,noise:.001})),c=phase(result),reference=c.finalFit.candidate.reference;
  assert.ok(Math.abs(c.finalFit.candidate.inertia-baseline.finalFit.candidate.inertia)<1e-10);assert.ok(Math.abs(c.validationRMSE-baseline.validationRMSE)<1e-10);
  assert.ok(Math.abs(Math.sin(reference.position-baseline.finalFit.candidate.reference.position-datumShift))<1e-10);assert.ok(reference.position>=-Math.PI&&reference.position<Math.PI);
  assert.equal(reference.period,2*Math.PI);assert.equal(result.candidates.length,5);
  if(result.candidates.some(c=>c.status!=='complete'))assert.equal(result.proposedId,null);
 }
});

test('small-angle reference families stay competitive and larger shifted linear motion retains its simpler law',()=>{
 for(const amplitude of [.1,.03]){
  const r=proposeAppliedRestoringReference(appliedRestoringReferenceExample({amplitude,noise:.001}));assert.equal(r.proposedId,null);assert.ok(r.competitiveIds.includes('linear-reference'));assert.ok(r.competitiveIds.includes('gravity-reference'));
 }
 const linear=proposeAppliedRestoringReference(appliedRestoringReferenceExample({family:'linear',noise:.001}));assert.equal(linear.preferredId,'linear-reference');assert.equal(linear.proposedId,null);assert.equal(linear.status,'incomplete_comparison');assert.ok(Math.abs(linear.candidates[3].finalFit.candidate.reference.position-.25)<.001);
});

test('separate challenge observations or denied challenge work cannot enter five-family inference',()=>{
 const source=appliedRestoringReferenceExample({noise:.001}),base=proposeAppliedRestoringReference(source),changed=structuredClone(source);
 changed.challengeRuns[0].samples.forEach((r,i)=>r.position+=Math.sin(i*.03));const other=proposeAppliedRestoringReference(changed);assert.deepEqual(frozen(other),frozen(base));assert.notEqual(phase(other).challenges[0].rollout.metrics.positionRMSE,phase(base).challenges[0].rollout.metrics.positionRMSE);
 const limited=proposeAppliedRestoringReference(source,{maxTotalSteps:base.reservation.training.steps});assert.deepEqual(frozen(limited),frozen(base));assert.equal(limited.reservation.challengeStatus,'work_refused');
 const old=proposeAppliedRestoring(source);assert.ok(base.reservation.training.steps>old.reservation.training.steps);assert.throws(()=>proposeAppliedRestoringReference(source,{maxTotalSteps:old.reservation.training.steps}),/no partial catalog/);
});

test('a wrong constant torque zero can move the inferred reference while retaining low motion error',()=>{
 const source=appliedRestoringReferenceExample({amplitude:.03,noise:.001}),original=phase(proposeAppliedRestoringReference(source));
 for(const run of [...source.trainingRuns,...source.challengeRuns])for(const row of run.samples)row.appliedTorque+=.1;
 const wrong=phase(proposeAppliedRestoringReference(source));assert.ok(Math.abs(wrong.finalFit.candidate.reference.position-original.finalFit.candidate.reference.position)>.02);assert.ok(wrong.challenges[0].rollout.metrics.positionRMSE<.001);
 assert.match(wrong.finalFit.candidate.reference.meaning,/Neither identifies an authenticated physical reference/);
});

test('explicit versioned reference notebook retains source and choice only, and legacy notebooks retain three-family interpretation',()=>{
 const source=appliedRestoringReferenceExample({noise:.001}),r=proposeAppliedRestoringReference(source),text=exportAppliedRestoringReference(r,{acceptedId:'gravity-reference'}),raw=JSON.parse(text);
 assert.equal(raw.candidates,undefined);raw.reference=123;raw.proposedId='linear';const back=reopenAppliedRestoringReference(JSON.stringify(raw));assert.deepEqual(back.proposal,r);assert.equal(back.acceptedId,'gravity-reference');
 assert.throws(()=>reopenAppliedRestoring(text),/original-input restoring notebook/);const original=proposeAppliedRestoring(source),legacy=exportAppliedRestoring(original);assert.throws(()=>reopenAppliedRestoringReference(legacy),/restoring-reference notebook/);assert.equal(reopenAppliedRestoring(legacy).proposal.candidates.length,3);
 assert.throws(()=>exportAppliedRestoringReference(original),/explicit restoring-reference/);raw.acceptedId='made-up';assert.throws(()=>reopenAppliedRestoringReference(JSON.stringify(raw)),/choice/);
});

test('flat evidence and numerical failure cannot supply an automatic reference or remove failed families',()=>{
 const source=appliedRestoringReferenceExample();for(const run of source.trainingRuns)for(const row of run.samples){row.position=.25;row.appliedTorque=0;}
 const flat=proposeAppliedRestoringReference(source);assert.equal(flat.proposedId,null);assert.equal(flat.candidates.length,5);assert.ok(flat.candidates.every(c=>c.finalFit.candidate===null));
 const strict=proposeAppliedRestoringReference(appliedRestoringReferenceExample({noise:.001}),{maxNumericalDifference:0});assert.equal(strict.proposedId,null);assert.equal(strict.candidates.length,5);
});

test('zero-restoring motion does not identify a physical phase from tiny fitted coefficients',()=>{
 const phases=[];
 for(const noise of [0,.001]){
  const source=appliedRestoringReferenceExample({noise:0});
  for(const run of [...source.trainingRuns,...source.challengeRuns])for(const row of run.samples){row.appliedTorque-=3.4*Math.sin(row.position-.25);row.position+=noise*Math.sin(27*row.time);}
  const result=proposeAppliedRestoringReference(source),candidate=phase(result).finalFit.candidate;
  assert.equal(result.proposedId,null);assert.ok(candidate.reference.gain<.001);phases.push(candidate.reference.position);
 }
 assert.ok(Math.abs(phases[1]-phases[0])>.3);
});
