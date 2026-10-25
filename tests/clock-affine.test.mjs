import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAffineClocks,exportAffineClockInvestigation,reopenAffineClockInvestigation} from '../src/science/clock-affine.mjs';
import {clockOffsetExample} from '../src/science/clock-offset-example.mjs';
function example(){const {model,input}=clockOffsetExample();input.torques.forEach(t=>t.time*=1.01);return {model,input:{...input,schema:'worldlaw.clock-affine-input/v1',stateOrigin:0,torqueOrigin:0,hypotheses:[1,1.005,1.01,1.015].flatMap(scale=>[.18,.2,.22].map(offset=>({id:`${scale}:${offset}`,scale,offset:scale*offset})))}};}
test('joint skew+offset family resolves delayed clock control where offset-only fails later',()=>{
 const {model,input}=example(),r=inspectAffineClocks(model,input);assert.equal(r.selectedId,'1.01:0.2');const selected=r.candidates.find(c=>c.hypothesis.id===r.selectedId);assert.ok(selected.training.rmse<1e-12&&selected.challenge.rmse<1e-12);const constant=r.candidates.filter(c=>c.hypothesis.scale===1).sort((a,b)=>a.training.rmse-b.training.rmse)[0];assert.ok(constant.challenge.rmse>.05);assert.equal(new Set(r.candidates.map(c=>c.rows.map(row=>row.stateIndex).join(','))).size,1);
});
test('original torque brackets independently reconstruct every candidate observation',()=>{
 const {model,input}=example(),r=inspectAffineClocks(model,input);for(const c of r.candidates)for(const row of c.rows){const [a,b=a]=row.torqueIndices.map(i=>input.torques[i]);assert.ok(Math.abs(a.jointTorque*(1-row.fraction)+b.jointTorque*row.fraction-row.interpolatedTorque)<1e-12);assert.equal(row.torqueTime,c.hypothesis.scale*row.stateTime+c.hypothesis.offset);}
});
test('challenge mutation cannot choose affine clock or change any training score',()=>{
 const {model,input}=example(),a=inspectAffineClocks(model,input);input.torques.forEach(t=>{if(t.time>5)t.jointTorque+=50;});const b=inspectAffineClocks(model,input);assert.deepEqual(b.competitive,a.competitive);assert.deepEqual(b.candidates.map(c=>c.training),a.candidates.map(c=>c.training));assert.ok(b.candidates.find(c=>c.hypothesis.id===b.selectedId).challenge.rmse>49);
});
test('clock origins can translate without changing physical correspondence',()=>{
 const {model,input}=example(),a=inspectAffineClocks(model,input);input.states.forEach(s=>s.time+=100);input.torques.forEach(t=>t.time+=200);input.stateOrigin=100;input.torqueOrigin=200;const b=inspectAffineClocks(model,input);assert.equal(b.selectedId,a.selectedId);assert.ok(b.candidates.find(c=>c.hypothesis.id===b.selectedId).challenge.rmse<1e-11);
});
test('global raw source custody rejects across-map leakage even with separate per-map courses',()=>{
 const {model,input}=example();input.hypotheses=[{id:'earlier',scale:1,offset:0},{id:'later',scale:1,offset:5}];input.torques=Array.from({length:201},(_,i)=>({time:i/10,jointTorque:i/10}));assert.throws(()=>inspectAffineClocks(model,input),/share original torque/);
});
test('common support excludes by entire family and preserves failure reason',()=>{
 const {model,input}=example();input.states.unshift({time:.01,position:0,rate:0,command:0,role:'training'});input.hypotheses.push({id:'negative',scale:1,offset:-.2});const r=inspectAffineClocks(model,input);assert.equal(r.excluded[0].stateIndex,0);assert.equal(r.excluded[0].failures[0].reason,'outside_torque_support');assert.ok(r.candidates.every(c=>c.rows[0].stateIndex===1));
});
test('flat evidence retains all affine ties; wrong fixed law remains wrong',()=>{
 const {model,input}=example();input.states.forEach(s=>s.command=2);input.torques.forEach(t=>t.jointTorque=2);let r=inspectAffineClocks(model,input);assert.equal(r.selectedId,null);assert.equal(r.competitive.length,12);model.terms[0].coefficient=3;r=inspectAffineClocks(model,input);assert.ok(r.candidates.every(c=>Math.abs(c.training.rmse-4)<1e-12));
});
test('input-only portable replay ignores derived claims',()=>{
 const {model,input}=example(),saved=JSON.parse(exportAffineClockInvestigation(model,input));assert.equal(saved.result,undefined);saved.result={selectedId:'wrong'};assert.equal(reopenAffineClockInvestigation(JSON.stringify(saved)).result.selectedId,'1.01:0.2');
});
test('duplicate, collapsed, unbounded and unsupported maps refuse',()=>{
 const {model,input}=example();for(const edit of [x=>x.hypotheses.push(x.hypotheses[0]),x=>x.hypotheses[0].scale=0,x=>x.hypotheses[0].offset=Infinity,x=>x.units.time='ms',x=>x.stateOrigin=NaN,x=>x.hypotheses=Array.from({length:66},(_,i)=>({id:String(i),scale:1,offset:i/100}))]){const bad=structuredClone(input);edit(bad);assert.throws(()=>inspectAffineClocks(model,bad));}
});
test('independent irregular linear signal recovers negative skew with nonzero origins',()=>{
 const model={schema:'worldlaw.torque-model/v1',terms:[{id:'command',coefficient:1}]};
 const hypotheses=[.98,1,1.02].flatMap(scale=>[-.1,0,.1].map(offset=>({id:`${scale}/${offset}`,scale,offset})));
 const states=Array.from({length:40},(_,i)=>{const time=i<20?10.5+i*.1:16+(i-20)*.1;return {time,position:0,rate:0,command:2*(20+.98*(time-10)-.1)+3,role:i<20?'training':'challenge'};});
 const torques=Array.from({length:201},(_,i)=>{const time=20+i*.05+(i%2)*.005;return {time,jointTorque:2*time+3};});
 const r=inspectAffineClocks(model,{schema:'worldlaw.clock-affine-input/v1',source:'independent affine analytic control',units:{time:'s',position:'rad',rate:'rad/s',command:'N·m',jointTorque:'N·m'},stateOrigin:10,torqueOrigin:20,maxGap:.06,tieTolerance:1e-10,hypotheses,states,torques});assert.equal(r.selectedId,'0.98/-0.1');assert.ok(r.candidates.find(c=>c.hypothesis.id===r.selectedId).challenge.rmse<1e-12);
});
test('complete maximum family executes within declared input limits without sampling',()=>{
 const {model,input}=example();input.hypotheses=Array.from({length:65},(_,i)=>({id:String(i),scale:1+(i-32)*1e-6,offset:0}));input.torques=Array.from({length:4096},(_,i)=>({time:i*.01,jointTorque:i*.02}));input.states=Array.from({length:2048},(_,i)=>{const time=i<1024?1+i*.01:21+(i-1024)*.01;return {time,command:2*time,position:0,rate:0,role:i<1024?'training':'challenge'};});const r=inspectAffineClocks(model,input);assert.equal(r.candidates.length,65);assert.equal(r.admittedStateIndices.length,2048);assert.equal(r.selectedId,'32');assert.equal(r.candidates.reduce((sum,c)=>sum+c.rows.length,0),65*2048);
});
test('retained negative: gain error on a linear course can masquerade as clock scale',()=>{
 // Ground truth clocks are aligned. The torque instrument has gain 1.25.
 // This data alone cannot distinguish that defect from a scale-0.8 clock map.
 const model={schema:'worldlaw.torque-model/v1',terms:[{id:'command',coefficient:1}]};
 const states=Array.from({length:20},(_,i)=>{const time=i<10?1+i*.1:6+(i-10)*.1;return {time,command:time,position:0,rate:0,role:i<10?'training':'challenge'};});
 const torques=Array.from({length:101},(_,i)=>({time:i/10,jointTorque:1.25*i/10}));
 const r=inspectAffineClocks(model,{schema:'worldlaw.clock-affine-input/v1',source:'Aligned clocks with authored torque gain error',units:{time:'s',position:'rad',rate:'rad/s',command:'N·m',jointTorque:'N·m'},stateOrigin:0,torqueOrigin:0,maxGap:.11,tieTolerance:1e-10,hypotheses:[{id:'aligned',scale:1,offset:0},{id:'apparent-clock-change',scale:.8,offset:0}],states,torques});assert.equal(r.selectedId,'apparent-clock-change');assert.ok(r.candidates[1].training.rmse<1e-12&&r.candidates[1].challenge.rmse<1e-12);assert.ok(r.limitations.some(s=>s.includes('confounded')));
});
