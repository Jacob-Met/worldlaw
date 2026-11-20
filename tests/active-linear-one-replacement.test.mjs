import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sealActivePlan,sealActiveReadout} from '../src/science/active-experiment-record.mjs';

const example=readFileSync(new URL('../examples/active-linear-one-replacement.json',import.meta.url),'utf8');

test('one unknown wrong value needs an extra reading beyond a known lost value',async()=>{
  const req=JSON.parse(example);
  for(const [schema,expected] of [
    ['worldlaw.active-linear-family/v1',2],
    ['worldlaw.active-linear-one-erasure/v1',3],
    [req.schema,4]
  ]){
    const plan=await sealActivePlan(JSON.stringify({...req,schema}));
    assert.equal(plan.numReadings,expected);
  }
  const plan=await sealActivePlan(example);
  assert.deepEqual(plan.selection.map(row=>row.tick),[0,1,2,4]);
  assert.equal(plan.totalCost,10);
  assert.equal(plan.doubleDeletionProofs.length,6);
  assert.ok(plan.doubleDeletionProofs.every(row=>row.pairs.every(pair=>pair.robustCertified)));
  const changed=structuredClone(plan);
  changed.doubleDeletionProofs[0].excludedTicks=[2,4];
  await assert.rejects(sealActivePlan(example,{prior:changed}),/digest changed/);
});

test('decode an unknown bad reading, preserve genuine alternatives on partial and ambiguous readouts',async()=>{
  const plan=await sealActivePlan(example);
  const decode=async values=>{
    const readings=values.map(([tick,value])=>({tick,value}));
    return sealActiveReadout(example,plan,JSON.stringify({
      schema:'worldlaw.active-linear-readings/v1',source:'Synthetic sensor with a possibly wrong value.',
      acquisition:'synthetic',sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,readings
    }));
  };
  const full=await decode([[0,5],[1,6],[2,-17],[4,9]]);
  assert.deepEqual(full.consistentHypothesisIds,['right']);
  assert.equal(full.allPlannedReadingsReceived,true);
  assert.equal(full.physicalProvenanceVerified,false);
  assert.deepEqual(full.checks[1].omissions.filter(r=>r.status==='consistent').map(r=>r.ignoredTick),[2]);
  // Constant 5 fits ticks 1 and 2. The ramp 4+t fits ticks 1 and 4.
  const ambiguous=await decode([[1,5],[2,5],[4,8]]);
  assert.deepEqual(ambiguous.consistentHypothesisIds,['left','right']);
  const one=await decode([[0,-17]]);
  assert.deepEqual(one.consistentHypothesisIds,['left','right']);
  assert.equal(one.allPlannedReadingsReceived,false);
  assert.deepEqual((await decode([[0,5],[1,5],[2,40],[4,90]])).consistentHypothesisIds,[]);
});

test('touching noise intervals, identical laws and insufficient budgets abstain',async()=>{
  const req=JSON.parse(example);
  const constant=[{id:'zero',A:[[0]],B:[[0]],C:[1]},{id:'two',A:[[0]],B:[[2]],C:[1]}];
  for(const bad of [{maxReadings:3},{controls:[[0],[0],[0],[0]]},
    {hypotheses:constant,noiseBound:1}]){
    const plan=await sealActivePlan(JSON.stringify({...req,...bad}));
    assert.equal(plan.selection,null);
  }
});

test('two unknown initial coordinates remain shared across a whole corrected position trace',async()=>{
  const model={
    schema:'worldlaw.active-linear-one-replacement/v1',
    source:'Synthetic constant-velocity versus accelerated position with unknown initial position and speed.',
    hypotheses:[0,1].map((force,index)=>({
      id:['coast','accelerate'][index],A:[[1,1],[0,1]],B:[[0],[force]],C:[1,0]
    })),
    controls:[[1],[1],[1],[1]],offeredTicks:[0,1,2,3,4],maxReadings:5,noiseBound:0
  };
  const original=JSON.stringify(model);
  const plan=await sealActivePlan(original);
  assert.equal(plan.numReadings,5);
  const readings=plan.selection.map(({tick})=>({
    tick,value:tick===2?-30:3+2*tick+tick*(tick-1)/2
  }));
  const result=await sealActiveReadout(original,plan,JSON.stringify({
    schema:'worldlaw.active-linear-readings/v1',source:'Synthetic constant-force position trace.',
    acquisition:'synthetic',sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,readings
  }));
  assert.deepEqual(result.consistentHypothesisIds,['accelerate']);
  assert.equal((await sealActivePlan(JSON.stringify({...model,maxReadings:4}))).selection,null);
});
