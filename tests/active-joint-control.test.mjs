import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {designActiveLinearJointControl,replayActiveLinearJointControl,evaluateActiveLinearReadings,
  designActiveInterventionFamily,designActiveLinearControlBox} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
const rows=JSON.parse(await readFile(new URL('./fixtures/active-joint-control-cases.json',import.meta.url),'utf8'));
const course=name=>structuredClone(rows.find(r=>r.name===name).request);
const chosen=plan=>plan.selection?.map(row=>row.tick)??null;
const reading=(value,tick=1)=>({schema:'worldlaw.active-linear-readings/v1',
  source:'Independent analytic scalar output for the frozen three-law input',acquisition:'synthetic',readings:[{tick,value}]});

test('one common interior input separates three laws where corners and midpoint fail',()=>{
  const source=course('interior_three_laws'),plan=designActiveLinearJointControl(source);
  assert.equal(plan.status,'optimal_certified_joint_control');assert.deepEqual(chosen(plan),[1]);
  assert.deepEqual(plan.chosenControls,[['1','-1/3'],['0','0']]);
  assert.equal(plan.jointPotential.margin,'2/3');assert.equal(plan.jointProof.margin,'2/3');
  assert.equal(plan.jointProof.certificate.upperBound,'2/3');
  assert.deepEqual(plan.proof.map(row=>row.marginLowerBound),['2/3','4/3','2/3']);
  assert.equal(plan.statistics.lpSolved,8);assert.equal(plan.statistics.lpCertificatesChecked,8);
  assert.equal(replayActiveLinearJointControl(source,plan).valid,true);
  const discrete={...source,schema:'worldlaw.active-linear-interventions/v1',
    interventions:[-1,0,1].map((v,i)=>({id:'sample'+i,actionCost:0,controls:[[1,v],[0,0]]}))};
  delete discrete.controlBounds;
  assert.equal(designActiveInterventionFamily(discrete).status,'no_offered_intervention_certified');
});

test('separately optimal pairwise controls do not establish a joint noisy experiment',()=>{
  const plan=designActiveLinearJointControl(course('incompatible_pairwise_maxima'));
  assert.deepEqual(plan.potential.map(p=>p.marginLowerBound),['1','1','1']);
  assert.equal(plan.jointPotential.margin,'1/2');assert.equal(plan.jointPotential.exact,true);
  assert.equal(plan.status,'noise_separation_not_certified');assert.equal(plan.noiseOverlapProven,true);
  assert.equal(plan.chosenControls,null);assert.match(plan.interpretation,/blocking pair may change/);
});

test('strict joint noise comparison rejects closed contact and accepts an exact strict gap',()=>{
  const contact=designActiveLinearJointControl(course('closed_contact'));
  assert.equal(contact.jointPotential.margin,'2/3');assert.equal(contact.status,'noise_separation_not_certified');
  assert.equal(designActiveLinearJointControl(course('strictly_below_contact')).status,'optimal_certified_joint_control');
});

test('fixed, duplicated and zero-forcing nulls remain explicit',()=>{
  for(const name of ['fixed_collapse','duplicate_law_null','no_actuation_null']){
    const plan=designActiveLinearJointControl(course(name));
    assert.equal(plan.status,'structurally_indistinguishable_on_control_box',name);
    assert.equal(plan.jointPotential.margin,'0');assert.equal(plan.jointPotential.exact,true);
    assert.equal(plan.selection,null);assert.equal(plan.chosenControls,null);
  }
});

test('one union respects reading cardinality, declared cost and numeric tick order',()=>{
  const plan=designActiveLinearJointControl(course('integrator_cost_schedule'));
  assert.deepEqual(chosen(plan),[0,2]);assert.equal(plan.totalCost,9);
  assert.equal(plan.jointProof.margin,'1/2');
  assert.deepEqual(chosen(designActiveLinearJointControl(course('numeric_tick_tie'))),[2]);
  assert.equal(designActiveLinearJointControl(course('coupled_insufficient_budget')).status,'insufficient_reading_budget');
});

test('budget exhaustion never exposes a chosen optimal experiment',()=>{
  const source=course('interior_three_laws');source.workLimit=100;
  const plan=designActiveLinearJointControl(source);
  assert.equal(plan.status,'search_inconclusive');assert.equal(plan.nodes,100);assert.equal(plan.exhausted,true);
  assert.equal(plan.jointPotential.exact,false);assert.equal(plan.jointProof,null);
  assert.equal(plan.selection,null);assert.equal(plan.chosenControls,null);
  assert.throws(()=>evaluateActiveLinearReadings(source,plan,reading(0)),/certified prospective plan/);
});

test('new schema preserves binary v1 and refuses unsupported or ambiguous input constraints',()=>{
  const source=course('interior_three_laws');
  assert.throws(()=>designActiveLinearJointControl({...source,hypotheses:source.hypotheses.slice(0,2)}),/3–5/);
  assert.throws(()=>designActiveLinearControlBox({...source,schema:'worldlaw.active-linear-control-box/v1'}),/exactly two/);
  for(const extra of [{controls:[[1,0],[0,0]]},{interventions:[]},{coupledBudget:1},{readings:[1]}])
    assert.throws(()=>designActiveLinearJointControl({...source,...extra}),/remove unknown or competing control fields/);
  const constrained=structuredClone(source);constrained.hypotheses[0].initialState=[0];
  assert.throws(()=>designActiveLinearJointControl(constrained),/independent and unconstrained/);
  assert.throws(()=>designActiveLinearJointControl({...source,costByTick:{'01':1}}),/canonical integer tick/);
  const tooMany=course('numeric_tick_tie');tooMany.controlBounds=Array.from({length:10},()=>({min:[-1],max:[1]}));
  assert.throws(()=>designActiveLinearJointControl(tooMany),/at most eight nonfixed/);
});

test('separate joint readouts can retain one, multiple or no compatible law',()=>{
  const source=course('interior_three_laws'),plan=designActiveLinearJointControl(source);
  assert.deepEqual(evaluateActiveLinearReadings(source,plan,reading(0)).consistentHypothesisIds,['law0']);
  assert.equal(evaluateActiveLinearReadings(source,plan,reading(10)).status,'all_hypotheses_falsified');
  const coupled=course('coupled_minimum_union'),coupledPlan=designActiveLinearJointControl(coupled);
  assert.ok(chosen(coupledPlan).includes(0));
  assert.equal(evaluateActiveLinearReadings(coupled,coupledPlan,reading(3,0)).status,'multiple_hypotheses_consistent');
});

test('generated interior fractions are not truncated to the source coefficient budget',()=>{
  const source=course('interior_three_laws');source.hypotheses[1].B=[[1,'1000000000000']];
  source.hypotheses[2].B=[[1,'-999999999999']];source.controlBounds[0]={min:[1,0],max:[1,'1/1000000000000']};
  const plan=designActiveLinearJointControl(source);
  assert.equal(plan.status,'optimal_certified_joint_control');
  assert.equal(plan.chosenControls[0][1],'1/2999999999998');
  assert.equal(plan.jointProof.margin,'1999999999999/2999999999998');
  assert.deepEqual(evaluateActiveLinearReadings(source,plan,reading(0)).consistentHypothesisIds,['law0']);
});

test('portable joint notebooks preserve original bytes and refuse altered controls and dual claims',async()=>{
  const text=JSON.stringify(course('interior_three_laws'),null,2)+'\n';
  const book=await createActiveNotebook(text),readings=JSON.stringify({...reading(0),
    sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256});
  const received=await receiveActiveNotebook(book,readings);
  assert.equal(received.sourceText,text);assert.equal(received.readouts[0].readingsText,readings);
  assert.deepEqual(await replayActiveNotebook(JSON.stringify(received)),received);
  const bad=structuredClone(received);bad.plan.jointProof.certificate.mixtureWeights[0]='7';
  await assert.rejects(()=>replayActiveNotebook(bad),/digest changed/);
  const changed=structuredClone(book.plan);changed.chosenControls[0][1]='0';
  assert.throws(()=>replayActiveLinearJointControl(JSON.parse(text),changed),/exact prospective replay refused/);
});
