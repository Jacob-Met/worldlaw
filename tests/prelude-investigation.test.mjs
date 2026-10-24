import test from 'node:test';import assert from 'node:assert/strict';
import {comparePrelude,preparePrelude,exportPreludeComparison,reopenPreludeComparison} from '../src/trajectory/prelude-investigation.mjs';
const model={schema:'worldlaw.angular-model/v1',id:'spring',terms:[{id:'spring',coefficient:-4,coefficientUnit:'1/s²'}],units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown'};
const theta=t=>Math.cos(2*t+.4);
const run=()=>({id:'separate',kind:'synthetic',inertia:null,dynamics:'unforced_scalar_rotation',initialRate:0,source:{label:'Analytic oscillator'},samples:Array.from({length:101},(_,i)=>({time:i*.01,position:theta(i*.01)}))});
const input=()=>({schema:'worldlaw.angular-prelude-input/v1',targetRunId:'separate',kind:'synthetic',units:{time:'s',position:'rad'},source:{label:'Independent earlier analytic positions'},samples:Array.from({length:31},(_,i)=>({time:(i-30)*.01,position:theta((i-30)*.01)}))});
test('explicit prelude rate improves known bad start without fitting later angles',()=>{
 const r=comparePrelude(model,run(),input(),{chosenWindowSize:9});assert.ok(r.original.receiving.scores[0].rmse>.1);assert.ok(r.derived.receiving.scores[0].rmse<.001);
 assert.equal(r.derived.forecasts.options.rateHalfWidth,0);assert.deepEqual(r.model,model);assert.equal(r.originalRate,0);
});
test('later challenge values cannot change rate estimate or either prediction',()=>{
 const a=run(),b=run();b.samples.slice(1).forEach(x=>x.position+=.7);
 const x=comparePrelude(model,a,input(),{chosenWindowSize:9}),y=comparePrelude(model,b,input(),{chosenWindowSize:9});
 assert.deepEqual(x.estimate,y.estimate);assert.deepEqual(x.derived.forecasts,y.derived.forecasts);assert.deepEqual(x.original.forecasts,y.original.forecasts);assert.notDeepEqual(x.derived.receiving,y.derived.receiving);
});
test('window selection is explicit and notebook replays from raw inputs',()=>{
 assert.throws(()=>comparePrelude(model,run(),input()),/Choose/);
 assert.throws(()=>comparePrelude(model,run(),input(),{chosenWindowSize:7}),/available/);
 const r=comparePrelude(model,run(),input(),{chosenWindowSize:9}),text=exportPreludeComparison(r);assert.deepEqual(reopenPreludeComparison(text),r);assert.ok(!text.includes('receiving'));
});
test('prelude endpoint and source contract refuse incompatible measurements',()=>{
 const a=input();a.samples.at(-1).position+=.001;assert.throws(()=>preparePrelude(a,run()),/match/);
 const b=input();b.units.position='degree';assert.throws(()=>preparePrelude(b,run()),/units/);
});
test('comparison reserves original and all derived starts under one total budget',()=>{
 assert.throws(()=>comparePrelude(model,run(),input(),{chosenWindowSize:9,maxTotalSteps:1}),/combined integration budget/);
 const r=comparePrelude(model,run(),input(),{chosenWindowSize:9,positionHalfWidth:.01,rateHalfWidth:.01});
 assert.equal(r.reservedSteps,r.original.forecasts.reservedSteps+r.derived.forecasts.reservedSteps);
 assert.ok(r.reservedSteps<=r.options.maxTotalSteps);
});

test('target run, evidence kind and declared recording identity must agree',()=>{
 const a=input();a.targetRunId='other';assert.throws(()=>preparePrelude(a,run()),/targetRunId/);
 const b=input();b.kind='measured';assert.throws(()=>preparePrelude(b,run()),/evidence kind/);
 const c=input();c.source.recordingId='different';assert.throws(()=>preparePrelude(c,run()),/recording identity/);
});
