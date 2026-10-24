import test from 'node:test';import assert from 'node:assert/strict';
import {rollingOriginChallenge,exportRollingOrigin,reopenRollingOrigin} from '../src/trajectory/rolling-origin.mjs';
const model={schema:'worldlaw.angular-model/v1',id:'spring',terms:[{id:'spring',coefficient:-4,coefficientUnit:'1/s²'}],units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown'};
const run=()=>({id:'separate',kind:'synthetic',inertia:null,dynamics:'unforced_scalar_rotation',initialRate:999,source:{label:'Independent analytic oscillator'},samples:Array.from({length:401},(_,i)=>({time:i*.01,position:Math.cos(2*i*.01+.4)}))});
const options={origins:[30,130,230],horizonSamples:[10,50,100],windowSize:9};
test('frozen analytic law predicts multiple prefixes and outperforms matched constant-rate forecast',()=>{
 const r=rollingOriginChallenge(model,run(),options);assert.equal(r.trials.length,9);assert.ok(r.trials.every(t=>t.status==='screened'));
 assert.ok(r.summaries.every(s=>s.modelRMSE<.001&&s.baselines.find(b=>b.id==='initial_rate').skill>.99));assert.deepEqual(r.model,model);assert.equal(r.run.initialRate,999);
});
test('future changes cannot enter the earlier origin; later origins legitimately see new prefixes',()=>{
 const a=run(),b=run();b.samples.slice(31).forEach(r=>r.position+=.2);
 const x=rollingOriginChallenge(model,a,options),y=rollingOriginChallenge(model,b,options);
 for(let i=0;i<3;i++){assert.deepEqual(x.trials[i].forecast,y.trials[i].forecast);assert.deepEqual(x.trials[i].rateEstimate,y.trials[i].rateEstimate);assert.notDeepEqual(x.trials[i].receiving,y.trials[i].receiving);}
 assert.notDeepEqual(x.trials[3].forecast,y.trials[3].forecast);
});
test('complete work is reserved and incomplete tails are refused rather than silently truncated',()=>{
 const r=rollingOriginChallenge(model,run(),options);assert.equal(r.reservedSteps,r.trials.reduce((s,t)=>s+t.reservedSteps,0));
 assert.throws(()=>rollingOriginChallenge(model,run(),{...options,maxTotalSteps:r.reservedSteps-1}),/combined integration budget/);
 assert.throws(()=>rollingOriginChallenge(model,run(),{...options,origins:[350]}),/complete receiving window/);
 assert.throws(()=>rollingOriginChallenge(model,run(),{...options,origins:[3]}),/preceding window/);
 assert.throws(()=>rollingOriginChallenge(model,run(),{...options,horizonSamples:[10,10]}),/unique/);
});
test('missing law mechanism retains every failed trial and suppresses survivor aggregates',()=>{
 const wrong={...model,terms:[{id:'spring',coefficient:1e15,coefficientUnit:'1/s²'}]};const r=rollingOriginChallenge(wrong,run(),options);
 assert.equal(r.trials.length,9);assert.ok(r.summaries.every(s=>s.status==='incomplete'&&s.modelRMSE===null&&s.baselines.every(b=>b.rmse===null)));assert.ok(r.summaries.every(s=>s.failedOrigins.length===3));
});
test('notebook replay derives outputs from inputs, preserving overlapping-window disclosure',()=>{
 const r=rollingOriginChallenge(model,run(),options),text=exportRollingOrigin(r);assert.deepEqual(reopenRollingOrigin(text),r);assert.ok(!text.includes('summaries'));assert.match(r.limitations.join(' '),/Overlapping/);
});
test('all horizons remain descriptive, including wrong-law predictive failure',()=>{
 const wrong={...model,terms:[{id:'spring',coefficient:-1,coefficientUnit:'1/s²'}]},r=rollingOriginChallenge(wrong,run(),options);
 assert.ok(r.summaries.every(s=>s.status==='complete'));assert.ok(r.summaries.at(-1).modelRMSE>.1);assert.deepEqual(r.options.horizonSamples,[10,50,100]);
});
test('one unavailable prefix does not disappear from an otherwise successful population',()=>{
 const source=run();source.samples.slice(0,40).forEach((r,i)=>r.time=i*1e-200);
 const r=rollingOriginChallenge(model,source,options);
 assert.ok(r.trials.slice(0,3).every(t=>t.status==='rate_unavailable'));
 assert.ok(r.trials.slice(3).every(t=>t.status==='screened'));
 assert.ok(r.summaries.every(s=>s.status==='incomplete'&&s.origins===3&&s.failedOrigins.length===1&&s.modelRMSE===null&&s.screenedPredictionCount===2*s.horizonSamples));
});

test('exact 1/2/3/4 future-sample horizons execute without weakening training admission',async()=>{
 const {normalizeAngularRuns,normalizeAngularForecastRun}=await import('../src/trajectory/angular-discovery.mjs');
 const r=rollingOriginChallenge(model,run(),{origins:[30],horizonSamples:[1,2,3,4],windowSize:9});
 assert.equal(r.trials.length,4);
 for(const [i,t]of r.trials.entries()){
  assert.equal(t.status,'screened');assert.equal(t.forecast.predictions.length,i+2);assert.equal(t.receiving.count,i+1);
  assert.equal(t.baselines[0].count,i+1);assert.equal(r.summaries[i].status,'complete');
  const segment={...run(),samples:run().samples.slice(30,32+i)};
  assert.equal(normalizeAngularForecastRun(segment).samples.length,i+2);
  if(i<3)assert.throws(()=>normalizeAngularRuns([segment]),/5–4096/);
  else assert.equal(normalizeAngularRuns([segment])[0].samples.length,5);
 }
});
test('short forecast admission retains source, units, scale, dense samples and strict clock validation',async()=>{
 const {normalizeAngularForecastRun}=await import('../src/trajectory/angular-discovery.mjs');
 const short=()=>({...run(),samples:run().samples.slice(0,2)});
 const badSource=short();delete badSource.source;assert.throws(()=>normalizeAngularForecastRun(badSource),/source object/);
 const badClock=short();badClock.samples[1].time=badClock.samples[0].time;assert.throws(()=>normalizeAngularForecastRun(badClock),/strictly increase/);
 const badScale=short();badScale.inertia=1;assert.throws(()=>normalizeAngularForecastRun(badScale),/explicitly null/);
 const badUnits=short();badUnits.units={time:'s',position:'degree',initialRate:'rad\/s'};assert.throws(()=>normalizeAngularForecastRun(badUnits),/angular input units/);
 const sparse=short();delete sparse.samples[1];assert.throws(()=>normalizeAngularForecastRun(sparse),/must be an object/);
 const torque=short();torque.samples[0].jointTorque=0;assert.throws(()=>normalizeAngularForecastRun(torque),/fabricated torque/);
 const one=short();one.samples.pop();assert.throws(()=>normalizeAngularForecastRun(one),/2–4096/);
});
