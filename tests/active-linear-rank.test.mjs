import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {designActiveLinearFamily,evaluateActiveLinearReadings}
  from '../src/science/active-linear-family.mjs';

const cycles=async()=>JSON.parse(await readFile(
  new URL('../examples/active-linear-family-signed-cycles.json',import.meta.url),'utf8'));

test('rank-ten hidden-state course recovers its two-reading circuit within 100 work nodes',async()=>{
  const source=await cycles();source.workLimit=100;
  const result=designActiveLinearFamily(source);
  assert.equal(result.status,'optimal_certified_schedule');
  assert.deepEqual(result.selection.map(row=>row.tick),[0,10]);
  assert.equal(result.potential[0].marginLowerBound,'1');
  assert.equal(result.potential[0].noiseMarginExact,true);
  assert.deepEqual(result.proof[0].witness.weights,['-1','1']);
  assert.ok(result.nodes<=100);
  const values={schema:'worldlaw.active-linear-readings/v1',
    source:'Exact synthetic signed-cycle trace with arbitrary hidden initial state',
    acquisition:'synthetic',readings:[{tick:0,value:3},{tick:10,value:4}]};
  const received=evaluateActiveLinearReadings(source,result,values);
  assert.deepEqual(received.consistentHypothesisIds,['positive']);
});

test('rank-complete extension preserves closed error-tube contact as overlap',async()=>{
  const source=await cycles();source.workLimit=100;source.noiseBound='1/2';
  const result=designActiveLinearFamily(source);
  assert.equal(result.potential[0].marginLowerBound,'1');
  assert.equal(result.status,'noise_separation_not_certified');
  assert.equal(result.noiseOverlapProven,true);
  assert.equal(result.selection,null);
});

test('zero observation rows survive extension as one-reading circuits',()=>{
  const source={schema:'worldlaw.active-linear-family/v1',
    source:'Synthetic one-step forgetting system; every post-input row annihilates initial state',
    hypotheses:[1,2].map(gain=>({id:'gain_'+gain,A:[[0]],B:[[gain]],C:[1]})),
    controls:[[1],[0],[2]],offeredTicks:[0,1,2,3],maxReadings:3,
    noiseBound:'1/4',workLimit:100};
  const result=designActiveLinearFamily(source);
  assert.equal(result.status,'optimal_certified_schedule');
  assert.deepEqual(result.selection.map(row=>row.tick),[1]);
  assert.equal(result.potential[0].marginLowerBound,'2');
  assert.deepEqual(result.proof[0].witness.weights,['1']);
});
