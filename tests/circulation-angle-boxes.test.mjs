import test from 'node:test';
import assert from 'node:assert/strict';
import {circulationExample} from '../src/coupling/circulation.mjs';
import {analyzeCirculationBoxes,normalizeCirculationBoxes,exportCirculationBoxes,importCirculationBoxes,CIRCULATION_BOX_SCHEMA,CIRCULATION_BOX_ASSUMPTION} from '../src/coupling/circulation-angle-boxes.mjs';
const number=x=>Number(x.integer)*2**x.powerOfTwo;
const input=(radius=0)=>{const path=circulationExample('authored xy');return {schema:CIRCULATION_BOX_SCHEMA,assumption:CIRCULATION_BOX_ASSUMPTION,radiusSource:'Authored test bounds; not calibrated',path,positionRadii:path.samples.map(()=>[radius,radius])};};
function work(rows){return rows.slice(1).reduce((sum,b,i)=>sum+[0,1].reduce((s,a)=>s+(b.q[a]-rows[i].q[a])*(b.torque[a]+rows[i].torque[a])/2,0),0);}
function witness(raw,flags){return raw.path.samples.map((r,i)=>({q:r.q.map((q,a)=>q+(flags[a]===null?0:(flags[a][i]>>1?1:-1)*raw.positionRadii[i][a])),torque:r.torque.map((t,a)=>t+(flags[a]===null?0:(flags[a][i]&1?1:-1)*r.torqueRadius[a]))}));}
test('zero coordinate radii recover nominal work; wider boxes erase sign, allowance counted once',()=>{
 const raw=input(),before=structuredClone(raw),r=analyzeCirculationBoxes(raw);
 assert.equal(number(r.minimum.work),2);assert.equal(number(r.maximum.work),2);assert.equal(r.conclusion,'positive-work');assert.deepEqual(raw,before);
 assert.equal(analyzeCirculationBoxes(input(1)).conclusion,'zero-compatible');
 raw.path.integrationAllowance=.25;const allowed=analyzeCirculationBoxes(raw);assert.deepEqual(allowed.interval.map(number),[1.75,2.25]);
});
test('small coordinate uncertainty can erase an apparent weak directional signal',()=>{
 const raw=input();raw.path.samples.forEach(s=>{s.torque=[s.q[1],1.02*s.q[0]];s.torqueRadius=[0,0];});
 raw.positionRadii=raw.positionRadii.map(()=>[.001,.001]);assert.equal(analyzeCirculationBoxes(raw).conclusion,'positive-work');
 raw.positionRadii=raw.positionRadii.map(()=>[.005,.005]);const r=analyzeCirculationBoxes(raw);
 assert.equal(r.conclusion,'zero-compatible');assert.ok(Math.abs(number(r.interval[0])-(-.0002))<1e-15);assert.ok(Math.abs(number(r.interval[1])-.0402)<1e-15);
});
test('independent complete paired endpoint oracle and jointly attainable retained witnesses',()=>{
 for(let seed=0;seed<6;seed++){
  const raw=input(.25);raw.path.samples=raw.path.samples.slice(0,3).concat([raw.path.samples.at(-1)]);raw.positionRadii=raw.path.samples.map(()=>[.25,.5]);
  raw.path.samples.forEach((r,i)=>{r.torque=[(i*3+seed)%7-3,(i+seed*2)%5-2];r.torqueRadius=[.25,.5];});
  let low=Infinity,high=-Infinity;
  // Enumerate every paired assignment, with closing angles shared and separate final torques.
  const all=[];for(let n=0;n<256;n++){const flags=Array.from({length:4},(_,i)=>(n>>(2*i))&3);if((flags[0]>>1)===(flags[3]>>1))all.push(flags);}
  for(const x of all)for(const y of all){const w=work(witness(raw,[x,y]));low=Math.min(low,w);high=Math.max(high,w);}
  const r=analyzeCirculationBoxes(raw);assert.deepEqual([number(r.minimum.work),number(r.maximum.work)],[low,high]);
  assert.equal(work(witness(raw,r.minimum.axisCorners)),low);assert.equal(work(witness(raw,r.maximum.axisCorners)),high);
 }
});
test('reversal negates the complete interval, translation preserves work, input-only replay recomputes',()=>{
 const raw=input(.125);raw.path.samples.forEach(r=>r.torqueRadius=[.25,.125]);const r=analyzeCirculationBoxes(raw);
 const reversed=structuredClone(raw);reversed.path.samples.reverse();reversed.positionRadii.reverse();
 assert.deepEqual(analyzeCirculationBoxes(reversed).interval.map(number),r.interval.map(number).reverse().map(x=>-x));
 const shifted=structuredClone(raw);shifted.path.samples.forEach(s=>s.q=s.q.map(q=>q+32));assert.deepEqual(analyzeCirculationBoxes(shifted).interval.map(number),r.interval.map(number));
 assert.deepEqual(analyzeCirculationBoxes(importCirculationBoxes(exportCirculationBoxes(raw))),r);
 assert.ok(!exportCirculationBoxes(raw).includes('axisCorners'));
});
test('exact constant axis contributes zero; unsupported uncertain constant axis refuses atomically',()=>{
 const raw=input();raw.path.samples.forEach(s=>s.q[1]=2);raw.path.integrationAllowance=.5;
 const r=analyzeCirculationBoxes(raw);assert.equal(r.axes[1].status,'exact-constant');assert.equal(number(r.maximum.work)-number(r.interval[1]),-.5);
 const before=structuredClone(raw);raw.positionRadii[2][1]=.1;assert.throws(()=>analyzeCirculationBoxes(raw),/constant nominal/);assert.deepEqual(before.path,raw.path);
});
test('closure, coordinate dependence, radii and units are admitted before computation',()=>{
 const raw=input();raw.positionRadii[0][0]=.1;assert.throws(()=>normalizeCirculationBoxes(raw),/matching endpoint/);
 const bad=input();bad.positionRadii[1]=[NaN,0];assert.throws(()=>normalizeCirculationBoxes(bad),/finite nonnegative/);
 const units=input();units.path.units.position='degrees';assert.throws(()=>normalizeCirculationBoxes(units),/rad/);
 const dependence=input();dependence.assumption='correlated';assert.throws(()=>normalizeCirculationBoxes(dependence),/independent/);
});
