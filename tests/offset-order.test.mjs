import assert from 'node:assert/strict';
import {planOffsetReads, inspectOffsetReads} from '../src/unknown-lab/offset-order.mjs';
const spec={fast:[0.08,0.23],slow:[0.63,0.81],amplitude:[0.55,1.05],error:0.0002,maxStride:8};
const plan=planOffsetReads(spec);
assert.equal(plan.status,'separating-plan');
assert.deepEqual(plan.waits,[0,1,2,3].map(i=>i*plan.waits[1]));
let state=389711;
const unit=()=>((state=(Math.imul(state,1103515245)+12345)>>>0)/4294967296);
const draw=([lo,hi])=>lo+(hi-lo)*unit();
function receive(modes,offset,clean=false){
 const first=modes.map(m=>m.a);
 const y=[];
 for(let t=0;t<=plan.waits[3];t++){
   if(plan.waits.includes(t))y.push({wait:t,difference:offset+first.reduce((a,b)=>a+b,0)+(clean?0:(2*unit()-1)*spec.error)});
   modes.forEach((m,i)=>{first[i]*=m.r});
 }
 return y;
}
for(let i=0;i<256;i++){
  const bias=draw([-100,100]);
  const modes=[{a:draw(spec.amplitude),r:draw(spec.fast)},{a:draw(spec.amplitude),r:draw(spec.slow)}];
  const rows=receive(modes,bias);
  assert.equal(inspectOffsetReads(rows,spec.error).status,'offset-invariant-curvature');
  assert.equal(inspectOffsetReads(rows.slice(0,3),spec.error).status,'unresolved');
  const flat=receive(modes,bias,true).map(r=>r.difference);
  const ratio=(flat[1]-flat[2])/(flat[0]-flat[1]);
  const apparentAmplitude=(flat[0]-flat[1])/(1-ratio);
  const apparentOffset=flat[0]-apparentAmplitude;
  assert.ok(ratio>0&&ratio<1);
  assert.ok(Math.abs(apparentOffset+apparentAmplitude*ratio**2-flat[2])<1e-10);
  for(const control of [[{a:draw(spec.amplitude),r:draw(spec.slow)}],[],[{a:.75,r:.5},{a:.55,r:.5}]]){
    assert.equal(inspectOffsetReads(receive(control,bias),spec.error).status,'unresolved');
  }
}
for(const changed of [{fast:[.6,.75]},{amplitude:[0,1]},{error:.9}])assert.equal(planOffsetReads({...spec,...changed}).status,'unresolved');
assert.throws(()=>inspectOffsetReads([{wait:0,difference:1},{wait:2,difference:.7},{wait:4,difference:.5},{wait:7,difference:.4}],0));
console.log('256 blinded rates and offsets; 256 explicit three-read one-mode-plus-offset witnesses; 768 biased one-mode, constant and coincident controls; three unresolved domains passed');
