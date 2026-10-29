import assert from'node:assert/strict';import test from'node:test';
import{fixture}from'./nonlinear-cohort-family-fixture.mjs';
import{searchObserverSource}from'../src/science/nonlinear-observer-source.mjs';
const{source:physical}=fixture(1,false);
const refs=[1,2].map((nominalTorque,i)=>({id:'r'+i,nominalTorque,absoluteError:.001,basis:'Original bounded standard'}));
const source={schema:'worldlaw.nonlinear-reference-observer/v1',sameObserver:true,instrumentId:'observing-meter',basis:'Unchanged observing meter across both levels',offsetRadius:.1,inquiry:{schema:'worldlaw.nonlinear-reference-observations/v1',units:'N·m',independentSource:true,basis:'Original two-level observing course',original:{schema:'worldlaw.nonlinear-common-reference/v1',units:'N·m',unchangedReferences:true,basis:'Original shared standards',physical,references:refs,readings:refs.map((r,i)=>({id:'original'+i,reportId:'a',referenceId:r.id,reportedTorque:r.nominalTorque,residualRadius:.001,basis:'Original source residual'}))},observations:refs.map((r,i)=>({id:'observed'+i,referenceId:r.id,value:1.02*r.nominalTorque,absoluteError:.001,basis:'Original corrected-unit residual'}))}};

import{searchAffineObserver,checkAffineObserver,serializeAffineObserver,replayAffineObserver,prepareAffineObserver}from'../src/science/nonlinear-affine-observer.mjs';
function sample(){return{schema:'worldlaw.nonlinear-affine-observer/v1',sameAffineObserver:true,correctedUnitResiduals:true,basis:'Same original meter gain and offset across both levels',gainCenter:0,gainRadius:.03,original:structuredClone(source)}}

const s=sample();s.gainCenter=1;s.gainRadius=0;s.original.offsetRadius=0;
const o=s.original.inquiry.original;o.physical.receiving[0].jointTorque=1.03;o.references=[{id:'r0',nominalTorque:1.03,absoluteError:.001,basis:'Original physical reference'}];o.readings=[{id:'original',reportId:'a',referenceId:'r0',reportedTorque:1,residualRadius:.001,basis:'Original report source'}];s.original.inquiry.observations=[{id:'raw',referenceId:'r0',value:.5,absoluteError:.02,basis:'Comparison bound, units explicitly at issue'}];

import{searchRawObserver,checkRawObserver,prepareRawObserver,serializeRawObserver,replayRawObserver}from'../src/science/nonlinear-raw-observer.mjs';
function rawSource(){const a=structuredClone(s);delete a.correctedUnitResiduals;return{...a,schema:'worldlaw.nonlinear-raw-observer/v1',rawReadoutResiduals:true};}

import{searchRawSource,serializeRawSource,replayRawSource,checkRawSource}from'../src/science/nonlinear-raw-source.mjs';
test('raw source support remains separate when original physical receiving changes',()=>{const a=rawSource(),r=searchRawSource(a);assert.equal(r.status,'verified-interior-witness');const b=structuredClone(a);b.original.inquiry.original.physical.receiving[0].jointTorque=1.8;assert.equal(searchRawObserver(b).status,'verified-separation');const z=searchRawSource(b);assert.equal(z.status,'verified-interior-witness');assert.deepEqual(z.certificate.values,r.certificate.values);assert.equal(replayRawSource(serializeRawSource(z.certificate)).check.status,z.status);assert.throws(()=>checkRawSource(b,r.certificate));});
test('contradictory complete raw source separates without a physical-law claim',()=>{const a=rawSource();a.original.inquiry.observations.push({...a.original.inquiry.observations[0],id:'other',value:.7});const r=searchRawSource(a);assert.equal(r.status,'verified-separation');assert.match(r.check.qualification,/No physical-law/);});
test('zero raw interval and exhausted candidate search do not invent source witness',()=>{const a=rawSource();a.original.inquiry.observations[0].value=.515;a.original.inquiry.observations[0].absoluteError=0;assert.notEqual(searchRawSource(a).status,'verified-interior-witness');assert.equal(searchRawSource(rawSource(),{maxIterations:0}).status,'unresolved');});
