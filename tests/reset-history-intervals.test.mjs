import test from 'node:test';
import assert from 'node:assert/strict';
import { compareResetHistories, contenderDesign } from '../src/trajectory/reset-history-intervals.mjs';
import { acquireHistoryPair } from '../scripts/generate-reset-histories.mjs';
import { rollout } from '../src/trajectory/field-law-dictionary.mjs';
const record=(preparation,values,bounds)=>({preparation,values,bounds,reset:'reset-1',forcing:'force-1',time:[0,.25]});

test('touching boxes remain compatible; a disjoint channel records its two physical readings',()=>{
  const a=record('positive',[[0,1],[1,3]],[.125,.5]);
  const b=record('negative',[[.25,1],[1,4]],[.125,.5]);
  assert.equal(compareResetHistories(a,b).contradiction,false);
  b.values[1][1]=4.25;
  const result=compareResetHistories(a,b);
  assert.equal(result.contradiction,true);
  assert.deepEqual([result.witness.time,result.witness.channel,result.witness.left,result.witness.right],[.25,1,3,4.25]);
  assert.ok(Math.abs(result.witness.gap-.25)<1e-12);
});

test('unmatched resets, forcing, clocks, histories or bounds cannot establish a contradiction',()=>{
  const a=record('A',[[1],[2]],[1]),b=record('B',[[9],[10]],[1]);
  for(const delta of [{reset:'other'},{forcing:'other'},{preparation:'A'},{time:[0,.5]},
    {bounds:[-1]},{values:[[1],[NaN]]},{time:[0,0]}])
    assert.throws(()=>compareResetHistories(a,{...b,...delta}));
});

test('memoryless reset with genuinely different previous forces has intersecting observations',()=>{
  const pair=acquireHistoryPair('pendulum',[.94,1.08],[.8,-.2],[.74,.03],23,351047);
  assert.ok(pair[0].values.some((r,i)=>r.some((v,k)=>v!==pair[1].values[i][k])));
  assert.equal(compareResetHistories(...pair).contradiction,false);
});

test('two-contender design uses only the measured pilot and a deterministic equal-power menu',()=>{
  const values=rollout('duffing',[.91,.86],[.83,.13],-1);
  const plan=contenderDesign({layout:'oscillator',values,sigma:[.03,.02],drive:-1});
  assert.equal(new Set(plan.committee).size,2);
  assert.equal(new Set(plan.scores.map(x=>x.drive)).size,8);
  assert.equal(plan.drive,plan.scores[0].drive);
  assert.ok(plan.scores.every(x=>x.separation<=plan.scores[0].separation));
});
