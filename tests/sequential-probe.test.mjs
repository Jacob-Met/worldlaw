import test from 'node:test';
import assert from 'node:assert/strict';
import {planSequentialProbe} from '../src/unknown-lab/sequential-probe.mjs';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';

function fixture() {
  const training = probeExample('ambiguous');
  training.runs = training.runs.filter(run => run.role === 'training');
  const settings = {budget: 2, contrastRadius: .01, probes: [
    {id:'still', position:.6, rate:0, cost:1},
    {id:'moving', position:.6, rate:.58, cost:1}
  ]};
  return {training, settings};
}
test('a measured contrast at zero rate distinguishes admitted torque laws', () => {
  const {training, settings} = fixture();
  const first = planSequentialProbe(training, settings);
  assert.equal(first.selected.id, 'still');
  assert.deepEqual(first.models.map(x => x.id), ['drag','restoring']);
  const next = planSequentialProbe(training, settings, [{id:'still',contrast:0}]);
  assert.deepEqual(next.models.map(x => x.id), ['drag']);
  assert.equal(next.selected, null);
  assert.deepEqual(next.spent,[1,1]);
  assert.doesNotThrow(() => JSON.stringify(first));
});
test('a contradicted family stays empty and duplicate or over-budget observations are refused', () => {
  const {training, settings} = fixture();
  const observed = {id:'still',contrast:20};
  assert.equal(planSequentialProbe(training,settings,[observed]).models.length, 0);
  assert.throws(() => planSequentialProbe(training,settings,[observed,observed]), /distinct/);
  assert.throws(() => planSequentialProbe(training,{...settings,budget:0},[observed]), /budget/);
  assert.throws(() => planSequentialProbe(training,settings,[{id:'still',contrast:NaN}]), /bounded/);
});
