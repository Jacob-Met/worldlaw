import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseStateSupport} from '../src/science/state-support.mjs';
const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:4},{id:'bias',coefficient:1}]};
const row=(x,y=4*x+1)=>({command:0,rate:0,position:x,jointTorque:y});
test('many rows do not replace independent state support',()=>{
 const data=Array.from({length:18},(_,i)=>row(i===17?1:0)),before=structuredClone(data);
 const result=diagnoseStateSupport(model,data);
 assert.deepEqual(result.results.map(r=>r.status),['insufficient-rows','structure-unavailable']);
 assert.equal(result.unavailableCount,2);assert.deepEqual(data,before);
});
test('rich analytic design preserves fixed structure after every state omission',()=>{
 const data=Array.from({length:30},(_,i)=>row(i%5));const result=diagnoseStateSupport(model,data);
 assert.equal(result.fittedCount,5);assert.equal(result.results.reduce((s,r)=>s+r.removed,0),30);
 for(const r of result.results){assert.ok(r.predictionShiftRMS<1e-12);assert.deepEqual(r.coefficients.map(t=>t.id),['spring','bias']);}
});
test('one contaminated state materially shifts refits without silently changing terms',()=>{
 const data=Array.from({length:30},(_,i)=>row(i%5,4*(i%5)+1+(i%5===4?10:0)));
 const result=diagnoseStateSupport(model,data);
 assert.ok(result.results.some(r=>r.predictionShiftRMS>1));
 assert.ok(result.results.find(r=>r.state.position===4).predictionShiftRMS<1e-12);
 for(const r of result.results)assert.equal(r.coefficients.length,2);
});
test('exact grouping, complete work refusal, empty and invalid inputs',()=>{
 const data=Array.from({length:40},(_,i)=>row(i));assert.equal(diagnoseStateSupport(model,data).status,'work-limit');
 assert.deepEqual(diagnoseStateSupport(model,data).results,[]);
 const same=Array.from({length:20},()=>row(1));same[19]=row(1+1e-12);
 assert.equal(diagnoseStateSupport(model,same).uniqueStates,2);
 assert.equal(diagnoseStateSupport(model,[]).status,'no-observations');
 assert.throws(()=>diagnoseStateSupport(model,[row(NaN)]));
});
test('executable coefficient refusal is unavailable structure, not attributed rank loss',()=>{
 const boundedModel={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:1}]};
 const data=Array.from({length:16},(_,i)=>row(i<8?1e-9:2e-9,1e12));
 const result=diagnoseStateSupport(boundedModel,data);
 assert.equal(result.results.length,2);
 assert.ok(result.results.every(r=>r.status==='structure-unavailable'));
});
