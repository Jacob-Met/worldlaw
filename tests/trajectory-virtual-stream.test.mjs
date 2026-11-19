import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireVirtualPendulumReadings,
  acquireVirtualPendulum,
  openVirtualPendulumSensorStream
} from '../src/trajectory/virtual-experiment.mjs';
import {planAdaptiveGaussianReading} from '../src/trajectory/adaptive-gaussian-sensor.mjs';

const request=(seed,tau)=>({
  initialPosition:1.6,initialRate:-.18,
  duration:8,sampleInterval:.04,seed,noiseSigma:.025,
  ...(tau>0?{noiseCorrelationTime:tau}:{})
});

test('canonical virtual apparatus yields bit-identical sensor readings on demand and static sparse',()=>{
  for(const tau of [0,.04,.4,3.1]){
    for(const seed of [148,1003,99217]){
      const input=request(seed,tau),indices=[1,5,7,32,101,200];
      const staticResult=acquireVirtualPendulumReadings({...input,sampleIndices:indices},
        {existingRuns:[]});
      const session=openVirtualPendulumSensorStream(input,{existingRuns:[]});
      const fromSteps=indices.map(index=>session.readAt(index));
      assert.deepEqual(fromSteps,staticResult.readings,
        'RK4/sensor stream changed at tau='+tau+' seed='+seed);
      const delivered=session.evidence();
      assert.deepEqual(delivered.readings,staticResult.readings);
      assert.equal(delivered.measurementCount,indices.length);
      assert.deepEqual(delivered.source.sampleIndices,indices);
      assert.equal(delivered.source.measuredSampleCount,indices.length);
      assert.equal(delivered.source.numerical.steps,200*80);
      assert.equal(delivered.source.noise.selectedOnly,true);
      assert.equal(delivered.source.positionNoiseSigma,input.noiseSigma);
      assert.equal(delivered.source.positionNoiseCorrelationTime,tau||undefined);
    }
  }
});

test('first streamed acquisition has no future evidence, and incremental evidence is a true prefix',()=>{
  const session=openVirtualPendulumSensorStream(request(101,.2),{existingRuns:[]});
  assert.throws(()=>session.evidence(),/at least one|Acquire/);
  const one=session.readAt(4),first=session.evidence();
  assert.deepEqual(first.readings,[one]);
  assert.equal(first.source.numerical.steps,4*80);
  const second=session.readAt(150),then=session.evidence();
  assert.deepEqual(then.readings.slice(0,1),first.readings);
  assert.equal(then.readings.length,2);
  assert.equal(then.source.numerical.steps,150*80);
  assert.deepEqual(first.readings,[one],'earlier immutable snapshot cannot gain future sensor values');
  assert.equal(Object.hasOwn(one,'rate'),false);
  assert.equal(Object.hasOwn(one,'oracle'),false);
  assert.throws(()=>session.readAt(151.2),/future|scheduled/);
  assert.throws(()=>session.readAt(150),/future|scheduled/);
  assert.throws(()=>session.readAt(149),/future|scheduled/);
  session.close();
  assert.throws(()=>session.readAt(151),/closed/);
});

test('reused seeds or exact session identity cannot be counted as independent evidence',()=>{
  const stream=openVirtualPendulumSensorStream(request(2929,0),{existingRuns:[]});
  stream.readAt(8);const evidence=stream.evidence();
  const context={existingRuns:[evidence]};
  assert.throws(()=>openVirtualPendulumSensorStream(request(2929,0),context),
    /already retained|reused|stream/);
  assert.throws(()=>acquireVirtualPendulumReadings({
    ...request(2929,0),sampleIndices:[1,2]},context),/reused|stream/);
  const other=openVirtualPendulumSensorStream(request(2930,0),context);
  assert.equal(other.readAt(8).sampleIndex,8);
});

test('streaming experiment decisions condition only on actual readings',()=>{
  const physical=request(8894,.5),sensor=openVirtualPendulumSensorStream(physical,{existingRuns:[]});
  const times=Array.from({length:201},(_,i)=>Number((i*.04).toFixed(12)));
  const models=[
    {modelId:'candidate-zero',rows:times.map(t=>({time:t,position:1.6*Math.cos(t)}))},
    {modelId:'candidate-one',rows:times.map(t=>({time:t,position:1.6*Math.cos(t*.8)}))},
    {modelId:'candidate-two',rows:times.map(t=>({time:t,position:1.6*Math.cos(t*1.1)}))}
  ];
  const adaptiveOptions={sigma:.025,correlationTime:.5,maxReadings:3,
    decisionThreshold:.98};
  const history=[],indices=[];
  for(let k=0;k<3;k++){
    const stage=planAdaptiveGaussianReading(models,adaptiveOptions,history);
    if(stage.status!=='next_reading_proposed')break;
    const index=stage.proposed.sampleIndex;
    assert.ok(index>(indices.at(-1)??0));
    indices.push(index);
    history.push(sensor.readAt(index));
  }
  assert.ok(indices.length>=1&&indices.length<=3);
  assert.deepEqual(sensor.evidence().source.sampleIndices,indices);
  assert.deepEqual(sensor.evidence().readings,history);
  const receiving=planAdaptiveGaussianReading(models,adaptiveOptions,history);
  assert.equal(receiving.actualReadingCount,history.length);
  assert.equal(receiving.unobservedSensorValuesConsumed,0);
  const mutated=structuredClone(models);
  const highest=indices.at(-1);
  if(highest<200)mutated[1].rows[highest+1].position+=1000;
  const futureEdited=planAdaptiveGaussianReading(mutated,adaptiveOptions,history);
  assert.deepEqual(futureEdited.models,receiving.models);
});

test('shared RK4 refactor preserves the maintained full-run physical output',()=>{
  const raw=request(330,0),full=acquireVirtualPendulum(raw,{existingRuns:[]});
  assert.equal(full.samples.length,201);
  assert.equal(full.source.numerical.steps,200*80);
  const sparse=acquireVirtualPendulumReadings({
    ...raw,sampleIndices:[1,2,50,200]}, {existingRuns:[]});
  for(const observed of sparse.readings){
    const corresponding=full.samples[observed.sampleIndex];
    assert.equal(observed.time,corresponding.time);
    // Full and sparse noise streams differ by protocol, but both share
    // exactly the same underlying RK4 state at every requested index.
    assert.ok(Math.abs(observed.position-corresponding.position)<.2);
  }
});
