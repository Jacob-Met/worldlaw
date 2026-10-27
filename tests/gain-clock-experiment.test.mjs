import test from 'node:test';
import assert from 'node:assert/strict';
import {gainClockExample,planGainClockExperiment,inspectGainClockExperiment,commandAt} from '../src/science/gain-clock-experiment.mjs';
import {inspectClockEvidence,exportClockEvidence,reopenClockEvidence} from '../src/science/clock-evidence.mjs';
import {affineClockExample} from '../src/science/clock-affine-example.mjs';
import {clockTicksExample} from '../src/science/clock-ticks-example.mjs';
test('gain notebook refuses cross-format input and oversized UTF8 source on export/reopen',()=>{
 for(const example of [affineClockExample(),clockTicksExample()])assert.throws(()=>reopenClockEvidence(JSON.stringify({schema:'worldlaw.gain-clock-investigation/v1',model:example.model,input:example.input})),/gain-clock input/);
 const {model,input}=gainClockExample();input.extra='漢'.repeat(700000);
 assert.throws(()=>exportClockEvidence(model,input),/2 MB/);
 const text=JSON.stringify({schema:'worldlaw.gain-clock-investigation/v1',model,input});assert.ok(text.length<2_000_000);assert.throws(()=>reopenClockEvidence(text),/2 MB/);
});
test('complete 112-pair handoff selects nonlinear excitation; slew and full support enforced',()=>{
 const {model,input}=gainClockExample(),r=planGainClockExperiment(model,input);
 assert.equal(r.candidates.length,112);assert.equal(r.selected.id,'sine-3@0.5');assert.ok(Math.abs(r.selected.pairs[0].margin-.0336976653)<1e-9);
 assert.ok(r.candidates.filter(c=>c.profile.id==='sine-4').every(c=>!c.withinBudget));
 input.profiles=[input.profiles[0]];assert.equal(planGainClockExperiment(model,input).selected,null);
 input.duration=.4;assert.ok(planGainClockExperiment(model,input).candidates.every(c=>!c.withinBudget));
});
test('continuous family intervals enclose dense scale/gain samples including sine extrema',()=>{
 const {model,input}=gainClockExample();input.maxSlew=10;input.families[1].scale=[.5,2];
 for(const c of planGainClockExperiment(model,input).candidates.filter(c=>c.withinBudget))for(let j=0;j<input.families.length;j++){
  const f=input.families[j],b=c.predictions[j].interval;
  for(let i=0;i<=200;i++)for(const g of f.gain){const scale=f.scale[0]+(f.scale[1]-f.scale[0])*i/200,v=g*commandAt(c.profile,c.torqueTime/scale,input.duration);assert.ok(v>=b[0]&&v<=b[1]);}
 }
});
test('independent authored responses retain true family; planning ignores received outcomes',()=>{
 for(const truth of ['sensor-gain','clock-rate']){const {model,input}=gainClockExample(),p=planGainClockExperiment(model,input),c=p.selected;const t=c.torqueTime;
  input.received={candidateId:c.id,source:'Authored independent perturbation; not physical evidence',jointTorque:(truth==='sensor-gain'?1.25*commandAt(c.profile,t,input.duration):commandAt(c.profile,t/.8,input.duration))+.007*Math.cos(3*t)};
  const r=inspectClockEvidence(model,input).result;assert.deepEqual(r.received.remaining,[truth]);assert.deepEqual(r.selected,p.selected);
  assert.deepEqual(reopenClockEvidence(exportClockEvidence(model,input)).result,r);
 }
});
test('both prior families fail; refitting changes a new forecast but cannot rewrite saved prior',()=>{
 const {model,input}=gainClockExample(),p=planGainClockExperiment(model,input);input.received={candidateId:p.selected.id,source:'Authored omitted response',jointTorque:2};
 const saved=exportClockEvidence(model,input);assert.equal(inspectGainClockExperiment(model,input).received.allPriorFailed,true);
 const refit=structuredClone(model);refit.terms[0].coefficient=2/(1.25*commandAt(p.selected.profile,p.selected.torqueTime,input.duration));
 assert.equal(inspectGainClockExperiment(refit,input).received.allPriorFailed,false);
 assert.equal(reopenClockEvidence(saved).result.received.allPriorFailed,true);
});
test('no separation for overlapping families or large radius; whole input rejected before a partial plan',()=>{
 const {model,input}=gainClockExample();input.readingRadius=2;assert.equal(planGainClockExperiment(model,input).selected,null);
 input.readingRadius=.02;input.families[1]= {...input.families[0],id:'overlap'};assert.equal(planGainClockExperiment(model,input).selected,null);
 input.families.push({id:'invalid',gain:[1,1],scale:[0,1]});assert.throws(()=>planGainClockExperiment(model,input),/Clock scale/);
 assert.throws(()=>planGainClockExperiment({...model,terms:[...model.terms,{id:'bias',coefficient:0}]},input),/one fixed/);
});
test('received source is admitted and recomputed, never trusts serialized result',()=>{
 const {model,input}=gainClockExample();input.received={candidateId:'sine-4@0.5',source:'invalid acquisition',jointTorque:1};assert.throws(()=>inspectGainClockExperiment(model,input),/admitted/);
 delete input.received;const saved=JSON.parse(exportClockEvidence(model,input));saved.result={selected:'fabricated'};assert.notEqual(reopenClockEvidence(JSON.stringify(saved)).result.selected,'fabricated');
});
