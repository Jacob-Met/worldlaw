import test from 'node:test';import assert from 'node:assert/strict';
import {SCHEMA} from '../src/unknown-lab/paired-history.mjs';
import {DURATION_SCHEMA} from '../src/unknown-lab/duration-response.mjs';
import {fitContinuousDuration,analyzeContinuousDurationStudy,continuousPredictionIntervals,exportContinuousInvestigation,importContinuousInvestigation} from '../src/unknown-lab/continuous-duration.mjs';
function run(id,duration,contrast,role='training',sigma=.003){
 const shift=[...id].reduce((s,c)=>s+c.charCodeAt(0),0)/10000;
 const trials=Array.from({length:32},(_,i)=>{
  const state={pairId:id+'-'+i,command:0,position:0,rate:0},base=i/100+shift,first=i%2===0;
  return [{...state,history:'reference',jointTorque:base,sampleIndex:2*i+(first?0:1)},
   {...state,history:'conditioned',jointTorque:base+contrast,sampleIndex:2*i+(first?1:0)}];
 }).flat();
 return {id,duration,role,notebook:{schema:SCHEMA,source:'synthetic',sourceNote:'Independent authored analytic controls; no physical receiving',noiseSigma:sigma,trials}};
}
const curve=(t,tau,a=.7)=>a*(1-Math.exp(-t/tau));
const training=(tau=1.5,a=.7)=>[.3,1,3].map((t,i)=>run('train'+i,t,curve(t,tau,a)));
const study=runs=>({schema:DURATION_SCHEMA,runs});
function assertWitnesses(fit,points=fit.points){for(const w of fit.witnesses){assert.ok(w.tau>=fit.settings.tauMin&&w.tau<=fit.settings.tauMax);assert.ok(Math.abs(w.amplitude)<=100);for(const p of points){const y=curve(p.duration,w.tau,w.amplitude);assert.ok(y>=p.interval[0]-1e-13&&y<=p.interval[1]+1e-13);}}}
test('off-grid positive responses locate coherent witnesses while preserving finite-grid exclusion',()=>{
 for(const tau of [1.1,1.5,2.5]){
  const fit=fitContinuousDuration(training(tau));
  assert.equal(fit.finiteBaseline.status,'none-compatible');assert.equal(fit.status,'feasible-witnesses');assert.ok(fit.witnesses.length>0);
  assert.ok(fit.boxes.some(b=>b.tau[0]<=tau&&b.tau[1]>=tau&&b.amplitude[0]<=.7&&b.amplitude[1]>=.7));assertWitnesses(fit);
  assert.ok(fit.evaluatedBoxes<2048);
 }
});
test('negative coupling preserves sign and bounded future projections',()=>{
 const fit=fitContinuousDuration(training(1.5,-.7));assert.equal(fit.status,'feasible-witnesses');assertWitnesses(fit);
 assert.ok(fit.witnesses.every(w=>w.amplitude<0));
 const y=curve(6,1.5,-.7);assert.ok(continuousPredictionIntervals(fit,6).some(p=>p.interval[0]<=y&&p.interval[1]>=y));
});
test('zero response stays unidentified across the whole domain without expensive subdivision',()=>{
 const fit=fitContinuousDuration(training(1.5,0));assert.equal(fit.status,'zero-compatible-unidentified');
 assert.equal(fit.evaluatedBoxes,1);assert.equal(fit.resolutionComplete,false);assert.equal(fit.budgetExhausted,false);
 assert.deepEqual(fit.boxes[0].tau,[.1,8]);assert.equal(fit.witnesses[0].amplitude,0);assertWitnesses(fit);
});
test('one-box budget retains unvisited possible regions and cannot claim exclusion or feasibility',()=>{
 const fit=fitContinuousDuration(training(),{maxBoxes:1});assert.equal(fit.status,'budget-exhausted');assert.equal(fit.witnesses.length,0);
 assert.equal(fit.evaluatedBoxes,1);assert.ok(fit.boxes.length>0);assert.ok(fit.boxes.some(b=>b.tau[0]<=1.5&&b.tau[1]>=1.5));
 assert.ok(fit.boxes.some(b=>b.resolutionMet===false));
});
test('coarse outer boxes without a coherent witness are not called fitted models',()=>{
 const fit=fitContinuousDuration(training(),{tauResolution:100});assert.equal(fit.status,'outer-boxes-only');assert.ok(fit.boxes.length);assert.equal(fit.witnesses.length,0);
});
test('contradictory signs and incompatible zero-duration response exclude only bounded offered family',()=>{
 assert.equal(fitContinuousDuration([run('a',.3,.3),run('b',1,-.3),run('c',3,.5)]).status,'excluded-in-bounds');
 assert.equal(fitContinuousDuration([run('a',0,.4),run('b',1,.4),run('c',3,.4)]).status,'excluded-in-bounds');
});
test('challenge outcomes do not change training boxes, witnesses or frozen projections',()=>{
 const a=analyzeContinuousDurationStudy(study([...training(),run('held',6,curve(6,1.5),'challenge')]));
 const b=analyzeContinuousDurationStudy(study([...training(),run('held',6,-2,'challenge')]));
 assert.deepEqual(a.fit,b.fit);assert.deepEqual(a.challenges[0].predictions,b.challenges[0].predictions);
 assert.equal(a.joint.status,'coherent-witness');assert.equal(b.joint.status,'contradicted');
});
test('individual envelope overlap cannot authorize per-challenge parameter switching',()=>{
 const broad=[.3,1,3].map((t,i)=>run('broad'+i,t,.5,'training',10));
 const r=analyzeContinuousDurationStudy(study([...broad,run('one',1,.5,'challenge',.001),run('two',3,.1,'challenge',.001)]));
 assert.ok(r.challenges.every(c=>c.status==='outer-envelope-overlap'));assert.equal(r.joint.status,'contradicted');
});
test('qualified contradiction survives an order-confounded challenge',()=>{
 const unqualified=run('unqualified',4,.6,'challenge');for(const[i,row]of unqualified.notebook.trials.entries())row.sampleIndex=i;
 const r=analyzeContinuousDurationStudy(study([...training(),run('bad',6,-2,'challenge'),unqualified]));
 assert.equal(r.joint.status,'contradicted');assert.equal(r.joint.unqualifiedCount,1);
});
test('insufficient training, out-of-domain values and malformed budgets refuse explicitly',()=>{
 assert.equal(fitContinuousDuration(training().slice(0,2)).status,'insufficient-training');
 for(const settings of [{tauMin:0},{tauMin:8,tauMax:8},{maxBoxes:0},{maxBoxes:1.5},{tauResolution:NaN},{tauMax:Infinity}])assert.throws(()=>fitContinuousDuration(training(),settings));
 assert.throws(()=>continuousPredictionIntervals(fitContinuousDuration(training()),-1));
});

test('bounded noisy readings preserve coherent witnesses without precise identification',()=>{
 const rows=training();for(const r of rows){r.notebook.noiseSigma=.02;for(const[i,p]of r.notebook.trials.entries())p.jointTorque+=.02*Math.sin(i*1.719+r.duration);}
 const fit=fitContinuousDuration(rows);assert.ok(fit.witnesses.length);assertWitnesses(fit);
 assert.ok(fit.boxes.some(b=>b.tau[0]<=1.5&&b.tau[1]>=1.5));
 assert.ok(Math.max(...fit.boxes.map(b=>b.tau[1]))-Math.min(...fit.boxes.map(b=>b.tau[0]))>.1);
});
test('input comparison roundtrip recomputes and ignores fabricated saved verdicts',()=>{
 const input=study([...training(),run('held',6,curve(6,1.5),'challenge')]);
 const saved=JSON.parse(exportContinuousInvestigation(input,{maxBoxes:500}));saved.fit={status:'identified-certainly'};
 const loaded=importContinuousInvestigation(JSON.stringify(saved));assert.equal(loaded.fit,undefined);
 assert.deepEqual(analyzeContinuousDurationStudy(loaded.study,loaded.settings),analyzeContinuousDurationStudy(input,{maxBoxes:500}));
 assert.throws(()=>importContinuousInvestigation('{}'),/schema/);
});

test('saved search bounds and work budget cannot silently reopen under fresh-call defaults',()=>{
 const original=JSON.parse(exportContinuousInvestigation(study(training()),{tauMin:1,tauMax:3,tauResolution:.002,maxBoxes:500}));
 assert.deepEqual(importContinuousInvestigation(JSON.stringify(original)).settings,original.settings);
 const missing=structuredClone(original);delete missing.settings;
 assert.throws(()=>importContinuousInvestigation(JSON.stringify(missing)),/explicit finite numerical search settings/);
 for(const key of ['tauMin','tauMax','tauResolution','maxBoxes']){
  for(const value of [null,'2']){const changed=structuredClone(original);changed.settings[key]=value;assert.throws(()=>importContinuousInvestigation(JSON.stringify(changed)),/explicit finite numerical search settings/);}
  const changed=structuredClone(original);delete changed.settings[key];assert.throws(()=>importContinuousInvestigation(JSON.stringify(changed)),/explicit finite numerical search settings/);
 }
 assert.equal(fitContinuousDuration(training()).settings.tauMin,.1);
});
