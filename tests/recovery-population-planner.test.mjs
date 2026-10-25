import test from 'node:test';import assert from 'node:assert/strict';
import {planRecoveryPopulation,receiveRecoveryPopulation,exportRecoveryPopulationPlan,importRecoveryPopulationPlan} from '../src/unknown-lab/recovery-population-planner.mjs';
import {recoverySupportExample} from '../src/unknown-lab/recovery-support-example.mjs';
import {compareRecoveryTransport,RECOVERY_TRANSPORT_SCHEMA} from '../src/unknown-lab/recovery-transport.mjs';
const settings={delays:[0,.5,1,2,3,4,6,8,12],contrastRadius:.1,pairs:128,overheadPerPair:.5,budgetSeconds:4000};
function source(){const study=recoverySupportExample();study.challenges=[];return {schema:RECOVERY_TRANSPORT_SCHEMA,study,settings:{referenceRecordingId:'early',sensitivity:{command:0,position:0,rate:1}}};}
function acquired(raw,plan,index=0,target=true){
 let s=93811+7919*index;const noise=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return .001*Math.sqrt(12)*((s+.5)/4294967296-.5);};
 const trials=raw.study.training[target?0:1].evidence.trials.map(t=>({...t,pairId:'fresh-'+t.pairId,sampleIndex:t.sampleIndex+1000,jointTorque:.2+(t.history==='conditioned'?t.rate:0)+noise()}));
 return {recordingId:'fresh-'+index,protocolId:raw.study.protocolId,delaySeconds:plan.decision.selected.delaySeconds,evidence:{schema:'worldlaw.history-challenge/v1',source:'synthetic',sourceNote:'Independent held-back noise; authored persistent contrast equals rate.',noiseSigma:.001,trials}};
}
test('maintained policy freezes target and wait; 40 independently sampled courses check observed precision',()=>{
 const raw=source(),plan=planRecoveryPopulation(raw,settings),frozen=compareRecoveryTransport(raw).comparison.fit;
 assert.equal(plan.decision.selected.delaySeconds,1);assert.equal(plan.decision.selected.separated,4);assert.equal(plan.target.length,128);
 for(let i=0;i<20;i++)for(const target of [true,false]){
  const received=receiveRecoveryPopulation(raw,plan,acquired(raw,plan,i,target));
  assert.equal(received.acquisition.qualified,target);assert.deepEqual(received.report.comparison.fit,frozen);
  const survivors=received.report.comparison.tests.filter(t=>t.status==='compatible').map(t=>t.id);
  if(target)assert.deepEqual(survivors,['persistent']);else {assert.equal(survivors.length,4);assert.ok(received.acquisition.observedRadius>.75);}
 }
 assert.equal(raw.study.challenges.length,0);
});
test('requested precision never replaces observed width, even on exact target',()=>{
 const raw=source(),plan=planRecoveryPopulation(raw,{...settings,contrastRadius:.03});
 assert.equal(plan.decision.selected.separated,6);
 const received=receiveRecoveryPopulation(raw,plan,acquired(raw,plan));
 assert.equal(received.acquisition.qualified,false);assert.ok(received.acquisition.observedRadius>.08);
 assert.deepEqual(received.acquisition.reasons,['observed_combined_screen_exceeds_planned_radius']);
 assert.equal(received.input.study.challenges.length,1);
});
test('training-only source request replays without cached conclusions or challenge access',()=>{
 const raw=source(),plan=planRecoveryPopulation(raw,settings);raw.study.challenges=[{unreadable:true}];
 assert.deepEqual(planRecoveryPopulation(raw,settings),plan);
 const saved=JSON.parse(exportRecoveryPopulationPlan(raw,settings));saved.target=[];saved.decision={selected:{delaySeconds:60}};
 assert.deepEqual(importRecoveryPopulationPlan(JSON.stringify(saved)),plan);
});
test('changed original source, reference, sensitivities, settings or target refuse stale request',()=>{
 const raw=source(),plan=planRecoveryPopulation(raw,settings),r=acquired(raw,plan);
 for(const change of [n=>n.study.training[0].evidence.trials[0].jointTorque+=.01,n=>n.settings.sensitivity.rate=.9,n=>n.settings.referenceRecordingId='late']){
  const n=structuredClone(raw);change(n);assert.throws(()=>receiveRecoveryPopulation(n,plan,r),/stale/);
 }
 const forged=structuredClone(plan);forged.target[0].rate+=1;assert.throws(()=>receiveRecoveryPopulation(raw,forged,r),/stale/);
 assert.throws(()=>receiveRecoveryPopulation(raw,plan,r,{...settings,contrastRadius:.2}),/stale/);
 assert.throws(()=>receiveRecoveryPopulation(raw,plan,{...r,delaySeconds:60}),/match/);
});
test('unavailable received population remains original evidence with no partial qualification',()=>{
 const raw=source(),plan=planRecoveryPopulation(raw,settings),r=acquired(raw,plan);
 r.evidence.trials=r.evidence.trials.slice(0,-2);
 const result=receiveRecoveryPopulation(raw,plan,r);
 assert.equal(result.acquisition.qualified,false);assert.equal(result.acquisition.observedRadius,null);
 assert.ok(result.acquisition.reasons.includes('population_comparison_unavailable'));
 assert.equal(result.input.study.challenges.length,1);assert.equal(result.report.comparison.tests.find(t=>t.id==='persistent').status,'incomplete');
});
test('no-separation budget, wrong counts and malformed source-only requests refuse',()=>{
 const raw=source(),plan=planRecoveryPopulation(raw,{...settings,budgetSeconds:0});assert.equal(plan.decision.selected,null);
 assert.throws(()=>receiveRecoveryPopulation(raw,plan,{}),/No informative/);
 assert.throws(()=>planRecoveryPopulation(raw,{...settings,pairs:64}),/match the frozen/);
 for(const text of ['{}','null','x',' '.repeat(2100001)])assert.throws(()=>importRecoveryPopulationPlan(text));
});
