import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compareSerialOrders} from '../src/unknown-lab/serial-order.mjs';
const example=JSON.parse(await readFile(new URL('../examples/serial-orders.json',import.meta.url)));
test('offered course retains alternatives and changes ties with hypotheses',()=>{
 const r=compareSerialOrders(example);assert.equal(r.rows.length,2);assert.equal(r.rows[0].minimaxTie,true);assert.equal(r.rows[1].minimaxTie,false);
 assert.ok(Math.abs(r.rows[1].worstVariance-.6340941843854192)<1e-13);
 const changed=compareSerialOrders({...example,rhos:[0,.5,.9]});assert.ok(changed.rows.every(r=>r.minimaxTie));assert.ok(changed.rows.every(r=>r.worstVariance===.25));
 assert.deepEqual(compareSerialOrders(JSON.parse(JSON.stringify(r.inputs))),r);
});
test('independent innovations oracle for gaps and negative correlation',()=>{
 const raw=structuredClone(example);for(const p of raw.plans)for(const x of p.pairs){const shift=3*Math.floor(x.reference/2);x.reference+=shift;x.conditioned+=shift;}
 const r=compareSerialOrders(raw);
 for(let k=0;k<raw.plans.length;k++)for(let h=0;h<raw.rhos.length;h++){
  const rho=raw.rhos[h],weights=new Map(raw.plans[k].pairs.flatMap(p=>[[p.reference,-.125],[p.conditioned,.125]]));let coefficient=0,sum=0;
  for(let i=Math.max(...weights.keys());i>=0;i--){coefficient=rho*coefficient+(weights.get(i)||0);sum+=coefficient**2*(i?1-rho*rho:1);}
  assert.ok(Math.abs(sum-r.rows[k].variances[h])<1e-13);
 }
});
test('complete inputs and budget refusal never silently omit a plan',()=>{
 for(const change of [x=>x.rhos.push(0),x=>x.plans[0].pairs[0].reference=100,x=>x.plans[1].id=x.plans[0].id,x=>x.plans[0].pairs.pop()]){const raw=structuredClone(example);change(raw);assert.throws(()=>compareSerialOrders(raw));}
 const forged={...example,rows:[{minimaxTie:true}]};assert.deepEqual(compareSerialOrders(forged),compareSerialOrders(example));
});

test('resource admission is complete and duplicate indices refuse',()=>{
 const large={schema:example.schema,sourceNote:example.sourceNote,rhos:Array.from({length:16},(_,i)=>(i-8)/10),plans:Array.from({length:32},(_,p)=>({id:'p'+p,pairs:Array.from({length:128},(_,i)=>({reference:2*i+(i%2),conditioned:2*i+1-(i%2)}))}))};assert.throws(()=>compareSerialOrders(large),/two million/);
 const repeated=structuredClone(example);repeated.plans[0].pairs[2]=structuredClone(repeated.plans[0].pairs[0]);assert.throws(()=>compareSerialOrders(repeated),/repeat/);
});

test('sparse hypotheses, plans and pairs refuse rather than silently skip',()=>{
 for(const hole of [x=>delete x.rhos[1],x=>delete x.plans[0],x=>{x.plans[0].pairs.length=9;}]){const x=structuredClone(example);hole(x);assert.throws(()=>compareSerialOrders(x));assert.throws(()=>compareSerialOrders(JSON.parse(JSON.stringify(x))));}
 const r=compareSerialOrders(example);assert.deepEqual(compareSerialOrders(JSON.parse(JSON.stringify(r.inputs))),r);assert.equal(r.rows[0].pairCount,8);
});

test('same paired-reading budget and literal planning basis retained',()=>{
 const x=structuredClone(example);x.plans[1].pairs.push({reference:16,conditioned:17});assert.throws(()=>compareSerialOrders(x),/same total pair count/);
 const same=structuredClone(example);for(const p of same.plans){p.pairs.push({reference:16,conditioned:17});p.pairs.push({reference:18,conditioned:19});}
 same.sourceNote='Authored <basis> with newline\nretained';const r=compareSerialOrders(same);assert.ok(r.rows.every(x=>x.pairCount===10));assert.equal(r.inputs.sourceNote,same.sourceNote);assert.deepEqual(compareSerialOrders(JSON.parse(JSON.stringify(r.inputs))),r);assert.equal(r.rows[0].acquisitionSpan,19);
 delete same.sourceNote;assert.throws(()=>compareSerialOrders(same),/planning basis/);
});
