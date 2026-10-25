import test from 'node:test';
import assert from 'node:assert/strict';
import {residualStructure,physicalResidualStructure} from '../src/trajectory/residual-structure.mjs';
import {residualStructure as incumbent} from './support/residual-structure-incumbent-218.mjs';
const band=(lowerSeconds,upperSeconds)=>({lowerSeconds,upperSeconds});
const rows=Array.from({length:41},(_,i)=>({time:i*.125,observed:Math.sin(i*.3)+.01*i,predicted:Math.cos(i*.2)}));
test('shared summary refactor retains exact incumbent sample-lag output',()=>{
  for(const lags of [[1],[1,2,5,10],[7,19]])assert.deepEqual(residualStructure(rows,{lags}),incumbent(rows,{lags}));
});
test('exact physical-delay cohorts equal corresponding sample-lag source pairs',()=>{
  const indexed=residualStructure(rows,{lags:[1,4]}),physical=physicalResidualStructure(rows,{bands:[band(.125,.125),band(.5,.5)]});
  assert.equal(physical.meanError,indexed.meanError);assert.equal(physical.rmse,indexed.rmse);
  for(let i=0;i<2;i++){assert.deepEqual(physical.reports[i].pairs,indexed.reports[i].pairs);assert.equal(physical.reports[i].correlation,indexed.reports[i].correlation);assert.equal(physical.reports[i].differenceRatio,indexed.reports[i].differenceRatio);}
});
test('empty/single cohorts do not invent a correlation or elapsed range',()=>{
  const r=physicalResidualStructure(rows,{bands:[band(10,11),band(4.875,4.875)]});
  assert.equal(r.reports[0].status,'no_pairs');assert.equal(r.reports[0].elapsedMinimum,null);assert.equal(r.reports[0].correlation,null);assert.equal(r.reports[0].differenceRatio,null);
  assert.equal(r.reports[1].status,'single_pair');assert.equal(r.reports[1].correlation,null);
});
test('physical membership ignores receiving amplitudes, and all original values stay copied',()=>{
  const copy=structuredClone(rows),a=physicalResidualStructure(copy,{bands:[band(.2,.6)]});
  copy[8].observed+=.4;const b=physicalResidualStructure(copy,{bands:[band(.2,.6)]});
  assert.deepEqual(a.reports[0].pairs.map(p=>[p.earlier.index,p.later.index]),b.reports[0].pairs.map(p=>[p.earlier.index,p.later.index]));
  assert.notEqual(a.reports[0].correlation,b.reports[0].correlation);
  assert.equal(a.reports[0].pairs.find(p=>p.earlier.index===8).earlier.observed,rows[8].observed);
});
test('every overlapping physical cohort counts toward complete work refusal',()=>{
  assert.throws(()=>physicalResidualStructure(rows,{bands:[band(.1,.6),band(.2,.7)],maxPairs:1}),/entire/);
});
test('large admitted physical cohort does not exceed JavaScript argument capacity',()=>{
  const dense=Array.from({length:450},(_,i)=>({time:i*.001,observed:Math.sin(i*.2),predicted:0}));
  const r=physicalResidualStructure(dense,{bands:[band(.0001,1)],maxPairs:110000});
  assert.equal(r.pairCount,449*448/2);assert.ok(Number.isFinite(r.reports[0].correlation));
  assert.equal(r.reports[0].pairs.at(-1).later.index,449);
});
