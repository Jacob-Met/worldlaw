import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalDelayPairs} from '../src/trajectory/physical-delay.mjs';
const band=(lowerSeconds,upperSeconds)=>({lowerSeconds,upperSeconds});
const indices=r=>r.reports.map(x=>x.pairs.map(p=>[p.earlierIndex,p.laterIndex]));
test('closed delay bands retain original source indices and exclude imposed initial',()=>{
  const r=physicalDelayPairs([0,1,2,3,4],[band(1,1),band(2,3)]);
  assert.deepEqual(indices(r),[[[1,2],[2,3],[3,4]],[[1,3],[1,4],[2,4]]]);
  assert.equal(r.pairCount,6);assert.deepEqual(r.reports[0].pairs[0],{earlierIndex:1,laterIndex:2,earlierTime:1,laterTime:2,elapsed:1});
});
test('empty and single-pair bands are explicit, overlapping bands retain shared identities',()=>{
  const r=physicalDelayPairs([0,1,2,3],[band(10,11),band(2,2),band(1,2)]);
  assert.deepEqual(r.reports.map(x=>x.status),['no_pairs','single_pair','paired']);
  assert.equal(r.pairCount,4);assert.deepEqual(indices(r)[1],[[1,3]]);assert.ok(indices(r)[2].some(([i,j])=>i===1&&j===3));
});
test('the complete budget includes all overlapping cohorts and refuses atomically',()=>{
  const times=[0,1,2,3,4],bands=[band(1,2),band(2,3)];
  assert.throws(()=>physicalDelayPairs(times,bands,{maxPairs:7}),/entire/);
  assert.equal(physicalDelayPairs(times,bands,{maxPairs:8}).pairCount,8);
});
test('input validation and output custody preserve exact original timestamps',()=>{
  const t=[0,.1,.4,1,1.5],b=[band(.1,1)];const r=physicalDelayPairs(t,b),before=structuredClone(r);
  t[1]=99;b[0].upperSeconds=99;assert.deepEqual(r,before);
  for(const times of [[0,1,1,3],[0,1,NaN,3],Array(4),[-Number.MAX_VALUE,0,1,Number.MAX_VALUE]])assert.throws(()=>physicalDelayPairs(times,[band(1,2)]));
  for(const bands of [[],Array(1),[band(0,1)],[band(2,1)],[band(1,Infinity)],[band(1,2),band(1,2)]])assert.throws(()=>physicalDelayPairs([0,1,2,3],bands));
});
test('500 irregular and large-epoch cohorts match independent exhaustive pair membership',()=>{
  let seed=218;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let trial=0;trial<500;trial++){
    let t=trial%3===0?1e12:0;const times=Array.from({length:10+trial%51},()=>{t+=.001+random();return t;});
    const lower=random()*5+.001,upper=lower+random()*3;
    const expected=times.flatMap((x,i)=>times.flatMap((y,j)=>i>=1&&j>i&&y-x>=lower&&y-x<=upper?[[i,j]]:[]));
    assert.deepEqual(indices(physicalDelayPairs(times,[band(lower,upper)]))[0],expected);
  }
});
