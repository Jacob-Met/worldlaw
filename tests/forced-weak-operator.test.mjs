import test from 'node:test';
import assert from 'node:assert/strict';
import {weakWindows} from '../src/trajectory/weak-operator.mjs';
const insist=(ok,message)=>{if(!ok)throw new Error(message);};
const options={terms:['command'],windowDuration:1,windowStride:.5};
const make=(affine=0,irregular=false)=>({samples:Array.from({length:1001},(_,i)=>{
 const time=i*.01+(irregular&&i>0?.001*Math.sin(i):0);
 return {time,position:time*time+affine*(3+7*time),command:2};
})});
test('supplied forcing recovers constant acceleration over uniform and irregular clocks',()=>{
 for(const irregular of [false,true]){
  const rows=weakWindows(make(1,irregular),options,null,insist);
  assert.ok(rows.length>=18);
  assert.ok(Math.max(...rows.map(r=>Math.abs(r.target-r.columns[0])))<1e-6);
 }
});
test('compact target removes unknown affine starting trajectory without removing actual forcing',()=>{
 const base=weakWindows(make(),options,null,insist);
 const shifted=weakWindows(make(1),options,null,insist);
 for(let i=0;i<base.length;i++){
  assert.ok(Math.abs(base[i].target-shifted[i].target)<1e-10);
  assert.deepEqual(base[i].columns,shifted[i].columns);
 }
 const omitted=make(); omitted.samples.forEach(row=>row.command=0);
 const noForce=weakWindows(omitted,options,null,insist);
 assert.ok(noForce.every(row=>row.columns[0]===0));
 assert.ok(noForce.some(row=>Math.abs(row.target)>.01));
});
