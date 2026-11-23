import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planFeedbackTree,receiveFeedbackTree} from '../src/science/position-drift-feedback-tree.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';

const sample=()=>JSON.parse(readFileSync('examples/active-position-drift-feedback-tree.json','utf8'));
function raw(law,commands,word,origin,velocity,errors){
  let p=origin;
  return [String(p+BigInt(errors[0])),...word.map((u,t)=>{
    p+=velocity+BigInt(law.rates[commands.indexOf(u)]);return String(p+BigInt(errors[t+1]));
  })];
}
function words(commands,n){
  let list=[[]];
  for(let i=0;i<n;i++)list=list.flatMap(w=>commands.map(u=>[...w,u]));
  return list;
}

test('all six routes on one trajectory identify every law at every independent error corner',()=>{
  const s=sample(),p=planFeedbackTree(s),routes=new Set();
  assert.equal(p.status,'tree-certified');assert.equal(p.horizon,4);assert.equal(p.work.subproblems,22);
  for(const [k,law] of s.catalog.laws.entries())for(let mask=0;mask<32;mask++){
    const g=Math.floor(k/4),h=(k>>1)%2,word=['ref','group','sub'+g,'bit'+(2*g+h)];
    const err=Array.from({length:5},(_,t)=>mask>>t&1?1:-1);
    const ys=raw(law,s.catalog.commands,word,10n**61n,-(10n**34n),err);
    for(let n=1;n<=5;n++){
      const r=receiveFeedbackTree(p,ys.slice(0,n));
      assert.deepEqual(r.commands,word.slice(0,n-1));assert.equal(r.nextCommand,word[n-1]??null);
      assert.deepEqual(r.decisions.map(d=>d.choice),n<3?[]:n<4?[g]:[g,h]);
      if(n===5){assert.deepEqual(r.witnesses.map(w=>w.law),[law.id]);routes.add(r.commands.join(','));}
    }
  }
  assert.equal(routes.size,6);
});

test('all four-pulse policies with a predeclared single feedback cut have a physically shared ambiguous record',()=>{
  const {catalog}=sample(),{commands,laws}=catalog,zero=[0,0,0,0,0];
  const indices=commands.map((_,i)=>i),ids=laws.map((_,i)=>i),suffixes=new Map();
  const signatures=(id,word)=>word.map(i=>laws[id].rates[i]).join(',');
  // At ticks 0 or 4 a single cut reduces to a fixed tape. At tick 1 force
  // y0=y1=0 by selecting the common initial drift after the two laws are known.
  for(const tap of words(indices,4)){
    const address=Array.from({length:6},(_,i)=>i).find(k=>!tap.includes(commands.indexOf('bit'+k)));
    const pair=laws.slice(2*address,2*address+2),word=tap.map(i=>commands[i]);
    for(const v of [0n,-BigInt(pair[0].rates[tap[0]])]){
      const a=raw(pair[0],commands,word,0n,v,zero),b=raw(pair[1],commands,word,0n,v,zero);
      assert.deepEqual(a,b);if(v===-BigInt(pair[0].rates[tap[0]]))assert.deepEqual(a.slice(0,2),['0','0']);
    }
  }
  // With a known zero start, equal prefix increment strings are exactly
  // equal physical histories. One such history must defeat every fixed suffix.
  for(const cut of [2,3]){
    const tails=words(indices,4-cut);
    for(const prefix of words(indices,cut)){
      const classes=new Map();
      for(const id of ids){const key=signatures(id,prefix);if(!classes.has(key))classes.set(key,[]);classes.get(key).push(id);}
      const blocked=[...classes.values()].some(group=>{
        if(group.length<2)return false;
        const key=cut+'|'+group.join(',');
        if(!suffixes.has(key))suffixes.set(key,tails.every(tail=>new Set(group.map(i=>signatures(i,tail))).size<group.length));
        return suffixes.get(key);
      });
      assert.ok(blocked);
    }
    assert.equal(words(indices,cut).length*tails.length,14641);
  }
});

test('no unrestricted adaptive three-pulse policy identifies every law',()=>{
  const {catalog}=sample(),{commands,laws}=catalog,zeros=[0,0,0,0];
  for(const [a,b] of words(commands,2)){
    const untouched=[0,1,2].find(g=>[a,b].every(u=>!['sub'+g,'bit'+2*g,'bit'+(2*g+1)].includes(u)));
    const family=laws.slice(4*untouched,4*untouched+4),v=-BigInt(family[0].rates[commands.indexOf(a)]);
    const prefix=raw(family[0],commands,[a,b],0n,v,zeros);
    assert.deepEqual(prefix.slice(0,2),['0','0']);
    for(const law of family)assert.deepEqual(raw(law,commands,[a,b],0n,v,zeros),prefix);
    for(const c of commands){
      const seen=family.map(l=>raw(l,commands,[a,b,c],0n,v,zeros).join(','));
      assert.ok(new Set(seen).size<seen.length);
    }
  }
});

test('budget and omitted branches are inconclusive; unequal pulse budgets are rejected',()=>{
  const s=sample();s.subproblems=1;assert.equal(planFeedbackTree(s).status,'tree-budget-exhausted');
  s.subproblems=200;s.program.alternatives.pop();const p=planFeedbackTree(s);assert.equal(p.status,'tree-inconclusive');
  const failed=p.tables[p.entry];assert.equal(failed.status,'uncovered-group');assert.equal(failed.uncovered.attempts.length,2);
  assert.throws(()=>receiveFeedbackTree(p,[0]),/certified/);
  s.program.alternatives[0].alternatives[0].commands.push('ref');
  assert.throws(()=>planFeedbackTree(s),/same pulse budget/);
});

test('notebook rejects guessed later commands, reopens both successive measured choices and checks their bindings',async()=>{
  let b=await createActiveNotebook(JSON.stringify(sample()));
  for(const vs of [['0','0','32'],['48'],['64']]){
    const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last);
    const input={schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
      previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'One four-pulse physical trajectory',
      readings:vs.map((value,i)=>({value,tick:steps[i].tick,command:steps[i].command}))};
    if(!last){
      const bad=structuredClone(input);bad.readings.push({value:'48',tick:'3',command:'sub2'});
      await assert.rejects(receiveActiveNotebook(b,JSON.stringify(bad)),/pending/);
    }
    b=await receiveActiveNotebook(b,JSON.stringify(input));b=await replayActiveNotebook(JSON.stringify(b));
  }
  assert.deepEqual(b.readouts.at(-1).result.consistentHypothesisIds,['G2H1B1']);
  const bad=structuredClone(b);bad.readouts[1].result.checked.decisions[1].choice=0;
  await assert.rejects(replayActiveNotebook(JSON.stringify(bad)));
});
