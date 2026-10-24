import test from 'node:test';
import assert from 'node:assert/strict';
import {investigateStiffness, stiffnessDesignBasis} from '../src/stiffness/science.mjs';
import {planStiffness} from '../src/stiffness/experiment.mjs';
import {planStiffnessInputDesign, MAX_STIFFNESS_DESIGN_WORK} from '../src/stiffness/design.mjs';

const settings = {knots: [-.3, 0, .3], nuisanceTerms: ['bias', 'command'], noiseSigma: .01, ambiguityDelta: 6};
const rows = Array.from({length: 17}, (_, i) => {
  const position = (i-8)/10, command = 2*position;
  return {position, command, rate: 0, jointTorque: .2+1.2*command-3*position};
});
const permitted = [{command: 1, position: .5, rate: 0}, {command: 1, position: 0, rate: 0}];

test('an independently declared probe resolves confounding without inventing a torque forecast', () => {
  const fit = investigateStiffness(rows, settings);
  assert.equal(planStiffness(fit, permitted).status, 'unidentifiable');
  const plan = planStiffnessInputDesign(rows, settings, {family: 'global'}, permitted);
  assert.equal(plan.before.rank, 2); assert.equal(plan.before.coefficientCount, 3);
  assert.equal(plan.selected.index, 1); assert.equal(plan.selected.after.rank, 3);
  assert.equal(plan.ranked.find(row => row.index === 0).rankChange, 0);
  assert.equal('predictions' in plan.selected, false);
  const received = investigateStiffness([...rows, {...permitted[1], jointTorque: 1.4}], settings);
  assert.equal(received.selected.family, 'global');
  for (const [id, value] of Object.entries({bias: .2, command: 1.2, position: -3}))
    assert.ok(Math.abs(received.selected.terms.find(t => t.id === id).coefficient-value) < 1e-12);
});

test('prospective design is unchanged by response values or supplied check-like fields', () => {
  const original = planStiffnessInputDesign(rows, settings, {family: 'global'}, permitted);
  const changed = rows.map((row, i) => ({...row, jointTorque: i*1234, prediction: -999, heldOut: true}));
  assert.deepEqual(planStiffnessInputDesign(changed, settings, {family: 'global'}, permitted), original);
  assert.deepEqual(rows.map(row => row.jointTorque), rows.map(row => .2+1.2*row.command-3*row.position));
});

test('one new row can help while leaving unresolved coefficients explicit', () => {
  const selected = planStiffnessInputDesign(rows, {...settings, nuisanceTerms: ['bias', 'command', 'rate']},
    {family: 'global'}, [{command: 1, position: 0, rate: 0}]).selected;
  assert.equal(selected.after.rank, 3); assert.equal(selected.after.coefficientCount, 4);
  assert.equal(selected.after.unresolved, 1); assert.equal(selected.after.designSupported, false);
});

test('missing cubic position support and hinge side support remain separate from rank', () => {
  const cubicRows = [0, 1, 2].map(position => ({position, command: 0, rate: 0}));
  const cubic = planStiffnessInputDesign(cubicRows, {...settings, nuisanceTerms: ['bias'], cubicOrigin: 0},
    {family: 'cubic', origin: 0}, [{command: 0, position: 3, rate: 0}]);
  assert.equal(cubic.before.rank, 3); assert.equal(cubic.before.support.missing, 1);
  assert.equal(cubic.selected.supportGain, 1); assert.equal(cubic.selected.after.designSupported, true);
  const hingeRows = [-2, -1, 0, 1, 2, 3].map(position => ({position, command: 0, rate: 0}));
  const hinge = planStiffnessInputDesign(hingeRows, {...settings, nuisanceTerms: ['bias']},
    {family: 'piecewise', knot: 0}, [{command: 0, position: 0, rate: 0}, {command: 0, position: -3, rate: 0}]);
  assert.equal(hinge.before.support.left, 2); assert.equal(hinge.before.support.right, 3);
  assert.equal(hinge.selected.index, 1); assert.equal(hinge.selected.after.support.left, 3);
  assert.equal(hinge.ranked.find(row => row.index === 0).supportGain, 0);
});

test('no-gain, empty choices and already-supported designs do not manufacture a proposal', () => {
  assert.equal(planStiffnessInputDesign(rows, settings, {family: 'global'}, [permitted[0]]).status, 'no_gain');
  assert.equal(planStiffnessInputDesign(rows, settings, {family: 'global'}, []).status, 'no_permitted_inputs');
  const complete = [...rows, permitted[1]];
  const plan = planStiffnessInputDesign(complete, settings, {family: 'global'}, permitted);
  assert.equal(plan.status, 'already_supported'); assert.equal(plan.selected, null);
});

test('complete prospective course refuses excess work without thinning permitted states', () => {
  const many = Array.from({length: 4096}, (_, i) => ({position: i/1000, command: i%2, rate: i%3}));
  const choices = Array.from({length: 512}, (_, i) => ({position: i/100, command: i%3, rate: i%5}));
  const plan = planStiffnessInputDesign(many, {...settings, nuisanceTerms: ['bias', 'command', 'rate']},
    {family: 'piecewise', knot: 0}, choices);
  assert.equal(plan.status, 'work_limit'); assert.ok(plan.work > MAX_STIFFNESS_DESIGN_WORK);
  assert.equal(plan.permittedCount, 512); assert.deepEqual(plan.ranked, []); assert.equal(plan.selected, null);
});

test('basis declarations and numerical inputs must belong to the actual offered family', () => {
  assert.throws(() => stiffnessDesignBasis(rows, settings, {family: 'cubic', origin: 0}), /offered/);
  assert.throws(() => stiffnessDesignBasis(rows, settings, {family: 'piecewise', knot: 9}), /offered/);
  assert.throws(() => stiffnessDesignBasis(rows, settings, {family: 'global', knot: 0}), /global/);
  assert.throws(() => planStiffnessInputDesign([{position: NaN, command: 0, rate: 0}], settings,
    {family: 'global'}, permitted), /finite/);
  assert.throws(() => planStiffnessInputDesign(rows, settings, {family: 'global'}, [permitted[0], permitted[0]]), /distinct/);
});

// Consumer controls: unsupported forecasts stay absent through the maintained acquisition path.
import {stiffnessExperimentCourse, observeStiffnessCourse} from '../src/stiffness/experiment-fixture.mjs';
import {setPendingStiffnessRequest, receiveStiffnessObservation, exportStiffnessExperiment,
 importStiffnessExperiment, experimentInputs, replayStiffnessExperiment} from '../src/stiffness/experiment.mjs';

test('input-design request receives and replays a real authored reading without retroactive forecasts', () => {
  const initial=stiffnessExperimentCourse('confounded');
  const design=planStiffnessInputDesign(initial.study.dataset.observations, initial.study.settings,
    {family:'global'}, initial.permitted);
  const pending=setPendingStiffnessRequest(initial,design.selected.index);
  assert.equal(pending.pending.index,1);assert.equal(pending.pending.planStatus,'unidentifiable');
  assert.deepEqual(pending.pending.predictions,[]);
  const reopened=importStiffnessExperiment(exportStiffnessExperiment(pending));
  assert.deepEqual(reopened.pending,pending.pending);
  const reading={id:'off-line-authored',source:{label:'Explicit independent analytic generator',declaredKind:'authored simulation'},
    observation:{...reopened.pending.state,jointTorque:observeStiffnessCourse('confounded',reopened.pending.state)}};
  assert.equal(reading.observation.jointTorque,1.4);
  assert.throws(()=>receiveStiffnessObservation(reopened,reopened.pending,{...reading,observation:{...reading.observation,command:1.1}}),/coordinates/i);
  const received=receiveStiffnessObservation(reopened,reopened.pending,reading);
  assert.equal(received.study.dataset.observations.length,18);assert.equal(received.study.fit.selected.family,'global');
  assert.deepEqual(received.history[0].request,reopened.pending);
  assert.deepEqual(received.history[0].request.predictions,[]);assert.deepEqual(received.history[0].errors,[]);
  assert.deepEqual(received.history[0].acquisition.observation,reading.observation);
  const next=setPendingStiffnessRequest(received,0);
  assert.ok(next.pending.predictions.length>0,'supported subsequent request can forecast after receiving the reading');
  const saved=JSON.parse(exportStiffnessExperiment(next));
  assert.equal(saved.schema,'worldlaw.stiffness-experiment/v1');assert.equal(saved.design,undefined);
  assert.deepEqual(saved.permitted,initial.permitted);
  const final=importStiffnessExperiment(JSON.stringify(saved));
  assert.deepEqual(final,next);assert.deepEqual(final.history[0].errors,[]);
});

test('response mutations change fitted explanations but not input design; check mutations leave sequential evidence intact', () => {
  const initial=stiffnessExperimentCourse('confounded'),frozen=setPendingStiffnessRequest(initial,1);
  const acquired=receiveStiffnessObservation(frozen,frozen.pending,{id:'design-reading',source:{label:'Authored independent response',declaredKind:'authored'},
    observation:{...frozen.pending.state,jointTorque:1.4}});
  const session=setPendingStiffnessRequest(acquired,0);
  const inspect=s=>planStiffnessInputDesign(s.study.dataset.observations,s.study.settings,{family:'global'},s.permitted);
  const originalDesign=inspect(session),changedInputs=experimentInputs(session);
  changedInputs.initial.dataset.observations=changedInputs.initial.dataset.observations.map((r,i)=>({...r,jointTorque:100+i}));
  changedInputs.acquisitions[0].observation.jointTorque=-9;
  changedInputs.initial.dataset.heldOut=changedInputs.initial.dataset.heldOut.map(r=>({...r,jointTorque:999}));
  const changed=replayStiffnessExperiment(changedInputs);
  assert.deepEqual(inspect(changed),originalDesign);
  assert.notDeepEqual(changed.study.fit.selected.terms,session.study.fit.selected.terms);
  assert.deepEqual(changed.history[0].request.predictions,[]);assert.deepEqual(changed.history[0].errors,[]);
  const checkInputs=experimentInputs(session);
  checkInputs.initial.dataset.heldOut=checkInputs.initial.dataset.heldOut.map(r=>({...r,jointTorque:999}));
  const checksOnly=replayStiffnessExperiment(checkInputs);
  assert.deepEqual(inspect(checksOnly),originalDesign);assert.deepEqual(checksOnly.study.fit,session.study.fit);
  assert.deepEqual(checksOnly.pending,session.pending);assert.deepEqual(checksOnly.history,session.history);
  assert.notDeepEqual(checksOnly.study.checks,session.study.checks);
});

test('inspecting another offered structure does not rewrite saved declarations or a frozen request', () => {
  const session=setPendingStiffnessRequest(stiffnessExperimentCourse('confounded'),1);
  const saved=exportStiffnessExperiment(session),pending=structuredClone(session.pending);
  for(const choice of [{family:'global'},{family:'piecewise',knot:session.study.settings.knots[0]}])
    planStiffnessInputDesign(session.study.dataset.observations,session.study.settings,choice,session.permitted);
  assert.equal(exportStiffnessExperiment(session),saved);assert.deepEqual(session.pending,pending);
});
