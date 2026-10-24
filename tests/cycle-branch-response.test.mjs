import test from 'node:test';import assert from 'node:assert/strict';
import {freezeBranchResponses,reopenBranchResponses,exportBranchResponses,importBranchResponses,normalizeBranchRequest} from '../src/cycle-work/branch-response.mjs';
import {branchResponseExample,receiveAuthoredBranch} from '../src/cycle-work/branch-response-example.mjs';
test('complete normalized notebook size is admitted transactionally and compact export reopens',()=>{
 const seed=branchResponseExample();
 function rec(id,bias,n){
  const r=structuredClone(seed.request.training[0]);r.id=id;r.cycle.source='source'.repeat(333);
  const x=Array.from({length:n},(_,i)=>2*i/(n-1)),angles=[...x,...x.toReversed()];r.branches=angles.map((_,i)=>i<n?1:-1);
  r.cycle.samples=angles.map((position,i)=>({position,jointTorque:.3123456789012345-1.234567890123456*position+r.branches[i]*(.2345678901234567+.1234567890123456*position)+bias,torqueRadius:.002123456789012345}));return r;
 }
 function notebook(n){const request=normalizeBranchRequest({...seed.request,training:[rec('t1',0,n),rec('t2',.001,n)]});return {schema:seed.schema,request,acquisition:{request,assumption:'separately-acquired-cycle-not-used-for-fitting',records:[rec('r1',.0001,n),rec('r2',.0002,n)]}};}
 assert.throws(()=>reopenBranchResponses(notebook(2048)),/Complete normalized.*2 MB/);
 const accepted=reopenBranchResponses(notebook(1024)),text=exportBranchResponses(accepted.bundle);
 assert.ok(new TextEncoder().encode(text).byteLength<2000000);assert.ok(new TextEncoder().encode(JSON.stringify(accepted.bundle,null,2)).byteLength>2000000);
 assert.deepEqual(importBranchResponses(text).bundle,accepted.bundle);
});
test('maintained QR separates three declared response families and retains per-cycle failures',()=>{
 const r=reopenBranchResponses(branchResponseExample()),models=r.frozen.models;
 assert.deepEqual(models.map(m=>m.status),['incompatible','incompatible','compatible']);
 for(const m of models)assert.equal(m.training.length,2);
 models[2].coefficients.forEach((c,i)=>assert.ok(Math.abs(c-[.3,-1.2,.2,.1][i])<1e-12));
});
test('different-grid receiving transfers unchanged model; equal work does not conceal response drift',()=>{
 const raw=branchResponseExample(),match=reopenBranchResponses(receiveAuthoredBranch(raw)),drift=reopenBranchResponses(receiveAuthoredBranch(raw,'branch',true));
 assert.deepEqual(match.frozen,drift.frozen);assert.equal(match.receiving[2].cycles[0].status,'compatible');assert.equal(drift.receiving[2].cycles[0].status,'incompatible');
 const a=match.receiving[2].cycles[0],b=drift.receiving[2].cycles[0];assert.ok(Math.abs(a.work.observed.work-b.work.observed.work)<1e-12);assert.ok(b.rmse>.4);
});
test('position-only ambiguity and omitted nonlinear response retain every family',()=>{
 const staticModels=reopenBranchResponses(branchResponseExample('position')).frozen.models;assert.ok(staticModels.every(m=>m.status==='compatible'));
 const omitted=reopenBranchResponses(branchResponseExample('omitted')).frozen.models;assert.ok(omitted.every(m=>m.status==='incompatible'));assert.equal(omitted.length,3);
});
test('invalid branch identities and hidden reversals refuse before fitting',()=>{
 const raw=branchResponseExample();raw.request.training[0].branches[2]=-1;assert.throws(()=>freezeBranchResponses(raw.request),/contiguous/);
 const other=branchResponseExample();other.request.training[0].cycle.samples[2].position=.1;assert.throws(()=>freezeBranchResponses(other.request),/reversal/);
 const moved=branchResponseExample();moved.request.training[0].cycle.samples[5].position=1.9;assert.throws(()=>freezeBranchResponses(moved.request),/same angle/);
});
test('receiving request, identity and copied observations remain bound to frozen inputs',()=>{
 const raw=receiveAuthoredBranch(branchResponseExample());const stale=JSON.parse(JSON.stringify(raw));stale.request.settings.receivingRmsTolerance=.1;assert.throws(()=>reopenBranchResponses(stale),/stale/);
 const copied=structuredClone(raw);copied.acquisition.records=[{...copied.request.training[0],id:'new-id'}];assert.throws(()=>reopenBranchResponses(copied),/identical/);
 raw.acquisition.records[0].id='training-one';assert.throws(()=>reopenBranchResponses(raw),/duplicates training/);
});
test('outside-range rows remain scored without being qualified as transfer',()=>{
 const raw=receiveAuthoredBranch(branchResponseExample());for(const row of raw.acquisition.records[0].cycle.samples)row.position*=2;
 const r=reopenBranchResponses(raw);assert.ok(r.receiving.every(m=>m.cycles[0].status==='outside-training-range'));assert.ok(r.receiving[2].cycles[0].outsideTrainingRows>0);assert.equal(r.receiving[2].cycles[0].rows.length,10);
});
test('near-common-offset rank failures remain in population and replay ignores saved verdicts',()=>{
 const raw=branchResponseExample();for(const rec of raw.request.training)for(const row of rec.cycle.samples)row.position=999999+row.position*1e-9;
 const r=reopenBranchResponses(raw);assert.ok(r.frozen.models.some(m=>m.status==='rank-deficient'));assert.equal(r.frozen.models.length,3);
 const input=receiveAuthoredBranch(branchResponseExample()),before=JSON.stringify(input);const out=reopenBranchResponses(input);assert.equal(JSON.stringify(input),before);
 const replay=importBranchResponses(JSON.stringify({...out.bundle,frozen:{models:[]},receiving:[{status:'forged'}]}));assert.deepEqual(replay.frozen,out.frozen);assert.deepEqual(importBranchResponses(exportBranchResponses(input)).bundle,out.bundle);
});
test('each training cycle keeps its own gate despite unequal row populations',()=>{
 const raw=branchResponseExample();raw.request.training[1].cycle.samples.forEach(r=>r.jointTorque+=.5);const r=reopenBranchResponses(raw);
 assert.ok(r.frozen.models.every(m=>m.training.some(c=>c.status==='incompatible')));assert.ok(r.frozen.models.every(m=>m.status==='incompatible'));
 assert.throws(()=>normalizeBranchRequest({...raw.request,settings:{...raw.request.settings,trainingRmsTolerance:'0.1'}}),/Declare finite/);
});
