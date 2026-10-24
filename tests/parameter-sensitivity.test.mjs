import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterSensitivity} from '../src/science/parameter-sensitivity.mjs';
import {fitLinearColumns} from '../src/science/linear-fit.mjs';
const model=(terms)=>({schema:'worldlaw.torque-model/v1',terms:terms.map(([id,coefficient])=>({id,coefficient}))});
const rows=(xs)=>xs.map(position=>({command:0,position,rate:0,jointTorque:4*position+1}));
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('analytic symmetric spring and bias influence and independent box corners',()=>{
 const xs=[-1,-1,1,1], data=rows(xs), radius=.2;
 const result=parameterSensitivity(model([['spring',4],['bias',1]]),data,radius);
 assert.equal(result.status,'computed');
 for(const c of result.coefficients){close(c.radius,.2);close(c.amplification,1);}
 for(let mask=0;mask<16;mask++){
  const y=data.map((r,i)=>r.jointTorque+((mask>>i)&1?radius:-radius));
  const fit=fitLinearColumns([xs,xs.map(()=>1)],y);
  fit.coefficients.forEach((v,j)=>assert.ok(v>=result.coefficients[j].lower-1e-12&&v<=result.coefficients[j].upper+1e-12));
 }
});
test('each coefficient witness refits to its upper bound',()=>{
 const xs=[-.9,-.2,.1,.3,.8,1.2],data=rows(xs);
 const result=parameterSensitivity(model([['spring',4],['bias',1]]),data,.03);
 result.coefficients.forEach((c,j)=>{
  const target=data.map((r,i)=>r.jointTorque+c.upperWitnessOffsets[i]);
  close(fitLinearColumns([xs,xs.map(()=>1)],target).coefficients[j],c.upper);
 });
});
test('weak excitation exposes unstable parameters despite exact fit',()=>{
 const xs=[-.0001,-.00005,.00005,.0001];
 const result=parameterSensitivity(model([['spring',4],['bias',1]]),rows(xs),.01);
 assert.equal(result.status,'computed');
 assert.ok(result.coefficients[0].radius>100);
 assert.ok(result.coefficients[0].crossesZero);
 close(result.coefficients[0].refittedCoefficient,4,1e-7);
});
test('rank deficiency, zero model, no rows and complete work refusal are explicit',()=>{
 assert.equal(parameterSensitivity(model([['spring',4],['bias',1]]),rows([1,1,1,1])).status,'rank-unavailable');
 assert.equal(parameterSensitivity(model([]),rows([1,2])).status,'computed');
 assert.equal(parameterSensitivity(model([]),[]).status,'insufficient-rows');
 const result=parameterSensitivity(model([['spring',4]]),rows(Array(257).fill(1)));
 assert.equal(result.status,'work-limit');assert.deepEqual(result.coefficients,[]);
});
test('zero bound and row permutation preserve conditional coefficients',()=>{
 const data=rows([-2,-1,0,1,2]);const m=model([['spring',4],['bias',1]]);
 const zero=parameterSensitivity(m,data,0);zero.coefficients.forEach(c=>{close(c.lower,c.upper);close(c.radius,0);});
 const forward=parameterSensitivity(m,data,.1),reverse=parameterSensitivity(m,[...data].reverse(),.1);
 forward.coefficients.forEach((c,j)=>{close(c.radius,reverse.coefficients[j].radius);close(c.upper,reverse.coefficients[j].upper);});
});
test('refits inspected structure honestly and does not mutate caller inputs',()=>{
 const data=rows([-2,-1,0,1,2]);const m=model([['spring',99],['bias',-7]]);
 const before=JSON.stringify({m,data});const result=parameterSensitivity(m,data,.1);
 close(result.coefficients[0].refittedCoefficient,4);close(result.coefficients[0].inspectedToRefitShift,-95);
 assert.equal(JSON.stringify({m,data}),before);
 for(const value of [true,-1,Infinity,NaN,1e7]) assert.throws(()=>parameterSensitivity(m,data,value));
});
test('coefficient error amplification follows coordinate rescaling, without changing reading radius',()=>{
 const m=model([['spring',4],['bias',1]]),data=rows([-2,-1,0,1,2]);
 const original=parameterSensitivity(m,data,.03);
 const changed=data.map(r=>({...r,position:r.position*1000}));
 const scaled=parameterSensitivity(m,changed,.03);
 close(scaled.coefficients[0].refittedCoefficient,original.coefficients[0].refittedCoefficient/1000);
 close(scaled.coefficients[0].radius,original.coefficients[0].radius/1000);
 close(scaled.coefficients[1].radius,original.coefficients[1].radius);
});
