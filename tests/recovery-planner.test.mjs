import test from 'node:test';import assert from 'node:assert/strict';
import {planRecoveryAcquisition,receiveRecoveryAcquisition,exportRecoveryPlan,importRecoveryPlan} from '../src/unknown-lab/recovery-planner.mjs';
import {recoveryPlanningExample,executeRecoveryCourse} from '../src/unknown-lab/recovery-planning-example.mjs';
import {recoveryRecording,recoveryFixture} from '../src/unknown-lab/recovery-fixture.mjs';
import {exportRecovery,importRecovery} from '../src/unknown-lab/recovery-response.mjs';
import {screenIntervalPairs} from '../src/experiment-design/interval-separation.mjs';
const settings={delays:[.2,.5,1,1.5,2,3,4,6,10,20,60],contrastRadius:.045,pairs:32,overheadPerPair:1,budgetSeconds:500};
test('shared policy picks shortest full separation and independent acquisition discriminates models',()=>{
 const n=recoveryPlanningExample(),before=exportRecovery(n),p=planRecoveryAcquisition(n,settings);
 assert.equal(p.status,'all-pairs-separated');assert.equal(p.selected.delaySeconds,1.5);assert.equal(p.selected.costSeconds,128);
 const a=executeRecoveryCourse(n,p,'decay');assert.equal(a.acquisition.qualified,true);
 assert.deepEqual(a.report.tests.filter(t=>t.status==='compatible').map(t=>t.id),['decay:2']);assert.equal(exportRecovery(n),before);
});
test('budget retains partial/no-separation and every refused offered wait',()=>{
 const n=recoveryPlanningExample(),p=planRecoveryAcquisition(n,{...settings,budgetSeconds:70});assert.equal(p.status,'partial-separation');assert.equal(p.selected.delaySeconds,.5);
 assert.equal(p.candidates.find(c=>c.delaySeconds===1.5).withinBudget,false);
 assert.equal(planRecoveryAcquisition(n,{...settings,budgetSeconds:0}).selected,null);
 assert.equal(planRecoveryAcquisition(n,{...settings,contrastRadius:2}).selected,null);
 assert.equal(planRecoveryAcquisition(recoveryFixture(),settings).status,'unavailable');
});
test('training-only proposal ignores future values and input request replay recomputes outputs',()=>{
 const n=recoveryPlanningExample(),p=planRecoveryAcquisition(n,settings);n.challenges=[{unexpected:'future values must never enter planner'}];assert.deepEqual(planRecoveryAcquisition(n,settings),p);
 assert.deepEqual(importRecoveryPlan(exportRecoveryPlan(n,settings)),p);
 const forged=JSON.parse(exportRecoveryPlan(n,settings));forged.selected={delaySeconds:60};assert.deepEqual(importRecoveryPlan(JSON.stringify(forged)),p);
});
test('changed training, settings or plan output refuse before acquired evidence is admitted',()=>{
 const n=recoveryPlanningExample(),p=planRecoveryAcquisition(n,settings),r=recoveryRecording('decay',3,p.selected.delaySeconds);
 const changed=structuredClone(n);changed.training[0].evidence.trials[0].jointTorque+=.01;
 assert.throws(()=>receiveRecoveryAcquisition(changed,p,r),/stale/);
 assert.throws(()=>receiveRecoveryAcquisition(n,p,r,{...settings,pairs:64}),/stale/);
 const tampered=structuredClone(p);tampered.selected.delaySeconds=60;assert.throws(()=>receiveRecoveryAcquisition(n,tampered,r),/stale/);
 assert.throws(()=>receiveRecoveryAcquisition(n,p,{...r,delaySeconds:60}),/match the selected/);
});
test('actual readout width/count/order failure is retained rather than called successful design',()=>{
 const n=recoveryPlanningExample(),p=planRecoveryAcquisition(n,settings);
 const r=recoveryRecording('decay',3,p.selected.delaySeconds,{count:16,noiseSigma:.3});
 const a=receiveRecoveryAcquisition(n,p,r);assert.equal(a.notebook.challenges.length,1);assert.equal(a.acquisition.qualified,false);assert.ok(a.acquisition.reasons.includes('pair_count_differs'));assert.ok(a.acquisition.reasons.includes('observed_screen_exceeds_planned_radius'));
 const one=structuredClone(r);for(let i=0;i<one.evidence.trials.length;i++)one.evidence.trials[i].sampleIndex=i;
 const b=receiveRecoveryAcquisition(n,p,one);assert.ok(b.acquisition.reasons.includes('measurement_order_unqualified'));
});
test('authored oracle preserves new seeds across reopen; imported evidence cannot guess virtual instrument',()=>{
 const n=recoveryPlanningExample(),p=planRecoveryAcquisition(n,settings),a=executeRecoveryCourse(n,p,'decay');
 const reopened=importRecovery(exportRecovery(a.notebook)),b=executeRecoveryCourse(reopened,p,'decay');assert.equal(b.notebook.challenges.at(-1).recordingId,'virtual-recovery-4');
 const measured=structuredClone(n);measured.source='measured';for(const r of measured.training)r.evidence.source='measured';assert.throws(()=>executeRecoveryCourse(measured,planRecoveryAcquisition(measured,settings),'decay'),/exact authored/);
 const altered=structuredClone(a.notebook);altered.challenges[0].evidence.trials[0].jointTorque+=.1;assert.throws(()=>executeRecoveryCourse(altered,p,'decay'),/no longer reproduce/);
});
test('changed response can favor a different candidate; separation does not identify mechanism',()=>{
 const n=recoveryPlanningExample('mismatch'),p=planRecoveryAcquisition(n,settings),a=executeRecoveryCourse(n,p,'mismatch');
 assert.equal(a.report.tests.find(t=>t.id==='decay:2').status,'challenged');
 assert.deepEqual(a.report.tests.filter(t=>t.status==='compatible').map(t=>t.id),['persistent']);
});
test('shared separation keeps touching/negative intervals and applies two observation radii',()=>{
 const p=screenIntervalPairs([{id:'a',interval:[-2,-1]},{id:'b',interval:[-.8,.3]}],.1);assert.equal(p[0].separable,false);
 assert.equal(screenIntervalPairs([{id:'a',interval:[-2,-1]},{id:'b',interval:[-.79,.3]}],.1)[0].separable,true);
});
test('invalid future acquisition budgets and unbounded grids reject',()=>{
 for(const patch of [{pairs:9},{pairs:6},{contrastRadius:0},{delays:[1,1]},{delays:Array.from({length:33},(_,i)=>i)},{overheadPerPair:-1},{budgetSeconds:Infinity}])assert.throws(()=>planRecoveryAcquisition(recoveryPlanningExample(),{...settings,...patch}));
});
