import test from 'node:test';import assert from 'node:assert/strict';
import {screenReleaseDiscretization as run} from '../src/science/release-discretization.mjs';
import {screenReleaseResolution as toleranceOnly} from '../src/science/release-resolution.mjs';
import {saveReleaseInvestigation,reopenReleaseInvestigation} from '../src/science/release-investigation.mjs';
import {createSession} from '../src/session.mjs';
const law=terms=>({schema:'worldlaw.torque-model/v1',terms}),scales={positionScale:1,rateScale:1},coulomb={competitive:[law([{id:'coulomb',coefficient:-1}])]};
test('fixed Coulomb stopping actually changes under refined steps, unlike tolerance-only declarations',()=>{
 const initial={position:0,rate:.2},delta={position:0,rate:.01},settings={duration:.6,dt:.1};
 assert.equal(toleranceOnly(coulomb,initial,delta,settings,scales,.01).status,'not-assessed');
 const r=run(coulomb,initial,delta,settings,scales,.01);assert.equal(r.status,'numerically-sensitive');assert.ok(r.maximumDifference>2);assert.equal(r.assessment[0].stepRefinement,true);assert.equal(r.assessment[0].toleranceRefinement,false);
 // Independent physical stopping solution q=v0^2/2 at t>.21; positive finite gain=(.21^2-.2^2)/(.02).
 const exact=(.21**2-.2**2)/.02,coarse=r.original.results[0].samples.at(-1).positive,fine=r.refined.results[0].samples.at(-1).positive;
 assert.ok(Math.abs(fine-exact)<Math.abs(coarse-exact));assert.ok(Math.abs(fine-exact)>.01,'This course still does not establish convergence');
 const reserved=[r.original,r.refined].flatMap(x=>[x.baseline,x.positive,x.negative]).reduce((n,x)=>n+x.work.totalReservedEvaluations,0);assert.equal(reserved,456);assert.ok(reserved<=r.maxTotalEvaluations);
});
test('resolved fixed acceleration and dyadic refinement retain every exact original/partial terminal time',()=>{
 for(const [duration,dt]of [[.07,.01],[.14,.01],[.071,.01],[.3,.1],[.30000000000000004,.1]]){
  const r=run(coulomb,{position:0,rate:2},{position:0,rate:.01},{duration,dt},scales,1e-8);assert.equal(r.status,'within-declared-difference');
  assert.deepEqual(r.matchedRefined[0].samples.map(x=>x.time),r.original.results[0].samples.map(x=>x.time));assert.equal(r.matchedRefined[0].samples.at(-1).time,duration);
  for(const row of r.matchedRefined[0].samples)assert.ok(Math.abs(row.positive-Math.hypot(row.time,1))<1e-10);
 }
});
test('refused laws and fine-grid capacity remain incomplete, without survivor summary',()=>{
 const broken={competitive:[...coulomb.competitive,law([{id:'unsupported',coefficient:1}])]};
 const r=run(broken,{position:0,rate:2},{position:0,rate:.01},{duration:.1,dt:.01},scales,.01);assert.equal(r.status,'incomplete');assert.equal(r.maximumDifference,undefined);assert.equal(r.original.baseline.results.length,2);assert.equal(r.refined.baseline.results.length,2);
 const exhausted=run(coulomb,{position:0,rate:2},{position:0,rate:.01},{duration:10,dt:.002},scales,.01);assert.equal(exhausted.status,'incomplete');assert.equal(exhausted.refined.status,'incomplete');assert.equal(exhausted.maximumDifference,undefined);
});
test('typed v2 refinement source replays, while v1 cannot smuggle the new mode',async()=>{
 const state=createSession(Array.from({length:32},(_,i)=>{const position=((i*17)%37-18)/20,rate=((i*13)%31-15)/20,command=((i*7)%29-14)/20;return{position,rate,command,jointTorque:command-.5*Math.sign(rate)};}));
 const q={initial:{position:.8,rate:.2},settings:{duration:.3,dt:.1,inertia:1,command:0,relativeTolerance:1e-8,positionTolerance:1e-10,rateTolerance:1e-10,maxTrials:50000},displacement:{position:0,rate:.01},scales,screen:true,allowance:.01,eventIndex:null,refinement:'step-and-tolerances'};
 const text=await saveReleaseInvestigation(state,q),raw=JSON.parse(text),opened=await reopenReleaseInvestigation(text);assert.equal(raw.schema,'worldlaw.release-investigation/v2');assert.equal(opened.screened.refinementFactor,4);assert.deepEqual(opened.question,q);
 raw.schema='worldlaw.release-investigation/v1';await assert.rejects(reopenReleaseInvestigation(JSON.stringify(raw)),/fields/);raw.schema='worldlaw.release-investigation/v2';raw.question.refinement='invented';await assert.rejects(reopenReleaseInvestigation(JSON.stringify(raw)),/method/);
 const old={...q};delete old.refinement;assert.equal(JSON.parse(await saveReleaseInvestigation(state,old)).schema,'worldlaw.release-investigation/v1');
});
test('unrepresentable dyadic refinement refuses instead of claiming a different factor',()=>{assert.throws(()=>run(coulomb,{position:0,rate:1},{position:0,rate:.01},{duration:24*Number.MIN_VALUE,dt:6*Number.MIN_VALUE},scales,.01),/not representable/);});
