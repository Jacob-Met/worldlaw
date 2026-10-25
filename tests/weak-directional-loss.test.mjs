import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';

function course(id,initialRate,dt=.005){
 const k=initialRate>0?.37:-.13;
 return {id,label:id,kind:'synthetic',source:{label:'analytic directional quadratic decay'},units:RUN_UNITS,inertia:1,initialRate,
  samples:Array.from({length:Math.round(6/dt)+1},(_,i)=>{const time=i*dt;return {time,position:.1+Math.log1p(k*initialRate*time)/k,command:0};})};
}
const options={terms:['quadratic','rate_squared'],maxTerms:2,noiseSigma:1e-8,windowDuration:.3,windowStride:.15};
test('both velocity directions identify unequal quadratic losses and predict different releases',()=>{
 const fit=discoverWeak([course('positive',1.8),course('negative',-2.1)],options);
 const coefficients=Object.fromEntries(fit.selected.terms.map(t=>[t.id,t.coefficient]));
 assert.ok(Math.abs(coefficients.quadratic+.25)<.0001);
 assert.ok(Math.abs(coefficients.rate_squared+.12)<.0001);
 const baseline=discoverWeak([course('positive',1.8),course('negative',-2.1)],{...options,terms:['quadratic'],maxTerms:1});
 for(const velocity of [1.1,-1.3]){
  const challenge=course('heldback'+velocity,velocity);
  const received=rollout(fit.selected,challenge,{maxStep:.0025});
  const wrong=rollout(baseline.selected,challenge,{maxStep:.0025});
  assert.ok(received.metrics.positionRMSE<.001);
  assert.ok(wrong.metrics.positionRMSE>received.metrics.positionRMSE*100);
 }
});
test('one velocity sign cannot separate odd and even quadratic terms',()=>{
 for(const velocity of [1.8,-2.1]){
  const fit=discoverWeak([course('one-direction',velocity)],options);
  assert.equal(fit.diagnostics.fullLibraryRank,1);
  assert.equal(fit.diagnostics.identifiability,'insufficient_excitation');
  assert.ok(fit.diagnostics.rankDeficientCandidates>0);
 }
});

import {createChallenge,exportChallenge,restoreChallenge} from '../src/trajectory/session.mjs';
import {investigateRateDissipation} from '../src/science/rate-dissipation.mjs';
test('actual consumer predicts, reopens v3 and refuses legacy power certification',()=>{
 const bundle={schema:'worldlaw.trajectory-bundle/v1',units:RUN_UNITS,trainingRuns:[course('fit-positive',1.8),course('fit-negative',-2.1)],challengeRuns:[course('receive',-1.3)]};
 const state=createChallenge(bundle,{method:'weak',directionalQuadraticLoss:true,maxTerms:2,noiseSigma:1e-8,windowDuration:.3,windowStride:.15,modelLimit:1,maxStep:.005});
 assert.ok(state.discovery.selected.terms.some(t=>t.id==='rate_squared'));
 assert.ok(state.summary.selectedPositionRMSE<.001);
 const saved=exportChallenge(state);assert.equal(JSON.parse(saved).schema,'worldlaw.trajectory-notebook/v3');
 assert.deepEqual(restoreChallenge(saved),state);
 assert.throws(()=>investigateRateDissipation(state.discovery.selected,3));
 const downgraded=JSON.parse(saved);downgraded.schema='worldlaw.trajectory-notebook/v1';assert.throws(()=>restoreChallenge(JSON.stringify(downgraded)),/version 3/);
});

import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
test('unimplemented integral route refuses the new feature rather than fitting a zero column',()=>{
 assert.throws(()=>discoverIntegral([course('source',1.8)],options),/requires weak fitting/);
});
test('initial-rate declarations and future receiving positions cannot tune the directional law',()=>{
 const training=[course('fit-positive',1.8),course('fit-negative',-2.1)];
 const fitted=discoverWeak(training,options),changed=structuredClone(training);changed[0].initialRate=99;changed[1].initialRate=-77;
 assert.deepEqual(discoverWeak(changed,options).selected,fitted.selected);
 const challenge=course('received',-1.3),before=rollout(fitted.selected,challenge,{maxStep:.005});challenge.samples[100].position+=1;
 const after=rollout(fitted.selected,challenge,{maxStep:.005});
 assert.deepEqual(after.rows.map(r=>r.predicted),before.rows.map(r=>r.predicted));
 assert.notEqual(after.metrics.positionRMSE,before.metrics.positionRMSE);
});

test('an omitted cubic rate response remains a failed finite-family explanation',()=>{
 const cubic=(id,v)=>{const source=course(id,v);source.samples=source.samples.map(row=>({...row,position:.1+(Math.sqrt(1+.6*v*v*row.time)-1)/(.3*v)}));return source;};
 const fit=discoverWeak([cubic('cubic-positive',1.8),cubic('cubic-negative',-2.1)],options);
 assert.equal(fit.diagnostics.adequacy,'residual_mismatch');
 const received=rollout(fit.selected,cubic('cubic-receive',.7),{maxStep:.0025});
 assert.ok(received.metrics.positionRMSE>.01);
});

import {inspectInputEnclosures} from '../src/science/input-enclosure.mjs';
test('shared input enclosure binds squared rate to rate and encloses zero crossings',()=>{
 const model={schema:'worldlaw.torque-model/v1',terms:[{id:'rate_squared',coefficient:1}]};
 for(const [rate,radius,expected] of [[2,0,[4,4]],[0,2,[0,4]],[-2,.5,[2.25,6.25]],[2,.5,[2.25,6.25]]]){
  const report=inspectInputEnclosures(model,[{command:0,position:1,rate,jointTorque:rate*rate}],{command:0,position:0,rate:radius,jointTorque:0});
  assert.equal(report.rows[0].status,'not-excluded');
  assert.ok(report.rows[0].prediction[0]<=expected[0]);assert.ok(report.rows[0].prediction[1]>=expected[1]);
 }
 const mixed={schema:'worldlaw.torque-model/v1',terms:[{id:'rate_squared',coefficient:-1},{id:'spring',coefficient:2},{id:'cubic',coefficient:1}]};
 const report=inspectInputEnclosures(mixed,[{command:0,position:1,rate:2,jointTorque:-1}],{command:0,position:.2,rate:.3,jointTorque:0},{refinementSegments:16});
 assert.equal(report.rows[0].status,'not-excluded');assert.equal(report.refinement.status,'joint-position');
 for(const p of [.8,1,1.2])for(const v of [1.7,2,2.3]){const torque=-v*v+2*p+p*p*p;assert.ok(report.rows[0].prediction[0]<=torque&&report.rows[0].prediction[1]>=torque);}
});
