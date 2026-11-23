import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlledInstrument,commandSamples,receiveContinuousRun} from '../src/trajectory/controlled-instrument.mjs';
import {createContinuousSession,planNextContinuous,continuousRequest,receiveContinuous,
  exportContinuousSession,restoreContinuousSession} from '../src/trajectory/continuous-session.mjs';
const request=amplitudes=>({schema:'worldlaw.continuous-command-request/v1',inertia:1,
  initialPosition:.1,initialRate:.2,duration:4,dt:.05,noiseSigma:0,
  segments:amplitudes.map((amplitude,i)=>({startIndex:i*20,endIndex:(i+1)*20,amplitude}))});
const instrument=(extra={})=>createControlledInstrument({sourceId:'generated-control',inertia:1,
  noiseSigma:0,seed:21,maximumAcquisitions:5,drive:{linear:0,cubic:2},
  restoring:{spring:0,gravity:0,cubic:0},damping:0,...extra});
test('independent cubic actuator follows exact piecewise constant acceleration',()=>{
  const device=instrument(),r=request([.25,-.7,.1,.8]),run=device.acquire(r);
  let q=.1,v=.2;
  for(let i=0;i<run.samples.length-1;i++){
    const h=run.samples[i+1].time-run.samples[i].time,a=2*run.samples[i].command**3;
    q+=v*h+.5*a*h*h;v+=a*h;
    assert.ok(Math.abs(run.samples[i+1].position-q)<1e-10);
  }
  assert.equal(device.usage().acquired,1);
  assert.equal(run.source.truthParametersExposed,false);
  assert.equal(JSON.stringify(run.source).includes('restoring'),false);
  assert.deepEqual(receiveContinuousRun(r,run),run);
});
test('receiver refuses altered applied command, clock, missing row and initial state',()=>{
  const r=request([.2,.3,-.4,-.5]),run=instrument().acquire(r);
  for(const edit of [x=>x.samples[20].command+=.01,x=>x.samples[20].time+=.001,
    x=>x.samples.pop(),x=>x.initialRate+=.01]){
    const changed=structuredClone(run);edit(changed);
    assert.throws(()=>receiveContinuousRun(r,changed));
  }
  const invalid=structuredClone(r);invalid.segments[1].startIndex++;
  assert.throws(()=>commandSamples(invalid));
});
test('instrument inputs are owned and acquisition budgets cannot be replayed for free',()=>{
  const p={sourceId:'owned',inertia:1,noiseSigma:0,seed:4,maximumAcquisitions:1,
    drive:{linear:1},restoring:{spring:0},damping:0};
  const d=createControlledInstrument(p);p.drive.linear=99;
  const r=request([.2,.2,.2,.2]),x=d.acquire(r);
  assert.ok(Math.abs(x.samples.at(-1).position-(.1+.2*4+.5*.2*16))<1e-10);
  r.segments[0].amplitude=.8;
  assert.equal(d.usage().requests[0].segments[0].amplitude,.2);
  assert.throws(()=>d.acquire(request([.2,.2,.2,.2])));
});
test('owned forecasts precede reception and replay reproduces the actual refit',()=>{
  const sigma=1e-6,d=instrument({noiseSigma:sigma,sourceId:'loop'});
  const a=request([1,-1,1,-1]);a.noiseSigma=sigma;
  const b=request([-1,1,-1,1]);b.noiseSigma=sigma;b.initialPosition=-.1;
  const trainingRuns=[d.acquire(a),d.acquire(b)];
  const plannerConfig={inertia:1,initialPosition:.1,initialRate:.2,duration:4,dt:.05,maxStep:.02,
    amplitudeBounds:[-1,1],segmentDurations:[1,1,1,1],positionDomain:[-100,100],
    noiseSigma:sigma,starts:2,sweeps:2,maxTotalSteps:1000000,maxRefinementError:1e-8,minSeparation:3};
  const setup={trainingRuns,fitOptions:{terms:['command','command_cubic'],maxTerms:1,
    noiseSigma:sigma,windowDuration:.5,windowStride:.25},plannerConfig,
    policy:'active',policyId:'generated-control-only',worldId:'loop',maxRounds:1,seed:7};
  let s=planNextContinuous(createContinuousSession(setup));
  assert.equal(s.pending.plan.status,'planned');
  const changed=structuredClone(s);changed.pending.plan.predictions[0].position[5]+=1;
  assert.throws(()=>continuousRequest(changed));
  const r=continuousRequest(s),run=d.acquire(r);
  const altered=structuredClone(r);altered.segments[0].amplitude+=.01;
  assert.throws(()=>receiveContinuous(s,{request:altered,run}));
  s=receiveContinuous(s,{request:r,run});
  assert.deepEqual(s.events.map(e=>e.type),['source_fit','predictions_owned_before_acquisition',
    'prospective_residual_scored_before_refit','model_refit_after_receipt']);
  assert.equal(s.history[0].assessment.status,'uncalibrated_diagnostic');
  assert.equal(s.discovery.selected.id,'command_cubic');
  const restored=restoreContinuousSession(exportContinuousSession(s));
  assert.deepEqual(restored.discovery.selected,s.discovery.selected);
  assert.deepEqual(restored.history,s.history);
  assert.throws(()=>planNextContinuous(s));
});
