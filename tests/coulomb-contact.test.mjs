import test from 'node:test';
import assert from 'node:assert/strict';
import {rollout} from '../src/trajectory/forward.mjs';
import {rolloutWithResolution} from '../src/trajectory/resolution.mjs';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
import {harmonicRun} from '../experiments/contact-oracle.mjs';
import {createChallenge,exportChallenge,restoreChallenge} from '../src/trajectory/session.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:-4},{id:'coulomb',coefficient:-.6}]};
const motor={schema:'worldlaw.torque-model/v1',terms:[{id:'command',coefficient:1},{id:'coulomb',coefficient:-1}]};
test('independent exact harmonic half-cycles stop without subsequent numerical creep',()=>{
 const run=harmonicRun('oracle',1),contact=rolloutWithResolution(model,run,{coulombContact:true});
 assert.ok(contact.rollout.metrics.positionRMSE<2e-9);
 assert.ok(rollout(model,run).metrics.positionRMSE>.002);
 assert.equal(contact.rollout.rows.at(-1).rate,0);
 assert.equal(contact.rollout.diagnostics.coulombContact.zeroRateEvents,3);
 assert.equal(contact.resolution.status,'compared');
 assert.ok(contact.resolution.positionRMSEDifference<2e-9);
});
test('subthreshold commands hold and original held commands restart in either direction',()=>{
 const run=harmonicRun('driven',0,6);
 for(const row of run.samples)row.command=row.time<1?.5:row.time<2?2:row.time<4?0:row.time<5?-2:.5;
 const actual=rollout(motor,run,{coulombContact:true});
 const exact=t=>t<=1?0:t<=2?(t-1)**2/2:t<=3?.5+(t-2)-(t-2)**2/2:t<=4?1:t<=5?1-(t-4)**2/2:t<=5+2/3?.5-(t-5)+.75*(t-5)**2:1/6;
 for(const row of actual.rows)assert.ok(Math.abs(row.predicted-exact(row.time))<1e-10);
 assert.equal(actual.rows.at(-1).rate,0);
});
test('maintained discovery stays frozen while an independent release receives both hypotheses',()=>{
 const training=[harmonicRun('train-a',1,4),harmonicRun('train-b',-1.3,4)],challenge=harmonicRun('separate',.8);
 const options={terms:['spring','coulomb'],maxTerms:2,noiseSigma:.00001,windowDuration:.3,windowStride:.15};
 const fitted=discoverWeak(training,options),before=JSON.stringify(fitted);
 const contact=rollout(fitted.selected,challenge,{coulombContact:true}),legacy=rollout(fitted.selected,challenge);
 assert.ok(contact.metrics.positionRMSE<.0005);assert.ok(legacy.metrics.positionRMSE>.003);
 assert.equal(fitted.diagnostics.adequacy,'residual_mismatch');
 const changed=structuredClone(challenge);changed.samples.slice(1).forEach(r=>r.position+=.2);
 const received=rollout(fitted.selected,changed,{coulombContact:true});
 assert.deepEqual(received.rows.map(r=>r.predicted),contact.rows.map(r=>r.predicted));assert.equal(JSON.stringify(fitted),before);
});
test('motion staying in one direction has the same smooth dynamics',()=>{
 const run=harmonicRun('sliding',0,.3);run.initialRate=3;
 const smooth={schema:'worldlaw.torque-model/v1',terms:[{id:'coulomb',coefficient:-.2}]};
 assert.deepEqual(rollout(smooth,run).rows,rollout(smooth,run,{coulombContact:true}).rows);
});
test('unsupported coefficient and command-clock combinations refuse the contact interpretation',()=>{
 const run=harmonicRun('input',1);
 assert.throws(()=>rollout({...model,terms:[{id:'coulomb',coefficient:1}]},run,{coulombContact:true}),e=>e.code==='unsupported_contact_model');
 assert.throws(()=>rollout(model,run,{coulombContact:true,commandTiming:{delaySeconds:0}}),e=>e.code==='unsupported_contact_timing');
 assert.throws(()=>rollout(model,run,{coulombContact:'yes'}),e=>e.code==='invalid_options');
});
test('event search work consumes the same bounded solver budget and cannot report partial success',()=>{
 const run=harmonicRun('limited',1,2);
 const full=rollout(model,run,{coulombContact:true});
 assert.ok(full.diagnostics.steps>full.diagnostics.coulombContact.nominalSteps);
 assert.throws(()=>rollout(model,run,{coulombContact:true,maxSteps:full.diagnostics.coulombContact.nominalSteps}),e=>e.code==='step_limit');
 const coarseOnly=rolloutWithResolution(model,run,{coulombContact:true,maxSteps:full.diagnostics.steps});
 assert.equal(coarseOnly.resolution.status,'unavailable');assert.equal(coarseOnly.resolution.reason,'combined_step_budget');
});
test('actual source-only consumer retains ordinary ranking and results beside versioned contact forecasts',()=>{
 const bundle={schema:'worldlaw.trajectory-bundle/v1',units:RUN_UNITS,label:'Independent contact course',trainingRuns:[harmonicRun('a',1,4),harmonicRun('b',-1.3,4)],challengeRuns:[harmonicRun('c',.8)]};
 const options={method:'weak',maxTerms:2,noiseSigma:.00001,windowDuration:.3,windowStride:.15};
 const old=createChallenge(bundle,options),next=createChallenge(bundle,{...options,compareCoulombContact:true});
 assert.deepEqual(old.discovery,next.discovery);assert.deepEqual(old.results,next.results);assert.deepEqual(old.summary,next.summary);
 assert.ok(next.contactResults[0].rollout.metrics.positionRMSE<.0005);
 const saved=exportChallenge(next);assert.equal(JSON.parse(saved).schema,'worldlaw.trajectory-notebook/v4');assert.ok(!saved.includes('contactResults'));
 assert.deepEqual(restoreChallenge(saved),next);
 const bad=JSON.parse(saved);bad.options.compareCoulombContact=false;assert.throws(()=>restoreChallenge(JSON.stringify(bad)),/Version 4/);
 bad.options.compareCoulombContact=true;bad.schema='worldlaw.trajectory-notebook/v3';assert.throws(()=>restoreChallenge(JSON.stringify(bad)),/version 4/);
 assert.equal(JSON.parse(exportChallenge(old)).schema,'worldlaw.trajectory-notebook/v1');
});
test('a larger true static threshold remains an explicit failed equal-threshold hypothesis',()=>{
 const run=harmonicRun('wrong-static-assumption',0,2);for(const row of run.samples)row.command=.5;
 const wrong={...motor,terms:[{id:'command',coefficient:1},{id:'coulomb',coefficient:-.2}]};
 // Independent static-balance oracle: threshold1 holds this command at rest.
 const forecast=rollout(wrong,run,{coulombContact:true});assert.ok(forecast.metrics.positionRMSE>.25);
 assert.ok(forecast.rows.at(-1).rate>.59);
});
