import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {designActiveLinearAdaptive} from '../src/science/active-linear-adaptive.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook,adaptiveNotebookState}
  from '../src/science/active-experiment-record.mjs';
import {displayActiveNotebook,illustrateModels} from '../src/active/view.mjs';

const course=()=>JSON.parse(readFileSync(new URL('../examples/active-adaptive-amplitudes.json',import.meta.url),'utf8'));
function reading(book,value){
  const current=adaptiveNotebookState(book);
  return {schema:'worldlaw.active-adaptive-readings/v1',source:'Separate exact rational diagnostic observation; no physical acquisition',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    round:current.round,previousReadingsSHA256:current.previousReadingsSHA256,stateKey:current.node.key,
    experimentId:current.action.id,readings:current.action.readings.map(row=>({tick:row.tick,value}))};
}
const receive=(book,value)=>receiveActiveNotebook(book,JSON.stringify(reading(book,value)));

test('required amplitude observations continue after a compatible singleton and replay exactly',async()=>{
  const original=await createActiveNotebook(JSON.stringify(course()));
  assert.equal(original.plan.worstReadings,3);
  assert.equal(original.plan.staticPlan.readings,3);
  assert.equal(original.plan.worstCost,3);
  assert.deepEqual(original.plan.achievedRequiredInputDiversity,{distinct:3,rank:2});
  let book=original;
  for(const [index,value] of ['2','4','3'].entries()){
    book=await receive(book,value);
    const result=book.readouts.at(-1).result;
    assert.deepEqual(result.consistentHypothesisIds,['double']);
    assert.equal(result.status,index<2?'continue_frozen_policy':'one_hypothesis_consistent');
    assert.equal(result.pendingRequiredExperiments.length,2-index);
    assert.equal(result.requiredExperimentsComplete,index===2);
    assert.deepEqual(await replayActiveNotebook(book),book);
    if(index<2){
      const shown=displayActiveNotebook(book,-1);
      assert.deepEqual(shown.display.remainingHypothesisIds,['double']);
      assert.equal(illustrateModels(shown).traces.length,1);
    }
  }
  assert.equal(adaptiveNotebookState(book).action,null);
  assert.equal(original.readouts.length,0);
});

test('three original quadratic endpoint aliases are rejected at the required interior input',async()=>{
  for(const values of [['0','0','-1/4'],['2','4','5/2'],['4','8','13/2']]){
    let book=await createActiveNotebook(JSON.stringify(course()));
    for(const value of values)book=await receive(book,value);
    const result=book.readouts.at(-1).result;
    assert.equal(result.status,'all_remaining_hypotheses_falsified');
    assert.deepEqual(result.consistentHypothesisIds,[]);
    assert.ok(result.checks.every(row=>row.noiseMarginExact));
    assert.equal(adaptiveNotebookState(book).action,null);
    assert.deepEqual(await replayActiveNotebook(book),book);
  }
});

test('a required delayed observation can falsify a singleton even when it separates no listed pair',async()=>{
  const source=course();
  delete source.requiredInputDiversity;
  source.experiments=source.experiments.slice(0,2);
  source.experiments[1]={id:'delayed_reading',controls:[[1,1],[0,0],[0,0]],readings:[{tick:2,cost:1}],actuationCost:0};
  source.requiredExperiments=['amplitude_one','delayed_reading'];source.maxTotalReadings=2;
  let book=await createActiveNotebook(JSON.stringify(source));
  assert.equal(book.plan.geometry[1].maximalMasks[0],7);
  book=await receive(book,'0');
  assert.equal(adaptiveNotebookState(book).action.id,'delayed_reading');
  book=await receive(book,'2');
  assert.equal(book.readouts.at(-1).result.status,'all_remaining_hypotheses_falsified');
});

test('closed noise equality is retained and a strict residual excess is rejected',async()=>{
  for(const [bound,status] of [['1/4','one_hypothesis_consistent'],['1/5','all_remaining_hypotheses_falsified']]){
    const source=course();source.noiseBound=bound;
    let book=await createActiveNotebook(JSON.stringify(source));
    for(const value of ['0','0','-1/4'])book=await receive(book,value);
    assert.equal(book.readouts.at(-1).result.status,status);
    assert.equal(book.readouts.at(-1).result.checks[0].minimumNoiseRequired,'1/4');
  }
});

test('finite required inputs remain a list-relative certificate and cannot exclude a vanishing cubic',async()=>{
  let book=await createActiveNotebook(JSON.stringify(course()));
  // f(u)=2u+(u-1)(u-3/2)(u-2) equals the offered double law at all three probes.
  for(const value of ['2','4','3'])book=await receive(book,value);
  assert.equal(book.readouts.at(-1).result.status,'one_hypothesis_consistent');
  assert.equal(book.readouts.at(-1).result.physicalProvenanceVerified,false);
  assert.match(book.plan.interpretation,/does not exclude unlisted mechanisms/);
});

test('coverage cannot be forged, skipped, duplicated or silently added after planning',async()=>{
  const initial=await createActiveNotebook(JSON.stringify(course())),first=await receive(initial,'2');
  for(const change of [b=>b.readouts[0].result.nextCoveredMask=7,
    b=>b.readouts[0].result.pendingRequiredExperiments=[],b=>b.plan.requiredExperimentMask=1,
    b=>b.plan.policy.states.find(row=>row.key===b.plan.policy.rootKey).nextCoveredMask=7,
    b=>{const r=JSON.parse(b.sourceText);r.requiredExperiments.pop();b.sourceText=JSON.stringify(r);}]){
    const altered=structuredClone(first);change(altered);
    await assert.rejects(()=>replayActiveNotebook(altered));
  }
  const repeated=reading(initial,'2');
  await assert.rejects(()=>receiveActiveNotebook(first,JSON.stringify(repeated)));
  for(const requiredExperiments of [[],['unknown'],['amplitude_one','amplitude_one']]){
    assert.throws(()=>designActiveLinearAdaptive({...course(),requiredExperiments}),/requiredExperiments/);
  }
});

test('coverage obeys the original reading and exact-work budgets',()=>{
  const source=course();source.maxTotalReadings=2;
  const limited=designActiveLinearAdaptive(source);
  assert.equal(limited.status,'insufficient_total_reading_budget');
  assert.equal(limited.policy,null);
  source.maxTotalReadings=3;source.workLimit=100;
  const exhausted=designActiveLinearAdaptive(source);
  assert.equal(exhausted.status,'search_inconclusive');
  assert.equal(exhausted.policy,null);
});

test('required named bundles cannot substitute duplicated or collinear inputs for declared diversity',()=>{
  for(const amplitudes of [[1,1,1],[1,2,2]]){
    const source=course();
    source.experiments.forEach((action,i)=>{action.controls[0][1]=amplitudes[i];});
    const plan=designActiveLinearAdaptive(source);
    assert.equal(plan.status,'insufficient_required_input_diversity');
    assert.equal(plan.policy,null);
    assert.equal(plan.achievedRequiredInputDiversity.distinct,new Set(amplitudes).size);
  }
  const collinear=course();
  collinear.experiments.forEach((action,i)=>{action.controls[0]=[i+1,i+1];});
  const plan=designActiveLinearAdaptive(collinear);
  assert.deepEqual(plan.achievedRequiredInputDiversity,{distinct:3,rank:1});
  assert.equal(plan.status,'insufficient_required_input_diversity');
  const late=course();late.experiments.forEach((action,i)=>{action.controls=[[1,1],[0,i]];});
  assert.deepEqual(designActiveLinearAdaptive(late).achievedRequiredInputDiversity,{distinct:1,rank:1});
});
