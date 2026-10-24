import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {inspectSerialNoise} from '../src/unknown-lab/serial-noise.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-14,`${a} != ${b}`);
function oracle(weights,rho) {
 let sum=0,coefficient=0;
 for(let t=Math.max(...weights.map(x=>x.sampleIndex));t>=0;t--) {
  coefficient=rho*coefficient+weights.filter(x=>x.sampleIndex===t).reduce((s,x)=>s+x.weight,0);
  sum+=coefficient**2*(t===0?1:1-rho*rho);
 }
 return sum;
}
test('independent innovations oracle, acquisition gaps and unequal groups',()=>{
 for(const count of [16,17])for(const rho of [-.999,-.7,0,.6,.999]){
  const n=syntheticChallenge({count});
  for(const row of n.trials)row.sampleIndex+=6*Math.floor(row.sampleIndex/2);
  const r=inspectSerialNoise(n,rho);
  near(r.sensorVariance,oracle(r.weights,rho)*n.noiseSigma**2);
  const reversed=structuredClone(n);reversed.trials.reverse();near(inspectSerialNoise(reversed,rho).boundary,r.boundary);
  if(rho===0)near(r.boundary,r.baseline.boundary);
 }
});
test('same observed contrast can change conclusion solely under declared covariance',()=>{
 const n=syntheticChallenge({count:16,orderStrategy:'alternating'});
 for(const row of n.trials)row.jointTorque=row.history==='conditioned'?.02:0;
 const a=inspectSerialNoise(n,0),b=inspectSerialNoise(n,.9);
 assert.equal(a.verdict,'inconclusive');assert.equal(b.verdict,'challenged');
 assert.equal(a.baseline.decisionDifference,b.baseline.decisionDifference);
 assert.deepEqual(a.baseline,b.baseline);
});
test('order limits and malformed correlation refuse',()=>{
 const n=syntheticChallenge({orderStrategy:'oneway'});assert.equal(inspectSerialNoise(n,.5).status,'unresolved-order');
 for(const row of n.trials)delete row.sampleIndex;
 assert.equal(inspectSerialNoise(n,.5).status,'unresolved-order');
 for(const rho of [NaN,Infinity,1,-1,'0',null])assert.throws(()=>inspectSerialNoise(n,rho));
});
