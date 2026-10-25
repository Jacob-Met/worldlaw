import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectClockOffsets,exportClockInvestigation,reopenClockInvestigation} from '../src/science/clock-offset.mjs';
import {clockOffsetExample} from '../src/science/clock-offset-example.mjs';
const copy=x=>structuredClone(x);
test('declared delay beats zero on same original rows; brackets independently reconstruct evidence',()=>{
 const {model,input}=clockOffsetExample(),r=inspectClockOffsets(model,input);
 assert.equal(r.selectedOffset,.2);assert.equal(r.candidates.length,7);assert.ok(r.candidates.find(c=>c.offset===0).training.rmse>.1);
 for(const c of r.candidates){assert.equal(c.rows.length,32);for(const row of c.rows){const [a,b=a]=row.torqueIndices.map(i=>input.torques[i]);assert.ok(Math.abs(a.jointTorque*(1-row.fraction)+b.jointTorque*row.fraction-row.interpolatedTorque)<1e-12);}}
 assert.ok(r.candidates.find(c=>c.offset===.2).challenge.rmse<1e-12);
});
test('challenge mutation cannot alter training selection or ranking',()=>{
 const {model,input}=clockOffsetExample(),a=inspectClockOffsets(model,input);for(const t of input.torques)if(t.time>5)t.jointTorque+=20;
 const b=inspectClockOffsets(model,input);assert.deepEqual(a.competitive,b.competitive);assert.deepEqual(a.candidates.map(c=>c.training),b.candidates.map(c=>c.training));assert.ok(b.candidates.find(c=>c.offset===.2).challenge.rmse>19);
});
test('flat signal retains all ties and wrong law remains mismatched',()=>{
 const {model,input}=clockOffsetExample();for(const r of input.states)r.command=2;for(const r of input.torques)r.jointTorque=2;
 let r=inspectClockOffsets(model,input);assert.equal(r.selectedOffset,null);assert.equal(r.competitive.length,7);
 model.terms[0].coefficient=3;r=inspectClockOffsets(model,input);assert.ok(r.candidates.every(c=>c.training.rmse===4&&c.challenge.rmse===4));
});
test('common support excludes rows identically, never extrapolates',()=>{
 const {model,input}=clockOffsetExample();input.states.unshift({time:.05,position:0,rate:0,command:0,role:'training'});
 const r=inspectClockOffsets(model,input);assert.deepEqual(r.excludedStateIndices,[0]);assert.ok(r.candidates.every(c=>c.rows.length===32&&!c.rows.some(row=>row.stateIndex===0)));
 input.states.forEach(s=>s.time+=.001);input.maxGap=.01;assert.throws(()=>inspectClockOffsets(model,input),/Common support/);
});
test('cross-grid source guard rejects training/challenge reuse',()=>{
 const {model,input}=clockOffsetExample();input.states[15].role='challenge';assert.throws(()=>inspectClockOffsets(model,input),/share original torque/);
});
test('explicit units, monotone clocks, finite grid and finite work enforced',()=>{
 const {model,input}=clockOffsetExample();for(const mutate of [x=>x.units.time='ms',x=>x.torques[2].time=x.torques[1].time,x=>x.offsets.push(0),x=>x.offsets=[NaN],x=>x.maxGap=0,x=>x.states[1].command=Infinity,x=>x.states[0].role='test']){const bad=copy(input);mutate(bad);assert.throws(()=>inspectClockOffsets(model,bad));}
});
test('input-only save/reopen recomputes, ignores forged derived conclusions',()=>{
 const {model,input}=clockOffsetExample(),text=exportClockInvestigation(model,input),saved=JSON.parse(text);assert.equal(saved.result,undefined);saved.result={selectedOffset:99};const r=reopenClockInvestigation(JSON.stringify(saved));assert.equal(r.result.selectedOffset,.2);saved.input.torques.forEach(t=>t.jointTorque=0);assert.equal(reopenClockInvestigation(JSON.stringify(saved)).result.selectedOffset,null);
});
test('irregular time brackets support linear signal at independent shifted clock',()=>{
 const {model,input}=clockOffsetExample();input.torques=Array.from({length:151},(_,i)=>({time:i*.07+(i%2)*.005,jointTorque:3*(i*.07+(i%2)*.005)+2}));input.maxGap=.08;input.states.forEach(s=>s.command=3*(s.time+.2)+2);
 const r=inspectClockOffsets(model,input);assert.equal(r.selectedOffset,.2);assert.ok(r.candidates.find(c=>c.offset===.2).challenge.rmse<1e-12);
});
test('offset sign and candidate order are explicit, never row-count optimized',()=>{
 const {model,input}=clockOffsetExample();input.torques.forEach(t=>t.time-=.4);input.offsets=[.2,.1,0,-.1,-.2,-.3,-.4];const r=inspectClockOffsets(model,input);assert.equal(r.selectedOffset,-.2);assert.equal(new Set(r.candidates.map(c=>c.rows.map(v=>v.stateIndex).join(','))).size,1);
});
test('full declared work limit remains bounded and keeps original source custody',()=>{
 const {model,input}=clockOffsetExample();input.offsets=Array.from({length:65},(_,i)=>(i-32)*.001);input.torques=Array.from({length:4096},(_,i)=>({time:i*.01,jointTorque:i*.02}));input.states=Array.from({length:2048},(_,i)=>({time:i<1024?1+i*.01:21+(i-1024)*.01,position:0,rate:0,command:2*(i<1024?1+i*.01:21+(i-1024)*.01),role:i<1024?'training':'challenge'}));const r=inspectClockOffsets(model,input);assert.equal(r.candidates.length,65);assert.equal(r.admittedStateIndices.length,2048);assert.equal(r.selectedOffset,0);input.offsets.push(.1);assert.throws(()=>inspectClockOffsets(model,input),/1–65/);
});
