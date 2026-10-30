import test from 'node:test';import assert from 'node:assert/strict';
import {investigateReleaseSuperposition as run} from '../src/science/release-superposition.mjs';
const model=terms=>({schema:'worldlaw.torque-model/v1',terms}),scales={positionScale:1,rateScale:1},settings={duration:1,dt:.02};
test('affine zero spring drag and bias courses preserve finite superposition',()=>{
 for(const terms of [[],[{id:'spring',coefficient:-4},{id:'rate',coefficient:-.3},{id:'bias',coefficient:.5}]]){
 const d={competitive:[model(terms)]},before=JSON.stringify(d);const r=run(d,{position:.25,rate:.5},{position:.125,rate:.25},settings,scales);
 assert.equal(r.status,'within-declared-interaction');assert.ok(r.maximumInteraction<1e-7);assert.equal(r.laws[0].samples[0].interaction,0);assert.equal(JSON.stringify(d),before);
 }
});
test('quadratic drag matches independently solved mixed rate response',()=>{
 const r=run({competitive:[model([{id:'quadratic',coefficient:-1}])]}, {position:0,rate:0},{position:.5,rate:.5},settings,scales);
 assert.equal(r.status,'finite-superposition-difference');for(const s of r.laws[0].samples){const q=Math.log1p(s.time)-2*Math.log1p(.5*s.time),v=1/(1+s.time)-1/(1+.5*s.time);assert.ok(Math.abs(s.position-q)<2e-7);assert.ok(Math.abs(s.rate-v)<2e-7);}
 const samples=r.courses.reduce((sum,c)=>sum+c.results.reduce((s,l)=>s+l.trajectory.length,0),0);assert.equal(samples,r.requestedSamples);
 assert.ok(r.courses.reduce((s,c)=>s+c.work.totalReservedEvaluations,0)<=240000);
});
test('a nonlinear law can have zero interaction on the chosen directions',()=>{const r=run({competitive:[model([{id:'quadratic',coefficient:-1}])]}, {position:0,rate:0},{position:.5,rate:0},settings,scales);assert.equal(r.status,'within-declared-interaction');assert.ok(r.maximumInteraction<1e-12);});
test('nonlinear gravity differs from affine law while all competitors remain visible',()=>{
 const r=run({competitive:[model([{id:'spring',coefficient:-4}]),model([{id:'gravity',coefficient:-4}])]}, {position:0,rate:0},{position:1,rate:1},settings,scales);
 assert.equal(r.laws.length,2);assert.ok(r.laws[0].maximumInteraction<1e-7);assert.ok(r.laws[1].maximumInteraction>.1);
 const failed=run({competitive:[model([]),model([{id:'unknown',coefficient:1}])]}, {position:0,rate:0},{position:.5,rate:.5},settings,scales);assert.equal(failed.status,'incomplete');assert.deepEqual(failed.laws,[]);assert.equal(failed.maximumInteraction,undefined);for(const c of failed.courses)assert.equal(c.results.length,2);
});
test('complete work preflight and exact represented rectangle protect interpretation',()=>{
 const d={competitive:[model([])]};assert.equal(run(d,{position:0,rate:0},{position:.5,rate:.5},{duration:1,dt:.0001},scales).status,'work-limit');
 assert.throws(()=>run(d,{position:1,rate:1},{position:1e-16,rate:0},settings,scales),/representable/);
 assert.throws(()=>run(d,{position:.1,rate:.1},{position:.2,rate:.3},settings,scales),/close exactly/);
});

test('typed v6 recomputes four releases from original notebook and rejects mode/result injection',async()=>{
 const {createSession,exportSession}=await import('../src/session.mjs');const {saveReleaseInvestigation,reopenReleaseInvestigation}=await import('../src/science/release-investigation.mjs');
 const state=createSession(Array.from({length:32},(_,i)=>{const position=((i*17)%37-18)/20,rate=((i*13)%31-15)/20,command=((i*7)%29-14)/20;return {position,rate,command,jointTorque:command-4*position-.3*rate};}));
 const q={initial:{position:.8,rate:0},settings:{duration:.14,dt:.02,inertia:1,command:0,relativeTolerance:1e-8,positionTolerance:1e-10,rateTolerance:1e-10,maxTrials:50000},displacement:{position:.01,rate:0},scales,screen:true,allowance:.01,eventIndex:null,refinement:'release-superposition'};
 const edge={...q,initial:{position:1000000,rate:0},displacement:{position:-1,rate:0}};assert.equal(JSON.parse(await saveReleaseInvestigation(state,edge)).schema,'worldlaw.release-investigation/v6');await assert.rejects(saveReleaseInvestigation(state,{...edge,refinement:'release-directions'}),/envelope/);
 const text=await saveReleaseInvestigation(state,q),raw=JSON.parse(text),opened=await reopenReleaseInvestigation(text);assert.equal(raw.schema,'worldlaw.release-investigation/v6');assert.equal(opened.result.baseline,opened.screened.courses[0]);assert.equal(exportSession(opened.state),exportSession(state));assert.deepEqual(opened.question,q);assert.deepEqual(opened.screened,run(opened.state.discovery,q.initial,q.displacement,q.settings,q.scales,{allowance:.01}));
 for(const mutate of [x=>x.results=[],x=>x.question.levels=3,x=>x.question.shrinkFactor=4,x=>x.question.screen=false,x=>x.schema='worldlaw.release-investigation/v3',x=>x.question.settings.result={}]){const changed=structuredClone(raw);mutate(changed);await assert.rejects(reopenReleaseInvestigation(JSON.stringify(changed)));}
 await assert.rejects(saveReleaseInvestigation(state,{...q,initial:{position:0,rate:1},displacement:{position:1e-17,rate:0}}),/representable/);
});
