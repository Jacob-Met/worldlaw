import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planSuffixFeedback,receiveSuffixFeedback,HISTORY_SUFFIX_REQUEST} from '../src/science/position-drift-suffix-feedback.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as exact} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';

const {add,sub}=exact;
const sample=()=>JSON.parse(readFileSync('examples/active-position-drift-planar-suffix.json','utf8'));
function replay(s,p){
  assert.equal(p.status,'suffix-refuted');
  for(const [i,branch] of p.collision.branches.entries()){
    const word=[...s.prefix,...s.suffixes[i]];
    assert.equal(branch.suffix,i);assert.equal(word.length+1,branch.readings.length);
    assert.deepEqual(branch.readings.slice(0,4),p.collision.prefixReadings);
    assert.equal(new Set(branch.worlds.map(w=>w.law)).size,2);
    for(const w of branch.worlds){
      const row=s.catalog.laws.find(l=>l.id===w.law);
      let [p,v]=w.start.map(q);
      for(const [t,y] of branch.readings.entries()){
        if(t)p=add(p,add(v,q(row.rates[s.catalog.commands.indexOf(word[t-1])])));
        const e=sub(q(y),p),b=q(s.catalog.noiseBound);
        assert.ok((e.n<0n?-e.n:e.n)*b.d<=b.n*e.d);
      }
    }
  }
}

test('neither raw prefix contrast nor the surviving IDs alone determine the correct suffix',()=>{
  const s=sample(),p=planSuffixFeedback(s);
  assert.equal(p.status,'suffix-certified');
  assert.equal(planSuffixFeedback({...s,schema:HISTORY_SUFFIX_REQUEST,limits:{subsets:50,linearWork:40000}}).status,'cover-inconclusive');
  assert.deepEqual(p.polygons.map(ps=>ps.map(x=>x.vertices)),[
    [[['-2','-2'],['-2/3','-2'],['2','2'],['2/3','2']]],
    [[['-1','-3'],['1/3','-3'],['3','1'],['5/3','1']]]]);
  for(const [x,y,suffix] of [['-1','-2',1],['-1','-3',0],['-3/2','-2',1],['-1/3','-2',0]]){
    const r=receiveSuffixFeedback(p,[0,0,x,y]);
    assert.deepEqual(r.witnesses.map(w=>w.law),['A','B','C','D']);assert.equal(r.suffix,suffix);
  }
  const shorter={...s,suffixes:s.suffixes.map(w=>w.slice(0,1))};
  replay(shorter,planSuffixFeedback(shorter));
});

test('edge and single-point contacts yield complete private witnesses; a rational displacement reopens the point',()=>{
  const base=sample();
  for(const [x,y] of [[2,1],[4,4]]){
    const s=structuredClone(base);
    for(const law of s.catalog.laws.slice(2)){law.rates[1]=x;law.rates[2]=y-x;}
    const p=planSuffixFeedback(s);replay(s,p);
    assert.notDeepEqual(p.collision.branches[0].readings.slice(4),p.collision.branches[1].readings.slice(4));
    if(x===4)assert.deepEqual(p.collision.prefixReadings,['0','0','2','2']);
  }
  const den=10n**60n+7n;
  for(const law of base.catalog.laws.slice(2)){law.rates[1]=String(4n*den+1n)+'/'+den;law.rates[2]='-1/'+den;}
  assert.equal(planSuffixFeedback(base).status,'suffix-certified');
});

test('zero noise reduces the projection to a point and detects a difference only at the final pulse',()=>{
  const s=sample();s.catalog.noiseBound=0;s.catalog.laws=s.catalog.laws.slice(0,2);s.suffixes=[s.suffixes[0]];
  s.catalog.laws[1].rates=Array(7).fill(0);
  const alias=planSuffixFeedback(s);assert.deepEqual(alias.polygons[0][0].vertices,[['0','0']]);replay(s,alias);
  s.catalog.laws[1].rates[4]=1;
  const p=planSuffixFeedback(s);assert.equal(p.status,'suffix-certified');
  assert.deepEqual(receiveSuffixFeedback(p,[0,0,0,0,0,1]).witnesses.map(w=>w.law),['B']);
});

test('the workbench notebook commits a planar suffix before receiving either later position',async()=>{
  const s=sample();let b=await createActiveNotebook(JSON.stringify(s));
  for(const vs of [['0','0','-1','-3'],['-5/2','-3']]){
    const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last);
    const packet={schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
      previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'Independent shifted physical trial',
      readings:vs.map((value,i)=>({value,tick:steps[i].tick,command:steps[i].command}))};
    b=await receiveActiveNotebook(b,JSON.stringify(packet));b=await replayActiveNotebook(JSON.stringify(b));
  }
  assert.deepEqual(b.readouts.at(-1).result.consistentHypothesisIds,['A']);
  assert.equal(b.readouts[0].result.checked.suffix,0);
});
