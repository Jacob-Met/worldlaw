import test from 'node:test';import assert from 'node:assert/strict';
import {investigateReleasePeaks as investigate} from '../src/science/release-peak-resolution.mjs';
import {screenReleaseDiscretization} from '../src/science/release-discretization.mjs';
const model=terms=>({schema:'worldlaw.torque-model/v1',terms}),scales={positionScale:1,rateScale:1};
test('additional executed grids reveal oscillatory peaks hidden by exact-time agreement',()=>{
 const omega=2*Math.PI/.1,d={competitive:[model([{id:'spring',coefficient:-omega*omega}])]},initial={position:0,rate:0},delta={position:.001,rate:0},settings={duration:.4,dt:.1};
 assert.equal(screenReleaseDiscretization(d,initial,delta,settings,scales,.01).status,'within-declared-difference');
 const r=investigate(d,initial,delta,settings,scales);assert.equal(r.status,'sampled-peak-sensitive');assert.equal(r.courses.length,3);assert.ok(r.maximumSharedDifference<.01);assert.ok(r.maximumPeakDifference>60);
 assert.ok(Math.abs(r.courses[2].results[0].maximumAmplification-omega)<1e-6);assert.equal(r.courses[0].results[0].maximumAmplification,1);
 const reserved=r.courses.flatMap(c=>[c.baseline,c.positive,c.negative]).reduce((n,c)=>n+c.work.totalReservedEvaluations,0);assert.ok(reserved<=240000);assert.ok(r.requestedSamples<=20000);
});
test('resolved zero torque has identical finite-release gain and preserves all sources',()=>{const d={competitive:[model([])]},i={position:1,rate:0},delta={position:1.5e-16,rate:0},settings={duration:.071,dt:.01},before=JSON.stringify({d,i,delta,settings,scales});const r=investigate(d,i,delta,settings,scales,{levels:4,allowance:0});assert.equal(r.status,'within-declared-differences');for(const c of r.courses)assert.equal(c.results[0].maximumAmplification,1);assert.equal(JSON.stringify({d,i,delta,settings,scales}),before);});
test('complete sample admission and failed laws cannot produce a peak-resolution verdict',()=>{const d={competitive:[model([])]};const limited=investigate(d,{position:0,rate:0},{position:.001,rate:0},{duration:1,dt:.001},scales);assert.equal(limited.status,'work-limit');assert.deepEqual(limited.courses,[]);const invalid=investigate({competitive:[model([]),model([{id:'invalid',coefficient:1}])]},{position:0,rate:0},{position:.001,rate:0},{duration:.1,dt:.01},scales);assert.equal(invalid.status,'incomplete');assert.equal(invalid.courses.length,3);assert.deepEqual(invalid.transitions,[]);assert.equal(invalid.maximumPeakDifference,undefined);});

test('typed v3 reopens exact selected grid count and recomputes original source, without changing v1/v2',async()=>{
 const {createSession,exportSession}=await import('../src/session.mjs');
 const {saveReleaseInvestigation:save,reopenReleaseInvestigation:open}=await import('../src/science/release-investigation.mjs');
 const state=createSession(Array.from({length:32},(_,i)=>{const position=((i*17)%37-18)/20,rate=((i*13)%31-15)/20,command=((i*7)%29-14)/20;return {position,rate,command,jointTorque:command-4*position-.3*rate};}));
 const q={initial:{position:.8,rate:0},settings:{duration:.071,dt:.01,inertia:1,command:0,relativeTolerance:1e-8,positionTolerance:1e-10,rateTolerance:1e-10,maxTrials:50000},displacement:{position:.001,rate:0},scales:{positionScale:1,rateScale:10},screen:true,allowance:.01,eventIndex:null,refinement:'peak-grids',levels:2};
 for(const levels of [2,3,4]){const question={...q,levels},text=await save(state,question),raw=JSON.parse(text),reopened=await open(text);assert.equal(raw.schema,'worldlaw.release-investigation/v3');assert.equal(exportSession(reopened.state),exportSession(state));assert.deepEqual(reopened.question,question);assert.deepEqual(reopened.screened,investigate(state.discovery,q.initial,q.displacement,q.settings,q.scales,{levels,allowance:q.allowance}));assert.equal(reopened.screened.courses.length,levels);assert.equal(await save(reopened.state,reopened.question),text);}
 const raw=JSON.parse(await save(state,q));for(const mutate of [r=>r.question.levels=5,r=>r.question.levels=2.5,r=>r.question.results=[],r=>r.question.refinement='step-and-tolerances',r=>r.schema='worldlaw.release-investigation/v2',r=>r.notebook.base.observations[0].jointTorque++]){const changed=structuredClone(raw);mutate(changed);await assert.rejects(open(JSON.stringify(changed)));}
 const oversized={...q,settings:{...q.settings,duration:10}};await assert.rejects(open(await save(state,oversized)),/complete peak-grid/);
 const plain={...q};delete plain.levels;delete plain.refinement;assert.equal(JSON.parse(await save(state,plain)).schema,'worldlaw.release-investigation/v1');assert.equal(JSON.parse(await save(state,{...plain,refinement:'step-and-tolerances'})).schema,'worldlaw.release-investigation/v2');
});
