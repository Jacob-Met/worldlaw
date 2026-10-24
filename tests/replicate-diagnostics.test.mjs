import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseReplicates} from '../src/science/replicate-diagnostics.mjs';
const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:2}]};
const row=(position,jointTorque)=>({command:0,rate:0,position,jointTorque});
test('independent repeated-state arithmetic separates changed scatter and mean',()=>{
 const data=[row(1,1),row(1,3),row(2,5),row(2,7)], before=structuredClone(data);
 const d=diagnoseReplicates(model,data);
 assert.equal(d.pureErrorSSE,4);assert.equal(d.meanMismatchSSE,8);assert.equal(d.residualSSE,12);
 assert.equal(d.pureErrorDF,2);assert.equal(d.decompositionError,0);assert.deepEqual(data,before);
 const w=diagnoseReplicates(model,[row(1,0),row(1,4),row(2,4),row(2,8)]);
 assert.equal(w.meanMismatchSSE,8);assert.equal(w.pureErrorSSE,16);
 const shifted=diagnoseReplicates(model,[row(1,2),row(1,4),row(2,6),row(2,8)]);
 assert.equal(shifted.pureErrorSSE,4);assert.equal(shifted.meanMismatchSSE,20);
});
test('complete denominators preserve singletons, empty and one-state evidence',()=>{
 assert.equal(diagnoseReplicates(model,[]).status,'no-observations');
 const single=diagnoseReplicates(model,[row(1,2),row(2,4)]);
 assert.equal(single.status,'no-replication');assert.equal(single.repeatabilityRMS,null);
 const same=diagnoseReplicates(model,[row(1,1),row(1,3),row(2,4)]);
 assert.equal(same.singletonRows,1);assert.equal(same.replicatedRows,2);assert.equal(same.pureErrorDF,1);
 const exact=diagnoseReplicates(model,[row(1,2),row(1,2)]);
 assert.equal(exact.repeatabilityRMS,0);assert.equal(exact.uniqueStates,1);
 assert.equal(diagnoseReplicates(model,[row(1,2),row(1+1e-12,2)]).uniqueStates,2);
});
test('model changes preserve within-state scatter; invalid source refuses',()=>{
 const data=[row(1,1),row(1,3),row(2,5),row(2,7)];
 const a=diagnoseReplicates(model,data), b=diagnoseReplicates({...model,terms:[]},data);
 assert.equal(a.pureErrorSSE,b.pureErrorSSE);assert.notEqual(a.meanMismatchSSE,b.meanMismatchSSE);
 assert.throws(()=>diagnoseReplicates(model,[row(NaN,1)]));
 assert.throws(()=>diagnoseReplicates({},data));
});
