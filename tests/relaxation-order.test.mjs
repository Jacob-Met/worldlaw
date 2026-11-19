import assert from 'node:assert/strict';
import { planRelaxationReads, inspectRelaxationReads } from '../src/unknown-lab/relaxation-order.mjs';

const spec = { fast: [0.12, 0.27], slow: [0.74, 0.88], amplitude: [0.45, 1.1], error: 0.003, maxStride: 8 };
const plan = planRelaxationReads(spec);
assert.equal(plan.status,'separating-plan');
assert.equal(plan.waits.length,3);
assert.equal(plan.waits[0],0);
assert.equal(plan.waits[2],2*plan.waits[1]);
assert.ok(plan.waits[1]>=1 && plan.waits[1]<=8);
let state=7919;
const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
const between=([low,high])=>low+(high-low)*random();
function receive(modes,waits,amplitudeNoise) {
  const forward=modes.map(m=>m.a/2),reverse=modes.map(m=>-m.a/2);
  const observations=[];
  for(let t=0;t<=Math.max(...waits);t++) {
    if(waits.includes(t)) observations.push({wait:t, difference:forward.reduce((x,y)=>x+y,0)-reverse.reduce((x,y)=>x+y,0)+(2*random()-1)*amplitudeNoise});
    for(let i=0;i<modes.length;i++){forward[i]*=modes[i].r;reverse[i]*=modes[i].r;}
  }
  return observations;
}
for(let i=0;i<256;i++){
  const modes=[{a:between(spec.amplitude),r:between(spec.fast)},{a:between(spec.amplitude),r:between(spec.slow)}];
  const observed=receive(modes,plan.waits,spec.error);
  assert.equal(inspectRelaxationReads(observed,spec.error).status,'positive-curvature');
  assert.equal(inspectRelaxationReads(observed.slice(0,2),spec.error).status,'unresolved');
  for(const control of [[{a:2,r:0.62}], [{a:0.8,r:0.4},{a:0.9,r:0.4}], [{a:0,r:0.18},{a:0.95,r:0.8}], []]){
    assert.equal(inspectRelaxationReads(receive(control,plan.waits,spec.error),spec.error).status,'unresolved');
  }
}
for(const altered of [{fast:[0.5,0.8]}, {amplitude:[0,1.1]}, {error:0.8}]){
  assert.equal(planRelaxationReads({...spec,...altered}).status,'unresolved');
}
assert.throws(()=>inspectRelaxationReads([{wait:0,difference:1},{wait:2,difference:0.6},{wait:3,difference:0.4}],0));
assert.throws(()=>planRelaxationReads({...spec,error:-1}));
console.log('256 independent latent recurrences, 256 two-read ablations, 1024 controls, three nonseparating domains, two malformed requests passed');
