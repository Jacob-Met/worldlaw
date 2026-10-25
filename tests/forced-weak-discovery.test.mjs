import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
const units={time:'s',position:'rad',command:'N·m',inertia:'kg·m²',initialRate:'rad/s'};
const run=(inertia=3,irregular=false)=>({id:`forced-${inertia}`,kind:'synthetic',units,inertia,initialRate:4,source:{label:'independent authored constant acceleration'},samples:Array.from({length:1001},(_,i)=>{const time=i*.01+(irregular&&i>0?.001*Math.sin(i):0);return {time,position:2+4*time+3/inertia*time*time,command:2};})});
const options={terms:['command'],maxTerms:1,noiseSigma:1e-8};
test('one physical gain is recovered across distinct inertias and irregular clocks',()=>{
 const result=discoverWeak([run(3),run(5,true)],options);
 assert.equal(result.selected.id,'command');assert.ok(Math.abs(result.selected.terms[0].coefficient-3)<1e-5);
 assert.equal(result.trainingRuns.length,2);
});
test('changing declared initial rate cannot change fits or source-derived domain',()=>{
 const original=run(); const changed=structuredClone(original);changed.initialRate=99;
 assert.deepEqual(discoverWeak([original],options).candidates,discoverWeak([changed],options).candidates);
});
test('omitted forcing and rank failure stay visible',()=>{
 const source=run();source.samples.forEach(row=>row.command=0);
 const result=discoverWeak([source],options);
 assert.equal(result.selected.id,'zero');assert.equal(result.diagnostics.rankDeficientCandidates,1);
 assert.equal(result.diagnostics.adequacy,'residual_mismatch');
});
test('all source rows are admitted and invalid clocks/inertia/settings refuse',()=>{
 for(const edit of [r=>r.inertia=0,r=>r.samples[10].time=r.samples[9].time,r=>r.samples[4].command=NaN]){
  const source=run();edit(source);assert.throws(()=>discoverWeak([source],options));
 }
 assert.throws(()=>discoverWeak([run()],{...options,windowDuration:.01}));
 assert.throws(()=>discoverWeak([run()],{...options,terms:['unknown_interaction']}));
 assert.throws(()=>discoverWeak([run(),run()],options));
});
test('left-held forcing agrees across discontinuities and ignores final endpoint command',()=>{
 const source=run();let position=2,rate=4;
 source.samples=Array.from({length:1001},(_,i)=>{
  const time=i*.01,command=Math.floor(i/73)%2?-.7:2.3;
  const row={time,position,command};position+=rate*.01+.5*command*.01**2;rate+=command*.01;return row;
 });
 // acceleration=command, inertia=3 => physical command coefficient=3.
 const original=discoverWeak([source],options);
 assert.ok(Math.abs(original.selected.terms[0].coefficient-3)<.001);
 source.samples.at(-1).command=1e5;
 assert.deepEqual(discoverWeak([source],options).selected.terms,original.selected.terms);
});
test('actual challenge consumer preserves training fit and input-only weak replay',async()=>{
 const {createChallenge,exportChallenge,restoreChallenge}=await import('../src/trajectory/session.mjs');
 const training=run(),challenge=run();challenge.id='separate';challenge.initialRate=-1;
 challenge.samples=challenge.samples.map(r=>({...r,position:1-r.time+r.time*r.time}));
 const bundle={schema:'worldlaw.trajectory-bundle/v1',units,trainingRuns:[training],challengeRuns:[challenge]};
 const state=createChallenge(bundle,{method:'weak',maxTerms:1,noiseSigma:1e-8,modelLimit:1});
 assert.equal(state.discovery.selected.id,'command');
 assert.ok(state.summary.selectedPositionRMSE<1e-5);
 const reopened=restoreChallenge(exportChallenge(state));
 assert.deepEqual(reopened.discovery.selected,state.discovery.selected);
 const changed=structuredClone(bundle);changed.challengeRuns[0].samples[100].position+=1;
 assert.deepEqual(createChallenge(changed,state.options).discovery.selected,state.discovery.selected);
});
test('forced mixed-frequency trace identifies damping and spring with converging held-command discretization',()=>{
 const fitAt=step=>{
  const source={...run(),samples:Array.from({length:Math.floor(8/step)+1},(_,i)=>{
   const t=i*step,q=Math.sin(t)+.2*Math.cos(2*t),v=Math.cos(t)-.4*Math.sin(2*t),a=-Math.sin(t)-.8*Math.cos(2*t);
   return {time:t,position:q,command:3*a+.6*v+2*q};
  })};
  const result=discoverWeak([source],{terms:['command','rate','spring'],maxTerms:3,noiseSigma:1e-8,windowDuration:.8,windowStride:.4});
  return result.candidates.find(c=>c.id==='command+rate+spring').terms.map(t=>t.coefficient);
 };
 const coarse=fitAt(.008),fine=fitAt(.002),truth=[1,-.6,-2];
 const error=v=>Math.hypot(...v.map((x,i)=>x-truth[i]));
 assert.ok(error(fine)<error(coarse)/2);
 assert.ok(error(fine)<.02);
});

