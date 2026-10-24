import test from 'node:test';
import assert from 'node:assert/strict';
import {predictionContrasts,contrastWitness,MAX_CONTRAST_PAIRS} from '../src/science/prediction-contrast.mjs';
import {fitLinearColumns} from '../src/science/linear-fit.mjs';
const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:4},{id:'bias',coefficient:1}]};
const row=(position,jointTorque=4*position+1)=>({command:0,position,rate:0,jointTorque});
const training=[.9999,.99995,1.00005,1.0001].flatMap(x=>[row(x),row(x)]);
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const run=(receiving,options={trainingRadius:.01,receivingRadius:0})=>predictionContrasts(model,training,receiving,options);
function refit(t,offsets){return fitLinearColumns([t.map(r=>r.position),t.map(()=>1)],t.map((r,i)=>r.jointTorque+offsets[i])).coefficients;}
test('identical coordinates expose a shared-reading contradiction hidden by marginal overlap',()=>{
 const r=run([row(1,4.995),row(1,5.005)]);assert.equal(r.status,'computed');assert.equal(r.marginal.notExcludedCount,2);assert.equal(r.outsideCount,1);const p=r.pairs[0];assert.equal(p.center,0);assert.equal(p.radius,0);close(p.observedCenter,-.01);assert.equal(p.upperWitnessSigns,'00000000');
});
test('affine contrast combines signed influences before absolute values',()=>{
 const r=run([row(1),row(2)]),p=r.pairs[0];close(p.center,-4);close(p.radius,120);assert.equal(p.firstRow,0);assert.equal(p.secondRow,1);assert.equal(p.orientation,'first minus second');assert.ok(p.uncancelledRadius>p.radius);
});
test('all 256 corners obey the retained contrast envelope',()=>{
 const r=run([row(1),row(2)]),p=r.pairs[0];let low=Infinity,high=-Infinity;
 for(let mask=0;mask<256;mask++){
  const offsets=training.map((_,i)=>((mask>>i)&1)? .01 : -.01),c=refit(training,offsets),value=(c[0]+c[1])-(2*c[0]+c[1]);low=Math.min(low,value);high=Math.max(high,value);assert.ok(value>=p.prediction[0]-1e-7&&value<=p.prediction[1]+1e-7);
 }
 close(low,p.prediction[0]);close(high,p.prediction[1]);
});
test('compact witness reconstructs independent refits reaching both endpoints',()=>{
 const r=run([row(1),row(2),row(.5)]);
 for(const p of r.pairs){const witness=contrastWitness(r,p.index);for(const [key,endpoint] of [['upperWitnessOffsets',1],['lowerWitnessOffsets',0]]){const c=refit(training,witness[key]);const first=r.marginal.rows[p.firstRow].input.position,second=r.marginal.rows[p.secondRow].input.position;close((c[0]*first+c[1])-(c[0]*second+c[1]),p.prediction[endpoint]);}}
});
test('receiving values cannot alter predicted contrast or training witness',()=>{
 const a=run([row(1),row(2)]),b=run([row(1,123),row(2,-99)]);for(const key of ['prediction','radius','upperWitnessSigns','amplification'])assert.deepEqual(a.pairs[0][key],b.pairs[0][key]);assert.equal(b.pairs[0].status,'outside');
});
test('permuting two rows reverses the signed interval and keeps disposition',()=>{
 const a=run([row(1,5.1),row(2,9.2)]).pairs[0],b=run([row(2,9.2),row(1,5.1)]).pairs[0];close(b.prediction[0],-a.prediction[1]);close(b.prediction[1],-a.prediction[0]);close(b.observedCenter,-a.observedCenter);assert.equal(a.status,b.status);
});
test('common receiving bias cancels in contrasts without suppressing marginal rejection',()=>{
 const a=run([row(1),row(1)]),b=run([row(1,6),row(1,6)]);assert.equal(b.marginal.outsideCount,2);assert.equal(a.pairs[0].observedCenter,b.pairs[0].observedCenter);assert.deepEqual(a.pairs[0].prediction,b.pairs[0].prediction);assert.equal(b.outsideCount,0);
});
test('overlap of every pair is not promoted to joint feasibility',()=>{
 const t=[-1,1].flatMap(x=>Array.from({length:4},()=>row(x,0)));
 const r=predictionContrasts(model,t,[row(-1,-.5),row(0,.5),row(1,-.5)],{trainingRadius:1,receivingRadius:0});
 assert.equal(r.marginal.outsideCount,0);assert.equal(r.outsideCount,0);assert.equal(r.pairs.length,3);assert.match(r.interpretation,/does not establish one perturbation/);
 // Any affine law matching both endpoint readings predicts midpoint -.5,
 // inconsistent with +.5. Necessary pair checks intentionally miss this.
 assert.notEqual((-.5+-.5)/2,.5);assert.equal('jointFeasible' in r,false);
});
test('receiving error and engineering boundary screen remain separate',()=>{
 const r=run([row(1,5),row(1,5.02)],{trainingRadius:.01,receivingRadius:.01});assert.equal(r.pairs[0].status,'numerical-boundary');close(r.pairs[0].observedRadius,.02);
 assert.ok(r.pairs[0].numericalTolerance>=r.marginal.rows[0].numericalTolerance+r.marginal.rows[1].numericalTolerance,'pair screen must preserve both underlying marginal screens');
 const inside=run([row(1,5),row(1,5.019)],{trainingRadius:.01,receivingRadius:.01});assert.equal(inside.pairs[0].status,'not-excluded');
 const outside=run([row(1,5),row(1,5.021)],{trainingRadius:.01,receivingRadius:.01});assert.equal(outside.pairs[0].status,'outside');
 const exact=run([row(1),row(2)],{trainingRadius:0,receivingRadius:0});assert.equal(exact.pairs[0].radius,0);const constant={schema:'worldlaw.torque-model/v1',terms:[{id:'bias',coefficient:1}]};
 const exactStable=predictionContrasts(constant,Array.from({length:8},()=>row(0,1)),[row(1,1),row(2,1)],{trainingRadius:0,receivingRadius:0});
 assert.equal(exactStable.pairs[0].center,0);assert.equal(exactStable.pairs[0].radius,0);assert.equal(exactStable.pairs[0].status,'numerical-boundary');
});
test('complete 128-row course retains every pair and compact witness',()=>{
 const r=run(Array.from({length:128},(_,i)=>row(1+i/100)));assert.equal(r.contrastAssessed,true);assert.equal(r.pairs.length,8128);assert.equal(r.pairs.length,MAX_CONTRAST_PAIRS);assert.equal(r.expectedPairCount,8128);assert.equal(r.outsideCount+r.boundaryCount+r.notExcludedCount,8128);assert.ok(r.pairs.every(p=>p.upperWitnessSigns.length===training.length));assert.equal(r.pairs.at(-1).firstRow,126);assert.equal(r.pairs.at(-1).secondRow,127);
});
test('rank, work, insufficient pairs and malformed inputs preserve explicit refusals',()=>{
 const one=run([row(1)]);assert.equal(one.status,'insufficient-pairs');assert.equal(one.marginal.status,'computed');assert.equal(one.contrastAssessed,false);
 const large=run(Array.from({length:129},()=>row(1)));assert.equal(large.status,'marginal-unavailable');assert.equal(large.reason,'receiving-work-limit');assert.deepEqual(large.pairs,[]);
 const rank=predictionContrasts(model,training.map(r=>({...r,position:1})),[row(1),row(2)]);assert.equal(rank.reason,'rank-unavailable');assert.deepEqual(rank.pairs,[]);
 assert.throws(()=>run([row(1),row(2)],{trainingRadius:null}));assert.throws(()=>contrastWitness(one,0));assert.throws(()=>contrastWitness(run([row(1),row(2)]),1));
});
test('inputs remain unchanged',()=>{
 const q=[row(1),row(2)],before=JSON.stringify({model,training,q});const r=run(q);contrastWitness(r,0);assert.equal(JSON.stringify({model,training,q}),before);
});
