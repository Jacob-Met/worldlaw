import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {designActiveLinearAdaptive} from '../src/science/active-linear-adaptive.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook,adaptiveNotebookState,
  sealActiveReadout} from '../src/science/active-experiment-record.mjs';
const cases=JSON.parse(readFileSync(new URL('./fixtures/active-adaptive-baseline/cases.json',import.meta.url),'utf8')).cases;
const request=id=>structuredClone(cases.find(row=>row.id===id).request);
const makeBook=()=>createActiveNotebook(JSON.stringify(request('four_laws_point')));
function reading(book,values){
  const current=adaptiveNotebookState(book);
  return {schema:'worldlaw.active-adaptive-readings/v1',source:'Independent synthetic boundary observation for custody test',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    round:current.round,previousReadingsSHA256:current.previousReadingsSHA256,stateKey:current.node.key,
    experimentId:current.action.id,readings:current.action.readings.map((row,i)=>({tick:row.tick,value:values[i]}))};
}
const receive=(book,values)=>receiveActiveNotebook(book,JSON.stringify(reading(book,values)));

test('one frozen policy chooses different second experiments from actual survivors',async()=>{
  const original=await makeBook(),left=await receive(original,['0']),right=await receive(original,['1']);
  assert.equal(original.readouts.length,0);
  assert.equal(original.plan.worstReadings,2);assert.equal(original.plan.staticPlan.readings,3);
  assert.equal(adaptiveNotebookState(left).action.id,'probe_1');
  assert.equal(adaptiveNotebookState(right).action.id,'probe_2');
  for(const branch of [left,right]){
    const completed=await receive(branch,['1']);
    assert.equal(completed.readouts.at(-1).result.status,'one_hypothesis_consistent');
    assert.equal(adaptiveNotebookState(completed).spentReadings,2);
    assert.equal(adaptiveNotebookState(completed).node,null);
    assert.deepEqual(await replayActiveNotebook(JSON.stringify(completed)),completed);
    await assert.rejects(()=>receiveActiveNotebook(completed,JSON.stringify(reading(original,['0']))),/no pending/);
  }
});

test('unknown hidden velocity cancels across complete experiment bundles',()=>{
  const plan=designActiveLinearAdaptive(request('four_laws_coupled'));
  assert.equal(plan.worstReadings,6);assert.equal(plan.staticPlan.readings,9);
  assert.equal(plan.status,'optimal_certified_adaptive_policy');
});

test('remaining reading budget permits the slower cheap child under the hard branch',()=>{
  const plan=designActiveLinearAdaptive(request('five_laws_budget_slack'));
  assert.equal(plan.worstReadings,3);assert.equal(plan.worstCost,3);
  assert.equal(plan.policy.states.find(row=>row.key==='24:2').action,'slow_cheap');
  assert.equal(plan.policy.states.find(row=>row.key==='24:1').action,'probe_3');
  assert.equal(plan.policy.states.find(row=>row.key==='24:1').cost,100);
});

test('joint tube geometry distinguishes pair overlap from a common intersection and keeps closed contact',()=>{
  for(const [id,masks,feasible] of [['non_helly_pair_graph',[3,5,6],false],['three_tube_closed_contact',[7],true]]){
    const plan=designActiveLinearAdaptive(request(id));
    assert.equal(plan.geometry[0].intersections.at(-1).radius,'1/8');
    assert.equal(plan.geometry[0].intersections.at(-1).feasible,feasible);
    assert.deepEqual(plan.geometry[0].maximalMasks,masks);
    assert.equal(plan.status,'no_guaranteed_policy');
  }
});

test('outside readings stop without assigning a law or permitting another branch',async()=>{
  const book=await makeBook(),outside=await receive(book,['9']);
  assert.equal(outside.readouts[0].result.status,'all_remaining_hypotheses_falsified');
  assert.deepEqual(outside.readouts[0].result.consistentHypothesisIds,[]);
  assert.equal(adaptiveNotebookState(outside).action,null);
  assert.deepEqual(await replayActiveNotebook(outside),outside);
});

test('a later reading is bound to its exact source, policy, round, prior original and chosen branch',async()=>{
  const original=await makeBook(),book=await receive(original,['1']);
  const valid=reading(book,['1']);
  for(const change of [row=>row.sourceSHA256='0'.repeat(64),row=>row.planSHA256='0'.repeat(64),
    row=>row.round=1,row=>row.previousReadingsSHA256=null,row=>row.stateKey='3:1',
    row=>row.experimentId='probe_1',row=>row.readings=[],row=>row.readings.push({...row.readings[0]}),
    row=>row.readings[0].tick=0,row=>row.hiddenTruth='law_3']){
    const changed=structuredClone(valid);change(changed);
    await assert.rejects(()=>receiveActiveNotebook(book,JSON.stringify(changed)));
  }
  assert.equal(book.readouts.length,1);
  await assert.rejects(()=>sealActiveReadout(book.sourceText,book.plan,JSON.stringify(valid)),/portable notebook/);
});

test('forged policy geometry and reordered or altered historical outcomes fail exact replay',async()=>{
  const initial=await makeBook(),first=await receive(initial,['1']),book=await receive(first,['1']);
  for(const change of [b=>b.plan.worstCost++,b=>b.plan.geometry[0].intersections.at(-1).radius='0',
    b=>b.plan.policy.states[0].action='probe_2',b=>b.readouts.reverse(),
    b=>b.readouts[0].readingsText+=' ',b=>b.readouts[1].result.nextMask=1,
    b=>b.readouts[1].result.additionalClaim='identified physical truth']){
    const altered=structuredClone(book);change(altered);
    await assert.rejects(()=>replayActiveNotebook(altered));
  }
});

test('hard exhaustion exposes no chosen policy and unsupported nuisance assumptions refuse',()=>{
  const limited=request('five_laws_budget_slack');limited.workLimit=100;
  const incomplete=designActiveLinearAdaptive(limited);
  assert.equal(incomplete.status,'search_inconclusive');assert.equal(incomplete.exhausted,true);
  assert.equal(incomplete.policy,null);assert.equal(incomplete.worstReadings,null);assert.equal(incomplete.worstCost,null);
  for(const change of [r=>r.resetSemantics='same-hidden-state',r=>r.truth='law_1',
    r=>r.hypotheses[0].initialState=[0],r=>r.experiments[0].readings.reverse(),
    r=>r.experiments[0].actuationCost=-1]){
    const invalid=request('four_laws_integrator');change(invalid);
    assert.throws(()=>designActiveLinearAdaptive(invalid));
  }
});
