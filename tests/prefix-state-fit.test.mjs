import test from 'node:test';
import assert from 'node:assert/strict';
import {fitPrefixState} from '../src/science/prefix-state-fit.mjs';

test('prefix shooting agrees with an independent closed-form weighted exponential fit',()=>{
  const factors=Array.from({length:17},(_,j)=>Math.exp(-.2*j*.1));
  const observed=factors.map((a,j)=>[1.7*a+(j===0?.3:.01*Math.sin(j*2.1))]);
  const frozen=structuredClone(observed);
  const exact=factors.reduce((s,a,j)=>s+a*observed[j][0],0)/factors.reduce((s,a)=>s+a*a,0);
  const fit=fitPrefixState(observed,x=>factors.map(a=>[x[0]*a]),{scales:[.02]});
  assert.equal(fit.status,'fitted');
  assert.ok(Math.abs(fit.initial[0]-exact)<1e-8);
  assert.ok(fit.lossAfter<fit.lossBefore/4);
  assert.deepEqual(fit.usedStateRange,[0,16]);
  assert.deepEqual(observed,frozen);
  assert.ok(fit.evaluations<=21);
});
test('invalid and nonfinite prefixes fail without a fabricated state estimate',()=>{
  assert.throws(()=>fitPrefixState([[1]],()=>[]),/prefix observations/);
  assert.throws(()=>fitPrefixState(Array.from({length:17},()=>[1]),()=>[],{scales:[0]}),/measurement scales/);
  assert.throws(()=>fitPrefixState(Array.from({length:33},()=>Array(128).fill(1)),()=>[]),/work budget/);
  const failed=fitPrefixState(Array.from({length:17},()=>[1]),()=>null);
  assert.equal(failed.status,'abstained');assert.equal(failed.initial,null);
  assert.equal(failed.evaluations,1);
});
test('all state channels enter the coupled prefix fit',()=>{
  const times=Array.from({length:17},(_,j)=>j*.07);
  const simulate=x=>times.map(t=>[x[0]*Math.cos(t)+x[1]*Math.sin(t),-x[0]*Math.sin(t)+x[1]*Math.cos(t)]);
  const observed=simulate([1.2,-.4]);
  observed[0][0]+=.1;observed[1][1]-=.1;
  // Orthogonal rotations make the exact two-dimensional normal matrix 17 I.
  const exact=times.reduce((a,t,j)=>[a[0]+(observed[j][0]*Math.cos(t)-observed[j][1]*Math.sin(t))/17,a[1]+(observed[j][0]*Math.sin(t)+observed[j][1]*Math.cos(t))/17],[0,0]);
  const fit=fitPrefixState(observed,simulate);
  assert.equal(fit.status,'fitted');
  fit.initial.forEach((x,j)=>assert.ok(Math.abs(x-exact[j])<1e-8));
});
