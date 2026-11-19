import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChallenge} from '../src/trajectory/session.mjs';
import * as owner from '../src/trajectory/experiment-session.mjs';
import {withNumericalScreen} from '../src/experiment-design/screened-controller.mjs';
const screened=withNumericalScreen(owner);

test('normal notebook retains correlated sensor provenance and refuses changed memory on reopen',()=>{
  const bundle=JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
  const initial=screened.createExperimentSession(createChallenge(bundle));
  // The existing one-reading storage control; no statistical-power claim.
  const settings={noiseSigma:.012,noiseTargetZ:.000001,noiseMaxReadings:1,maxModels:2,maxTotalSteps:250000,noiseCorrelationTime:.4};
  const planned=screened.planNextExperiment(initial,settings);
  assert.equal(planned.plan.status,'proposed');
  assert.equal(screened.experimentView(planned).numericalQualification.status,'screen_passed');
  const acquired=screened.acquireSelectedReadings(planned,{seed:189453});
  const serialized=owner.exportExperimentSession(acquired);
  const reopened=screened.restoreExperimentSession(serialized);
  assert.deepEqual(reopened.sparseAcquisition.evidence,acquired.sparseAcquisition.evidence);
  assert.deepEqual(reopened.sparseAcquisition.receiving,acquired.sparseAcquisition.receiving);
  assert.equal(reopened.settings.noiseCorrelationTime,.4);
  for(const edit of [
    x=>{x.experiment.sparse.evidence.source.positionNoiseCorrelationTime=.5;},
    x=>{x.experiment.sparse.request.noiseCorrelationTime=.5;},
    x=>{x.experiment.sparse.planSettings.noiseCorrelationTime=.5;}
  ]){const x=JSON.parse(serialized);edit(x);assert.throws(()=>screened.restoreExperimentSession(JSON.stringify(x)));}
  assert.throws(()=>screened.acquireSelectedReadings(acquired,{seed:189454}));
});
