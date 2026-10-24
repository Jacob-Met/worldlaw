import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {compareOrderArtifacts} from '../src/unknown-lab/periodic-order.mjs';import {compareSerialOrders} from '../src/unknown-lab/serial-order.mjs';
const input=JSON.parse(await readFile(new URL('../examples/periodic-orders.json',import.meta.url)));
test('analytic alternating gain, degenerate constant samples and changed period',()=>{
 const r=compareOrderArtifacts(input);assert.ok(Math.abs(r.rows[0].artifacts[1].gain-Math.SQRT2)<1e-12);assert.ok(r.rows[1].artifacts[1].gain<1e-12);assert.ok(Math.abs(r.rows[1].artifacts[2].gain-.3953817094288733)<1e-12);assert.ok(r.rows.every(x=>x.artifacts[0].gain<1e-12));assert.deepEqual(compareOrderArtifacts(JSON.parse(JSON.stringify(r.inputs))),r);assert.throws(()=>compareSerialOrders(input));
 const v1={...input,schema:'worldlaw.serial-orders/v1'};delete v1.periodic;assert.deepEqual(compareOrderArtifacts(v1),compareSerialOrders(v1));
});
test('independent direct phase sweep approaches arbitrary-phase gain',()=>{
 const r=compareOrderArtifacts(input);
 for(let i=0;i<input.plans.length;i++)for(const result of r.rows[i].artifacts){let maximum=0;for(let k=0;k<8192;k++){const phase=2*Math.PI*k/8192;let contrast=0;for(const p of input.plans[i].pairs)contrast+=(Math.sin(2*Math.PI*p.conditioned/result.period+phase)-Math.sin(2*Math.PI*p.reference/result.period+phase))/8;maximum=Math.max(maximum,Math.abs(contrast));}assert.ok(Math.abs(maximum-result.gain)<2e-7);}
});
test('source, sparse, oversized and shifted inputs preserve complete admission',()=>{
 for(const alter of [x=>delete x.periodic.sourceNote,x=>delete x.periodic.periods[1],x=>x.periodic.periods.push(4),x=>x.periodic.periods=[0],x=>x.plans[0].pairs[0]={reference:2000000,conditioned:2000001}]){const x=structuredClone(input);alter(x);assert.throws(()=>compareOrderArtifacts(x));}
 const shifted=structuredClone(input);for(const p of shifted.plans)for(const x of p.pairs){x.reference+=999999000;x.conditioned+=999999000;}
 const original=compareOrderArtifacts(input),other=compareOrderArtifacts(shifted);assert.deepEqual(other.rows.map(r=>r.artifacts),original.rows.map(r=>r.artifacts));
});
