import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {createExperimentSession,planNextExperiment,acquireNextExperiment,applyNextExperiment,exportExperimentSession} from '../src/trajectory/experiment-session.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';
import {createRecordedExperiment,planRecordedExperiment,receiveRecordedOutcome,applyRecordedOutcome,discardRecordedOutcome,recordedExperimentView,exportRecordedExperiment,restoreRecordedExperiment,refitRecordedExperiment} from '../src/trajectory/recorded-experiment-session.mjs';
const clone=structuredClone;
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
const fit={method:'integral',noiseSigma:.01,maxTerms:4,modelLimit:8,maxStep:.01};
const settings={inertia:.8,command:0,bounds:{initialPosition:{min:-2.2,max:2.2},initialRate:{min:-.6,max:.6}},duration:8,sampleInterval:.04,positionCount:9,rateCount:3,maxModels:8,maxStep:.01,maxTotalSteps:250000,minDisagreement:.01,predictionBounds:{position:{min:-3.2,max:3.2},rate:{min:-8,max:8}}};
const base=(b=fixture())=>exportExperimentSession(createExperimentSession(createChallenge(b,fit)));
const start=b=>createRecordedExperiment(base(b));
const planned=b=>planRecordedExperiment(start(b),settings);
const refusal=(fn)=>assert.throws(fn,e=>e instanceof Error&&typeof e.code==='string'&&e.code.length>0);
function recording(s,seed=81001){return acquireVirtualPendulum({...s.plan.selected.acquisitionRequest,seed,noiseSigma:.00002},{existingRuns:[...s.current.bundle.trainingRuns,...s.current.bundle.challengeRuns]});}
const forecasts=s=>s.acquisition.predictions.map(p=>({modelId:p.modelId,status:p.status,error:p.error,rows:p.rollout?.rows.map(({time,predicted,rate})=>({time,predicted,rate}))}));

test('recorded receive retains nominal plan and actual source; only explicit apply changes fitting',()=>{
 const s=planned(),before=JSON.stringify(s),run=recording(s);run.initialRate+=.03;run.samples[0].position+=.02;
 for(let i=1;i<run.samples.length-1;i++)run.samples[i].time+=i%2?.001:-.001;
 const p=receiveRecordedOutcome(s,run);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(p.plan,s.plan);assert.deepEqual(p.current,s.current);assert.deepEqual(p.acquisition.run,run);
 assert.deepEqual(p.current.discovery,s.current.discovery);
 const next=applyRecordedOutcome(p);assert.equal(next.current.bundle.trainingRuns.length,s.current.bundle.trainingRuns.length+1);
 assert.deepEqual(next.current.bundle.trainingRuns.at(-1),run);assert.deepEqual(next.current.bundle.challengeRuns,s.current.bundle.challengeRuns);
 assert.equal(p.current.bundle.trainingRuns.length,s.current.bundle.trainingRuns.length);assert.equal(next.history.length,1);
});

test('future recorded positions cannot fit frozen models or condition the forecast',()=>{
 const s=planned(),a=recording(s),b=clone(a);b.id+='-counterfactual';b.source.recordingId+='-counterfactual';
 for(let i=1;i<b.samples.length;i++)b.samples[i].position=100+Math.sin(i);
 const pa=receiveRecordedOutcome(s,a),pb=receiveRecordedOutcome(s,b);
 assert.deepEqual(pa.plan,pb.plan);assert.deepEqual(pa.current.discovery,pb.current.discovery);assert.deepEqual(forecasts(pa),forecasts(pb));
 assert.deepEqual(pb.acquisition.run,b,'Poor agreement must remain admitted as supplied evidence');
 const applied=applyRecordedOutcome(pb);assert.deepEqual(applied.current.bundle.trainingRuns.at(-1),b);
});

test('actual initial conditions and clock affect receiving forecast without rewriting original proposal',()=>{
 const s=planned(),a=recording(s),b=clone(a);b.id+='-conditions';b.source.recordingId+='-conditions';b.initialRate+=.07;b.samples[0].position+=.04;
 for(let i=1;i<b.samples.length-1;i++)b.samples[i].time+=i%2?.002:-.002;
 const pa=receiveRecordedOutcome(s,a),pb=receiveRecordedOutcome(s,b);
 assert.deepEqual(pa.plan,pb.plan);assert.notDeepEqual(forecasts(pa),forecasts(pb));
 assert.deepEqual(pb.acquisition.run.samples,b.samples);assert.equal(pb.acquisition.run.initialRate,b.initialRate);
});

test('recorded admission refuses incompatible inertia/command, missing recording identity and retained evidence',()=>{
 const s=planned(),run=recording(s);
 for(const change of [r=>{r.inertia=1;},r=>{r.samples[10].command=.1;},r=>{delete r.source.recordingId;},r=>{r.source.recordingId=' ';},r=>{r.samples[4].time=r.samples[3].time;}]){const bad=clone(run);change(bad);refusal(()=>receiveRecordedOutcome(s,bad));}
 for(const retained of [...s.current.bundle.trainingRuns,...s.current.bundle.challengeRuns]){
  refusal(()=>receiveRecordedOutcome(s,retained));
  const relabeled=clone(retained);relabeled.id+='-renamed';relabeled.source.recordingId='new-label-for-old-evidence';
  refusal(()=>receiveRecordedOutcome(s,relabeled));
 }
 refusal(()=>receiveRecordedOutcome(s,run,{contextKey:'not-this-session'}));refusal(()=>receiveRecordedOutcome(s,run,{planId:'not-this-plan'}));
});

test('opaque session, frozen plan and pending observation mutation are detected',()=>{
 for(const change of [s=>{s.current.bundle.trainingRuns[0].samples[1].position+=.1;},s=>{s.current.discovery.candidates[0].terms[0].coefficient+=.1;},s=>{s.plan.selected.acquisitionRequest.initialPosition+=.1;}]){
  const s=planned(),r=recording(s);change(s);refusal(()=>receiveRecordedOutcome(s,r));
 }
 const s=planned();refusal(()=>receiveRecordedOutcome({...s},recording(s)));
 const p=receiveRecordedOutcome(s,recording(s));p.acquisition.run.samples[1].position+=.1;refusal(()=>applyRecordedOutcome(p));
});

test('pending state cannot be overwritten, explicit discard retains fitted source and permits a new receive',()=>{
 const s=planned(),p=receiveRecordedOutcome(s,recording(s));
 refusal(()=>receiveRecordedOutcome(p,recording(s,81002)));refusal(()=>planRecordedExperiment(p,settings));
 refusal(()=>applyRecordedOutcome(p,{contextKey:'different'}));refusal(()=>applyRecordedOutcome(p,{acquisitionId:'different'}));
 const discarded=discardRecordedOutcome(p);assert.deepEqual(discarded.current,s.current);assert.equal(discarded.acquisition,null);
 const next=discarded.plan?discarded:planRecordedExperiment(discarded,settings);
 assert.ok(receiveRecordedOutcome(next,recording(next,81003)).acquisition);
});

test('pending and applied portable histories reproduce original observations and ignore cached scientific answers',()=>{
 const s=planned(),p=receiveRecordedOutcome(s,recording(s));
 for(const original of [p,applyRecordedOutcome(p)]){
  const text=exportRecordedExperiment(original),raw=JSON.parse(text);
  assert.equal(raw.discovery,undefined);assert.equal(raw.results,undefined);
  raw.discovery={selected:{id:'forged'}};raw.results=[{status:'ok',rollout:{metrics:{positionRMSE:0}}}];raw.comparison={after:{positionRMSE:0}};
  const restored=restoreRecordedExperiment(JSON.stringify(raw));
  assert.deepEqual(restored.current.bundle,original.current.bundle);assert.deepEqual(restored.current.discovery,original.current.discovery);
  assert.deepEqual(restored.acquisition?.run,original.acquisition?.run);assert.deepEqual(restored.history,original.history);
  assert.deepEqual(recordedExperimentView(restored).comparison,recordedExperimentView(original).comparison);
 }
});

test('original virtual acquisition history survives recorded workflow export and reopening',()=>{
 const virtual=createExperimentSession(createChallenge(fixture(),fit));
 const evolved=applyNextExperiment(acquireNextExperiment(planNextExperiment(virtual,settings),{seed:82001}));
 const originalText=exportExperimentSession(evolved),s=createRecordedExperiment(originalText);
 const exported=exportRecordedExperiment(s);assert.equal(JSON.parse(exported).baseNotebookText,originalText,'Portable workflow retains exact original virtual notebook text');
 const reopened=restoreRecordedExperiment(exported);assert.deepEqual(reopened.current.bundle,evolved.current.bundle);assert.deepEqual(reopened.current.discovery,evolved.current.discovery);
 const pending=acquireNextExperiment(planNextExperiment(virtual,settings),{seed:82002});refusal(()=>createRecordedExperiment(exportExperimentSession(pending)));
});

function highNoise(){
 const a=acquireVirtualPendulum({initialPosition:.06,initialRate:0,duration:6.4,sampleInterval:.04,seed:50021,noiseSigma:.01},{existingRuns:[]});
 const b=acquireVirtualPendulum({initialPosition:-.045,initialRate:.025,duration:6.4,sampleInterval:.04,seed:50022,noiseSigma:.01},{existingRuns:[a]});
 const c=acquireVirtualPendulum({initialPosition:1.9,initialRate:0,duration:8,sampleInterval:.04,seed:50023,noiseSigma:.01},{existingRuns:[a,b]});
 return {...fixture(),trainingRuns:[a,b],challengeRuns:[c]};
}
test('authored failed refit remains applied and survives portable replay',()=>{
 const s=planned(highNoise());const run=acquireVirtualPendulum({...s.plan.selected.acquisitionRequest,seed:50024,noiseSigma:.01},{existingRuns:[...s.current.bundle.trainingRuns,...s.current.bundle.challengeRuns]});
 const a=applyRecordedOutcome(receiveRecordedOutcome(s,run));
 assert.equal(s.current.discovery.selected.id,'coulomb+spring');assert.equal(a.current.discovery.selected.id,'rate+spring+gravity+bias');
 const result=a.current.results.find(r=>r.modelId===a.current.discovery.selected.id);assert.equal(result.status,'failed');assert.equal(result.error.code,'runaway_state');
 assert.deepEqual(a.current.bundle.trainingRuns.at(-1),run);assert.deepEqual(a.current.bundle.challengeRuns,s.current.bundle.challengeRuns);
 const r=restoreRecordedExperiment(exportRecordedExperiment(a));assert.deepEqual(r.current.bundle,a.current.bundle);assert.equal(r.current.summary.selectedPositionRMSE,null);
});


test('complete actual-clock forecast budget refuses all predictions while retaining the recording',()=>{
 const s=planRecordedExperiment(start(),{...settings,bounds:{initialPosition:{min:1.9,max:1.9},initialRate:{min:0,max:0}},positionCount:1,rateCount:1,maxStep:.001,minDisagreement:0});
 const run=recording(s,83001);run.samples=run.samples.slice(0,17).map((row,i)=>({...row,time:i*18.75}));
 const p=receiveRecordedOutcome(s,run);assert.deepEqual(p.acquisition.run,run);assert.equal(p.acquisition.work.executed,false);
 assert.ok(p.acquisition.work.reservedSteps>p.acquisition.work.budget);
 assert.equal(p.acquisition.predictions.length,s.plan.provenance.modelIds.length);
 assert.ok(p.acquisition.predictions.every(r=>r.status==='failed'&&r.rollout===null&&r.error.code==='resource_limit'));
});

test('explicit refit is replayed in history and cannot overwrite pending recorded evidence',()=>{
 const s=planned(),p=receiveRecordedOutcome(s,recording(s,84001));
 refusal(()=>refitRecordedExperiment(p,{...fit,noiseSigma:.02}));
 const a=applyRecordedOutcome(p),changed=refitRecordedExperiment(a,{...fit,noiseSigma:.02});
 assert.deepEqual(changed.current.bundle,a.current.bundle);assert.equal(changed.current.options.noiseSigma,.02);
 const r=restoreRecordedExperiment(exportRecordedExperiment(changed));
 assert.deepEqual(r.current.discovery,changed.current.discovery);assert.deepEqual(r.current.bundle,changed.current.bundle);
 assert.deepEqual(r.history,changed.history);assert.equal(r.plan,null);
});

test('default absent prediction bounds remain reopenable and short schedules refuse training admission',()=>{
 const noBounds={...settings};delete noBounds.predictionBounds;
 const s=planRecordedExperiment(start(),noBounds),p=receiveRecordedOutcome(s,recording(s,85001));
 assert.deepEqual(restoreRecordedExperiment(exportRecordedExperiment(p)).plan,p.plan);
 const short=planRecordedExperiment(start(),{...noBounds,bounds:{initialPosition:{min:1.9,max:1.9},initialRate:{min:0,max:0}},positionCount:1,rateCount:1,duration:.4,sampleInterval:.04,minDisagreement:0});
 refusal(()=>receiveRecordedOutcome(short,recording(s,85002)));
});

test('recording admission cannot leave an unsavable notebook beyond the portable limit',()=>{
 const ordinary=planned(),spare=3000000-100-exportRecordedExperiment(ordinary).length;
 assert.ok(spare>0);
 const paddedBase=base()+' '.repeat(spare);
 const s=planRecordedExperiment(createRecordedExperiment(paddedBase),settings);
 const before=exportRecordedExperiment(s);assert.ok(before.length<=3000000);assert.ok(before.length>2999000);
 refusal(()=>receiveRecordedOutcome(s,recording(s,86001)));
 assert.equal(exportRecordedExperiment(s),before);assert.equal(s.acquisition,null);
});
