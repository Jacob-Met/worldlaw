import test from 'node:test';import assert from 'node:assert/strict';import {inspectInputEnclosures}from'../src/science/input-enclosure.mjs';import{predict}from'../src/science/torque-discovery.mjs';
const cancellation={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:1},{id:'gravity',coefficient:-1}]};
const input=(position=0,jointTorque=.001)=>({command:0,rate:0,position,jointTorque});const radii=r=>({command:0,position:r,rate:0,jointTorque:0});
test('joint dependence excludes a cancellation counterexample and refinement approaches analytic extrema',()=>{
 const baseline=inspectInputEnclosures(cancellation,[input()],radii(.1),{refinementSegments:0});assert.equal(baseline.excludedCount,0);let previous=Infinity;
 for(const n of[1,4,16,64]){const result=inspectInputEnclosures(cancellation,[input()],radii(.1),{refinementSegments:n}),bound=result.rows[0].prediction;assert.equal(result.excludedCount,1);assert.ok(bound[1]<previous);previous=bound[1];assert.ok(bound[1]>=.1-Math.sin(.1));assert.deepEqual(result.rows[0].independentPrediction,baseline.rows[0].prediction);}
 assert.ok(previous<.000167);
});
test('every row retains baseline when complete refinement reservation exceeds budget',()=>{
 const rows=Array.from({length:129},()=>input()),result=inspectInputEnclosures(cancellation,rows,radii(.1),{refinementSegments:64});assert.equal(result.refinement.status,'work-limit');assert.equal(result.refinement.usedSegments,0);assert.equal(result.rows.length,129);assert.ok(result.rows.every(r=>r.status==='not-excluded'));assert.equal(result.refinement.requestedRowSegments,8256);
 assert.throws(()=>inspectInputEnclosures(cancellation,[input()],radii(.1),{refinementSegments:3}));
});
test('mixed signed models, stationary points and domain endpoints retain independent sampled containment',()=>{
 const terms=[cancellation.terms,[{id:'spring',coefficient:-3},{id:'gravity',coefficient:3},{id:'cubic',coefficient:.5}],[{id:'gravity',coefficient:-2},{id:'cubic',coefficient:.1},{id:'bias',coefficient:1}]];
 for(const ts of terms)for(const [center,radius]of[[0,.1],[0,2],[1.5,.5],[999999,.5],[-999999,.5],[1e6,0],[-1e6,0]]){
  const m={schema:cancellation.schema,terms:ts},result=inspectInputEnclosures(m,[input(center)],radii(radius),{refinementSegments:16}),bounds=result.rows[0].prediction;
  for(let i=0;i<=1000;i++){const y=predict(m,input(center-radius+2*radius*i/1000));assert.ok(y>=bounds[0]&&y<=bounds[1],JSON.stringify({ts,center,radius,y,bounds}));}
 }
});
test('zero-width and non-position discontinuity behavior stays on maintained path',()=>{
 const m={...cancellation,terms:[...cancellation.terms,{id:'coulomb',coefficient:2}]};
 const r={...radii(0),rate:.1};const a=inspectInputEnclosures(m,[input()],r),b=inspectInputEnclosures(m,[input()],r,{refinementSegments:0});assert.deepEqual(a.rows,b.rows);assert.equal(a.refinement.usedSegments,0);
 const refined=inspectInputEnclosures(m,[input()],{...r,position:.1});assert.ok(refined.rows[0].prediction[0]<-2&&refined.rows[0].prediction[1]>2);
});
