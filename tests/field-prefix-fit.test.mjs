import test from 'node:test';
import assert from 'node:assert/strict';
import {rollout,N} from '../src/trajectory/field-law-dictionary.mjs';
import {identify} from '../src/trajectory/noisy-field-intervention.mjs';

const run=(start,drive)=>({layout:'oscillator',drive,sigma:[.005,.005],values:rollout('pendulum',[.93,1.08],start,drive)});
test('prefix and suffix integrator windows reproduce the original full trajectory',()=>{
  const all=run([1.23,.83],1).values;
  assert.deepEqual(rollout('pendulum',[.93,1.08],[1.23,.83],1,{steps:16}),all.slice(0,17));
  assert.deepEqual(rollout('pendulum',[.93,1.08],all[16],1,{start:16,steps:N-16}),all.slice(16));
  assert.throws(()=>rollout('pendulum',[1,1],[1,0],1,{start:120,steps:20}),/interval/);
});
test('field verification improves a perturbed first reading and cannot consume future states',()=>{
  const training=[run([1.23,.83],1),run([.75,-.15],3)],verification=run([-.71,.55],2);
  verification.values[0][0]+=.08;verification.values[0][1]-=.08;
  const legacy=identify(training,verification,'weak',{scoreStart:17});
  const fitted=identify(training,verification,'weak',{initialization:'prefix-shooting',prefixPoints:17});
  assert.equal(fitted.law,'pendulum');assert.equal(fitted.prefix.status,'fitted');
  assert.ok(fitted.standardizedError<legacy.standardizedError/3,JSON.stringify({legacy,fitted}));
  assert.equal(fitted.firstScored,17);assert.equal(fitted.scoredValues,112*2);
  const changed=structuredClone(verification);
  for(let i=17;i<changed.values.length;i++)changed.values[i]=[2+Math.sin(i),-3+Math.cos(i)];
  const future=identify(training,changed,'weak',{initialization:'prefix-shooting'});
  assert.deepEqual(future.prefix,fitted.prefix);
  assert.equal(future.law,fitted.law);assert.deepEqual(future.coef,fitted.coef);
  assert.notEqual(future.standardizedError,fitted.standardizedError);
  assert.throws(()=>identify(training,verification,'weak',{initialization:'prefix-shooting',scoreStart:16}),/overlaps/);
  assert.equal(Object.hasOwn(identify(training,verification),'prefix'),false);
});
