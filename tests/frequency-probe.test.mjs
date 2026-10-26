import test from 'node:test';import assert from 'node:assert/strict';
import {discoverAngularFrequency} from '../src/science/angular-frequency.mjs';
import {createSession,appendMeasurements,restoreSession,exportSession} from '../src/session.mjs';
import {compareFrequencyOffers} from '../src/science/frequency-probe.mjs';
const training=Array.from({length:61},(_,i)=>({position:(i-30)*Math.PI,command:0,rate:0,jointTorque:Math.sin(.3*(i-30)*Math.PI)}));
const settings={min:.1,max:4.1,points:81,noiseSigma:.0001,nuisance:[]};
const offers=[Math.PI/4,Math.PI/2,31*Math.PI].map(position=>({position,command:0,rate:0}));
test('permitted off-grid observation breaks sampled aliases through maintained acquisition and replay',()=>{
  const session=createSession({schema:'worldlaw.observations/v2',observations:training,offeredInputs:offers});
  const profile=discoverAngularFrequency(session.discovery.observations,settings),plan=compareFrequencyOffers(profile,session.base.offeredInputs);
  assert.equal(plan.status,'proposed');assert.ok(plan.selected.spread>1);assert.notEqual(plan.selected.sourceIndex,2);
  const grid=offers[2],gridSession=appendMeasurements(session,[{...grid,jointTorque:Math.sin(.3*grid.position)}]);
  assert.equal(discoverAngularFrequency(gridSession.discovery.observations,settings).competitiveFrequencies.length,4,'Same-budget grid observation leaves aliases.');
  const input=plan.selected.input,next=appendMeasurements(session,[{...input,jointTorque:Math.sin(.3*input.position)}]);
  assert.equal(next.discovery.observations.length,62);assert.equal(next.events.length,1);
  const revised=discoverAngularFrequency(next.discovery.observations,settings);assert.deepEqual(revised.competitiveFrequencies,[.3]);
  const reopened=restoreSession(exportSession(next));assert.deepEqual(discoverAngularFrequency(reopened.discovery.observations,settings),revised);
});
test('complete offers retain indices and never accept a future reading',()=>{
  const profile=discoverAngularFrequency(training,settings),copy=JSON.stringify(profile);
  const plan=compareFrequencyOffers(profile,[{command:0,rate:0,position:0},...offers]);assert.equal(plan.outcomes[0].previouslyObserved,true);assert.equal(plan.outcomes[1].sourceIndex,1);assert.equal(JSON.stringify(profile),copy);
  assert.equal(compareFrequencyOffers(profile,[]).status,'no_unobserved_offers');
  assert.throws(()=>compareFrequencyOffers(profile,[{...offers[0],jointTorque:0}]),/future torque/);
  assert.throws(()=>compareFrequencyOffers(profile,offers,{maxWork:1}),/budget/);
  const grid=compareFrequencyOffers(profile,[offers[2]]);assert.equal(grid.status,'uninformative');
});

test('failed offered law family cannot become a successful probe recommendation',()=>{const wrong=training.map(r=>({...r,jointTorque:r.position**2}));const fit=discoverAngularFrequency(wrong,settings);assert.equal(fit.status,'residual_mismatch');const result=compareFrequencyOffers(fit,offers);assert.equal(result.status,'unsupported_training');assert.equal(result.selected,null);});
test('a wrong separately entered response is retained as a failed revision, not a manufactured gain',()=>{
  const session=createSession({schema:'worldlaw.observations/v2',observations:training,offeredInputs:offers});
  const before=discoverAngularFrequency(session.discovery.observations,settings),proposal=compareFrequencyOffers(before,offers);
  const input=proposal.selected.input,next=appendMeasurements(session,[{...input,jointTorque:4}]);
  const after=discoverAngularFrequency(next.discovery.observations,settings);
  assert.equal(after.status,'residual_mismatch');assert.equal(next.events[0].rows[0].jointTorque,4);
  assert.equal(compareFrequencyOffers(after,offers).status,'unsupported_training');
});
