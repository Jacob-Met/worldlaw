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
  assert.deepEqual(receiveContinuousRun(r,run,{expectedSourceId:'generated-control'}),run);
});
test('receiver refuses altered applied command, clock, missing row and initial state',()=>{
  const r=request([.2,.3,-.4,-.5]),run=instrument().acquire(r);
  for(const edit of [x=>x.samples[20].command+=.01,x=>x.samples[20].time+=.001,
    x=>x.samples.pop(),x=>x.initialRate+=.01]){
    const changed=structuredClone(run);edit(changed);
    assert.throws(()=>receiveContinuousRun(r,changed,{expectedSourceId:'generated-control'}));
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
function loopSetup(){
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
  return {d,setup};
}
test('owned forecasts precede reception and replay reproduces the actual refit',()=>{
  const {d,setup}=loopSetup();
  let s=planNextContinuous(createContinuousSession(setup));
  assert.equal(s.pending.plan.status,'planned');
  const changed=structuredClone(s);changed.pending.plan.predictions[0].position[5]+=1;
  assert.throws(()=>continuousRequest(changed));
  const r=continuousRequest(s),run=d.acquire(r);
  const altered=structuredClone(r);altered.segments[0].amplitude+=.01;
  assert.throws(()=>receiveContinuous(s,{request:altered,run}));
  const pending=s;
  s=receiveContinuous(pending,{request:r,run});
  assert.throws(()=>receiveContinuous(pending,{request:r,run}),/stale/);
  assert.deepEqual(s.events.map(e=>e.type),['source_fit','predictions_owned_before_acquisition',
    'prospective_residual_scored_before_refit','model_refit_after_receipt']);
  assert.equal(s.history[0].assessment.status,'uncalibrated_diagnostic');
  assert.equal(s.discovery.selected.id,'command_cubic');
  const restored=restoreContinuousSession(exportContinuousSession(s));
  assert.deepEqual(restored.discovery.selected,s.discovery.selected);
  assert.deepEqual(restored.history,s.history);
  assert.throws(()=>planNextContinuous(s));
});

test('controlled receipts bind declared world, noise, recording and complete original request',()=>{
  const {d,setup}=loopSetup(),options={expectedSourceId:'loop'};
  const pending=planNextContinuous(createContinuousSession(setup));
  const req=continuousRequest(pending),run=d.acquire(req);
  const wrongWorld=instrument({sourceId:'foreign',noiseSigma:req.noiseSigma}).acquire(req);
  const noisier={...req,noiseSigma:req.noiseSigma*2};
  const wrongNoise=instrument({sourceId:'loop',noiseSigma:noisier.noiseSigma}).acquire(noisier);
  assert.throws(()=>receiveContinuous(pending,{request:req,run:wrongWorld}),/source identity/);
  assert.throws(()=>receiveContinuous(pending,{request:req,run:wrongNoise}),/frozen request/);
  for(const edit of [x=>{x.kind='measured';},x=>{x.source.instrument='sim/other';},
    x=>{x.source.recordingId='another-acquisition';},x=>{x.source.acquisitionIndex++;},
    x=>{x.source.noise.sigma*=2;},x=>{x.source.noise.distribution='other';},
    x=>{x.source.request.commandConvention='different schedule convention';}]){
    const changed=structuredClone(run);edit(changed);
    assert.throws(()=>receiveContinuousRun(req,changed,options));
  }
  assert.throws(()=>receiveContinuousRun(req,run),/expected source/);
  assert.equal(receiveContinuous(pending,{request:req,run}).history.length,1);
  for(const edit of [x=>{x.source.sourceId='foreign';},x=>{x.source.request.noiseSigma*=2;},
    x=>{x.samples[8].command=.01;},x=>{x.source.noise.sigma*=2;}]){
    const foreign=structuredClone(setup);edit(foreign.trainingRuns[0]);
    assert.throws(()=>createContinuousSession(foreign));
  }
});

test('short instrument grids are refused before charging; 8192 fitter rows are checked before acquisition',()=>{
  const device=instrument(),r=request([1,1,1,1]);
  const short={...r,duration:.1,dt:.01,segments:[{startIndex:0,endIndex:10,amplitude:1}]};
  assert.throws(()=>device.acquire(short),/17 or more/);
  assert.deepEqual(device.usage(),{acquired:0,chargedSamples:0,requests:[]});

  const {setup}=loopSetup(),sigma=setup.plannerConfig.noiseSigma;
  const source=instrument({sourceId:'loop',noiseSigma:sigma});
  setup.trainingRuns=[1,-1].map(amplitude=>source.acquire({...r,noiseSigma:sigma,dt:.001,duration:4.095,
    segments:[{startIndex:0,endIndex:4095,amplitude}]}));
  const session=createContinuousSession(setup);
  assert.equal(session.trainingRuns.reduce((s,x)=>s+x.samples.length,0),8192);
  assert.throws(()=>planNextContinuous(session),/combined 8192-sample/);
  assert.equal(source.usage().acquired,2);
});

test('random schedules refuse insufficient work before the first model rollout',()=>{
  const {setup}=loopSetup();
  setup.policy='random';setup.plannerConfig.maxTotalSteps=1;
  assert.throws(()=>planNextContinuous(createContinuousSession(setup)),/before rollouts/);
});

test('paid short-window observation and its original residual survive a refused refit',()=>{
  const {setup,d}=loopSetup();
  setup.policy='random';setup.maxRounds=2;
  Object.assign(setup.plannerConfig,{duration:.4,dt:.025,segmentDurations:[.1,.1,.1,.1]});
  const pending=planNextContinuous(createContinuousSession(setup)),r=continuousRequest(pending);
  const run=d.acquire(r),result=receiveContinuous(pending,{request:r,run});
  assert.equal(result.status,'refit_refused');
  assert.deepEqual(result.history[0].run,run);
  assert.equal(result.history[0].residual.rowsUsed,16);
  assert.equal(result.history[0].selectedAfter,null);
  assert.equal(result.history[0].refitError.code,'insufficient_sampling');
  assert.deepEqual(result.history[0].retainedModel,{id:pending.discovery.selected.id,status:'experimental_pre_receipt_fit'});
  assert.deepEqual(result.discovery.selected,pending.discovery.selected);
  assert.deepEqual(result.events.slice(-2).map(e=>e.type),['prospective_residual_scored_before_refit','refit_refused']);
  assert.throws(()=>receiveContinuous(pending,{request:r,run}),/stale/);
  assert.throws(()=>planNextContinuous(result),/could not be refitted/);
  const restored=restoreContinuousSession(exportContinuousSession(result));
  assert.equal(restored.status,'refit_refused');
  assert.deepEqual(restored.history,result.history);
});

test('session setup validates and owns every calibration world and round before prospective planning',()=>{
  const {d,setup}=loopSetup();
  const valid={schema:'worldlaw.residual-calibration/v1',policyId:setup.policyId,alpha:.05,maxRounds:1,
    roundScoresByWorld:[{worldId:'cal-A',scores:[.5]},{worldId:'cal-B',scores:[1.5]}]};
  for(const edit of [
    x=>{x.schema='unknown';},x=>{delete x.schema;},x=>{x.alpha=1;},x=>{x.policyId='another';},
    x=>{x.maxRounds=2;for(const row of x.roundScoresByWorld)row.scores.push(0);},
    x=>{x.roundScoresByWorld[1].worldId='cal-A';},x=>{x.roundScoresByWorld[0].worldId=setup.worldId;},
    x=>{x.roundScoresByWorld[1].scores=[];},x=>{x.roundScoresByWorld[1].scores[0]=-1;},
    x=>{x.roundScoresByWorld[1].scores[0]=NaN;},x=>{x.roundScoresByWorld=[];}
  ]){
    const calibration=structuredClone(valid);edit(calibration);
    assert.throws(()=>createContinuousSession({...setup,calibration}),RangeError);
  }
  const session=createContinuousSession({...setup,calibration:valid});
  valid.roundScoresByWorld[0].scores[0]=99;
  assert.equal(session.calibration.roundScoresByWorld[0].scores[0],.5);
  // Two reference worlds are valid data but cannot resolve alpha=.05.
  const pending=planNextContinuous(session),req=continuousRequest(pending);
  assert.equal(d.usage().acquired,2);
  const result=receiveContinuous(pending,{request:req,run:d.acquire(req)});
  assert.equal(result.history[0].assessment.status,'insufficient_calibration');
  assert.equal(result.history[0].assessment.n,2);
});
