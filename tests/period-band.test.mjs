import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {inspectPeriodBands} from '../src/unknown-lab/period-band.mjs';
const raw=JSON.parse(await readFile(new URL('../examples/period-bands.json',import.meta.url)));
test('band reverses misleading endpoint ranking and preserves both strategies',()=>{
 const r=inspectPeriodBands(raw);assert.equal(r.rows.length,2);assert.ok(r.comparison.rows[0].artifacts.every(a=>a.gain<.376));
 const a=r.rows[0].strategies[1],b=r.rows[1].strategies[1];assert.ok(a.lower>1.42);assert.ok(b.upper<1);assert.ok(b.upper<a.lower);assert.ok(a.evaluations<=31);assert.ok(a.cells.length>1);assert.deepEqual(inspectPeriodBands(JSON.parse(JSON.stringify(r.inputs))),r);
});
test('direct dense independent Fourier controls stay within reported engineering brackets',()=>{
 const r=inspectPeriodBands(raw);for(let i=0;i<2;i++){let max=0;for(let j=0;j<=10000;j++){const period=3+2*j/10000;let re=0,im=0;for(const p of raw.comparison.plans[i].pairs)for(const[t,w]of[[p.reference,-.125],[p.conditioned,.125]]){re+=w*Math.cos(2*Math.PI*t/period);im+=w*Math.sin(2*Math.PI*t/period);}max=Math.max(max,Math.hypot(re,im));}for(const s of r.rows[i].strategies){assert.ok(max<=s.upper);assert.ok(max+1e-6>=s.lower);}}
});
test('budget exhaustion is explicit and whole inputs refused',()=>{
 const r=inspectPeriodBands({...raw,evaluations:5,tolerance:1e-10});assert.ok(r.rows.every(r=>r.strategies.every(s=>s.status==='unresolved-budget')));
 for(const patch of [{evaluations:4},{tolerance:0},{bands:Array(1)},{bands:[{...raw.bands[0],fromPeriod:5,toPeriod:3}]}])assert.throws(()=>inspectPeriodBands({...raw,...patch}));
});
test('near cancellation and small-budget adaptive loss stay visible',()=>{
 const input=structuredClone(raw);input.comparison.plans[1]={id:'mask90',pairs:Array.from({length:8},(_,i)=>({reference:2*i+1-(90>>i&1),conditioned:2*i+(90>>i&1)}))};input.bands=[{id:'near-one',sourceNote:'Authored low-response control',fromPeriod:1,toPeriod:1.001}];input.tolerance=1e-10;
 const r=inspectPeriodBands(input),[uniform,adaptive]=r.rows[1].strategies;assert.ok(uniform.gap<adaptive.gap);assert.ok(adaptive.upper<.00001);
 input.bands=[{id:'near-four',sourceNote:'Authored cancellation sensitivity',fromPeriod:3.99,toPeriod:4.01}];const q=inspectPeriodBands(input);assert.ok(q.rows[1].strategies[1].lower>.02);
});
