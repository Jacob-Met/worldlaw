import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSmoothDrift,reopenSmoothDrift,serializeSmoothDrift,driftValue} from '../src/unknown-lab/smooth-drift.mjs';
const plan=(mask,n=12)=>({id:'order-'+mask,pairs:Array.from({length:n},(_,i)=>({reference:2*i+1-(mask>>i&1),conditioned:2*i+(mask>>i&1)}))});
export const example=()=>({schema:'worldlaw.smooth-drift/v1',orders:{schema:'worldlaw.serial-orders/v2',sourceNote:'Authored equal-count research; not acquired observations.',rhos:[-.9,-.5,0,.5,.9],periodic:{sourceNote:'Hypothetical finite sinusoid periods, not fitted sensor frequencies.',periods:[3,5]},plans:[plan(819),plan(1365)]},drift:{curvatureBound:.01,sourceNote:'Illustrative curvature limit, not a calibrated sensor specification.'}});
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,`${a} versus ${b}`);
test('finite-period winner has twice the admissible smooth drift bias; witness really attains it',()=>{
 const r=compareSmoothDrift(example()),[a,b]=r.rows;near(a.curvatureCoefficient,2);near(b.curvatureCoefficient,1);near(a.worstBias,.02);near(b.worstBias,.01);assert.ok(a.artifacts.every(x=>x.gain<.044));assert.ok(Math.max(...b.artifacts.map(x=>x.gain))>.18);
 for(const row of r.rows){near(row.witnessContrast,row.worstBias);assert.equal(row.witnessStatus,'numerically-received');for(const p of row.samples)near(driftValue(row,p.offset),p.value);}
});
test('independent fine integration agrees with kernel area and random bounded-curvature curves stay within it',()=>{
 for(const row of compareSmoothDrift(example()).rows){
  const w=row.samples;let area=0,contrast=0,dt=row.acquisitionSpan/20000;
  for(let j=0;j<20000;j++){const t=(j+.5)*dt,k=w.reduce((s,p)=>s+p.weight*Math.max(0,p.offset-t),0);area+=Math.abs(k)*dt;contrast+=k*.01*Math.sin(7*t+.2)*dt;}
  near(area,row.curvatureCoefficient,2e-6);assert.ok(Math.abs(contrast)<row.worstBias);
  near(w.reduce((s,p)=>s+p.weight*(27-13*p.offset),0),0);near(w.reduce((s,p)=>s+p.weight*.005*p.offset**2,0),row.cells.reduce((s,c)=>s+.01*(c.to-c.from)*(c.kernelFrom+c.kernelTo)/2,0));
 }
});
test('unequal strata, gaps, common origin shift, and zero curvature retain original semantics',()=>{
 const x=example();x.orders.plans=[plan(15,9),plan(23,9)];x.orders.plans.forEach(p=>p.pairs.forEach((q,i)=>{q.reference+=i*11;q.conditioned+=i*11;}));const a=compareSmoothDrift(x);
 x.orders.plans.forEach(p=>p.pairs.forEach(q=>{q.reference+=999000000;q.conditioned+=999000000;}));const b=compareSmoothDrift(x);
 a.rows.forEach((r,i)=>{near(r.curvatureCoefficient,b.rows[i].curvatureCoefficient);near(r.witnessContrast,r.worstBias,1e-8);});x.drift.curvatureBound=0;assert.ok(compareSmoothDrift(x).rows.every(r=>r.worstBias===0&&r.witnessContrast===0));
});
test('complete replay ignores no source, stored result or malformed declaration',()=>{
 const x=example(),before=JSON.stringify(x),r=compareSmoothDrift(x);assert.equal(JSON.stringify(x),before);assert.deepEqual(reopenSmoothDrift(serializeSmoothDrift(x)),r);
 assert.throws(()=>compareSmoothDrift({...x,rows:[]}),/cached/);assert.throws(()=>compareSmoothDrift({...x,drift:{...x.drift,sourceNote:''}}),/source/);assert.throws(()=>compareSmoothDrift({...x,drift:{...x.drift,curvatureBound:-1}}),/curvature/);
 const hole=example();delete hole.orders.plans[0].pairs[2];assert.throws(()=>compareSmoothDrift(hole),/complete/);assert.throws(()=>reopenSmoothDrift('broken'),/JSON/);assert.throws(()=>driftValue(r.rows[0],-1),/within/);
});
