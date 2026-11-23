import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planSuffixFeedback,receiveSuffixFeedback,SUFFIX_REQUEST} from '../src/science/position-drift-suffix-feedback.mjs';
import {openPositionDriftFeedback} from '../src/science/position-drift-terminal-feedback.mjs';
import {planOneFeedback} from '../src/science/persistent-position-drift-one-feedback.mjs';
import {createActiveNotebook,replayActiveNotebook,receiveActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';

const example=name=>JSON.parse(readFileSync('examples/active-position-drift-'+name+'.json','utf8'));
const sample=()=>example('suffix-feedback');

// Independent raw p(t+1) = p(t) + v + rate(command) generator.
function positions(catalog,law,word,errors,origin=0n,velocity=0n){
  let p=origin;
  return [String(p+BigInt(errors[0])),...word.map((command,i)=>{
    p+=velocity+BigInt(law.rates[catalog.commands.indexOf(command)]);
    return String(p+BigInt(errors[i+1]));
  })];
}

test('one earlier decision covers every four-pulse route, including all independent error corners',()=>{
  const request=sample(),p=planSuffixFeedback(request);
  assert.equal(p.status,'suffix-certified');assert.equal(p.prefixSeparations.length,96);
  assert.deepEqual(p.cover.map(r=>[r.laws.length,r.proofs.length,r.suffix]),[[4,6,0],[4,6,1],[4,6,2],[4,6,3]]);
  const origin=10n**70n+13n,velocity=-37n;
  for(const [i,law] of request.catalog.laws.entries())for(let mask=0;mask<32;mask++){
    const g=Math.floor(i/4),suffix=request.suffixes[g];
    const errors=Array.from({length:5},(_,j)=>mask&(1<<j)?1:-1);
    const ys=positions(request.catalog,law,[...request.prefix,...suffix],errors,origin,velocity);
    for(let n=3;n<=5;n++){
      const r=receiveSuffixFeedback(p,ys.slice(0,n));
      assert.equal(r.suffix,g);assert.equal(r.nextCommand,suffix[n-3]??null);
      if(n===5)assert.deepEqual(r.witnesses.map(w=>w.law),[law.id]);
    }
  }
});

test('each of 1,000 late-decision prefixes has one shared physical history defeating all ten final commands',()=>{
  const {catalog}=sample(),{commands,laws}=catalog,zero=[0,0,0,0,0];
  let histories=0,leaves=0;
  for(const a of commands)for(const b of commands)for(const c of commands){
    const prefix=[a,b,c],untouched=[0,1,2,3].find(g=>prefix.every(u=>u!=='g'+g+'x'&&u!=='g'+g+'y'));
    assert.ok(untouched!==undefined);
    const family=laws.slice(4*untouched,4*untouched+4);
    const history=positions(catalog,family[0],prefix,zero,3n,-2n);
    for(const law of family)assert.deepEqual(positions(catalog,law,prefix,zero,3n,-2n),history);
    histories++;
    for(const last of commands){
      const word=[...prefix,last],first=positions(catalog,family[0],word,zero,3n,-2n);
      assert.deepEqual(first.slice(0,-1),history);
      assert.ok(family.slice(1).some(law=>positions(catalog,law,word,zero,3n,-2n).at(-1)===first.at(-1)));
      leaves++;
    }
  }
  assert.deepEqual([histories,leaves],[1000,10000]);
});

test('any adaptive three-pulse policy can be answered causally by one feasible ambiguous record',()=>{
  const {catalog}=sample(),{commands,laws}=catalog,zero=[0,0,0,0];
  for(const a of commands)for(const b of commands){
    const group=[0,1,2,3].find(g=>[a,b].every(u=>u!=='g'+g+'x'&&u!=='g'+g+'y'));
    const family=laws.slice(4*group,4*group+4);
    const velocity=-BigInt(family[0].rates[commands.indexOf(a)]);
    const prefix=positions(catalog,family[0],[a,b],zero,0n,velocity);
    assert.deepEqual(prefix.slice(0,2),['0','0']);
    for(const law of family)assert.deepEqual(positions(catalog,law,[a,b],zero,0n,velocity),prefix);
    for(const c of commands){
      const trace=positions(catalog,family[0],[a,b,c],zero,0n,velocity);
      assert.ok(family.slice(1).some(law=>positions(catalog,law,[a,b,c],zero,0n,velocity).at(-1)===trace.at(-1)));
    }
  }
});

test('two future readings separate jointly while their individual projections overlap; equality is a collision',()=>{
  const s={schema:SUFFIX_REQUEST,catalog:{schema:'worldlaw.position-drift-rate-catalog/v1',noiseBound:1,
    commands:['ref','up','down'],laws:[{id:'A',rates:[0,0,0]},{id:'B',rates:[0,5,-5]}]},
    prefix:['ref'],suffixes:[['up','down']]};
  const p=planSuffixFeedback(s);assert.equal(p.status,'suffix-certified');
  assert.deepEqual(p.cover[0].proofs[0].ticks,['0','2','3']);
  const model=openPositionDriftFeedback(s.catalog);
  assert.equal(model.receive(['ref','up'],['0','0','2']).length,2);
  // With zero initial state and zero error, both laws also give y3=0.
  for(const law of s.catalog.laws)assert.equal(positions(s.catalog,law,['ref','up','down'],[0,0,0,0]).at(-1),'0');
  s.catalog.laws[1].rates=[0,4,-4];
  const contact=planSuffixFeedback(s);
  assert.equal(contact.status,'cover-inconclusive');
  const report=contact.uncovered.failures[0].collision;
  assert.equal(openPositionDriftFeedback(s.catalog).receive(['ref','up','down'],report.readings).length,2);
});

test('a valid reading-dependent last decision can evade the sufficient clique cover',()=>{
  const s=example('one-feedback');s.catalog.commands=['a','b','c'];s.prefixes=[['a','b','c']];
  s.catalog.laws=[[3,-4,-4],[6,2,-5],[5,6,0]].map((rates,i)=>({id:'L'+i,rates}));
  assert.equal(planOneFeedback(s).status,'one-feedback-certified');
  const limited=planSuffixFeedback({schema:SUFFIX_REQUEST,catalog:s.catalog,prefix:s.prefixes[0],
    suffixes:s.catalog.commands.map(u=>[u])});
  assert.equal(limited.status,'cover-inconclusive');
});

test('notebook commits the suffix before seeing its readings and reopens every intermediate packet',async()=>{
  const source=sample(),law=source.catalog.laws[13];
  const ys=positions(source.catalog,law,[...source.prefix,...source.suffixes[3]],[0,0,0,0,0]);
  let b=await createActiveNotebook(JSON.stringify(source));
  for(const values of [ys.slice(0,3),ys.slice(3,4),ys.slice(4)]){
    const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last),packet={schema:GUIDED_INPUT,
      sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,previousReadingsSHA256:last?.readingsSHA256??null,
      acquisition:'synthetic',source:'Independent group three trajectory',readings:values.map((value,i)=>({tick:steps[i].tick,command:steps[i].command,value}))};
    if(last)assert.equal(last.checked.suffix,3);
    b=await receiveActiveNotebook(b,JSON.stringify(packet));b=await replayActiveNotebook(JSON.stringify(b));
  }
  assert.deepEqual(b.readouts.at(-1).result.consistentHypothesisIds,[law.id]);
  const bad=structuredClone(b);bad.readouts[0].result.checked.suffix=0;
  await assert.rejects(replayActiveNotebook(JSON.stringify(bad)));
});
