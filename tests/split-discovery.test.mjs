import assert from 'node:assert/strict';import {discover,discoverSplit,evaluate,predict,planExperiment,refitDiscovery,revise} from '../src/science/torque-discovery.mjs';
const point=i=>({command:Math.sin(i*1.7),position:Math.sin(i*.73)*2,rate:(i+.5)/32-1});
const training=Array.from({length:64},(_,i)=>{const r=point(i);return {...r,jointTorque:1e4+2*r.rate+(i%16===0?100:0)};});
const options={loss:'soft_l1',lossScale:1e-7,noiseSigma:1e-6,maxTerms:4};
assert.throws(()=>discover(training,options),e=>e.code==='robust_fit_incomplete');
const result=discoverSplit(training,options);assert.equal(result.diagnostics.examinedCandidates,99);assert.equal(result.candidates.length,99);assert.equal(result.diagnostics.unexecutableCandidates,0);assert.ok(result.diagnostics.robustWorkReserved<=250000000);
const challenge=Array.from({length:43},(_,i)=>{const r=point(i+.37);return {...r,jointTorque:1e4+2*r.rate};});
const highFloor=discoverSplit(training,{...options,noiseSigma:.01});assert.equal(highFloor.selected.id,'bias');assert.ok(evaluate(highFloor.selected,challenge).rmse>1);
const before=JSON.stringify(result);const scores=evaluate(result.selected,challenge);evaluate(result.selected,challenge.map(r=>({...r,jointTorque:-r.jointTorque})));assert.equal(JSON.stringify(result),before);assert.ok(scores.rmse<1e-6);
const planned=planExperiment(result,challenge.map(({jointTorque,...r})=>r));assert.equal(planned.ranked.length,43);assert.equal(predict(result.selected,challenge[0]),scores.rows[0].prediction);
const again=refitDiscovery(result,options);assert.deepEqual(again.selected,result.selected);
const changed=revise(result,[challenge[0]]);assert.equal(changed.observations.length,65);assert.equal(changed.schema,result.schema);
assert.throws(()=>discoverSplit(training.map(r=>({...r,torqueNoiseRatio:1})),options));
assert.throws(()=>discoverSplit(Array.from({length:4096},(_,i)=>training[i%64]),options),e=>e.code==='work_limit');
const small=training.map(r=>({...r,jointTorque:2*r.rate}));const ordinary=discover(small,{...options,lossScale:.01}),split=discoverSplit(small,{...options,lossScale:.01});assert.equal(split.selected.id,ordinary.selected.id);assert.equal(split.candidates.length,ordinary.candidates.length);
console.log({candidates:result.candidates.length,selected:result.selected.id,work:result.diagnostics.robustWorkReserved,heldAsideRmse:scores.rmse,unshiftedSelected:split.selected.id});

const conditioned=result.candidates.find(c=>c.id==='spring+gravity');assert.ok(conditioned.metrics.conditionEstimate>1.1);assert.equal(conditioned.metrics.conditionEstimate,conditioned.fit.conditionEstimate);
