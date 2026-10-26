import test from 'node:test';
import assert from 'node:assert/strict';
import {rollout} from '../src/trajectory/forward.mjs';
import {rolloutWithResolution} from '../src/trajectory/resolution.mjs';
import {contactEventResolutionNote} from '../src/trajectory/contact-resolution-note.mjs';

const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:-100},{id:'coulomb',coefficient:-10}]};
const run={id:'internal-event',label:'Authored internal contact course',kind:'synthetic',source:{label:'authored model control'},
 inertia:1,initialRate:1,samples:[{time:0,position:1,command:0},{time:.7,position:0,command:0}]};

test('paired contact receiving exposes source-derived unequal event counts',()=>{
 const options={coulombContact:true,maxStep:.7,maxSteps:10000};
 const result=rolloutWithResolution(model,run,options);
 assert.equal(result.resolution.status,'compared');
 assert.deepEqual(result.resolution.contactEventComparison,{
   coarseZeroRateEvents:0,refinedZeroRateEvents:3,countsDiffer:true});
 assert.deepEqual(result.rollout,rollout(model,run,options));
 assert.match(contactEventResolutionNote(result.resolution),/0 at nominal vs 3 at half steps.*step-sensitive/);
 const changed=structuredClone(run);changed.samples[1].position+=100;
 assert.deepEqual(rolloutWithResolution(model,changed,options).resolution,result.resolution);
});

test('matching event counts do not imply certified zero-crossing detection',()=>{
 const result=rolloutWithResolution(model,run,{coulombContact:true,maxStep:.35,maxSteps:10000});
 assert.deepEqual(result.resolution.contactEventComparison,{
   coarseZeroRateEvents:3,refinedZeroRateEvents:3,countsDiffer:false});
 assert.match(contactEventResolutionNote(result.resolution),/same count does not certify/);
});

test('unavailable refinement cannot invent a zero-rate event agreement',()=>{
 const result=rolloutWithResolution(model,run,{coulombContact:true,maxStep:.7,maxSteps:2});
 assert.equal(result.resolution.status,'unavailable');
 assert.equal(result.resolution.reason,'combined_step_budget');
 assert.equal(Object.hasOwn(result.resolution,'contactEventComparison'),false);
 assert.match(contactEventResolutionNote(result.resolution),/refinement unavailable/);
});

test('original smooth or zero-friction course never gets a contact comparison',()=>{
 const smooth={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:-4}]};
 for(const opt of [{maxStep:.1,maxSteps:10000},{maxStep:.1,maxSteps:10000,coulombContact:true}]){
   const result=rolloutWithResolution(smooth,run,opt);
   assert.equal(result.resolution.status,'compared');
   assert.equal(Object.hasOwn(result.resolution,'contactEventComparison'),false);
   assert.match(contactEventResolutionNote(result.resolution),/unavailable/);
 }
});
