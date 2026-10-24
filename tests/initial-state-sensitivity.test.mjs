import test from 'node:test';
import assert from 'node:assert/strict';
import {initialStateSensitivity} from '../src/trajectory/initial-state-sensitivity.mjs';
import {rolloutAngularWithResolution} from '../src/trajectory/angular-resolution.mjs';
const model=(coefficient=-4,id='spring')=>({schema:'worldlaw.angular-model/v1',id,terms:[{id,coefficient,coefficientUnit:id==='spring'?'1/s²':'1/s'}],units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown'});
const run=()=>({id:'analytic',kind:'synthetic',inertia:null,dynamics:'unforced_scalar_rotation',initialRate:0,source:{label:'Independent cosine solution'},samples:Array.from({length:41},(_,i)=>({time:i/20,position:Math.cos(i/10)}))});
test('all nine declared starts follow independent oscillator solutions',()=>{
 const r=initialStateSensitivity(model(),run(),{positionHalfWidth:.1,rateHalfWidth:.2});
 assert.equal(r.forecasts.variants.length,9);assert.equal(r.forecasts.complete,true);
 for(const v of r.forecasts.variants)for(const p of v.predictions)assert.ok(Math.abs(p.position-(1+v.positionOffset)*Math.cos(2*p.time)-v.rateOffset*Math.sin(2*p.time)/2)<1e-7);
 assert.equal(r.forecasts.physicalInertia,null);
});
test('later observations change only receiving; no grid point is selected or ranked',()=>{
 const a=run(),b=structuredClone(a);b.samples.slice(1).forEach(x=>x.position+=3);
 const opt={positionHalfWidth:.1,rateHalfWidth:.2};
 const x=initialStateSensitivity(model(),a,opt),y=initialStateSensitivity(model(),b,opt);
 assert.deepEqual(x.forecasts,y.forecasts);assert.notDeepEqual(x.receiving,y.receiving);
 assert.equal(y.receiving.outsideCount,40);
});
test('zero width retains exact nominal solver predictions and errors',()=>{
 const raw=run(),x=initialStateSensitivity(model(),raw),y=rolloutAngularWithResolution(model(),raw);
 assert.equal(x.forecasts.variants.length,1);
 assert.deepEqual(x.forecasts.variants[0].predictions,y.rollout.rows.map(r=>({time:r.time,position:r.predicted,rate:r.rate})));
 assert.ok(Math.abs(x.receiving.scores[0].rmse-y.rollout.metrics.positionRMSE)<1e-20);
});
test('wrong supplied rate can explain a mismatch without fitting the response',()=>{
 const raw=run();raw.initialRate=.3;
 const x=initialStateSensitivity(model(),raw,{rateHalfWidth:.3});
 assert.ok(x.receiving.scores.find(s=>s.rateOffset===0).rmse>.05);
 assert.ok(x.receiving.scores.find(s=>s.rateOffset===-.3).rmse<1e-7);
 assert.deepEqual(x.forecasts.variants.map(v=>v.rateOffset),[-.3,0,.3]);
});
test('complete reservation refuses excess before output; malformed widths refused',()=>{
 assert.throws(()=>initialStateSensitivity(model(),run(),{rateHalfWidth:1,maxTotalSteps:2}),/complete initial-state grid/);
 for(const width of [-1,NaN,Infinity,'1',101])assert.throws(()=>initialStateSensitivity(model(),run(),{rateHalfWidth:width}),/half-widths/);
});
test('unstable or step-sensitive variants remain visible and invalidate whole range',()=>{
 const x=initialStateSensitivity(model(10000),run(),{positionHalfWidth:1});
 assert.ok(x.forecasts.variants.some(v=>v.status==='failed'));assert.equal(x.forecasts.range,null);assert.equal(x.receiving.outsideCount,null);
 const raw=run();raw.samples=Array.from({length:5},(_,i)=>({time:i/32,position:0}));raw.initialRate=1;
 const y=initialStateSensitivity(model(-100,'rate'),raw,{maxStep:1/32});
 assert.equal(y.forecasts.variants[0].status,'step_sensitive');assert.equal(y.forecasts.complete,false);
});
test('wrong physics remains outside a small declared initial-state grid',()=>{
 const raw=run();raw.samples.forEach(row=>row.position=Math.cos(3*row.time));
 const x=initialStateSensitivity(model(),raw,{positionHalfWidth:.001,rateHalfWidth:.001});
 assert.ok(x.receiving.outsideCount>30);
 assert.match(x.forecasts.meaning,/not a confidence/);
});
