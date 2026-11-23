import assert from 'node:assert/strict';
import test from 'node:test';
import {designEvolutionExcitation as design} from '../src/science/operator-rollout.mjs';
const model=(weight,tree='command')=>({schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',terms:[{tree,weight}]});
const menu=[0,1].map(offset=>({id:offset?'forcing':'silent',initial:[0,0],step:.04,steps:50,forcing:{offset,amplitude:0,startFrequency:0,endFrequency:0}}));

test('an exact alias stays unresolved while the opposite drive separates',()=>{
  const result=design([model(1),model(1,['mul','command','one']),model(-1)],menu);
  assert.equal(result.selected,'forcing');
  assert.equal(result.status,'partially_separating_in_simulation');
  assert.deepEqual(result.groups,[[0,1],[2]]);
  assert.deepEqual(result.unresolvedPairs,[[0,1]]);
  assert.deepEqual(result.selectedUnresolvedPairs,[[0,1]]);
  assert.equal(result.ranked[0].minimumSeparation,0);
  assert.equal(result.ranked[0].separatedClassPairs,1);
  const ordinary=design([model(1),model(-1)],menu);
  assert.equal(ordinary.selected,result.selected);
  assert.equal(ordinary.ranked[0].minimumSeparation,result.ranked[0].betweenClassSeparation);
});
test('position resolution preserves a near-equivalent pair',()=>{
  const opts={resolution:.006,observedIndices:[0]}, roster=[model(1),model(1.001),model(-1)];
  const r=design(roster,menu,opts);
  assert.equal(r.selected,'forcing');assert.deepEqual(r.groups,[[0,1],[2]]);
  assert.deepEqual(r.selectedUnresolvedPairs,[[0,1]]);
  assert.ok(r.ranked[0].minimumSeparation>0 && r.ranked[0].minimumSeparation<opts.resolution);
  const near=design(roster.slice(0,2),menu,opts);
  assert.equal(near.status,'indistinguishable_on_menu');assert.deepEqual(near.groups,[[0,1]]);
});
test('unresolved threshold chains do not collapse distinguishable endpoints',()=>{
  const r=design([model(0),model(.01),model(.02)],menu,{resolution:.015,observedIndices:[0]});
  assert.equal(r.selected,'forcing');assert.deepEqual(r.unresolvedPairs,[[0,1],[1,2]]);
  assert.deepEqual(r.groups,[[0],[1],[2]]);assert.equal(r.ranked[0].separatedClassPairs,1);
});
test('invalid observation bounds fail before selection',()=>{
  for(const opts of [{resolution:-1},{resolution:Infinity},{observedIndices:[2]},{observedIndices:[]},{observedIndices:[0,0]}])
    assert.throws(()=>design([model(1),model(-1)],menu,opts),RangeError);
});
