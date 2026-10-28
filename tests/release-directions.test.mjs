import test from 'node:test';
import assert from 'node:assert/strict';
import {investigateReleaseDirections as run} from '../src/science/release-directions.mjs';
const model=terms=>({schema:'worldlaw.torque-model/v1',terms});
const zero={position:0,rate:0}, scales={positionScale:2,rateScale:3};
test('free rotor has independently derived unequal directional gains',()=>{
 const d={competitive:[model([])]},before=JSON.stringify(d);
 const r=run(d,zero,{position:.2,rate:0},{dt:.05,duration:1},scales);
 assert.equal(r.status,'release-direction-sensitive');assert.equal(JSON.stringify(d),before);
 for(const s of r.courses[0].results[0].samples)for(const side of ['positive','negative'])assert.ok(Math.abs(s[side]-1)<1e-12);
 for(const s of r.courses[1].results[0].samples)for(const side of ['positive','negative'])assert.ok(Math.abs(s[side]-Math.hypot(1,1.5*s.time))<1e-12);
 assert.ok(Math.abs(r.maximumDifference-(Math.hypot(1,1.5)-1))<1e-12);
 const actual=r.courses.flatMap(c=>[c.baseline,c.positive,c.negative]).reduce((n,c)=>n+c.results.reduce((a,b)=>a+b.trajectory.length,0),0);assert.equal(r.requestedSamples,actual);
});
test('matched harmonic scales preserve direction-independent norm; distinct laws remain distinct',()=>{
 const r=run({competitive:[model([]),model([{id:'spring',coefficient:-2.25}])]},zero,{position:.2,rate:0},{dt:.02,duration:1},scales);
 assert.equal(r.laws.length,2);assert.ok(r.laws[0].maximumDifference>.8);assert.ok(r.laws[1].maximumDifference<1e-6);
 for(const c of r.courses)for(const row of c.results)for(const side of ['positive','negative'])assert.equal(row.samples[0][side],1);
});
test('whole-set failures, preflight and represented direction refusals cannot yield a verdict',()=>{
 const d={competitive:[model([]),model([{id:'bad',coefficient:1}])]},settings={dt:.1,duration:.2};
 const r=run(d,zero,{position:.1,rate:0},settings,scales);assert.equal(r.status,'incomplete');assert.deepEqual(r.laws,[]);assert.equal(r.maximumDifference,undefined);
 for(const c of r.courses)assert.equal(c.baseline.results.length,2);
 const limited=run({competitive:[model([])]},zero,{position:.1,rate:0},{dt:.0001,duration:1},scales);assert.equal(limited.status,'work-limit');assert.deepEqual(limited.courses,[]);
 assert.throws(()=>run(d,{position:1,rate:1},{position:Number.MIN_VALUE,rate:0},settings,scales),/representable/);
 assert.throws(()=>run(d,zero,{position:1,rate:0},settings,{positionScale:Number.MIN_VALUE,rateScale:1}),/representable/);
});

test('typed v5 recomputes both directions from original notebook and rejects mode/result injection',async()=>{
 const {createSession,exportSession}=await import('../src/session.mjs');const {saveReleaseInvestigation,reopenReleaseInvestigation}=await import('../src/science/release-investigation.mjs');
 const state=createSession(Array.from({length:32},(_,i)=>{const position=((i*17)%37-18)/20,rate=((i*13)%31-15)/20,command=((i*7)%29-14)/20;return {position,rate,command,jointTorque:command-4*position-.3*rate};}));
 const q={initial:{position:.8,rate:0},settings:{duration:.14,dt:.02,inertia:1,command:0,relativeTolerance:1e-8,positionTolerance:1e-10,rateTolerance:1e-10,maxTrials:50000},displacement:{position:.01,rate:0},scales,screen:true,allowance:.01,eventIndex:null,refinement:'release-directions'};
 const text=await saveReleaseInvestigation(state,q),raw=JSON.parse(text),opened=await reopenReleaseInvestigation(text);assert.equal(raw.schema,'worldlaw.release-investigation/v5');assert.equal(exportSession(opened.state),exportSession(state));assert.deepEqual(opened.question,q);assert.deepEqual(opened.screened,run(opened.state.discovery,q.initial,q.displacement,q.settings,q.scales,{allowance:.01}));
 for(const mutate of [x=>x.results=[],x=>x.question.levels=3,x=>x.question.shrinkFactor=4,x=>x.question.screen=false,x=>x.schema='worldlaw.release-investigation/v3',x=>x.question.settings.result={}]){const changed=structuredClone(raw);mutate(changed);await assert.rejects(reopenReleaseInvestigation(JSON.stringify(changed)));}
 await assert.rejects(saveReleaseInvestigation(state,{...q,initial:{position:0,rate:1},displacement:{position:1e-17,rate:0}}),/unresolved/);
});
