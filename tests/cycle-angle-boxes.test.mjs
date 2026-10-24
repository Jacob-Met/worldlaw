import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeAngleBoxes,normalizeAngleBoxes,evaluateAngleBoxWitness,angleBoxWitnessRow,exportAngleBoxes,importAngleBoxes} from '../src/cycle-work/angle-boxes.mjs';
import {angleBoxExample} from '../src/cycle-work/angle-boxes-example.mjs';
const rational=x=>Number(BigInt(x.integer))*2**x.powerOfTwo;
const compare=(a,b)=>{const e=Math.min(a.powerOfTwo,b.powerOfTwo),n=(BigInt(a.integer)<<BigInt(a.powerOfTwo-e))-(BigInt(b.integer)<<BigInt(b.powerOfTwo-e));return n<0n?-1:n>0n?1:0;};
test('narrow and widened angular boxes change work sign with exact middle-torque cancellation',()=>{
 const a=analyzeAngleBoxes(angleBoxExample()),b=analyzeAngleBoxes(angleBoxExample('zero-compatible'));
 assert.equal(a.conclusion,'negative-work');assert.equal(rational(a.minimum.work),-2.5);assert.equal(rational(a.maximum.work),-1.5);
 assert.equal(b.conclusion,'zero-compatible');assert.equal(rational(b.minimum.work),-4);assert.equal(BigInt(b.maximum.work.integer),0n);
});
test('every retained witness re-evaluates without decimal roundtrip',()=>{
 for(const kind of ['narrow','zero-compatible','independent-return-rows']){
  const raw=angleBoxExample(kind),r=analyzeAngleBoxes(raw);
  for(const name of ['minimum','maximum']){assert.deepEqual(evaluateAngleBoxWitness(raw,r[name].corners),r[name].work);assert.equal(r[name].corners[0]>>1,r[name].corners.at(-1)>>1);}
 }
});
test('exact endpoint construction retains sub-ulp angular radius',()=>{
 const raw=angleBoxExample();raw.cycle.samples.forEach((r,i)=>{r.position=i===1?1000001-1:999999;r.torqueRadius=0;});raw.positionRadii=[Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE];
 const r=analyzeAngleBoxes(raw),p=angleBoxWitnessRow(raw,r.minimum.corners,0);
 assert.notEqual(BigInt(p.position.integer),999999n<<1074n);
 assert.equal(compare(r.minimum.work,r.maximum.work),-1);
});
test('zero angular radii agree with maintained torque-box result within its rounding guard',()=>{
 const raw=angleBoxExample();raw.positionRadii.fill(0);raw.cycle.samples[0].torqueRadius=.25;raw.cycle.samples[2].torqueRadius=.5;
 const r=analyzeAngleBoxes(raw);assert.equal(rational(r.minimum.work),r.nominal.work-r.nominal.torqueBound);assert.equal(rational(r.maximum.work),r.nominal.work+r.nominal.torqueBound);
});
test('independent interior equal-angle rows retain separate endpoint choices',()=>{
 const raw=angleBoxExample('independent-return-rows'),r=analyzeAngleBoxes(raw);
 assert.ok(r.maximum.corners.some((c,i)=>i===2&&(c>>1)!==(r.maximum.corners[1]>>1))||r.minimum.corners.some((c,i)=>i===2&&(c>>1)!==(r.minimum.corners[1]>>1)));
 assert.equal(r.minimum.corners.length,4);
});
test('integration allowance expands exact extrema separately and reversal negates them',()=>{
 const raw=angleBoxExample();raw.cycle.integrationAllowance=.25;const a=analyzeAngleBoxes(raw);
 assert.equal(rational(a.interval[0]),-2.75);assert.equal(rational(a.interval[1]),-1.25);assert.equal(rational(a.minimum.work),-2.5);
 raw.cycle.samples.reverse();raw.positionRadii.reverse();const b=analyzeAngleBoxes(raw);
 assert.equal(rational(b.minimum.work),-rational(a.maximum.work));assert.equal(rational(b.maximum.work),-rational(a.minimum.work));
});
test('raw replay discards saved claims, preserves input and rejects closure or witness tampering',()=>{
 const raw=angleBoxExample(),before=structuredClone(raw);const a=analyzeAngleBoxes(raw);assert.deepEqual(raw,before);
 const replay=importAngleBoxes(JSON.stringify({...raw,minimum:{work:'forged'},conclusion:'positive-work'}));assert.equal(replay.minimum,undefined);assert.equal(analyzeAngleBoxes(replay).conclusion,a.conclusion);assert.deepEqual(importAngleBoxes(exportAngleBoxes(raw)),normalizeAngleBoxes(raw));
 assert.throws(()=>normalizeAngleBoxes({...raw,positionRadii:[.25,.125,.125]}),/identical/);
 const corners=[...a.minimum.corners];corners[corners.length-1]^=2;assert.throws(()=>evaluateAngleBoxWitness(raw,corners),/shared return/);
});
test('full maintained4096-row admission and exact mixed-exponent witness',()=>{
 const raw=angleBoxExample();raw.cycle.samples=Array.from({length:4096},(_,i)=>({position:i===4095?Number.MIN_VALUE:i%3===0?Number.MIN_VALUE:i%3===1?1e6:-1e6,jointTorque:i%3===0?Number.MIN_VALUE:i%3===1?1e12:-1e12,torqueRadius:i%2?Number.MIN_VALUE:1e12}));
 raw.positionRadii=raw.cycle.samples.map((_,i)=>i===0||i===4095?Number.MIN_VALUE:i%2?1e6:Number.MIN_VALUE);
 const r=analyzeAngleBoxes(raw);assert.equal(r.minimum.corners.length,4096);assert.deepEqual(evaluateAngleBoxWitness(raw,r.maximum.corners),r.maximum.work);
 raw.cycle.samples.push(raw.cycle.samples.at(-1));raw.positionRadii.push(raw.positionRadii.at(-1));assert.throws(()=>analyzeAngleBoxes(raw),/4096/);
});
