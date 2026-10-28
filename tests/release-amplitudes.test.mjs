import test from 'node:test';import assert from 'node:assert/strict';
import {investigateReleaseAmplitudes as run} from '../src/science/release-amplitudes.mjs';
const model=terms=>({schema:'worldlaw.torque-model/v1',terms}),scales={positionScale:1,rateScale:1},initial={position:0,rate:0};
test('linear zero and spring laws preserve normalized finite-release response',()=>{
 for(const terms of [[],[{id:'spring',coefficient:-4}]]){const d={competitive:[model(terms)]},before=JSON.stringify(d);const r=run(d,initial,{position:.1,rate:.1},{dt:.01,duration:1},scales);
 assert.equal(r.status,'within-declared-difference');assert.ok(r.maximumDifference<1e-6);assert.equal(JSON.stringify(d),before);for(const c of r.courses)assert.equal(c.results[0].samples[0].positive,1);}
});
test('same-settings nonlinear gravity courses expose finite-amplitude dependence with independent reducer',()=>{
 const r=run({competitive:[model([{id:'gravity',coefficient:-4}])] },initial,{position:2,rate:0},{dt:.01,duration:2},scales,{shrinkFactor:4,allowance:.01});
 assert.equal(r.status,'release-magnitude-sensitive');assert.ok(r.maximumDifference>.1);
 let maximum=0;for(let i=0;i<r.courses[0].results[0].samples.length;i++)for(const side of ['positive','negative'])maximum=Math.max(maximum,Math.abs(r.courses[0].results[0].samples[i][side]-r.courses[1].results[0].samples[i][side]));assert.equal(maximum,r.maximumDifference);
 const samples=r.courses.flatMap(c=>[c.baseline,c.positive,c.negative]).reduce((n,c)=>n+c.results.reduce((v,r)=>v+r.trajectory.length,0),0);assert.equal(samples,r.requestedSamples);
});
test('whole-set work and failures cannot produce a magnitude verdict; unresolved shrink refuses',()=>{
 const good=model([]),bad=model([{id:'unknown',coefficient:1}]);
 const r=run({competitive:[good,bad]},initial,{position:.01,rate:0},{dt:.01,duration:.1},scales);assert.equal(r.status,'incomplete');assert.equal(r.laws.length,0);assert.equal(r.maximumDifference,undefined);for(const c of r.courses)assert.equal(c.baseline.results.length,2);
 const limit=run({competitive:[good]},initial,{position:.01,rate:0},{dt:.0001,duration:1},scales);assert.equal(limit.status,'work-limit');assert.equal(limit.courses.length,0);
 assert.throws(()=>run({competitive:[good]},initial,{position:Number.MIN_VALUE,rate:0},{},scales),/representable/);
 assert.throws(()=>run({competitive:[good]},{position:1,rate:0},{position:2e-16,rate:0},{dt:.01,duration:.1},scales),/representable/);
});
test('quadratic drag matches an independent finite-amplitude solution on both sides',()=>{
 const r=run({competitive:[model([{id:'quadratic',coefficient:-1}])]},initial,{position:0,rate:1},{dt:.025,duration:1},scales,{shrinkFactor:2,allowance:.001});
 assert.equal(r.status,'release-magnitude-sensitive');
 for(let j=0;j<2;j++){const v=1/(2**j);for(const s of r.courses[j].results[0].samples){const exact=Math.hypot(Math.log1p(v*s.time)/v,1/(1+v*s.time));for(const side of ['positive','negative'])assert.ok(Math.abs(s[side]-exact)<2e-7,JSON.stringify({j,time:s.time,side,actual:s[side],exact}));}}
});
test('typed v4 recomputes both magnitudes from original notebook and rejects mode/result injection',async()=>{
 const {createSession,exportSession}=await import('../src/session.mjs');const {saveReleaseInvestigation,reopenReleaseInvestigation}=await import('../src/science/release-investigation.mjs');
 const state=createSession(Array.from({length:32},(_,i)=>{const position=((i*17)%37-18)/20,rate=((i*13)%31-15)/20,command=((i*7)%29-14)/20;return {position,rate,command,jointTorque:command-4*position-.3*rate};}));
 const q={initial:{position:.8,rate:0},settings:{duration:.14,dt:.02,inertia:1,command:0,relativeTolerance:1e-8,positionTolerance:1e-10,rateTolerance:1e-10,maxTrials:50000},displacement:{position:.01,rate:0},scales,screen:true,allowance:.01,eventIndex:null,refinement:'release-magnitudes',shrinkFactor:4};
 const text=await saveReleaseInvestigation(state,q),raw=JSON.parse(text),opened=await reopenReleaseInvestigation(text);assert.equal(raw.schema,'worldlaw.release-investigation/v4');assert.equal(exportSession(opened.state),exportSession(state));assert.deepEqual(opened.question,q);assert.deepEqual(opened.screened,run(opened.state.discovery,q.initial,q.displacement,q.settings,q.scales,{shrinkFactor:4,allowance:.01}));
 for(const mutate of [x=>x.results=[],x=>x.question.levels=3,x=>x.question.shrinkFactor=3,x=>x.question.screen=false,x=>x.schema='worldlaw.release-investigation/v3',x=>x.question.settings.result={}]){const changed=structuredClone(raw);mutate(changed);await assert.rejects(reopenReleaseInvestigation(JSON.stringify(changed)));}
 await assert.rejects(saveReleaseInvestigation(state,{...q,initial:{position:1,rate:0},displacement:{position:2e-16,rate:0}}),/unresolved/);
});
