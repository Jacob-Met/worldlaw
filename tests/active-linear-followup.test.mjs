import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createActiveNotebook,receiveActiveNotebook,recommendActiveFollowup,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
const source=JSON.parse(await readFile(new URL('../examples/active-linear-conditional-future.json',import.meta.url),'utf8'));

async function history(values,changes={}){
  const book=await createActiveNotebook(JSON.stringify({...source,...changes}));
  const input={schema:'worldlaw.active-linear-historical-readings/v1',source:'Synthetic same-trajectory history.',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    readings:values.map((value,tick)=>({tick,value}))};
  return receiveActiveNotebook(book,JSON.stringify(input));
}

test('conditioned acquisition retains the original calibration and outlier across both stages',async()=>{
  const book=await history([5,5,7]);
  const plan=await recommendActiveFollowup(book,0);
  assert.deepEqual(plan.selection,{ticks:[4],cost:1});
  assert.deepEqual(plan.eligibleTicks,[3,4]);
  for(const [value,ids,ignored] of [[5,['left'],2],[9,['right'],1],[-30,[],null]]){
    const input={schema:'worldlaw.active-linear-followup-readings/v1',source:'Synthetic future observation.',
      acquisition:'synthetic',sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,
      historySHA256:plan.historySHA256,followupSHA256:plan.followupSHA256,readings:[{tick:4,value}]};
    const next=await receiveActiveNotebook(book,JSON.stringify(input));
    const result=next.readouts[1].result;
    assert.deepEqual(result.consistentHypothesisIds,ids);
    if(ignored!==null){
      const match=result.checks.find(r=>r.status==='consistent');
      assert.deepEqual(match.omissions.filter(r=>r.status==='consistent').map(r=>r.ignoredTick),[ignored]);
    }
    assert.deepEqual(await replayActiveNotebook(JSON.stringify(next)),next);
    await assert.rejects(receiveActiveNotebook(book,JSON.stringify({...input,followupSHA256:'0'.repeat(64)})));
    await assert.rejects(receiveActiveNotebook(book,JSON.stringify({...input,readings:[{tick:3,value}]})));
    const altered=structuredClone(next);altered.readouts[0].readingsText+=' ';
    await assert.rejects(replayActiveNotebook(altered));
  }
});

test('a less informative history needs two future readings and a resolved one needs none',async()=>{
  const short=await history([5,5]);
  assert.deepEqual((await recommendActiveFollowup(short,0)).selection,{ticks:[2,4],cost:2});
  assert.equal((await recommendActiveFollowup(await history([5,7,9]),0)).status,'already_resolved');
  const alias=structuredClone(source.hypotheses);alias[0].B=[[1]];alias[1].B=[[2]];
  const aliased=await history([5,7,9],{hypotheses:alias});
  assert.equal(aliased.plan.selection,null);
  assert.equal((await recommendActiveFollowup(aliased,0)).status,'no_separating_future_schedule');
  const exhausted=await history([5,5],{workLimit:100});
  assert.equal((await recommendActiveFollowup(exhausted,0)).status,'search_inconclusive');
});

test('future schedule enumeration respects the shared work ceiling before expanding combinations',async()=>{
  const controls=Array.from({length:10},()=>[1]);
  const input={...source,controls,offeredTicks:Array.from({length:11},(_,i)=>i),
    maxReadings:7,workLimit:100};
  const book=await history([5],input);
  const result=await recommendActiveFollowup(book,0);
  assert.equal(result.status,'search_inconclusive');
  assert.equal(result.exhausted,true);
  assert.ok(result.nodes<=100);
});

test('64 seeded trajectories agree with separate exact interval projection at every acquisition stage',async()=>{
  // For these two one-state laws, eliminating the unrestricted initial state
  // and sensor offset leaves an unknown constant intercept. The driven law
  // also has one persistent slope in [1/2, 2]. Pairwise interval intersection
  // is an independent exact projection of that small rational feasibility
  // problem, without calling the production LP or sharing its tableau.
  const {classifyAccumulatedReadings}=await import('../src/science/active-linear-followup.mjs');
  const oracle=(rows,driven)=>{
    for(const omit of [null,...rows.map(row=>row.tick)]){
      const keep=rows.filter(row=>row.tick!==omit);
      let lower=driven?8:0,upper=driven?32:0; // slope in sixteenths
      for(let i=0;i<keep.length;i++)for(let j=i+1;j<keep.length;j++){
        const a=keep[i],b=keep[j],dt=b.tick-a.tick;
        const dy=16*(b.value-a.value);
        lower=Math.max(lower,(dy-2)/dt);
        upper=Math.min(upper,(dy+2)/dt);
      }
      if(lower<=upper)return true;
    }
    return false;
  };
  let checked=0;
  for(let seed=0;seed<64;seed++){
    const base=2+seed%11;
    const slope=seed%2?(seed%3===0?2:1):0;
    const wrongTick=seed%5;
    const perturbation=seed%3===0?0:(seed%4===0?-7:7);
    const complete=Array.from({length:5},(_,tick)=>({
      tick,value:base+slope*tick+(tick===wrongTick?perturbation:0)}));
    for(let count=3;count<=5;count++){
      const rows=complete.slice(0,count);
      const actual=classifyAccumulatedReadings(source,rows);
      const expected=['left','right'].filter(id=>oracle(rows,id==='right'));
      assert.deepEqual(actual.consistentHypothesisIds,expected,
        'seed '+seed+', accumulated readings '+count);
      assert.deepEqual(actual.unresolvedHypothesisIds,[]);
      checked++;
    }
  }
  assert.equal(checked,192);
});
