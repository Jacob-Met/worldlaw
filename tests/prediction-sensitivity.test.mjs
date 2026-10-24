import test from 'node:test';
import assert from 'node:assert/strict';
import {predictionSensitivity} from '../src/science/prediction-sensitivity.mjs';
import {fitLinearColumns} from '../src/science/linear-fit.mjs';
const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:4},{id:'bias',coefficient:1}]};
const row=(position,jointTorque=4*position+1)=>({command:0,position,rate:0,jointTorque});
const training=[.9999,.99995,1.00005,1.0001].flatMap(x=>[row(x),row(x)]);
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=(receiving=[row(1),row(2)],options={})=>predictionSensitivity(model,training,receiving,options);
function refit(offsets){return fitLinearColumns([training.map(r=>r.position),training.map(()=>1)],training.map((r,i)=>r.jointTorque+offsets[i])).coefficients;}
test('shared reading influence retains interpolation cancellation and extrapolation exposure',()=>{
 const r=run();assert.equal(r.status,'computed');close(r.rows[0].refittedPrediction,5);close(r.rows[1].refittedPrediction,9);close(r.rows[0].radius,.01);close(r.rows[1].radius,120);close(r.rows[0].independentCoefficientBoxRadius,240);close(r.rows[1].independentCoefficientBoxRadius,360);assert.deepEqual(r.rows[0].extrapolation,[]);assert.deepEqual(r.rows[1].extrapolation,['position']);
});
test('all 256 training-box corners stay in both receiving ranges',()=>{
 const report=run();for(let mask=0;mask<256;mask++){
  const offsets=training.map((_,i)=>(((mask>>i)&1)? .01 : -.01)),c=refit(offsets);
  for(const r of report.rows){const p=c[0]*r.input.position+c[1];assert.ok(p>=r.prediction[0]-1e-7&&p<=r.prediction[1]+1e-7);}
 }
});
test('each retained upper and lower witness attains its own scalar endpoint',()=>{
 for(const r of run().rows)for(const sign of [-1,1]){const c=refit(r.upperWitnessOffsets.map(x=>sign*x));close(c[0]*r.input.position+c[1],r.refittedPrediction+sign*r.radius);}
});
test('receiving outcomes never enter fit and receiving row order remains explicit',()=>{
 const a=run(),b=run([row(1,6),row(2,-500)]);assert.equal(b.outsideCount,2);
 for(let i=0;i<2;i++)for(const key of ['prediction','influence','upperWitnessOffsets'])assert.deepEqual(a.rows[i][key],b.rows[i][key]);
 const reversed=run([row(2),row(1)]);assert.deepEqual(reversed.rows[0].prediction,a.rows[1].prediction);assert.deepEqual(reversed.rows[1].prediction,a.rows[0].prediction);
});
test('touching boundaries remain numerically unresolved',()=>{
 const r=predictionSensitivity({schema:'worldlaw.torque-model/v1',terms:[{id:'bias',coefficient:0}]},Array.from({length:8},()=>row(0,0)),[row(0,.2),row(0,.20001),row(0,.19999)],{trainingRadius:.1,receivingRadius:.1});
 assert.deepEqual(r.rows.map(x=>x.status),['numerical-boundary','outside','not-excluded']);assert.ok(r.rows.every(x=>x.numericalTolerance>0));
});
test('separate overlaps do not claim a jointly compatible perturbation',()=>{
 const r=run([row(1,4.995),row(1,5.005)],{trainingRadius:.01,receivingRadius:0});assert.equal(r.notExcludedCount,2);assert.deepEqual(r.rows[0].prediction,r.rows[1].prediction);assert.match(r.interpretation,/does not establish one common perturbation/);
});
test('common calibration offset shifts predictions without changing sensitivity',()=>{
 const a=run(),b=predictionSensitivity(model,training.map(r=>({...r,jointTorque:r.jointTorque+.02})),[row(1),row(2)]);
 a.rows.forEach((r,i)=>{close(b.rows[i].refittedPrediction-r.refittedPrediction,.02);close(b.rows[i].radius,r.radius);});
});
test('exact zero, zero-term model and empty receiving course stay explicit',()=>{
 assert.ok(run(undefined,{trainingRadius:0,receivingRadius:0}).rows.every(r=>r.radius===0));
 const z=predictionSensitivity({schema:'worldlaw.torque-model/v1',terms:[]},training,[row(1,0)]);assert.equal(z.status,'computed');assert.equal(z.rows[0].radius,0);assert.equal(z.rows[0].refittedPrediction,0);
 assert.equal(run([]).status,'no-receiving-observations');
});
test('rank and complete-work refusals never select a favorable subset',()=>{
 assert.equal(predictionSensitivity(model,training.map(r=>({...r,position:1})),[row(1)]).status,'rank-unavailable');
 for(const [t,q,status] of [[Array.from({length:257},(_,i)=>row(i)),[row(1)],'work-limit'],[training,Array.from({length:129},()=>row(1)),'receiving-work-limit']]){const r=predictionSensitivity(model,t,q);assert.equal(r.status,status);assert.deepEqual(r.rows,[]);}
});
test('inputs are unchanged and malformed explicit radii are refused',()=>{
 const before=JSON.stringify({model,training});run();assert.equal(JSON.stringify({model,training}),before);
 for(const key of ['trainingRadius','receivingRadius'])for(const value of [-1,NaN,Infinity,true,1e7,null,undefined])assert.throws(()=>run(undefined,{[key]:value}));
 assert.throws(()=>predictionSensitivity({terms:model.terms},training,[row(1)]),/Invalid executable torque model/);
 assert.throws(()=>run(undefined,{other:1}));assert.throws(()=>run([row(NaN)]));
});

test('roundoff screen retains the magnitude canceled inside shared influence',()=>{
 const r=run([row(1)],{trainingRadius:.01,receivingRadius:0}).rows[0];
 assert.ok(r.independentCoefficientBoxRadius>10000*r.radius);
 assert.ok(r.numericalTolerance>=256*Number.EPSILON*r.independentCoefficientBoxRadius);
 const near=run([row(1,r.prediction[1]+r.numericalTolerance/2)],{trainingRadius:.01,receivingRadius:0}).rows[0];
 assert.equal(near.status,'numerical-boundary');
});
