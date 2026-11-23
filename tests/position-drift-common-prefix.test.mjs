import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prefixHistoryOracle} from '../src/science/position-drift-prefix-intersection.mjs';
import {planSuffixFeedback,receiveSuffixFeedback,SUFFIX_REQUEST,HISTORY_SUFFIX_REQUEST} from '../src/science/position-drift-suffix-feedback.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as exact} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {GUIDED_INPUT,pendingDriftSteps} from '../src/science/active-guided-drift.mjs';

const {add,sub,fmt}=exact;
const source=()=>JSON.parse(readFileSync('examples/active-position-drift-history-suffix.json','utf8'));
const v1=({catalog,prefix,suffixes})=>({schema:SUFFIX_REQUEST,catalog,prefix,suffixes});
function rawReplay(catalog,lawName,word,readings,start){
  const row=catalog.laws.find(law=>law.id===lawName);
  let [p,v]=start.map(q);
  for(const [tick,y] of readings.entries()){
    if(tick)p=add(p,add(v,q(row.rates[catalog.commands.indexOf(word[tick-1])])));
    const e=sub(q(y),p),bound=q(catalog.noiseBound);
    assert.ok((e.n<0n?-e.n:e.n)*bound.d<=bound.n*e.d);
  }
}

test('all four proper triples have a common physical prefix, the four-way exclusion enables both suffixes',()=>{
  const s=source(),legacy=planSuffixFeedback(v1(s));
  assert.equal(legacy.status,'cover-inconclusive');
  for(const f of legacy.uncovered.failures){
    const word=[...s.prefix,...s.suffixes[f.suffix]];
    for(const [i,law] of f.collision.laws.entries())rawReplay(s.catalog,law,word,f.collision.readings,f.collision.starts[i]);
  }
  const p=planSuffixFeedback(s);assert.equal(p.status,'suffix-certified');
  assert.deepEqual(p.work,{subsets:5,linearWork:446});assert.equal(p.eliminations.length,1);
  const elimination=p.eliminations[0];
  assert.deepEqual(elimination.excluded,['A','B','C','D']);
  // Independent reduction of the four raw strip contrasts on normalized
  // coordinates (y2,y3,y4) gives a strict discrepancy of four units.
  const inequalities=new Map([[60,[-1,0,0,-2]],[3,[0,1,0,3]],[32,[3,0,-1,-1]],[55,[0,-4,3,5]]]);
  const sum=[0,0,0,0];
  elimination.proof.forEach(([i,w])=>inequalities.get(i).forEach((a,j)=>sum[j]+=Number(w)*a));
  assert.deepEqual(sum,[0,0,0,-4]);
  const check=prefixHistoryOracle(s.catalog,s.prefix),all=[0,1,2,3];
  for(const omit of all){
    const members=all.filter(i=>i!==omit),r=check(members,()=>{});
    assert.equal(r.witnesses.length,3);
    for(const world of r.witnesses)rawReplay(s.catalog,world.law,s.prefix,r.readings,world.start);
    const picked=receiveSuffixFeedback(p,r.readings);
    assert.deepEqual(picked.witnesses.map(w=>w.law),members.map(i=>s.catalog.laws[i].id));
    assert.equal(picked.suffix,omit<2?0:1);
    for(const world of r.witnesses){
      const row=s.catalog.laws.find(law=>law.id===world.law);
      const [p0,v]=world.start.map(q);let state=p0;const ys=r.readings.slice();
      for(const [i,u] of [...s.prefix,...s.suffixes[picked.suffix]].entries()){
        state=add(state,add(v,q(row.rates[s.catalog.commands.indexOf(u)])));
        if(i>=s.prefix.length)ys.push(fmt(state));
      }
      assert.deepEqual(receiveSuffixFeedback(p,ys).witnesses.map(x=>x.law),[world.law]);
    }
  }
});

test('closed four-way contact keeps its real history and lowers no uncertainty bound',()=>{
  const s=source();s.catalog.laws=s.catalog.laws.map((law,i)=>({id:law.id,rates:[0,0,0,0,i%2,i<2?0:1,0]}));
  const p=planSuffixFeedback(s);assert.equal(p.status,'cover-inconclusive');
  assert.equal(p.uncovered.commonPrefix.witnesses.length,4);
  for(const world of p.uncovered.commonPrefix.witnesses)rawReplay(s.catalog,world.law,s.prefix,p.uncovered.commonPrefix.readings,world.start);
  s.catalog.laws[3].rates[1]=8; // second differences just touch at 4
  const contact=prefixHistoryOracle(s.catalog,s.prefix.slice(0,2))([0,1,2,3],()=>{});
  assert.equal(contact.readings[2],'4');
  s.catalog.laws[3].rates[1]='800000000000000000001/100000000000000000000';
  const gap=prefixHistoryOracle(s.catalog,s.prefix.slice(0,2))([0,1,2,3],()=>{});
  assert.ok(gap.proof.length>0);assert.ok(gap.excluded.includes(3));
});

test('higher-order limits stay inconclusive and previously published pairwise plans retain their schema',()=>{
  const s=source();
  for(const limits of [{subsets:0,linearWork:10000},{subsets:5,linearWork:1},{subsets:4,linearWork:10000}]){
    const p=planSuffixFeedback({...s,limits});assert.equal(p.status,'cover-budget-exhausted');
    assert.ok(p.work.subsets<=limits.subsets&&p.work.linearWork<=limits.linearWork);
    assert.equal(p.cover,undefined);
  }
  const old=planSuffixFeedback(v1(s));assert.equal(old.eliminations,undefined);assert.equal(old.work,undefined);
  const tiny={...s,prefix:['a'],limits:{subsets:5,linearWork:1000}};
  const p=planSuffixFeedback(tiny);assert.equal(p.status,'cover-inconclusive');assert.deepEqual(p.uncovered.commonPrefix.readings,['0','0']);
});

test('portable notebook freezes the exclusion and replays the selected six-command trajectory',async()=>{
  const s=source();assert.equal(s.schema,HISTORY_SUFFIX_REQUEST);
  let b=await createActiveNotebook(JSON.stringify(s));
  for(const vs of [['0','0','2','4','7'],['6','8']]){
    const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last);
    const doc={schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
      previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'Six-command physical world B',
      readings:vs.map((value,i)=>({tick:steps[i].tick,command:steps[i].command,value}))};
    b=await receiveActiveNotebook(b,JSON.stringify(doc));
  }
  const last=b.readouts.at(-1).result;
  assert.equal(last.checked.suffix,0);assert.deepEqual(last.consistentHypothesisIds,['B']);
  assert.deepEqual(await replayActiveNotebook(JSON.stringify(b)),b);
  const forged=structuredClone(b);forged.plan.eliminations[0].proof[0][1]='1';
  await assert.rejects(replayActiveNotebook(JSON.stringify(forged)));
});
