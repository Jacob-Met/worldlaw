import test from 'node:test';
import assert from 'node:assert/strict';
import {UNITS} from '../src/science/torque-discovery.mjs';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {acquireVirtualPendulumReadings} from '../src/trajectory/virtual-experiment.mjs';
import {receiveSparseReadings} from '../src/trajectory/sparse-discrimination.mjs';

test('actual planner, independent step screen and sparse sensor consume the same declared covariance',()=>{
  const models=[{schema:'worldlaw.torque-model/v1',id:'zero',terms:[],units:UNITS},
    {schema:'worldlaw.torque-model/v1',id:'bias',terms:[{id:'bias',coefficient:1}],units:UNITS}];
  const discovery={schema:'worldlaw.discovery/v1',units:UNITS,candidates:models,competitive:models,trainingRuns:[{id:'frozen-source'}]};
  const options={inertia:.8,bounds:{initialPosition:{min:1,max:1},initialRate:{min:0,max:0}},duration:.8,sampleInterval:.04,maxStep:.01,minDisagreement:0,noiseSigma:.01,noiseTargetZ:3,noiseMaxReadings:4,noiseCorrelationTime:.3};
  const plan=planTrajectoryExperiment(discovery,options);
  assert.equal(plan.method,'finite-grid_minimax_correlated_gaussian_discrimination');
  assert.equal(plan.status,'proposed');
  const screen=qualifyTrajectoryPlan(discovery,plan);
  assert.equal(screen.status,'screen_passed');
  const evidence=acquireVirtualPendulumReadings({...plan.selected.acquisitionRequest,noiseSigma:.01,noiseCorrelationTime:.3,seed:30013,sampleIndices:plan.selected.power.readings.map(r=>r.sampleIndex)},{existingRuns:[]});
  const result=receiveSparseReadings(plan,evidence);
  assert.equal(result.correlationTimeSeconds,.3);
  assert.equal(result.unmeasuredPositionsConsumed,0);
  assert.equal(result.measuredReadingCount,plan.selected.power.measurementCount);
  const tampered=structuredClone(evidence);tampered.source.positionNoiseCorrelationTime=.4;
  assert.throws(()=>receiveSparseReadings(plan,tampered),/differs/);
  const bad=structuredClone(plan);bad.options.noiseCorrelationTime=0;
  assert.throws(()=>qualifyTrajectoryPlan(discovery,bad),/covariance/);
  const normalGrid=planTrajectoryExperiment(discovery,{...options,bounds:{initialPosition:{min:-1,max:1},initialRate:{min:-.2,max:.2}}});
  assert.equal(normalGrid.ranked.length,27);
  assert.ok(normalGrid.diagnostics.reservedPowerProducts<=normalGrid.options.maxPowerProducts);
  assert.ok(normalGrid.ranked.every(row=>row.power.work.innovationTerms<=row.power.work.limit));
});
