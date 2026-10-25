import test from 'node:test';
import assert from 'node:assert/strict';
import {investigateRateDissipation as inspect} from '../src/science/rate-dissipation.mjs';
const model=x=>({schema:'worldlaw.torque-model/v1',terms:Object.entries(x).map(([id,coefficient])=>({id,coefficient}))});
const rational=x=>[BigInt(x.numerator),BigInt(x.denominator)];
const add=(x,y)=>[x[0]*y[1]+y[0]*x[1],x[1]*y[1]];
const mul=(x,y)=>[x[0]*y[0],x[1]*y[1]];
test('interior active pocket is retained despite negative endpoints',()=>{
  const result=inspect(model({coulomb:-1,rate:8,quadratic:-8}),1);
  assert.ok(result.maximumCandidates.slice(0,2).every(x=>BigInt(x.factor.numerator)<0n));
  assert.equal(result.status,'positive_rate_power_exists');
  // Independent rational substitution into r(-1+8r-8r²).
  const r=rational(result.witness.speed);
  const p=mul(r,add([-1n,1n],add(mul([8n,1n],r),mul([-8n,1n],mul(r,r)))));
  const recorded=rational(result.witness.power);
  assert.ok(p[0]>0n);assert.equal(p[0]*recorded[1],recorded[0]*p[1]);
});
test('positive zero-speed limiting factor produces strictly positive actual-speed witness',()=>{
  const result=inspect(model({coulomb:1,rate:-100,quadratic:-100}),1);
  assert.equal(result.status,'positive_rate_power_exists');
  assert.ok(BigInt(result.witness.speed.numerator)>0n);
  assert.ok(result.witness.speed.upper<=1);
  assert.ok(BigInt(result.witness.power.numerator)>0n);
});
test('tangent zero, zero law and zero-only domain remain nonpositive',()=>{
  for(const [m,V] of [[{coulomb:-.25,rate:1,quadratic:-1},1],[{},1],[{coulomb:1,rate:1,quadratic:1},0]]){
    const result=inspect(model(m),V);assert.equal(result.status,'rate_power_nonpositive_on_declared_interval');assert.equal(result.witness,null);
  }
});
test('domain expansion exposes active behavior without changing supplied law',()=>{
  const m=model({coulomb:-1,quadratic:1}),original=JSON.stringify(m);
  assert.equal(inspect(m,1).witness,null);assert.ok(inspect(m,2).witness);
  assert.equal(JSON.stringify(m),original);
});
test('small positive coefficient is not rounded into absence',()=>{
  const result=inspect(model({rate:Number.MIN_VALUE}),1);
  assert.equal(result.status,'positive_rate_power_exists');
  assert.ok(BigInt(result.witness.power.numerator)>0n);
});
test('positive rational power survives binary64 underflow in the display enclosure',()=>{
  const result=inspect(model({rate:Number.MIN_VALUE}),Number.MIN_VALUE);
  assert.equal(result.status,'positive_rate_power_exists');
  assert.ok(BigInt(result.witness.power.numerator)>0n);
  assert.equal(result.witness.power.lower,0);
  assert.equal(result.witness.power.upper,Number.MIN_VALUE);
});
test('conservative and command terms do not change rate-only classification',()=>{
  assert.deepEqual(inspect(model({rate:-1}),2),inspect(model({rate:-1,spring:1,command:3,command_position:4,bias:5}),2));
});
test('unsupported, nonfinite, negative and oversized declarations refuse',()=>{
  for(const V of [-1,NaN,Infinity,1e7,'1'])assert.throws(()=>inspect(model({}),V));
  assert.throws(()=>inspect(model({rate:Infinity}),1));
  assert.throws(()=>inspect(model({missing:1}),1));
});
