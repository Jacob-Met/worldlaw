import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planSuffixFeedback,receiveSuffixFeedback,HISTORY_SUFFIX_REQUEST} from '../src/science/position-drift-suffix-feedback.mjs';
import {verifySharedSuffixPolicy} from '../src/science/position-drift-shared-suffix.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as exact} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';
const {add,sub}=exact;
const sample=()=>JSON.parse(readFileSync('examples/active-position-drift-shared-suffix.json','utf8'));
function physical(s,p){
  assert.equal(p.status,'suffix-refuted');assert.equal(p.collision.branches.length,s.suffixes.length);
  for(const [n,branch] of p.collision.branches.entries()){
    const word=[...s.prefix,...s.suffixes[n]];
    assert.equal(n,branch.suffix);assert.equal(branch.readings.length,word.length+1);
    assert.deepEqual(branch.readings.slice(0,s.prefix.length+1),p.collision.prefixReadings);
    assert.equal(new Set(branch.worlds.map(x=>x.law)).size,2);
    for(const world of branch.worlds){
      const row=s.catalog.laws.find(r=>r.id===world.law);
      let [p,v]=world.start.map(q);
      for(const [t,y] of branch.readings.entries()){
        if(t)p=add(p,add(v,q(row.rates[s.catalog.commands.indexOf(word[t-1])])));
        const e=sub(p,q(y)),b=q(s.catalog.noiseBound);
        assert.ok((e.n<0n?-e.n:e.n)*b.d<=b.n*e.d);
      }
    }
  }
}

test('all coordinate-pair marginals miss a necessary decision on the same four surviving laws',()=>{
  const s=sample(),p=planSuffixFeedback(s);
  assert.equal(p.status,'suffix-certified');assert.equal(verifySharedSuffixPolicy(s,p),true);
  assert.deepEqual(p.candidates,[[[0,1]],[[2,3]]]);
  const bounds=planSuffixFeedback({...s,schema:HISTORY_SUFFIX_REQUEST,limits:{subsets:100,linearWork:40000}});
  assert.equal(bounds.status,'cover-inconclusive');
  for(const [x,y,z,suffix] of [
    ['11/40','-11/40','-3/40',1],['11/40','-11/40','5/8',0],
    ['-3/40','-11/40','11/40',1],['5/8','-11/40','11/40',0],
    ['11/40','1/40','11/40',1],['11/40','-23/40','11/40',0]]){
    const values=['0','0',x,y,z],r=receiveSuffixFeedback(p,values);
    assert.deepEqual(r.witnesses.map(w=>w.law),['A','B','C','D']);assert.equal(r.suffix,suffix);
    const final=receiveSuffixFeedback(p,[...values,...(suffix?['0','0','0']:['1/2','-7/2','1/2'])]);
    assert.deepEqual(final.witnesses.map(w=>w.law),['A']);
  }
});

test('one partial contradiction prunes six later pairs; damage and uncovered branches fail verification',()=>{
  const s=sample();s.suffixes.push(['ref','ref','ref']);s.limits.assignments=2;
  const p=planSuffixFeedback(s);assert.equal(p.status,'suffix-certified');
  assert.equal(p.work.assignments,2);assert.equal(p.candidates[2].length,6);
  assert.equal(p.exclusions.length,1);assert.equal(p.exclusions[0].choices.length,2);
  assert.equal(verifySharedSuffixPolicy(s,p),true);
  const bad=structuredClone(p);bad.exclusions[0].proof[0][1]='12345';
  assert.throws(()=>verifySharedSuffixPolicy(s,bad),/contradict/);
  const missing=structuredClone(p);missing.exclusions=[];
  assert.throws(()=>verifySharedSuffixPolicy(s,missing),/missing|budget/);
  for(const limits of [{assignments:1,linearWork:100000},{assignments:100,linearWork:3}]){
    const cut=planSuffixFeedback({...s,limits});assert.equal(cut.status,'shared-budget-exhausted');
    assert.ok(cut.work.assignments<=limits.assignments&&cut.work.linearWork<=limits.linearWork);
    assert.throws(()=>receiveSuffixFeedback(cut,[0]),/certified/);
  }
});

test('at exact contact one history defeats both suffixes, with different subsequent readings',()=>{
  const s=sample();
  for(const law of s.catalog.laws.slice(2)){law.rates[1]='1/2';law.rates[2]=-1;law.rates[3]=1;}
  const p=planSuffixFeedback(s);physical(s,p);
  assert.notDeepEqual(p.collision.branches[0].readings.slice(5),p.collision.branches[1].readings.slice(5));
  const d=10n**70n+1n;
  for(const law of s.catalog.laws.slice(2)){
    law.rates[1]=String(d+2n)+'/'+String(2n*d);
    law.rates[2]='-'+String(d+2n)+'/'+d;law.rates[3]=String(d+2n)+'/'+d;
  }
  const opened=planSuffixFeedback(s);assert.equal(verifySharedSuffixPolicy(s,opened),true);
});

test('different hypothetical suffix choices may require different starts for the same law',()=>{
  const s=sample();s.prefix=[];s.suffixes=[['plus'],['minus']];
  s.catalog={schema:s.catalog.schema,commands:['plus','minus'],noiseBound:0,laws:[{id:'A',rates:[0,0]},{id:'B',rates:[1,-1]}]};
  const p=planSuffixFeedback(s);physical(s,p);
  const shifts=p.collision.branches.map(b=>sub(q(b.worlds[0].start[1]),q(b.worlds[1].start[1])));
  assert.deepEqual(shifts,[q(1),q(-1)]);
});

test('shorter admitted courses agree with independent interval and polygon solvers',()=>{
  let seed=899;const draw=()=>{seed=seed*48271%2147483647;return seed%15-7;};
  for(let i=0;i<40;i++){
    const n=2+i%2,commands=['a','b','c','d','e'],source=sample();
    source.catalog={schema:source.catalog.schema,commands,noiseBound:(i>>1)%3,
      laws:Array.from({length:3},(_,j)=>({id:'L'+j,rates:commands.map(draw)}))};
    source.prefix=commands.slice(0,n);source.suffixes=[['d','e'],['e','d']];
    const {limits,...geometric}=source;
    geometric.schema='worldlaw.position-drift-suffix-feedback-source/v'+(n+1);
    const oracle=planSuffixFeedback(geometric),actual=planSuffixFeedback(source);
    assert.equal(actual.status,oracle.status);
    if(actual.status==='suffix-certified')assert.ok(verifySharedSuffixPolicy(source,actual));
    else physical(source,actual);
  }
});

test('portable notebook commits the longer suffix from the original values before receiving it',async()=>{
  const s=sample();let b=await createActiveNotebook(JSON.stringify(s));
  for(const vs of [['0','0','11/40','-11/40','5/8'],['1/2','-7/2','1/2']]){
    const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last);
    const packet={schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
      previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'Shared-prefix physical replay',
      readings:vs.map((value,i)=>({value,tick:steps[i].tick,command:steps[i].command}))};
    b=await receiveActiveNotebook(b,JSON.stringify(packet));b=await replayActiveNotebook(JSON.stringify(b));
  }
  assert.equal(b.readouts[0].result.checked.suffix,0);assert.deepEqual(b.readouts.at(-1).result.consistentHypothesisIds,['A']);
});
