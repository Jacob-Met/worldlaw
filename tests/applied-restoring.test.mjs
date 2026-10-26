import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeAppliedRestoring,exportAppliedRestoring,reopenAppliedRestoring,RESTORING_FAMILIES} from '../src/trajectory/applied-restoring.mjs';
import {appliedRestoringExample} from '../src/trajectory/applied-restoring-example.mjs';
import {identifyAppliedTorque} from '../src/trajectory/applied-torque.mjs';

const decision=r=>({status:r.status,preferredId:r.preferredId,proposedId:r.proposedId,competitiveIds:r.competitiveIds,withinToleranceIds:r.withinToleranceIds,ranking:r.ranking,
 candidates:r.candidates.map(({challenges,...candidate})=>candidate)});

test('training-prefix proposal finds a nonlinear restoring family and executes separately without expert term selection',()=>{
 for(const family of ['gravity','cubic','linear']){
  const source=appliedRestoringExample({family,noise:.001}),original=JSON.stringify(source),result=proposeAppliedRestoring(source),selected=result.candidates.find(c=>c.id===result.proposedId);
  assert.equal(result.status,'proposed');assert.equal(result.proposedId,family);assert.equal(result.candidates.length,3);assert.ok(selected.finalFit.candidate);
  assert.ok(Math.abs(selected.finalFit.candidate.inertia-.7)<.003);assert.ok(Math.abs(selected.finalFit.candidate.damping-.19)<.005);
  assert.ok(selected.challenges.every(c=>c.status==='screened'));assert.ok(selected.challenges[0].rollout.metrics.positionRMSE<.005);
  if(family!=='linear')assert.ok(selected.challenges[0].rollout.metrics.positionRMSE<result.candidates.find(c=>c.id==='linear').challenges[0].rollout.metrics.positionRMSE/20);
  assert.equal(JSON.stringify(source),original);
 }
});

test('the retained full linear fit exactly agrees with the maintained original instrument',()=>{
 const source=appliedRestoringExample({noise:.001}),baseline=identifyAppliedTorque(source),linear=proposeAppliedRestoring(source).candidates.find(c=>c.id==='linear');
 assert.equal(linear.finalFit.candidate.inertia,baseline.candidate.inertia);assert.equal(linear.finalFit.candidate.damping,baseline.candidate.damping);
 assert.equal(linear.finalFit.candidate.restoring[0].coefficient,baseline.candidate.stiffness);
 assert.deepEqual(linear.challenges[0].rollout.rows,baseline.challenges[0].rollout.rows);
});

test('small-angle ambiguity and an omitted restoring law cannot report a unique qualified proposal',()=>{
 const small=proposeAppliedRestoring(appliedRestoringExample({amplitude:.03,noise:.001}));assert.equal(small.status,'ambiguous');assert.equal(small.proposedId,null);assert.ok(small.competitiveIds.includes('linear'));assert.ok(small.competitiveIds.includes('gravity'));
 const omitted=proposeAppliedRestoring(appliedRestoringExample({family:'quintic',noise:.001}));assert.equal(omitted.status,'no_family_within_declared_tolerance');assert.equal(omitted.proposedId,null);assert.equal(omitted.withinToleranceIds.length,0);assert.equal(omitted.candidates.length,3);
});

test('separate challenge outcomes and challenge work failure cannot choose or revoke training proposals',()=>{
 const source=appliedRestoringExample(),baseline=proposeAppliedRestoring(source),changed=structuredClone(source);
 changed.challengeRuns[0].samples.forEach((row,i)=>row.position+=.1*Math.sin(i*.03));
 const other=proposeAppliedRestoring(changed);assert.deepEqual(decision(other),decision(baseline));assert.notEqual(other.candidates[1].challenges[0].rollout.metrics.positionRMSE,baseline.candidates[1].challenges[0].rollout.metrics.positionRMSE);
 const limited=proposeAppliedRestoring(source,{maxTotalSteps:baseline.reservation.training.steps});assert.deepEqual(decision(limited),decision(baseline));assert.equal(limited.reservation.challengeStatus,'work_refused');assert.ok(limited.candidates.every(c=>c.challenges.every(r=>r.status==='work_refused')));
});

test('held training-tail changes cannot enter prefix coefficients and the cutoff retains original indices',()=>{
 const source=appliedRestoringExample(),baseline=proposeAppliedRestoring(source),cut=baseline.partitions[0].prefixCount,changed=structuredClone(source);
 changed.trainingRuns[0].samples[cut].position+=.1;const other=proposeAppliedRestoring(changed);
 assert.deepEqual(other.candidates.map(c=>c.initialFit),baseline.candidates.map(c=>c.initialFit));
 assert.equal(baseline.partitions[0].fitThrough,source.trainingRuns[0].samples[cut-1].time);assert.equal(baseline.partitions[0].validationFrom,source.trainingRuns[0].samples[cut].time);
 assert.ok(baseline.weakWindows.prefix[0].windows.every(window=>window.lastIndex<cut));
 assert.equal(baseline.validationCount,source.trainingRuns[0].samples.length-cut);
});

test('source-only notebooks preserve explicit choices, recompute answers and refuse stale or invalid declarations',()=>{
 const result=proposeAppliedRestoring(appliedRestoringExample()),text=exportAppliedRestoring(result,{acceptedId:'gravity'}),raw=JSON.parse(text);
 assert.equal(raw.candidates,undefined);assert.equal(raw.source.trainingRuns[0].inertia,null);raw.proposedId='linear';raw.answer={inertia:99};
 const reopened=reopenAppliedRestoring(JSON.stringify(raw));assert.deepEqual(reopened.proposal,result);assert.equal(reopened.acceptedId,'gravity');
 raw.acceptedId='invented';assert.throws(()=>reopenAppliedRestoring(JSON.stringify(raw)),/choice/);
 assert.throws(()=>reopenAppliedRestoring('é'.repeat(1500001)),/3 MB/);
 assert.throws(()=>exportAppliedRestoring(result,{acceptedId:'invented'}),/family/);
});

test('complete work and numerical refusals never report a fallback or partial winning family',()=>{
 const source=appliedRestoringExample();assert.throws(()=>proposeAppliedRestoring(source,{maxTotalSteps:1}),/no partial catalog/);
 for(const options of [{trainingFraction:.99},{positionTolerance:0},{ambiguityDelta:Infinity},{maxNumericalDifference:-1},{maxStep:0}])assert.throws(()=>proposeAppliedRestoring(source,options));
 const strict=proposeAppliedRestoring(source,{maxNumericalDifference:0});assert.equal(strict.status,'no_complete_family');assert.equal(strict.proposedId,null);assert.equal(strict.candidates.length,3);
 assert.ok(strict.candidates.some(c=>c.validation.some(r=>r.status==='numerically_unresolved')));
});

test('rank deficiency and nonphysical fitted inertia stay visible across the complete catalog',()=>{
 const source=appliedRestoringExample();for(const run of source.trainingRuns)for(const row of run.samples){row.position=.2;row.appliedTorque=1;}
 const flat=proposeAppliedRestoring(source);assert.equal(flat.status,'no_complete_family');assert.ok(flat.candidates.every(c=>c.initialFit.status==='unidentifiable'));assert.equal(flat.candidates.length,RESTORING_FAMILIES.length);
 const reversed=appliedRestoringExample();for(const run of reversed.trainingRuns)for(const row of run.samples)row.appliedTorque=-row.appliedTorque;
 const negative=proposeAppliedRestoring(reversed);assert.equal(negative.status,'no_complete_family');assert.ok(negative.candidates.every(c=>!c.finalFit.candidate));
});

 test('a partially unresolved catalog cannot promote its surviving family as an automatic proposal',()=>{
 const source=appliedRestoringExample(),baseline=proposeAppliedRestoring(source),differences=baseline.candidates.map(c=>Math.max(...c.validation.map(v=>v.resolution.positionRMSEDifference))).sort((a,b)=>a-b);
 assert.ok(differences[2]>differences[0]);
 const result=proposeAppliedRestoring(source,{maxNumericalDifference:(differences[0]+differences[2])/2});
 assert.equal(result.status,'incomplete_comparison');assert.equal(result.proposedId,null);assert.ok(result.ranking.length>0&&result.ranking.length<3);assert.equal(result.candidates.length,3);
 });

 test('an outside-tolerance simpler family cannot displace the only qualified nonlinear alternative',()=>{
 const source=appliedRestoringExample({family:'cubic',amplitude:.2}),first=proposeAppliedRestoring(source),tolerance=first.candidates[0].validationRMSE*.999;
 const result=proposeAppliedRestoring(source,{positionTolerance:tolerance});assert.deepEqual(result.withinToleranceIds,['cubic']);assert.equal(result.status,'proposed');assert.equal(result.proposedId,'cubic');assert.equal(result.candidates[0].withinTolerance,false);
 });
