import test from 'node:test';
import assert from 'node:assert/strict';
import {sealActivePlan,sealActiveReadout} from '../src/science/active-experiment-record.mjs';

function family(noiseBound='0') {
  return {schema:'worldlaw.active-linear-one-erasure/v1',source:'Hypothetical exact one-erasure controls.',
    hypotheses:[{id:'zero',A:[[0]],B:[[0]],C:[1]},{id:'two',A:[[0]],B:[[2]],C:[1]}],
    controls:[[1],[1],[1]],offeredTicks:[1,2,3],maxReadings:3,
    costByTick:{1:3,2:1,3:1},noiseBound};
}
test('minimizes paid schedule cardinality and cost with a lost reading',async()=>{
  const f=family(),bytes=JSON.stringify(f),plan=await sealActivePlan(bytes);
  assert.equal(plan.status,'optimal_certified_schedule');
  assert.deepEqual(plan.selection,[{tick:2,cost:1},{tick:3,cost:1}]);
  assert.equal(plan.totalCost,2);
  assert.deepEqual(plan.singleDeletionProofs.map(q=>q.receivedTicks),[[3],[2]]);
  assert.ok(plan.singleDeletionProofs.every(q=>q.pairs.every(p=>p.robustCertified)));
  const tampered=structuredClone(plan);tampered.singleDeletionProofs[0].missingTick=3;
  await assert.rejects(sealActivePlan(bytes,{prior:tampered}),/digest changed/);
  const readings={schema:'worldlaw.active-linear-readings/v1',source:'Synthetic bounded one-row dropout.',acquisition:'synthetic',
    sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,readings:[{tick:2,value:2}]};
  const result=await sealActiveReadout(bytes,plan,JSON.stringify(readings));
  assert.deepEqual(result.consistentHypothesisIds,['two']);assert.deepEqual(result.missingTicks,[3]);
  assert.equal(result.withinDesignedErasureBudget,true);assert.equal(result.physicalProvenanceVerified,false);
  readings.sourceSHA256='0'.repeat(64);await assert.rejects(sealActiveReadout(bytes,plan,JSON.stringify(readings)),/digest/);
});
test('one observation cannot survive its own loss; ordinary route retains its optimum',async()=>{
  const f={...family(),maxReadings:1};
  assert.equal((await sealActivePlan(JSON.stringify(f))).selection,null);
  f.schema='worldlaw.active-linear-family/v1';
  const ordinary=await sealActivePlan(JSON.stringify(f));assert.equal(ordinary.numReadings,1);
  assert.equal('singleDeletionProofs' in ordinary,false);
});
test('closed identical/touching observation tubes and zero forcing remain uncertified',async()=>{
  for(const f of [family('1'),{...family(),controls:[[0],[0],[0]]},
      {...family(),hypotheses:family().hypotheses.map(h=>({...h,B:[[2]]}))}]){
    assert.equal((await sealActivePlan(JSON.stringify(f))).selection,null);
  }
});
test('exhausted search reports incompleteness',async()=>{
  const f=family();f.controls=Array.from({length:10},()=>[1]);f.offeredTicks=Array.from({length:11},(_,i)=>i);
  f.costByTick={};f.maxReadings=8;f.workLimit=100;
  f.hypotheses=[1,2,3,4,5].map((v,i)=>({id:'law'+i,A:[[1,v],[0,1]],B:[[0],[v]],C:[1,0]}));
  const p=await sealActivePlan(JSON.stringify(f));assert.equal(p.exhausted,true);assert.notEqual(p.status,'optimal_certified_schedule');
});

test('losing the first tick leaves the original single impulse absorbable by both unknown initial states',async()=>{
  const source={schema:'worldlaw.active-linear-one-erasure/v1',source:'Synthetic single impulse, independent unknown initial states.',
    hypotheses:[{id:'half',A:[['1/2']],B:[[1]],C:[1]},{id:'third',A:[['1/3']],B:[[1]],C:[1]}],
    controls:[[1],[0],[0],[0]],offeredTicks:[0,1,2,3,4],maxReadings:5,noiseBound:'1/1000'};
  const onlyOne=await sealActivePlan(JSON.stringify(source));assert.equal(onlyOne.selection,null);
  source.controls[2]=[1];const repeated=await sealActivePlan(JSON.stringify(source));assert.equal(repeated.status,'optimal_certified_schedule');
});
