import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planSuffixFeedback,receiveSuffixFeedback,HISTORY_SUFFIX_REQUEST} from '../src/science/position-drift-suffix-feedback.mjs';
import {openPositionDriftFeedback} from '../src/science/position-drift-terminal-feedback.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as exact} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';

const {add,sub,fmt}=exact;
const sample=()=>JSON.parse(readFileSync('examples/active-position-drift-suffix-regions.json','utf8'));
function verifyCollision(s,report){
  assert.equal(report.status,'suffix-refuted');
  assert.equal(report.collision.branches.length,s.suffixes.length);
  for(const [i,branch] of report.collision.branches.entries()){
    const word=[...s.prefix,...s.suffixes[i]];
    assert.equal(branch.suffix,i);assert.equal(branch.readings.length,word.length+1);
    assert.deepEqual(branch.readings.slice(0,3),report.collision.prefixReadings);
    assert.equal(new Set(branch.worlds.map(w=>w.law)).size,2);
    for(const world of branch.worlds){
      let [p,v]=world.start.map(q);const rates=s.catalog.laws.find(l=>l.id===world.law).rates;
      branch.readings.forEach((value,t)=>{
        if(t)p=add(p,add(v,q(rates[s.catalog.commands.indexOf(word[t-1])])));
        const e=sub(p,q(value)),bound=q(s.catalog.noiseBound);
        assert.ok((e.n<0n?-e.n:e.n)*bound.d<=bound.n*e.d);
      });
    }
  }
}

test('identical four-law survivors require opposite complete suffixes',()=>{
  const s=sample(),p=planSuffixFeedback(s);
  const legacy=planSuffixFeedback({...s,schema:HISTORY_SUFFIX_REQUEST,limits:{subsets:100,linearWork:20000}});
  assert.equal(legacy.status,'cover-inconclusive');
  assert.deepEqual(p.unsafe,[[{laws:['A','B'],lo:'-2',hi:'2'}],[{laws:['C','D'],lo:'3',hi:'7'}]]);
  const model=openPositionDriftFeedback(s.catalog);
  for(const [value,selected,wrongReadings] of [[2,1,[6,7]],[3,0,[105,104]]]){
    const prefix=[0,0,value],r=receiveSuffixFeedback(p,prefix);
    assert.deepEqual(r.witnesses.map(w=>w.law),['A','B','C','D']);assert.equal(r.suffix,selected);
    const wrong=[...s.prefix,...s.suffixes[1-selected]];
    assert.equal(model.receive(wrong,[...prefix,...wrongReadings]).length,2);
  }
  const truncated={...s,suffixes:s.suffixes.map(word=>word.slice(0,1))};
  verifyCollision(truncated,planSuffixFeedback(truncated));
});

test('closed faces collide at one shared history and separate across an arbitrarily small rational gap',()=>{
  const s=sample();
  for(const law of s.catalog.laws.slice(2))law.rates[1]=4;
  const contact=planSuffixFeedback(s);verifyCollision(s,contact);
  assert.deepEqual(contact.collision.prefixReadings,['0','0','2']);
  assert.notDeepEqual(contact.collision.branches[0].readings.slice(3),contact.collision.branches[1].readings.slice(3));
  const d=10n**80n+7n;
  for(const law of s.catalog.laws.slice(2))law.rates[1]=String(4n*d+1n)+'/'+d;
  const above=planSuffixFeedback(s);assert.equal(above.status,'suffix-certified');
  assert.equal(above.unsafe[1][0].lo,fmt(q(String(2n*d+1n)+'/'+d)));
  assert.equal(receiveSuffixFeedback(above,['0','0','2']).suffix,1);
  assert.equal(receiveSuffixFeedback(above,['0','0',above.unsafe[1][0].lo]).suffix,0);
});

test('zero error admits one prefix point, distinguishes a late-only rate change, and replays a constant-offset alias',()=>{
  const s=sample();s.catalog.laws=s.catalog.laws.slice(0,2);s.catalog.noiseBound=0;
  s.suffixes=[['x1','x2']];s.catalog.laws[1].rates=[0,0,0,1,0,0];
  const p=planSuffixFeedback(s);assert.deepEqual(p.unsafe,[[]]);
  assert.deepEqual(p.regions,[{lo:'0',hi:'0',suffix:0}]);
  assert.deepEqual(receiveSuffixFeedback(p,[7,10,13,16,20]).witnesses.map(w=>w.law),['B']);
  s.catalog.laws[1].rates=Array(6).fill('2/7');verifyCollision(s,planSuffixFeedback(s));
});

test('unnormalized observations choose both opposite routes in portable notebook replay',async()=>{
  const s=sample(),origin=10n**55n+7n,drift=-(10n**38n);
  for(const [values,chosen,law] of [[[0,0,2,4,7],1,'A'],[[0,0,3,101,99],0,'C']]){
    let b=await createActiveNotebook(JSON.stringify(s)),tick=0;
    for(const slice of [values.slice(0,3),values.slice(3)]){
      const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last);
      const packet={schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
        previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'Independent translated exact course',
        readings:slice.map((v,i)=>({tick:steps[i].tick,command:steps[i].command,value:String(origin+BigInt(tick++)*drift+BigInt(v))}))};
      b=await receiveActiveNotebook(b,JSON.stringify(packet));b=await replayActiveNotebook(JSON.stringify(b));
    }
    const result=b.readouts.at(-1).result;assert.equal(result.checked.suffix,chosen);assert.deepEqual(result.consistentHypothesisIds,[law]);
  }
});
