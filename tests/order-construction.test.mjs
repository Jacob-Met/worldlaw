import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {constructOrders,selectConstructedOrders} from '../src/unknown-lab/order-construction.mjs';import {compareOrderArtifacts} from '../src/unknown-lab/periodic-order.mjs';
const raw=JSON.parse(await readFile(new URL('../examples/order-construction.json',import.meta.url)));
test('complete 8/10/12 families and original comparison parity',()=>{
 for(const [pairCount,count]of [[8,70],[10,252],[12,924]]){const r=constructOrders({...raw,pairCount,maximumVariance:2/pairCount+.01});assert.equal(r.count,count);assert.equal(new Set(r.plans.map(p=>JSON.stringify(p.pairs))).size,count);assert.ok(r.bestIds.length>=2);assert.ok(r.bestGain<.4);for(const p of r.plans){assert.equal(p.pairs.filter(x=>x.reference<x.conditioned).length,pairCount/2);assert.deepEqual(p.pairs.flatMap(x=>[x.reference,x.conditioned]).sort((a,b)=>a-b),Array.from({length:2*pairCount},(_,i)=>i));}
 const selected=selectConstructedOrders(r.inputs,[r.plans[0].id,r.bestIds[0]]);const comparison=compareOrderArtifacts(selected);for(const row of comparison.rows)assert.deepEqual(row.artifacts,r.rows.find(x=>x.id===row.id).artifacts);
 }
});
test('exact nominal budget stays unresolved; impossible budget yields no winner',()=>{
 const r=constructOrders({...raw,maximumVariance:.25});assert.equal(r.within,0);assert.equal(r.boundary,8);assert.deepEqual(r.bestIds,[]);
 const impossible=constructOrders({...raw,maximumVariance:0});assert.equal(impossible.within,0);assert.equal(impossible.boundary,0);assert.equal(impossible.bestGain,null);
});
test('raw replay, source retention and bounds',()=>{
 const r=constructOrders(raw);assert.deepEqual(constructOrders(JSON.parse(JSON.stringify(r.inputs))),r);
 for(const patch of [{pairCount:14},{pairCount:'8'},{maximumVariance:NaN},{maximumVariance:-1},{sourceNote:''}])assert.throws(()=>constructOrders({...raw,...patch}));
 assert.throws(()=>selectConstructedOrders(raw,['order-85','missing']));assert.throws(()=>selectConstructedOrders(raw,['order-85','order-85']));
});
