import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planOneFeedback,openOneFeedback,verifyOneFeedbackCertificate} from '../src/science/persistent-position-drift-one-feedback.mjs';
import {feedbackPrimitive,intersectFeedbackHalfspaces,checkFeedbackContradiction} from '../src/science/exact-feedback-feasibility.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {pendingDriftSteps,GUIDED_INPUT} from '../src/science/active-guided-drift.mjs';

const {Q,add,sub,mul}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q=v=>{const [a,b='1']=String(v).split('/');return Q(BigInt(a),BigInt(b));};
const plain=v=>JSON.parse(JSON.stringify(v));
const sample=()=>JSON.parse(readFileSync('examples/active-position-drift-one-feedback.json','utf8'));
const fits=(v,b)=>v.n*b.d<=b.n*v.d && -v.n*b.d<=b.n*v.d;

function replayCollision(src,prefix,c){
  assert.equal(c.readings.length,prefix.length+1);assert.equal(c.branches.length,src.commands.length);
  c.branches.forEach((branch,i)=>{
    assert.equal(branch.command,src.commands[i]);assert.equal(new Set(branch.worlds.map(w=>w.law)).size,2);
    for(const world of branch.worlds){
      const law=src.laws.find(l=>l.id===world.law),word=[...prefix,branch.command];
      let [p,v]=world.start.map(q);
      [...c.readings,branch.finalReading].forEach((y,t)=>{
        if(t)p=add(p,add(v,q(law.rates[src.commands.indexOf(word[t-1])])));
        assert.ok(fits(sub(p,q(y)),q(src.noiseBound)));
      });
    }
  });
}

test('declared search retains a concrete failed prefix and certifies the next without case-specific rules',()=>{
  const source=sample(),p=planOneFeedback(source);
  assert.equal(p.status,'one-feedback-certified');assert.equal(p.proofs.length,27);
  replayCollision(source.catalog,p.trials[0].prefix,p.trials[0].collision);
  assert.equal(verifyOneFeedbackCertificate(source,p),true);
  const bad=plain(p);bad.proofs[3][0][1]='0';assert.throws(()=>verifyOneFeedbackCertificate(source,bad),/weight/);
  const missing=plain(p);missing.proofs.pop();assert.throws(()=>verifyOneFeedbackCertificate(source,missing),/assignment/);
  const stale=plain(p);stale.source.laws.reverse();assert.throws(()=>verifyOneFeedbackCertificate(source,stale),/prefix/);
  const session=openOneFeedback(source,p);
  for(const [values,cmd,final] of [[[-1,-2,-3,-4,2,8],'sample',13],[[1,-2,-3,-4,2,10],'rise',15]]){
    assert.equal(session.receive(values).nextCommand,cmd);
    assert.deepEqual(session.receive([...values,final]).witnesses.map(w=>w.law),['A']);
  }
  source.prefixes=[['rise','rise','rise','coast','coast']];
  const reverse=planOneFeedback(source);
  assert.equal(reverse.status,'one-feedback-certified');assert.equal(verifyOneFeedbackCertificate(source,reverse),true);
});

test('case 8 yields three private last positions with two actual complete possible worlds for each action',()=>{
  const s=sample();s.catalog.laws=[[-2,-2,5],[1,-2,6],[-1,-4,0],[6,7,-3]].map((rates,i)=>({id:'K'+i,rates}));
  s.prefixes=[['coast','coast','coast','rise','rise']];const p=planOneFeedback(s);
  assert.equal(p.status,'all-declared-prefixes-refuted');const c=p.trials[0].collision;
  replayCollision(s.catalog,s.prefixes[0],c);
  assert.equal(new Set(c.branches.map(b=>b.finalReading)).size,3);
  assert.throws(()=>openOneFeedback(s,p),/no executable policy/);
});

test('strict rational contact, affine rate shifts, and exact search budgets',()=>{
  const s=sample();s.catalog.commands=['left','right'];s.prefixes=[['left']];
  s.catalog.laws=[{id:'X',rates:['0','0']},{id:'Y',rates:['0','8']}];
  const touching=planOneFeedback(s);assert.equal(touching.status,'all-declared-prefixes-refuted');
  replayCollision(s.catalog,s.prefixes[0],touching.trials[0].collision);
  const den=10n**80n+7n;s.catalog.laws[1].rates[1]=String(8n*den+1n)+'/'+den;
  const above=planOneFeedback(s);assert.equal(above.status,'one-feedback-certified');verifyOneFeedbackCertificate(s,above);
  s.catalog.laws[0].rates=['2/3','2/3'];const shifted=planOneFeedback(s);
  assert.equal(shifted.status,above.status);verifyOneFeedbackCertificate(s,shifted);
  s.prefixes=[[]];const empty=planOneFeedback(s);replayCollision(s.catalog,[],empty.trials[0].collision);
  for(const [limits,reason] of [[{assignments:0,linearWork:300},'assignment-budget'],[{assignments:5,linearWork:1},'linear-work-budget']]){
    const src=sample();src.limits=limits;const p=planOneFeedback(src);
    assert.equal(p.status,'search-inconclusive');assert.equal(p.reason,reason);assert.equal(p.prefix,undefined);
    assert.ok(p.work.assignments<=limits.assignments && p.work.linearWork<=limits.linearWork);
  }
});

test('the linear solver lifts non-pairwise contradictions and preserves all touching faces',()=>{
  const row=(a,b)=>feedbackPrimitive(a.map(BigInt),q(b)),spend=()=>{};
  for(let d=2;d<=5;d++){
    const rows=Array.from({length:d},(_,j)=>row(Array.from({length:d},(_,i)=>i===j?-1:0),-1));
    const impossible=[...rows,row(Array(d).fill(1),d-1)];
    const res=intersectFeedbackHalfspaces(impossible,d,spend);
    assert.equal(res.proof.length,d+1);assert.ok(checkFeedbackContradiction(impossible,d,res.proof));
    const possible=[...rows,row(Array(d).fill(1),d)];
    assert.deepEqual(intersectFeedbackHalfspaces(possible,d,spend).point,Array.from({length:d},()=>q('1')));
  }
  // Independent bounded 2-D vertex test; all candidate coordinates are kept
  // as integer numerators with a common positive denominator.
  let seed=742;const draw=()=>{seed=seed*48271%2147483647;return seed%11-5;};
  for(let trial=0;trial<120;trial++){
    const raw=[[1,0,7],[-1,0,7],[0,1,7],[0,-1,7]];
    for(let i=0;i<6;i++)raw.push([draw(),draw(),draw()]);
    let feasible=false;
    for(let j=1;j<raw.length;j++)for(let i=0;i<j;i++){
      const [a,b,c]=raw[i],[u,v,w]=raw[j],det=a*v-b*u;if(!det)continue;
      const sign=Math.sign(det),x=(c*v-b*w)*sign,y=(a*w-c*u)*sign;
      if(raw.every(([h,k,l])=>h*x+k*y<=l*Math.abs(det)))feasible=true;
    }
    const rows=raw.map(([a,b,c])=>row([a,b],c)),res=intersectFeedbackHalfspaces(rows,2,spend);
    assert.equal(Boolean(res.point),feasible);
    if(!feasible)assert.ok(checkFeedbackContradiction(rows,2,res.proof));
    else for(const [a,b,c] of raw)assert.ok(sub(add(mul(q(a),res.point[0]),mul(q(b),res.point[1])),q(c)).n<=0n);
  }
});

test('a portable notebook executes the selected command and refuses a stale history',async()=>{
  const src=sample(),book=await createActiveNotebook(JSON.stringify(src));
  function packet(b,values){
    const prev=b.readouts.at(-1)?.result,steps=pendingDriftSteps(b.plan,prev);
    return JSON.stringify({schema:GUIDED_INPUT,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
      previousReadingsSHA256:prev?.readingsSHA256??null,source:'One held trajectory for testing',acquisition:'synthetic',
      readings:values.map((value,i)=>({tick:steps[i].tick,command:steps[i].command,value:String(value)}))});
  }
  const first=packet(book,[-1,-2,-3,-4,2,8]),mid=await receiveActiveNotebook(book,first);
  assert.equal(mid.readouts[0].result.checked.nextCommand,'sample');
  const end=await receiveActiveNotebook(mid,packet(mid,[13]));
  assert.deepEqual(end.readouts.at(-1).result.consistentHypothesisIds,['A']);
  assert.deepEqual(await replayActiveNotebook(JSON.stringify(end)),end);
  await assert.rejects(receiveActiveNotebook(mid,first),/continue this frozen notebook/);
});
