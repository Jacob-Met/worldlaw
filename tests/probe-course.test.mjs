import test from 'node:test';
import assert from 'node:assert/strict';
import {compareProbeCourse,planProbeCourses,exportProbeCourses,importProbeCourses} from '../src/unknown-lab/probe-course.mjs';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
const models=[{id:'drag',coefficientInterval:[1,2]},{id:'restoring',coefficientInterval:[1,2]}];
const states=[{position:Math.asin(.75),rate:.5},{position:Math.asin(.5),rate:.75}];
test('two overlapping projections jointly separate shared coefficients',()=>{
 for(const p of states)assert.equal(compareProbeCourse(models,[p],.01)[0].separable,false);
 assert.equal(compareProbeCourse(models,states,.01)[0].separable,true);
 assert.equal(compareProbeCourse(models,states,1)[0].separable,false);
});
test('zero response, fixed coefficient, degenerate polygon and touching controls',()=>{
 assert.equal(compareProbeCourse(models.map(m=>({...m,coefficientInterval:[0,2]})),states,.01)[0].separable,false);
 const m=[{id:'offset',coefficientInterval:[1,1]},{id:'drag',coefficientInterval:[2,2]}];
 assert.equal(compareProbeCourse(m,[{position:0,rate:.5}],.01)[0].separable,false);
 assert.equal(compareProbeCourse(m,[{position:0,rate:.625}],.125)[0].separable,false);
 assert.equal(compareProbeCourse(m,[{position:0,rate:.625}],.124)[0].separable,true);
 assert.throws(()=>compareProbeCourse(models,states,.01,{count:0,limit:0}),/capacity/);
});
test('planner retains complete bounded family and replays only source inputs',()=>{
 const t=probeExample('ambiguous');t.runs=t.runs.filter(r=>r.role==='training');
 const input={contrastRadius:.01,budget:5,probes:[{id:'a',...states[0],cost:1},{id:'b',...states[1],cost:1},{id:'c',position:.6,rate:0,cost:3}]};
 const before=structuredClone({t,input}),r=planProbeCourses(t,input);
 assert.equal(r.courses.length,3);assert.ok(r.selected);assert.deepEqual({t,input},before);
 const raw=JSON.parse(exportProbeCourses(t,input));raw.selected={ids:['forged']};assert.deepEqual(importProbeCourses(JSON.stringify(raw)),r);
 assert.equal(planProbeCourses(t,{...input,budget:0}).selected,null);
 assert.throws(()=>planProbeCourses(probeExample('ambiguous'),input),/training runs only/);
 assert.throws(()=>planProbeCourses(t,{...input,probes:Array(9).fill(input.probes[0])}),/eight/);
});

test('actual maintained training exposes a joint-only course',()=>{
 const t=probeExample('ambiguous');t.runs=t.runs.filter(r=>r.role==='training');
 const r=planProbeCourses(t,{contrastRadius:.001,budget:2,probes:[{id:'slower',position:Math.asin(.5),rate:.47,cost:1},{id:'faster',position:Math.asin(.5),rate:.53,cost:1}]});
 assert.deepEqual(r.selected.jointOnly,[['drag','restoring']]);
 assert.ok(r.selected.states.every(s=>s.separated===0));
 assert.equal(r.status,'all-pairs-separated');
});

test('128 independent Fraction vertex-feasibility oracle controls',()=>{
 // Expected exclusions generated independently by enumerating every pair of
 // boundary lines and checking all inequalities with Python Fraction.
 const expected='10000000100010000000000000000111000110001110000000000000110001101010000000010000100110000001000010000001000010000000100000001000';
 let seed=201;const rand=n=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<128;i++){
  const bounds=Array.from({length:2},()=>[(rand(17)-8)/4,(rand(17)-8)/4].sort((a,b)=>a-b));
  const probes=Array.from({length:2},()=>({rate:(rand(9)-4)/4,position:[0,Math.PI/2,-Math.PI/2][rand(3)]}));
  const radius=(1+rand(4))/8;
  const result=compareProbeCourse([{id:'drag',coefficientInterval:bounds[0]},{id:'restoring',coefficientInterval:bounds[1]}],probes,radius)[0];
  assert.equal(result.separable,expected[i]==='1','case '+i);
 }
});
