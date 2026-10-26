import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCoulombContact} from '../src/trajectory/coulomb-contact.mjs';

// Exact branch is independent of the maintained RK4 implementation; use it
// to isolate contact-event detection rather than conflating RK4 truncation.
const omega=10,friction=10;
function branch(q,v,t,sign) {
 const equilibrium=-friction*sign/(omega*omega),phase=omega*t;
 return {position:equilibrium+(q-equilibrium)*Math.cos(phase)+v/omega*Math.sin(phase),
   rate:-(q-equilibrium)*omega*Math.sin(phase)+v*Math.cos(phase)};
}
function contactCourse(divisions) {
 let position=1,rate=0,events=0,held=0;
 const duration=.7/divisions;
 for(let i=0;i<divisions;i++) {
  const result=advanceCoulombContact({position,rate,duration,friction,drive:q=>-omega*omega*q,
   advance:branch,fail:(message,code)=>{const error=new Error(message);error.code=code;throw error;}});
  position=result.position;rate=result.rate;events+=result.events;held+=result.held;
 }
 return {position,rate,events,held};
}
test('an exact branch detects an internal reversal with unchanged endpoint sign',()=>{
 const single=contactCourse(1),reference=contactCourse(10);
 assert.equal(single.events,2,'both physical velocity zeros should trigger a direction update');
 assert.equal(reference.events,2);
 assert.ok(Math.abs(single.position-reference.position)<1e-11);
 assert.ok(Math.abs(single.rate-reference.rate)<1e-11);
 assert.ok(Math.abs(single.position-0.4769511271716544)<1e-11);
});
test('monotonic sliding keeps the exact original endpoint, with counted midpoint work',()=>{
 let evaluations=0;
 const result=advanceCoulombContact({position:0,rate:1,duration:.2,friction:.5,drive:()=>2,
  advance:(q,v,t,sign)=>{evaluations++;const a=2-.5*sign;return {position:q+v*t+a*t*t/2,rate:v+a*t}},
  fail:(message)=>{throw Error(message)}});
 assert.equal(result.position,.23);
 assert.equal(result.rate,1.3);
 assert.equal(result.events,0);
 assert.equal(evaluations,2);
});
test('a midpoint probe must spend the same bounded solver evaluation budget',()=>{
 let evaluations=0;
 const limit=1;
 assert.throws(()=>advanceCoulombContact({position:0,rate:1,duration:.2,friction:.5,drive:()=>2,
  advance:(q,v,t,sign)=>{if(evaluations++>=limit){const error=new Error('evaluation budget exhausted');error.code='step_limit';throw error;}
   const a=2-.5*sign;return {position:q+v*t+a*t*t/2,rate:v+a*t}},
  fail:(message)=>{throw Error(message)}}),e=>e.code==='step_limit');
 assert.equal(evaluations,2);
});

// The actual product RK4 consumer can also return its original endpoint sign
// after missing intervening zero crossings. It must route through the new
// probe, while a finer course still exposes substantial coarse-step error.
test('the maintained forward consumer detects hidden reversals without claiming convergence',async()=>{
 const {rollout}=await import('../src/trajectory/forward.mjs');
 const run={id:'internal-event',label:'Authored internal crossing',kind:'synthetic',source:{label:'authored mathematical control'},
  inertia:1,initialRate:1,samples:[{time:0,position:1,command:0},{time:.7,position:0,command:0}]};
 const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:-100},{id:'coulomb',coefficient:-10}]};
 const coarse=rollout(model,run,{maxStep:.35,maxSteps:10000,coulombContact:true});
 const finer=rollout(model,run,{maxStep:.01,maxSteps:10000,coulombContact:true});
 assert.equal(coarse.diagnostics.coulombContact.zeroRateEvents,3);
 assert.equal(finer.diagnostics.coulombContact.zeroRateEvents,3);
 assert.ok(Math.abs(coarse.rows.at(-1).predicted-finer.rows.at(-1).predicted)>.1,
  'observing events does not certify the coarse RK4 position');
});
