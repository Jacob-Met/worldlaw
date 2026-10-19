import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import {createExperimentSession,planNextExperiment,acquireNextExperiment,applyNextExperiment,
  experimentView,exportExperimentSession,restoreExperimentSession} from '../src/trajectory/experiment-session.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';

const fixture=()=>JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
const start=bundle=>createExperimentSession(createChallenge(bundle??fixture()));
const plan=session=>planNextExperiment(session??start());
const acquired=()=>acquireNextExperiment(plan(),{seed:91234});
const refusal=(callback,code)=>assert.throws(callback,error=>typeof error.code==='string'&&(!code||error.code===code));

test('stale model, evidence, planned request and pending samples are refused before later transitions',()=>{
  for(const change of [
    s=>{s.current.bundle.trainingRuns[0].samples[1].position+=.001;},
    s=>{s.current.options.noiseSigma=.02;},
    s=>{s.current.discovery.candidates[0].terms[0].coefficient+=.01;},
    s=>{s.plan.selected.acquisitionRequest.initialPosition+=.1;},
  ]){const s=plan();change(s);refusal(()=>acquireNextExperiment(s),'stale_plan');}
  const s=acquired();s.acquisition.run.samples[1].position+=.001;
  refusal(()=>applyNextExperiment(s),'stale_plan');
  refusal(()=>experimentView(structuredClone(plan())),'invalid_experiment');
});

test('fixed reserved evaluation identity cannot be changed to compare different before/after recordings',()=>{
  const s=acquired();s.evaluationRunId='outside-recorded-transition';
  refusal(()=>experimentView(s),'stale_plan');
  refusal(()=>applyNextExperiment(s),'stale_plan');
});

test('pending evidence transitions preserve the input and prohibit duplicate acquire or replacement plans',()=>{
  const initial=plan(),before=JSON.stringify(initial),pending=acquireNextExperiment(initial,{seed:91235});
  assert.equal(JSON.stringify(initial),before);assert.notEqual(pending,initial);
  refusal(()=>acquireNextExperiment(pending),'repeated_evidence');
  refusal(()=>planNextExperiment(pending),'pending_evidence');
  const pendingBefore=JSON.stringify(pending),applied=applyNextExperiment(pending);
  assert.equal(JSON.stringify(pending),pendingBefore);assert.equal(applied.acquisition,null);assert.equal(applied.history.length,1);
  assert.equal(applied.comparison.evaluationRunId,initial.evaluationRunId);
  assert.deepEqual(applied.comparison.evaluationRun,initial.current.bundle.challengeRuns[0]);
  refusal(()=>applyNextExperiment(applied),'missing_acquisition');
});

test('instrument protocol and interactive workload bounds remain explicit refusals',()=>{
  refusal(()=>planNextExperiment(start(),{maxTotalSteps:250001}),'resource_limit');
  const narrow={bounds:{initialPosition:{min:2,max:2},initialRate:{min:0,max:0}},positionCount:1,rateCount:1,maxModels:2};
  for(const settings of [{duration:.4},{duration:.8,sampleInterval:.005}]){
    const s=planNextExperiment(start(),{...narrow,...settings,minDisagreement:0});
    refusal(()=>acquireNextExperiment(s),'instrument_mismatch');
  }
  const bundle=fixture();
  for(const [i,initialPosition]of [[0,.8],[1,-1.1]])bundle.trainingRuns.push(acquireVirtualPendulum({initialPosition,initialRate:0,seed:92000+i,duration:2},{existingRuns:[...bundle.trainingRuns,...bundle.challengeRuns]}));
  refusal(()=>planNextExperiment(start(bundle)),'resource_limit');
});

test('portable pending and applied recipes recompute scientific states and ignore cached predictions',()=>{
  const pending=acquired(),pendingText=exportExperimentSession(pending),raw=JSON.parse(pendingText);
  raw.discovery={selected:{id:'fabricated'}};raw.results=[{status:'ok',rollout:{metrics:{positionRMSE:0}}}];raw.experiment.cachedPrediction={positionRMSE:0};
  const restored=restoreExperimentSession(JSON.stringify(raw));
  assert.deepEqual(restored.acquisition.run,pending.acquisition.run);
  assert.equal(restored.current.discovery.selected.id,pending.current.discovery.selected.id);
  assert.ok(restored.current.summary.selectedPositionRMSE>.5);
  const applied=applyNextExperiment(restored),reopened=restoreExperimentSession(exportExperimentSession(applied));
  assert.deepEqual(reopened.current.bundle,applied.current.bundle);
  assert.equal(reopened.history.length,1);assert.equal(reopened.current.discovery.selected.id,'rate+gravity');
  assert.equal(reopened.comparison.evaluationRunId,applied.comparison.evaluationRunId);
});

test('replay admits only bounded floating-point position differences and preserves recorded evidence',()=>{
  const raw=JSON.parse(exportExperimentSession(acquired()));
  const sample=raw.experiment.pending.run.samples[17];
  sample.position+=Number.EPSILON*Math.max(1,Math.abs(sample.position));
  const expected=sample.position;
  const reopened=restoreExperimentSession(JSON.stringify(raw));
  assert.equal(reopened.acquisition.run.samples[17].position,expected);
  const applied=applyNextExperiment(reopened);
  assert.equal(applied.current.bundle.trainingRuns.at(-1).samples[17].position,expected);
  assert.equal(restoreExperimentSession(exportExperimentSession(applied)).current.bundle.trainingRuns.at(-1).samples[17].position,expected);
  const material=structuredClone(raw);material.experiment.pending.run.samples[17].position+=1e-7;
  refusal(()=>restoreExperimentSession(JSON.stringify(material)),'invalid_history');
  const command=structuredClone(raw);command.experiment.pending.run.samples[17].command=.001;
  refusal(()=>restoreExperimentSession(JSON.stringify(command)),'invalid_history');
});

test('forged recipe identity, extra acquisitions and mismatched outer evidence cannot be replayed',()=>{
  const original=JSON.parse(exportExperimentSession(acquired()));
  for(const change of [
    raw=>{raw.experiment.pending.request.seed++;},
    raw=>{raw.experiment.pending.run.source.recordingId+='edited';},
    raw=>{raw.bundle.trainingRuns[0].samples[3].position+=.1;},
    raw=>{raw.experiment.history=new Array(5).fill(raw.experiment.pending);},
    raw=>{raw.experiment.base.experiment={};},
  ]){const raw=structuredClone(original);change(raw);refusal(()=>restoreExperimentSession(JSON.stringify(raw)));}
});
