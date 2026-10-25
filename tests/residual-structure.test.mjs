import test from 'node:test';
import assert from 'node:assert/strict';
import {residualStructure} from '../src/trajectory/residual-structure.mjs';
const course = residuals => [{time:0, observed:0, predicted:0}, ...residuals.map((r,i)=>({time:i+1,observed:r,predicted:0,residual:999}))];
const near = (actual, expected, tolerance=1e-12) => assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} != ${expected}`);
test('same RMSE hides persistent versus alternating failures',()=>{
  const coherent=residualStructure(course([-1,-1,-1,-1,1,1,1,1]),{lags:[1]});
  const alternating=residualStructure(course([-1,1,-1,1,-1,1,-1,1]),{lags:[1]});
  near(coherent.rmse,1);near(alternating.rmse,1);
  near(coherent.reports[0].correlation,5/7);near(alternating.reports[0].correlation,-1);
  near(coherent.reports[0].differenceRatio,2/7);near(alternating.reports[0].differenceRatio,2);
});
test('zero error and constant bias have distinct magnitude but undefined centered cosine',()=>{
  for(const n of [3,7,101]) for(const value of [0,.1,-.3]){
    const r=residualStructure(course(Array(n).fill(value)),{lags:[1]});
    near(r.meanError,value);near(r.rmse,Math.abs(value));assert.equal(r.centeredRMS,0);
    assert.equal(r.reports[0].correlation,null);assert.equal(r.reports[0].differenceRatio,value===0?null:0);
  }
});
test('uses original predictions, excludes imposed initial sample, retains pair custody',()=>{
  const rows=course([1,2,3,4]);rows[0].observed=999;rows[2].predicted=.5;
  const before=JSON.stringify(rows), r=residualStructure(rows,{lags:[1,2]});
  near(r.meanError,2.375);assert.equal(r.count,4);assert.equal(r.pairCount,5);
  assert.deepEqual(r.reports[1].pairs.map(p=>[p.earlier.index,p.later.index]),[[1,3],[2,4]]);
  assert.equal(r.reports[0].pairs[0].later.residual,1.5);assert.equal(JSON.stringify(rows),before);
  rows[1].observed=100;assert.equal(r.reports[0].pairs[0].earlier.observed,1);
});
test('retains irregular physical lags rather than inventing a sampling frequency',()=>{
  const rows=course([1,-1,1,-1]);[0,.1,.4,1.2,2.7].forEach((t,i)=>rows[i].time=t);
  const r=residualStructure(rows,{lags:[1]});near(r.reports[0].elapsedMinimum,.3);near(r.reports[0].elapsedMaximum,1.5);
  near(r.reports[0].pairs[1].elapsed,.8);
});
test('complete population refuses malformed lags, rows and budgets',()=>{
  const rows=course([1,2,3,4]);
  for(const lags of [[],[0],[1,1],[3],[1.5],[NaN],Array(2)])assert.throws(()=>residualStructure(rows,{lags}));
  assert.throws(()=>residualStructure(rows,{lags:[1,2],maxPairs:4}),/complete declared/);
  assert.equal(residualStructure(rows,{lags:[1,2],maxPairs:5}).pairCount,5);
  for(const patch of [{time:1},{observed:Infinity},{predicted:1e7}]){const broken=structuredClone(rows);Object.assign(broken[2],patch);assert.throws(()=>residualStructure(broken,{lags:[1]}));}
  assert.throws(()=>residualStructure(Array(4),{lags:[1]}));
});
test('scaled computation retains tiny nonzero errors without squared underflow',()=>{
  const r=residualStructure(course([1e-300,-1e-300,1e-300,-1e-300]),{lags:[1]});
  assert.ok(r.rmse>0);near(r.reports[0].correlation,-1);near(r.reports[0].differenceRatio,2);
});
test('lag cosine matches independent direct formula for all bounded declared pairs',()=>{
  const values=Array.from({length:37},(_,i)=>Math.sin(i*.31)+.03*i),r=residualStructure(course(values),{lags:[1,4,13]});
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  for(const report of r.reports){let dot=0,a=0,b=0;for(let i=0;i<values.length-report.lag;i++){const x=values[i]-mean,y=values[i+report.lag]-mean;dot+=x*y;a+=x*x;b+=y*y;}near(report.correlation,dot/Math.sqrt(a*b));}
});
