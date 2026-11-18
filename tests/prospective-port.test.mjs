import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulePortObservations} from '../src/coupling/actuator-port.mjs';
import {planProspectivePortIntervention, receiveProspectivePortObservation, PROSPECTIVE_PORT_SCHEMA} from '../src/coupling/prospective-port.mjs';

const settings=()=>({amplitudeCapNm:2,impulseCapNms:.38,maxSlewNmPerSecond:120,
 durationSeconds:.30,stepSeconds:.01,contrastRadiusRad:.02});
const source=(initial=[0,0,0,0])=>({initial,settings:settings()});
const clone=x=>structuredClone(x);
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('the complete precommitted command is selected from initial state and hard limits alone',()=>{
 const input=source(), original=clone(input), result=planProspectivePortIntervention(input);
 assert.deepEqual(input,original);
 assert.equal(result.schema,PROSPECTIVE_PORT_SCHEMA);
 assert.equal(result.source.initial.length,4);
 assert.equal(result.source.settings.durationSeconds,.30);
 assert.ok(result.candidateCount>2);
 assert.equal(result.status,'prospective-witness');
 const chosen=result.selected;
 assert.ok(chosen.observationIndex>=1&&chosen.observationIndex<=30);
 assert.equal(chosen.observationTime,chosen.drive[chosen.observationIndex].time);
 assert.ok(chosen.predicted.certifiedMargin>0);
 assert.ok(chosen.impulseNms<=settings().impulseCapNms+1e-12);
 assert.ok(chosen.peakSlewNmPerSecond<=settings().maxSlewNmPerSecond+1e-12);
 assert.ok(chosen.drive.every(p=>Math.abs(p.torque)<=settings().amplitudeCapNm+1e-12));
 assert.equal(chosen.drive.length,31);
 for(const key of ['shoulder','elbow']){
  const readout={time:chosen.observationTime,position:clone(chosen.predicted[key])};
  assert.equal(receiveProspectivePortObservation(result,clone(chosen.drive),readout).status,key);
 }
 assert.deepEqual(planProspectivePortIntervention(input),result);
});

test('unobserved sensor values cannot influence precommitted stimulus or readout clock',()=>{
 const initial=[-.1,.2,.04,-.08], first=planProspectivePortIntervention(source(initial));
 assert.equal(first.status,'prospective-witness');
 const extra={...source(initial),futureEncoderReadings:Array(100).fill([999,999])};
 assert.throws(()=>planProspectivePortIntervention(extra),/Declare only/);
 const second=planProspectivePortIntervention(source(initial));
 assert.deepEqual(second,first);
});

test('an unverified command, changed proposal, wrong clock and an out-of-family sensor reading all refuse certainty',()=>{
 const p=planProspectivePortIntervention(source());assert.equal(p.status,'prospective-witness');
 const drive=clone(p.selected.drive),reading={time:p.selected.observationTime,position:clone(p.selected.predicted.shoulder)};
 const altered=clone(drive);altered[3].torque+=.08;
 assert.throws(()=>receiveProspectivePortObservation(p,altered,reading),/differs/);
 const missing=clone(drive);missing.splice(1,1);
 assert.throws(()=>receiveProspectivePortObservation(p,missing,reading),/differs/);
 assert.throws(()=>receiveProspectivePortObservation(p,drive,{...reading,time:reading.time+.01}),/precommitted/);
 const forged=clone(p);forged.selected.predicted.separation+=1;
 assert.throws(()=>receiveProspectivePortObservation(forged,drive,reading),/plan changed/);
 const impossible={time:reading.time,position:[2.9,-2.8]};
 const mismatch=receiveProspectivePortObservation(p,drive,impossible);
 assert.equal(mismatch.status,'model-inadequate');
 assert.ok(mismatch.shoulderResidualRad>mismatch.declaredAcceptanceRadiusRad);
 assert.ok(mismatch.elbowResidualRad>mismatch.declaredAcceptanceRadiusRad);
});

test('tight effort and low-excitation conditions abstain rather than fabricate a distinguishing experiment',()=>{
 const input=source();input.settings.maxSlewNmPerSecond=3;input.settings.amplitudeCapNm=.3;
 const plan=planProspectivePortIntervention(input);
 assert.equal(plan.status,'no-admissible-command');
 assert.equal(plan.selected,null);
 assert.throws(()=>receiveProspectivePortObservation(plan,[],{time:.1,position:[0,0]}),/No numerically screened/);
 for(const mutation of [
  {durationSeconds:.5},{contrastRadiusRad:NaN},{maxSlewNmPerSecond:-1},{impulseCapNms:2},
  {stepSeconds:.013},{amplitudeCapNm:Infinity}
 ]) assert.throws(()=>planProspectivePortIntervention({...source(),settings:{...settings(),...mutation}}));
});

test('frozen independent high-resolution held-out simulator: classifications conditional on the offered family',()=>{
 // 48 seeds and both latent actuators are fixed before inspecting any result.
 // The generating simulator is half the finest planning step; readout perturbations are fixed.
 const counts={seeds:48,proposed:0,unresolved:0,classified:0,correct:0,otherModelRejected:0};
 for(let seed=70001;seed<=70048;seed++){
  const random=rng(seed);
  const initial=[(random()-.5)*.6,(random()-.5)*.6,(random()-.5)*.4,(random()-.5)*.4];
  const plan=planProspectivePortIntervention(source(initial));
  if(plan.status!=='prospective-witness'){counts.unresolved++;continue;}
  counts.proposed++;
  const {drive,observationIndex,observationTime}=plan.selected;
  const independent=schedulePortObservations(drive,0,initial,.5,.0005).predictions[observationIndex-1];
  for(const port of ['shoulder','elbow']){
   const encoder=independent[port].map(angle=>angle+(.5-random())*.006);
   const result=receiveProspectivePortObservation(plan,clone(drive),{time:observationTime,position:encoder});
   counts.classified++;if(result.status===port)counts.correct++;
   if(result.status!==port)throw Error('Accepted in-family high-resolution witness classified incorrectly seed '+seed+' port '+port+': '+result.status);
  }
  const wrong={time:observationTime,position:[3.1,2.8]};
  if(receiveProspectivePortObservation(plan,drive,wrong).status==='model-inadequate')counts.otherModelRejected++;
 }
 assert.equal(counts.correct,counts.classified);
 assert.ok(counts.proposed>=1,'The frozen cohort must admit at least one actual experiment');
 console.log('FROZEN PROSPECTIVE SYNTHETIC HOLDOUT '+JSON.stringify(counts));
});

test('fine-step numerical screen is not accidentally equal to coarse RK4 across changed inputs',()=>{
 const input=source([.21,-.34,2.1,-1.2]);
 const p=planProspectivePortIntervention(input);
 assert.ok(p.candidateCount>0);
 if(p.status==='prospective-witness'){
  const {drive,observationIndex,predicted}=p.selected;
  const fine=schedulePortObservations(drive,0,input.initial,.5,.0025).predictions[observationIndex-1];
  assert.ok(Math.hypot(...predicted.shoulder.map((v,i)=>v-fine.shoulder[i]))<=.01);
  assert.ok(predicted.numerical>=0);
 }
});
