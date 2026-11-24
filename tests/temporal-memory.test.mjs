import test from 'node:test';
import assert from 'node:assert/strict';
import {fitTemporalMemory,forecastTemporalMemory,DECAYS} from '../src/science/temporal-memory.mjs';

test('causal lift matches projected dynamics including at a position zero',()=>{
  for(const [x,v,z,u] of [[1,0,24,0],[1,0,25,0],[0,3,31,-.1],[-2,4,19,.5]]){
    const y=x+v/10, h=z-x*x/20;
    const dv=10*(x*(28-z)-y+.1*u-v);
    assert.ok(Math.abs(dv-(270*x-x**3/2-11*v+u-10*x*h))<1e-10);
    assert.ok(Math.abs((x*y-8*z/3-x*v/10)-(13*x*x/15-8*h/3))<1e-10);
  }
  assert.equal(DECAYS.length,13);
  assert.equal(DECAYS.includes(8/3),false);
});
test('identical projected present can require different acceleration',()=>{
  const acc=z=>10*(1*(28-z)-1);
  assert.equal(acc(24)-acc(25),10);
});
test('all four public fit and forecast arms propagate a free particle with zero velocity',()=>{
  const r=Array.from({length:41},(_,i)=>({time:i*.02,state:[.5,0],command:0}));
  for(const arm of ['local','transient','wrongHistory','memory']){
    const model=fitTemporalMemory([r,r],arm,2);
    const p=forecastTemporalMemory(model,r.slice(0,11),Array(21).fill(0));
    assert.equal(p.states.length,21);
    assert.ok(p.states.every(([x,v])=>x===.5&&v===0));
    assert.throws(()=>forecastTemporalMemory(model,r.slice(0,12),[0]),/prefix/);
  }
});
