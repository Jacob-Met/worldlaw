import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSparseAdditivity} from '../src/science/additive-graph.mjs';
import {inspectSeparability} from '../src/science/separability.mjs';
const declaration={axes:['command','position'],fixedValue:0,torqueRadius:0,exactCoordinates:true};
const loop=[[0,0],[0,1],[1,1],[1,2],[2,2],[2,0]].map(([command,position])=>({command,position,rate:0,jointTorque:command*position}));
const numeric=x=>Number(x.integer)*2**x.powerOfTwo;
function checkAssignment(result,rows){
 const a=new Map(result.potentials.filter(p=>p.axis===result.declaration.axes[0]).map(p=>[p.value,numeric(p.valueExact)]));
 const b=new Map(result.potentials.filter(p=>p.axis===result.declaration.axes[1]).map(p=>[p.value,numeric(p.valueExact)]));
 for(const row of rows.filter(row=>row[result.fixedAxis]===result.declaration.fixedValue)){
  const p=a.get(row[result.declaration.axes[0]])+b.get(row[result.declaration.axes[1]]),r=result.declaration.torqueRadius;
  assert.ok(row.jointTorque-r<=p&&p<=row.jointTorque+r);
 }
}
test('sparse six-row cycle excludes additivity with zero complete rectangles and original source signs',()=>{
 const before=structuredClone(loop),result=inspectSparseAdditivity(loop,declaration);
 assert.equal(inspectSeparability(loop,declaration).rectangles.length,0);
 assert.equal(result.status,'additivity-excluded');assert.equal(result.witness.edges.length,6);
 const balance=new Map();let total=0;
 for(const edge of result.witness.edges){const row=loop[edge.row];total+=edge.sign*row.jointTorque;
  for(const axis of declaration.axes){const key=`${axis}:${row[axis]}`;balance.set(key,(balance.get(key)||0)+edge.sign);}}
 assert.ok([...balance.values()].every(x=>x===0));assert.equal(total,-3);assert.equal(numeric(result.witness.upperBound),-3);assert.deepEqual(loop,before);
});
test('equality receives an exact constructive assignment, while a smaller bound excludes',()=>{
 const pass=inspectSparseAdditivity(loop,{...declaration,torqueRadius:.5});assert.equal(pass.status,'compatible-on-observed-slice');checkAssignment(pass,loop);
 assert.equal(inspectSparseAdditivity(loop,{...declaration,torqueRadius:.49}).status,'additivity-excluded');
});
test('disconnected trees receive every original bound and repeats remain a distinct conflict',()=>{
 const rows=[...loop.slice(0,5),{command:8,position:9,rate:0,jointTorque:100}];const pass=inspectSparseAdditivity(rows,declaration);
 assert.equal(pass.status,'compatible-on-observed-slice');checkAssignment(pass,rows);
 const bad=[...rows,{...rows[0],jointTorque:1}];const conflict=inspectSparseAdditivity(bad,declaration);
 assert.equal(conflict.status,'incompatible-replicates');assert.deepEqual(conflict.conflict.rows,[6,0]);
 assert.equal(inspectSparseAdditivity(bad,{...declaration,torqueRadius:.5}).status,'compatible-on-observed-slice');
});
test('all ordered input-axis pairs and off-slice rows preserve the source certificate',()=>{
 for(const x of ['command','position','rate'])for(const y of ['command','position','rate'].filter(k=>k!==x)){
  const z=['command','position','rate'].find(k=>k!==x&&k!==y);
  const rows=loop.map(r=>({[x]:r.command,[y]:r.position,[z]:7,jointTorque:r.jointTorque}));
  rows.unshift({command:50,position:50,rate:50,jointTorque:1e6});
  const result=inspectSparseAdditivity(rows,{...declaration,axes:[x,y],fixedValue:7});
  assert.equal(result.status,'additivity-excluded');assert.equal(result.sliceRowCount,6);assert.ok(result.witness.edges.every(e=>e.row>0));
 }
});
test('graph work is independent of preserved rectangle output refusal; no partial graph result on exhaustion',()=>{
 const dense=[];for(let u=0;u<13;u++)for(let p=0;p<7;p++)dense.push({command:u,position:p,rate:0,jointTorque:u+p});
 assert.throws(()=>inspectSeparability(dense,declaration),/rectangle limit/);
 const graph=inspectSparseAdditivity(dense,declaration);assert.equal(graph.status,'compatible-on-observed-slice');checkAssignment(graph,dense);
 assert.throws(()=>inspectSparseAdditivity(loop,declaration,{maxWork:1}),/no partial result/);
 assert.throws(()=>inspectSparseAdditivity(loop,declaration,{maxWork:Infinity}),/Unsupported/);
 assert.throws(()=>inspectSparseAdditivity(loop,{...declaration,exactCoordinates:false}),/explicitly/);
 assert.equal(inspectSparseAdditivity(loop,{...declaration,fixedValue:4}).status,'no-source-states');
});
test('subnormal source contradiction uses exact sign and serializable certificate, not rounded display',()=>{
 const rows=loop.map((r,i)=>({...r,jointTorque:i===0?Number.MIN_VALUE:0}));
 const result=inspectSparseAdditivity(rows,declaration);assert.equal(result.status,'additivity-excluded');
 assert.ok(BigInt(result.witness.upperBound.integer)<0n);assert.equal(result.witness.upperBound.powerOfTwo,-1074);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
 assert.equal(inspectSparseAdditivity(rows,{...declaration,torqueRadius:Number.MIN_VALUE}).status,'compatible-on-observed-slice');
});
