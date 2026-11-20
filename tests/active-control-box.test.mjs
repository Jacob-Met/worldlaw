import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  ACTIVE_LINEAR_CONTROL_BOX_SCHEMA,designActiveLinearControlBox,replayActiveLinearControlBox,
  evaluateActiveLinearReadings,
} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';

const cases=JSON.parse(await readFile(new URL('./fixtures/active-control-box-cases.json',import.meta.url),'utf8'));
const course=name=>structuredClone(cases.find(row=>row.name===name).request);
const ticks=plan=>plan.selection?.map(row=>row.tick)??null;
const readings=(values,ts=[0,1,4])=>({schema:'worldlaw.active-linear-readings/v1',
  source:'Independent analytic position p0=3, v0=-2 under frozen unit velocity inputs',
  acquisition:'synthetic',readings:ts.map((tick,i)=>({tick,value:values[i]}))});

test('continuous control synthesis needs three readings and optimizes their signed input',()=>{
  const request=course('coupled_minimum_support'),plan=designActiveLinearControlBox(request);
  // p[t]=p0+g(t*v0+sum_{k<t}(t-1-k)u[k]). The [3,-4,1]
  // projection at [0,1,4] removes p0,v0; max gap=3+2+1=6.
  assert.equal(plan.status,'optimal_certified_control_box');
  assert.deepEqual(ticks(plan),[0,1,4]);assert.equal(plan.totalCost,3);
  assert.deepEqual(plan.chosenControls,[['1'],['1'],['1'],['0']]);
  assert.equal(plan.proof[0].marginLowerBound,'3/4');
  assert.deepEqual(plan.proof[0].witness.weights,['3','-4','1']);
  assert.equal(plan.proof[0].witness.signedGap,'6');assert.equal(plan.proof[0].witness.l1Norm,'8');
  assert.equal(plan.potential[0].marginLowerBound,'1');
  assert.equal(plan.outcomeValuesUsed,false);assert.equal(plan.physicalActionsPerformed,false);
  assert.equal(replayActiveLinearControlBox(request,plan).valid,true);
});

test('noncentered bounds require the negative circuit orientation',()=>{
  const plan=designActiveLinearControlBox(course('negative_only_orientation'));
  assert.deepEqual(ticks(plan),[1]);assert.deepEqual(plan.chosenControls,[['-3'],['0']]);
  assert.equal(plan.proof[0].witness.signedGap,'-3');assert.equal(plan.proof[0].marginLowerBound,'3');
});

test('five-state hidden signed cycles retain independent starts at the chosen negative pulse',()=>{
  const request=course('signed_cycle_negative_box'),plan=designActiveLinearControlBox(request);
  assert.deepEqual(ticks(plan),[0,10]);assert.deepEqual(plan.proof[0].witness.weights,['-1','1']);
  assert.equal(plan.chosenControls[4][0],'-3');assert.equal(plan.proof[0].marginLowerBound,'3');
  const result=evaluateActiveLinearReadings(request,plan,readings([2,-1],[0,10]));
  assert.deepEqual(result.consistentHypothesisIds,['positive']);
});

test('closed noise contact refuses certification and a strict exact gap succeeds',()=>{
  const touching=designActiveLinearControlBox(course('closed_noise_contact'));
  assert.equal(touching.status,'noise_separation_not_certified');assert.equal(touching.noiseOverlapProven,true);
  assert.equal(touching.potential[0].marginLowerBound,'1/4');assert.equal(touching.chosenControls,null);
  assert.equal(designActiveLinearControlBox(course('below_contact')).status,'optimal_certified_control_box');
});

test('zero, unobservable, full-row-rank and equivalent families do not invent a separator',()=>{
  for(const name of ['zero_controls','zero_sensor','equivalent_laws','no_annihilator','zero_input_response']){
    const plan=designActiveLinearControlBox(course(name));
    assert.equal(plan.status,'structurally_indistinguishable_on_control_box',name);
    assert.equal(plan.potential[0].marginLowerBound,'0',name);assert.equal(plan.selection,null,name);
  }
  assert.equal(designActiveLinearControlBox(course('reading_budget_refusal')).status,'insufficient_reading_budget');
});

test('schedule cost and numeric tick order break ties after cardinality',()=>{
  const plan=designActiveLinearControlBox(course('cost_precedes_tick_order'));
  // [1,2,4] has max margin 1/2, exactly touching the closed noise tubes.
  // [0,2,4] has margin 1 and costs 10; the earlier [0,1,4] costs 13.
  assert.deepEqual(ticks(plan),[0,2,4]);assert.equal(plan.totalCost,10);
  assert.deepEqual(ticks(designActiveLinearControlBox(course('numeric_tick_tie'))),[2]);
});

test('work exhaustion is inconclusive even when a partial circuit already separates',()=>{
  const request={schema:ACTIVE_LINEAR_CONTROL_BOX_SCHEMA,source:'Independent work-limit control using four distinct latent decay modes',
    hypotheses:[{id:'a',A:[[1,0],[0,2]],B:[[1],[1]],C:[1,1]},
      {id:'b',A:[[3,0],[0,4]],B:[[1],[1]],C:[1,1]}],
    controlBounds:Array.from({length:10},(_,i)=>({min:[i===0?-1:0],max:[i===0?1:0]})),
    maxReadings:8,noiseBound:0,workLimit:100};
  const plan=designActiveLinearControlBox(request);
  assert.equal(plan.status,'search_inconclusive');assert.equal(plan.nodes,100);assert.equal(plan.exhausted,true);
  assert.equal(plan.selection,null);assert.equal(plan.chosenControls,null);
  assert.equal(plan.potential[0].noiseMarginExact,false);
  assert.match(plan.potential[0].witness.meaning,/attainable separation lower bound/);
  assert.throws(()=>evaluateActiveLinearReadings(request,plan,readings([1],[0])),/certified prospective plan/);
});

test('ambiguous, coupled and multi-hypothesis declarations are refused before design',()=>{
  const source=course('coupled_minimum_support');
  for(const extra of [{controls:[[1],[1]]},{interventions:[]},{jointBudget:1},{readings:[1]}])
    assert.throws(()=>designActiveLinearControlBox({...source,...extra}),/remove unknown or competing control fields/);
  assert.throws(()=>designActiveLinearControlBox({...source,hypotheses:[...source.hypotheses,{...source.hypotheses[0],id:'third'}]}),/exactly two/);
  const reversed=structuredClone(source);reversed.controlBounds[0]={min:[1],max:[-1]};
  assert.throws(()=>designActiveLinearControlBox(reversed),/min <= max/);
  const wrong=structuredClone(source);wrong.controlBounds[0]={min:[0,1],max:[1]};
  assert.throws(()=>designActiveLinearControlBox(wrong),/same-dimension/);
});

test('separate exact readings can leave one, two or no source-declared law consistent',()=>{
  const request=course('coupled_minimum_support'),plan=designActiveLinearControlBox(request);
  assert.deepEqual(evaluateActiveLinearReadings(request,plan,readings([3,1,1])).consistentHypothesisIds,['unit_coupling']);
  assert.deepEqual(evaluateActiveLinearReadings(request,plan,readings([3,-1,-1])).consistentHypothesisIds,['double_coupling']);
  assert.equal(evaluateActiveLinearReadings(request,plan,readings([3],[0])).status,'multiple_hypotheses_consistent');
  assert.equal(evaluateActiveLinearReadings(request,plan,readings([3,1,20])).status,'all_hypotheses_falsified');
  const mutated=structuredClone(plan);mutated.chosenControls[0][0]='-1';
  assert.throws(()=>evaluateActiveLinearReadings(request,mutated,readings([3,1,1])),/exact prospective replay refused/);
});

test('portable control-box notebook replays original inputs and refuses source, plan and result tampering',async()=>{
  const original=JSON.stringify(course('coupled_minimum_support'),null,2)+'\n';
  let book=await createActiveNotebook(original);
  const separate={...readings([3,1,1]),sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256};
  book=await receiveActiveNotebook(book,JSON.stringify(separate));
  assert.deepEqual(await replayActiveNotebook(JSON.stringify(book)),book);
  for(const alter of [b=>{b.sourceText+=' ';},b=>{b.plan.chosenControls[0][0]='-1';},
    b=>{b.readouts[0].result.status='all_hypotheses_falsified';}]){
    const wrong=structuredClone(book);alter(wrong);await assert.rejects(()=>replayActiveNotebook(wrong),/changed|digest/);
  }
});
