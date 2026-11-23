import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planFeedbackTree,receiveFeedbackTree,TREE_REQUEST} from '../src/science/position-drift-feedback-tree.mjs';
import {verifyExactFeedbackTree} from '../src/science/position-drift-exact-feedback-tree.mjs';
import {planSuffixFeedback,REGION_SUFFIX_REQUEST} from '../src/science/position-drift-suffix-feedback.mjs';
import {fourPulseCenter,pairFourPulseProjection,unsafeThirdBands,compare} from '../src/science/persistent-four-pulse-geometry.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as exact} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';
const {add,sub,fmt}=exact;
const sample=()=>JSON.parse(readFileSync('examples/active-position-drift-exact-feedback-tree.json','utf8'));
function replay(s,p){
  assert.equal(p.status,'tree-refuted');assert.equal(p.collision.length,p.nodes[0].leaves.length);
  const readings=new Map();
  for(const branch of p.collision){
    const node=p.nodes[branch.leaf];assert.deepEqual(node.word,branch.commands);
    assert.equal(node.marks.length,branch.readings.length);assert.equal(new Set(branch.worlds.map(w=>w.law)).size,2);
    node.marks.forEach((mark,t)=>{
      const y=branch.readings[t];if(readings.has(mark))assert.equal(readings.get(mark),y);readings.set(mark,y);
    });
    for(const w of branch.worlds){
      let [x,v]=w.start.map(q);const row=s.catalog.laws.find(l=>l.id===w.law);
      branch.readings.forEach((y,t)=>{
        if(t)x=add(x,add(v,q(row.rates[s.catalog.commands.indexOf(branch.commands[t-1])])));
        const gap=sub(x,q(y)),bound=q(s.catalog.noiseBound);
        assert.ok((gap.n<0n?-gap.n:gap.n)*bound.d<=bound.n*gap.d);
      });
    }
  }
}

test('three essential leaf tapes win only by preserving the branch timing',()=>{
  const s=sample(),p=planFeedbackTree(s);assert.equal(p.status,'tree-certified');
  assert.equal(verifyExactFeedbackTree(s,p),true);assert.equal(p.exclusions.length,2);
  const {limits,...old}=s;old.schema=TREE_REQUEST;old.subproblems=200;
  assert.equal(planFeedbackTree(old).status,'tree-inconclusive');
  const flat=planSuffixFeedback({schema:REGION_SUFFIX_REQUEST,catalog:s.catalog,prefix:s.program.commands,suffixes:[['c','e'],['c','f'],['d','e']]});
  assert.equal(flat.status,'suffix-refuted');assert.deepEqual(flat.collision.prefixReadings,['0','0','1']);
  for(const [middle,choice,law] of [['-11/4','f','L0'],['4','e','L1']]){
    assert.equal(receiveFeedbackTree(p,[0,0,1]).nextCommand,'c');
    assert.equal(receiveFeedbackTree(p,[0,0,1,middle]).nextCommand,choice);
    assert.deepEqual(receiveFeedbackTree(p,[0,0,1,middle,6]).witnesses.map(w=>w.law),[law]);
  }
  assert.deepEqual(receiveFeedbackTree(p,[0,0,2]).committed,['a','b','d','e']);
  for(let missing=0;missing<3;missing++){
    const input=structuredClone(s);
    if(missing<2)input.program.alternatives[0].alternatives.splice(missing,1);
    else input.program.alternatives.splice(1,1);
    replay(input,planFeedbackTree(input));
  }
});

test('counterfactual siblings share every ancestor measurement but may have disjoint later physical readings',()=>{
  const s=sample();s.catalog={schema:s.catalog.schema,commands:['r','up','down','left','right'],noiseBound:0,
    laws:['A','B'].map(id=>({id,rates:[0,100,-100,-3,3]}))};
  s.program={commands:['r','r'],alternatives:['up','down'].map(a=>({commands:[a],alternatives:['left','right'].map(b=>({commands:[b]}))}))};
  const p=planFeedbackTree(s);replay(s,p);
  const pos=p.collision.map(l=>l.readings);
  assert.deepEqual(pos.map(v=>v.slice(0,3)),Array(4).fill(['0','0','0']));
  assert.deepEqual(pos.map(v=>v[3]),['100','100','-100','-100']);
  assert.deepEqual(pos.map(v=>v[4]),['97','103','-103','-97']);
});

test('independent nested planar projections match the result and closed contact',()=>{
  let seed=803904;const draw=()=>{seed=seed*48271%2147483647;return seed%15-7;};
  for(let n=-1;n<32;n++){
    const s=sample();
    if(n>=0){s.catalog.noiseBound=n%3;s.catalog.laws.forEach(l=>l.rates=l.rates.map(draw));}
    function projections(i,j){
      const centers=s.catalog.laws.map(l=>fourPulseCenter([0,1,i,j].map(t=>q(l.rates[t])))),pairs=[];
      for(let b=1;b<centers.length;b++)for(let a=0;a<b;a++){
        const result=pairFourPulseProjection(centers[a],centers[b],q(s.catalog.noiseBound));
        if(result)pairs.push(result);
      }
      return pairs;
    }
    const c=unsafeThirdBands([projections(2,4),projections(2,5)]),d=unsafeThirdBands([projections(3,4)]);
    if(n===-1){assert.deepEqual(c.map(b=>b.map(fmt)),[['2','2']]);assert.deepEqual(d.map(b=>b.map(fmt)),[['-10/3','4/3']]);}
    const trap=c.some(a=>d.some(b=>compare(a[0],b[1])<=0&&compare(b[0],a[1])<=0));
    const p=planFeedbackTree(s);
    if(trap)replay(s,p);else assert.equal(verifyExactFeedbackTree(s,p),true);
  }
});

test('budgets leave the tree open; certificate substitution rejects a missing branch or altered weight',()=>{
  const s=sample(),p=planFeedbackTree(s);
  for(const limits of [{assignments:1,linearWork:40000},{assignments:200,linearWork:1}]){
    const cut=planFeedbackTree({...s,limits});assert.equal(cut.status,'tree-budget-exhausted');
    assert.ok(cut.work.assignments<=limits.assignments&&cut.work.linearWork<=limits.linearWork);
    assert.throws(()=>receiveFeedbackTree(cut,[0]),/certified/);
  }
  const missing=structuredClone(p);missing.exclusions.pop();assert.throws(()=>verifyExactFeedbackTree(s,missing),/missing/);
  const forged=structuredClone(p);forged.exclusions[0].proof[0][1]='1234567';assert.throws(()=>verifyExactFeedbackTree(s,forged),/contradict/);
  const stale=structuredClone(p);stale.nodes[0].marks.reverse();assert.throws(()=>verifyExactFeedbackTree(s,stale),/differs/);
});

test('translated measurements drive both decisions and persist through every notebook reopen',async()=>{
  const s=sample(),shift=(y,t)=>fmt(add(q(y),q(String(10n**60n+BigInt(t)*(10n**32n)))));
  let b=await createActiveNotebook(JSON.stringify(s)),t=0;
  for(const vs of [['0','0','1'],['-11/4'],['6']]){
    const last=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,last);
    const doc={schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
      previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'Translated exact adaptive test course',
      readings:vs.map((v,i)=>({value:shift(v,t++),tick:steps[i].tick,command:steps[i].command}))};
    b=await receiveActiveNotebook(b,JSON.stringify(doc));b=await replayActiveNotebook(JSON.stringify(b));
  }
  assert.deepEqual(b.readouts.at(-1).result.consistentHypothesisIds,['L0']);
  assert.deepEqual(b.readouts.at(-1).result.checked.commands,['a','b','c','f']);
});
