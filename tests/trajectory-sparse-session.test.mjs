import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import * as owner from '../src/trajectory/experiment-session.mjs';
import {withNumericalScreen} from '../src/experiment-design/screened-controller.mjs';

const screened=withNumericalScreen(owner);
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
const start=()=>screened.createExperimentSession(createChallenge(fixture()));
const settings={noiseSigma:.012,noiseTargetZ:.000001,noiseMaxReadings:1,maxModels:2,maxTotalSteps:250000};

test('actual Studio controller persists a one-reading experiment with exact provenance and no silent training refit',()=>{
  const initial=start();
  const planned=screened.planNextExperiment(initial,settings);
  assert.equal(planned.plan.status,'proposed');
  assert.equal(screened.experimentView(planned).numericalQualification.status,'screen_passed');
  const trainingBefore=JSON.stringify(initial.current.bundle.trainingRuns);
  const originalModel=initial.current.discovery.selected.id;
  const acquired=screened.acquireSelectedReadings(planned,{seed:844901});
  const view=screened.experimentView(acquired);
  assert.equal(view.acquisitionAllowed,false);
  assert.equal(view.acquisition,null);
  assert.ok(view.sparseAcquisition);
  assert.equal(view.sparseAcquisition.evidence.readings.length,1);
  assert.equal(view.sparseAcquisition.receiving.candidates.length,2);
  assert.equal(view.sparseAcquisition.evidence.source.measuredSampleCount,1);
  assert.equal(view.sparseAcquisition.evidence.source.fullGridSampleCount,201);
  assert.equal(JSON.stringify(acquired.current.bundle.trainingRuns),trainingBefore);
  assert.equal(acquired.current.discovery.selected.id,originalModel);
  assert.throws(()=>screened.acquireSelectedReadings(acquired,{seed:844902}),e=>e.code==='repeated_evidence');
  assert.throws(()=>screened.acquireNextExperiment(acquired,{seed:844902}),e=>e.code==='repeated_evidence');
  assert.throws(()=>screened.planNextExperiment(acquired,settings),e=>e.code==='pending_evidence');
  assert.throws(()=>screened.applyNextExperiment(acquired),e=>e.code==='missing_acquisition');
  const notebook=owner.exportExperimentSession(acquired);
  const reopened=screened.restoreExperimentSession(notebook);
  assert.deepEqual(reopened.sparseAcquisition.evidence,acquired.sparseAcquisition.evidence);
  assert.deepEqual(reopened.sparseAcquisition.receiving,acquired.sparseAcquisition.receiving);
  assert.equal(reopened.plan.id,acquired.plan.id);
  assert.equal(screened.experimentView(reopened).acquisitionAllowed,false);
  assert.equal(JSON.stringify(reopened.current.bundle.trainingRuns),trainingBefore);
  assert.deepEqual(screened.restoreExperimentSession(owner.exportExperimentSession(reopened)).sparseAcquisition.evidence,
    acquired.sparseAcquisition.evidence);
});

test('sparse evidence replay rejects tampered sensor position, sample index, sigma and planning protocol',()=>{
  const acquired=screened.acquireSelectedReadings(screened.planNextExperiment(start(),settings),{seed:845001});
  const original=JSON.parse(owner.exportExperimentSession(acquired));
  for(const edit of [
    obj=>{obj.experiment.sparse.evidence.readings[0].position+=.01;},
    obj=>{obj.experiment.sparse.evidence.readings[0].sampleIndex++;},
    obj=>{obj.experiment.sparse.evidence.source.positionNoiseSigma+=.001;},
    obj=>{obj.experiment.sparse.request.sampleIndices[0]++;},
    obj=>{obj.experiment.sparse.request.seed++;},
    obj=>{obj.experiment.sparse.planSettings.noiseTargetZ+=.01;},
    obj=>{obj.experiment.sparse.evidence.source.oracle.gravity=100000;},
    obj=>{obj.experiment.pending={planSettings:obj.experiment.sparse.planSettings};},
  ]){
    const edited=structuredClone(original);edit(edited);
    assert.throws(()=>screened.restoreExperimentSession(JSON.stringify(edited)),
      e=>typeof e.code==='string'&&['invalid_history','invalid_plan','protocol_mismatch'].includes(e.code));
  }
  const mutated=structuredClone(acquired);
  mutated.sparseAcquisition.evidence.readings[0].position+=.1;
  assert.throws(()=>screened.experimentView(mutated),e=>e.code==='invalid_experiment');
  acquired.sparseAcquisition.evidence.readings[0].position+=.1;
  assert.throws(()=>screened.experimentView(acquired),e=>e.code==='stale_plan');
});

test('unknown or real measured source remains incompatible with the independent synthetic sensor',()=>{
  const bundle=fixture();
  bundle.trainingRuns[0].source.oracle.gravity=-88;
  const initial=screened.createExperimentSession(createChallenge(bundle));
  assert.equal(screened.experimentView(initial).available,false);
  assert.throws(()=>screened.planNextExperiment(initial,settings),e=>e.code==='instrument_unavailable');
});
