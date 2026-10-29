import assert from 'node:assert/strict';import {openSplitTorqueSource as open,parseSplitTorqueSource as parse,serializeSplitTorqueSource as save,SPLIT_SOURCE_SCHEMA} from '../src/science/split-torque-source.mjs';
const training=Array.from({length:16},(_,i)=>({position:i/8,rate:i/8-1,command:0,jointTorque:2*(i/8-1)}));const source={schema:SPLIT_SOURCE_SCHEMA,training,challenge:training,terms:['rate'],scale:1e-7};
const received=open(source);assert.equal(received.status,'converged');assert.deepEqual(parse(save(source)),received);
for(const bad of [{...source,model:{}},{...source,challenge:new Array(2)},{...source,terms:new Array(1)},{...source,training:training.map(r=>({...r,torqueNoiseRatio:1}))},{...source,challenge:[{...training[0],jointTorque:NaN}]}])assert.throws(()=>open(bad));
const huge={...source,training:Array.from({length:4096},(_,i)=>({...training[i%16]})),terms:['command','rate','coulomb','spring','gravity','quadratic','bias','cosine','cubic']};assert.equal(open(huge).status,'rank-unavailable');assert.equal(open(huge).model,undefined);
assert.throws(()=>open({...source,challenge:[{...training[0],extra:'x'.repeat(4*1024*1024)}]}));
console.log('split source original-only roundtrip, malformed/sparse/weighted/nonfinite/size and rank refusal pass');
