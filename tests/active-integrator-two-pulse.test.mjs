import test from 'node:test';
import assert from 'node:assert/strict';
import {TWO_PULSE_SCHEMA,TWO_PULSE_READINGS,designTwoPulse,receiveTwoPulse} from '../src/science/active-integrator-two-pulse.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';

const source=(coefs,amplitudes=[0,1,2])=>({schema:TWO_PULSE_SCHEMA,initialState:'single-unknown-offset',
  noiseBound:1,amplitudes,hypotheses:coefs.map((coefficients,i)=>({id:'L'+i,coefficients}))});
const q=source([[0,0,0],[8,-12,4],[8,4,-4],[8,0,0]]);
const read=(round,amplitude,values)=>({schema:TWO_PULSE_READINGS,round,amplitude,source:'synthetic offset and errors',
  acquisition:'synthetic',observations:values.map((value,i)=>({tick:round===1?i:2,value}))});
const g=(coeff,u)=>coeff.reduceRight((v,a)=>v*u+a,0);

test('a continuous two-pulse policy separates four laws while all nine fixed schedules collide',()=>{
  const plan=designTwoPulse(q);
  assert.equal(plan.worstReadings,3);
  assert.equal(plan.firstAmplitude,'1');
  assert.equal(plan.fixedSchedules.length,9);
  for(const fixed of plan.fixedSchedules){
    assert.ok(fixed.ambiguousPairs.length>0);
    const [a,b]=fixed.ambiguousPairs[0].map(id=>q.hypotheses.find(h=>h.id===id).coefficients);
    for(const u of fixed.pulses.map(Number))assert.equal(g(a,u),g(b,u));
  }
  // Enumerate shared starting offsets and independently varied errors, including every closed boundary.
  for(const [i,h] of q.hypotheses.entries())for(const x0 of [-17,4])
    for(const e0 of [-1,0,1])for(const e1 of [-1,0,1])for(const e2 of [-1,0,1]){
      const x1=x0+g(h.coefficients,1);
      const first=receiveTwoPulse(q,plan,read(1,1,[x0+e0,x1+e1]));
      const u=Number(first.nextAmplitude);
      assert.equal(u,i<2?0:2);
      const last=receiveTwoPulse(q,plan,read(2,u,[x1+g(h.coefficients,u)+e2]),first);
      assert.deepEqual(last.consistentHypothesisIds,[h.id]);
    }
});

test('closed noise contact yields a real ambiguous transcript and strict separation removes it',()=>{
  const contact=source([[0],[2]],[1]), refused=designTwoPulse(contact);
  assert.equal(refused.status,'no_guaranteed_two_pulse_policy');
  assert.deepEqual(refused.refusals[0].ambiguousContinuationPairs,[{amplitude:'1',pair:['L0','L1']}]);
  for(const fitted of [[0,0,0],[-2,0,2]])
    assert.ok([-1,0,1].every((y,i)=>Math.abs(y-fitted[i])<=1));
  const separate=source([[0],[3]],[1]), plan=designTwoPulse(separate);
  assert.equal(plan.status,'certified_adaptive_policy');
  assert.deepEqual(plan.fixedSchedules[0].ambiguousPairs,[]);
  const one=designTwoPulse(source([[0],[5]],[1]));
  assert.equal(one.worstReadings,2);
  assert.equal(receiveTwoPulse(q,designTwoPulse(q),read(1,1,[0,4])).status,'all_hypotheses_falsified');
});

test('the exact difference can change continuation eligibility within the same surviving pair',()=>{
  const req=source([[0,-2,2],[-4,-5,4],[-1,-4,2]]);
  const plan=designTwoPulse(req);
  const inside=receiveTwoPulse(req,plan,read(1,0,[0,'-3/2']));
  const boundary=receiveTwoPulse(req,plan,read(1,0,[0,-1]));
  assert.deepEqual(inside.consistentHypothesisIds,['L0','L2']);
  assert.deepEqual(boundary.consistentHypothesisIds,inside.consistentHypothesisIds);
  assert.equal(inside.nextAmplitude,'1');
  assert.equal(boundary.nextAmplitude,'2');
  // At d=-1, the second command 1 can leave a shared final reading -2:
  // L0 true path [-1,-1,-1], L2 true path [1,0,-3], both in the error box.
  for(const fitted of [[-1,-1,-1],[1,0,-3]])
    assert.ok([0,-1,-2].every((y,i)=>Math.abs(y-fitted[i])<=1));
});

test('notebook seals the exact applied branch, previous readings and terminal decision',async()=>{
  let book=await createActiveNotebook(JSON.stringify(q));
  const tagged=(b,row)=>JSON.stringify({...row,sourceSHA256:b.plan.sourceSHA256,planSHA256:b.plan.planSHA256,
    previousReadingsSHA256:b.readouts.at(-1)?.result.readingsSHA256??null});
  book=await receiveActiveNotebook(book,tagged(book,read(1,1,[11,19])));
  assert.equal(book.readouts[0].result.nextAmplitude,'2');
  await assert.rejects(receiveActiveNotebook(book,tagged(book,read(2,0,[19]))),/applied pulse/);
  const last=tagged(book,read(2,2,[19]));
  await assert.rejects(receiveActiveNotebook(book,last.replace(book.readouts[0].result.readingsSHA256,'different')),/preceding notebook/);
  book=await receiveActiveNotebook(book,last);
  assert.deepEqual(book.readouts[1].result.consistentHypothesisIds,['L2']);
  assert.deepEqual(await replayActiveNotebook(book),book);
  await assert.rejects(receiveActiveNotebook(book,tagged(book,read(2,2,[27]))),/closed or out of order/);
  book.readouts[0].result.nextAmplitude='0';
  await assert.rejects(replayActiveNotebook(book),/exact replay refused/);
});
