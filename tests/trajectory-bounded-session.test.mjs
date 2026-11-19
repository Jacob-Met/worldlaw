import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import * as owner from '../src/trajectory/experiment-session.mjs';
import {withNumericalScreen} from '../src/experiment-design/screened-controller.mjs';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {receiveSparseReadings} from '../src/trajectory/sparse-discrimination.mjs';

const screened=withNumericalScreen(owner);
const fixture=JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
const sensor={noiseSigma:.012,noiseTargetZ:.000001,noiseMaxReadings:1,maxModels:2,
  maxTotalSteps:250000,noiseCorrelationTime:.2,noiseCorrelationTimeMax:.8};

test('robust memory interval is a real session->screen->sparse source->notebook->reopen path',()=>{
  const base=screened.createExperimentSession(createChallenge(fixture));
  const plan=screened.planNextExperiment(base,sensor);
  assert.equal(plan.plan.method,'finite-grid_minimax_bounded_correlated_gaussian_discrimination');
  assert.equal(plan.plan.status,'proposed');
  assert.deepEqual(plan.plan.selected.power.correlationTimeRangeSeconds,{min:.2,max:.8});
  assert.equal(screened.experimentView(plan).numericalQualification.status,'screen_passed');
  const acquired=screened.acquireSelectedReadings(plan,{seed:189453});
  assert.equal(acquired.sparseAcquisition.evidence.source.positionNoiseCorrelationTime,.2);
  assert.deepEqual(acquired.sparseAcquisition.receiving.correlationTimeRangeSeconds,{min:.2,max:.8});
  assert.match(acquired.sparseAcquisition.receiving.uncertaintyReceiverMeaning,/conditional only.*nominal tau/);
  const txt=owner.exportExperimentSession(acquired),doc=JSON.parse(txt);
  const recovered=screened.restoreExperimentSession(txt);
  assert.deepEqual(recovered.sparseAcquisition.receiving,acquired.sparseAcquisition.receiving);
  assert.deepEqual(recovered.sparseAcquisition.evidence,acquired.sparseAcquisition.evidence);
  assert.equal(recovered.settings.noiseCorrelationTimeMax,.8);
  for(const mutate of [
    x=>{x.experiment.sparse.planSettings.noiseCorrelationTimeMax=.9;},
    x=>{x.experiment.sparse.evidence.source.positionNoiseCorrelationTime=.7;},
    x=>{x.experiment.sparse.request.noiseCorrelationTime=.6;}
  ]){const edit=structuredClone(doc);mutate(edit);assert.throws(()=>screened.restoreExperimentSession(JSON.stringify(edit)));}
  const sourceSwapped=structuredClone(acquired.sparseAcquisition.evidence);
  sourceSwapped.source.positionNoiseCorrelationTime=.4;
  assert.throws(()=>receiveSparseReadings(plan.plan,sourceSwapped),/differs/);
  assert.throws(()=>screened.acquireSelectedReadings(acquired,{seed:189455}),/recorded|already|evidence/);
});

test('bounded numerical screen refuses a changed tau limit without silently assuming point tau',()=>{
  const state=screened.planNextExperiment(screened.createExperimentSession(createChallenge(fixture)),sensor);
  const tampered=structuredClone(state.plan);
  tampered.options.noiseCorrelationTimeMax=.9;
  assert.throws(()=>qualifyTrajectoryPlan(state.current.discovery,tampered),/covariance|power|sensor|mismatch/i);
  assert.throws(()=>planTrajectoryExperiment(state.current.discovery,{...sensor,
    noiseCorrelationTimeMax:.1,inertia:.8,bounds:{initialPosition:{min:-.5,max:.5},initialRate:{min:-.2,max:.2}}}),/upper|nominal|lower/);
  assert.throws(()=>screened.planNextExperiment(screened.createExperimentSession(createChallenge(fixture)),
    {...sensor,noiseSigma:undefined,noiseCorrelationTimeMax:.8}),/noiseSigma|noise-aware/i);
});
