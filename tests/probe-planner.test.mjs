import test from 'node:test';
import assert from 'node:assert/strict';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
import {planProbeAcquisition,exportProbePlan} from '../src/unknown-lab/probe-planner.mjs';
const training=(kind='ambiguous')=>{const x=probeExample(kind);x.runs=x.runs.filter(r=>r.role==='training');return x;};
const options=()=>({contrastRadius:.01,budget:4,probes:[{id:'correlated',position:.6,rate:.6,cost:1},{id:'zero-rate',position:.6,rate:0,cost:2},{id:'reversed',position:.6,rate:-.6,cost:4}]});
test('cheapest complete separator wins over greatest disagreement, with all intervals retained',()=>{
 const result=planProbeAcquisition(training(),options());assert.equal(result.status,'all-pairs-separated');assert.equal(result.selected.id,'zero-rate');assert.equal(result.candidates.length,3);assert.equal(result.candidates[0].separated,0);
 assert.ok(result.candidates[2].comparisons[0].gap>result.selected.comparisons[0].gap);assert.ok(Math.abs(result.selected.comparisons[0].gap-.38077380625344)<1e-12);
 assert.deepEqual(result.selected.probe,{command:0,position:.6,rate:0});assert.deepEqual(result.selected.extrapolation,{position:true,rate:true});
});
test('cost, budget and future precision alter the actual decision',()=>{
 const x=options();x.probes[2].cost=1;assert.equal(planProbeAcquisition(training(),x).selected.id,'reversed');
 assert.equal(planProbeAcquisition(training(),{...options(),budget:1}).selected,null);
 assert.equal(planProbeAcquisition(training(),{...options(),contrastRadius:.2}).selected.id,'reversed');
 assert.equal(planProbeAcquisition(training(),{...options(),contrastRadius:.2,budget:2}).status,'no-informative-probe');
 assert.equal(planProbeAcquisition(training(),{...options(),contrastRadius:.4}).selected,null);
});
test('exact boundary is not an all-outcome separating gap',()=>{
 const first=planProbeAcquisition(training(),options());const radius=first.selected.comparisons[0].gap/2;
 const x={...options(),contrastRadius:radius,probes:options().probes.slice(1,2)};assert.equal(planProbeAcquisition(training(),x).selected,null);
});
test('partial comparison remains explicit when two hypotheses coincide at offered state',()=>{
 const t=training();for(const r of t.runs)r.notebook.noiseSigma=.1;
 const result=planProbeAcquisition(t,{contrastRadius:.01,budget:1,probes:[{id:'zero-state',position:0,rate:0,cost:1}]});
 assert.equal(result.models.length,3);assert.equal(result.status,'partial-separation');assert.equal(result.selected.separated,2);assert.equal(result.selected.total,3);assert.equal(result.selected.allSeparated,false);
});
test('no surviving or single surviving offered law is not silently a design decision',()=>{
 for(const kind of ['mixed','drag']){const r=planProbeAcquisition(training(kind),options());assert.equal(r.status,'unavailable');assert.equal(r.selected,null);assert.deepEqual(r.candidates,[]);}
 const t=training();t.runs=t.runs.slice(0,2);assert.equal(planProbeAcquisition(t,options()).fitStatus,'insufficient-training');
});
test('training-only contract and immutable inputs prevent later observations affecting planning',()=>{
 const full=probeExample('ambiguous');assert.throws(()=>planProbeAcquisition(full,options()),/training runs only/);
 const t=training(),settings=options(),before=structuredClone({t,settings});const result=planProbeAcquisition(t,settings);assert.deepEqual({t,settings},before);
 full.runs.filter(r=>r.role==='challenge').forEach(r=>r.notebook.trials.forEach(row=>row.jointTorque+=999));assert.deepEqual(planProbeAcquisition({...full,runs:full.runs.filter(r=>r.role==='training')},settings),result);
});
test('bounded work and invalid declaration refusals',()=>{
 for(const x of [{...options(),contrastRadius:0},{...options(),budget:-1},{...options(),probes:[]},{...options(),probes:Array.from({length:33},(_,i)=>({id:'p'+i,position:i,rate:i,cost:1}))},{...options(),probes:[options().probes[0],{...options().probes[0],id:'different'}]},{...options(),probes:[{id:'bad',position:NaN,rate:0,cost:1}]}])assert.throws(()=>planProbeAcquisition(training(),x));
});
test('request export retains actual training and has no acquired challenge evidence',()=>{
 const raw=JSON.parse(exportProbePlan(training(),options()));assert.equal(raw.schema,'worldlaw.probe-plan/v1');assert.equal(raw.selected.id,'zero-rate');assert.ok(raw.training.runs.every(r=>r.role==='training'));assert.throws(()=>exportProbePlan(training(),{...options(),budget:0}),/No informative/);
});
test('request reopen recomputes from inputs and ignores forged cached recommendation',async()=>{
 const {importProbePlan}=await import('../src/unknown-lab/probe-planner.mjs');
 const raw=JSON.parse(exportProbePlan(training(),options()));raw.selected={id:'fabricated'};raw.candidates=[];raw.models=[];
 assert.deepEqual(importProbePlan(JSON.stringify(raw)),planProbeAcquisition(training(),options()));
 assert.throws(()=>importProbePlan('{}'),/Expected/);assert.throws(()=>importProbePlan('{'),/Invalid/);
});
