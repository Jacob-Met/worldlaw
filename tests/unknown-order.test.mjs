import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge,evaluateHistory,exportNotebook,importNotebook,validateNotebook} from '../src/unknown-lab/paired-history.mjs';

const approximately=(actual,expected,epsilon=.035)=>assert.ok(Math.abs(actual-expected)<epsilon,String(actual)+' differs from '+String(expected));
test('one-way chronological drift looks like history on naive screen but refuses causal interpretation',()=>{
 const r=evaluateHistory(syntheticChallenge({effect:0,driftPerReading:.5,counterbalanced:false}));
 assert.equal(r.naiveVerdict,'challenged');
 assert.equal(r.verdict,'inconclusive');
 assert.equal(r.order.status,'unbalanced');
 assert.equal(r.order.referenceFirst,16);
 approximately(r.meanDifference,.5);
 assert.match(r.interpretation,/drift/);
});
test('AB/BA crossover cancels linear drift on an independent memoryless synthetic instrument',()=>{
 for(const drift of [-.7,-.2,.2,.7]){
  const r=evaluateHistory(syntheticChallenge({effect:0,driftPerReading:drift}));
  assert.equal(r.order.status,'counterbalanced');
  assert.equal(r.verdict,'inconclusive');
  approximately(r.order.driftPerStep,drift);
  approximately(r.decisionDifference,0);
  assert.equal(r.order.referenceFirst,8);
  assert.equal(r.order.conditionedFirst,8);
 }
});
test('true memory effect survives controlled linear drift with both orders',()=>{
 const r=evaluateHistory(syntheticChallenge({effect:.8,duration:3,driftPerReading:.45}));
 assert.equal(r.order.status,'counterbalanced');
 assert.equal(r.verdict,'challenged');
 const expected=.8*(1-Math.exp(-3/1.3));
 approximately(r.decisionDifference,expected);
 approximately(r.order.driftPerStep,.45);
 assert.ok(r.interval[0]>0);
});
test('single-order false positive is withheld even when all differences are far above noise',()=>{
 const r=evaluateHistory(syntheticChallenge({effect:0,driftPerReading:-.8,counterbalanced:false}));
 assert.equal(r.naiveVerdict,'challenged');
 assert.equal(r.verdict,'inconclusive');
 assert.equal(r.order.historyEstimate,null);
});
test('chronology survives portable measured notebook import/export without inventing authentication',()=>{
 const d=syntheticChallenge({effect:.9,driftPerReading:.3});
 d.source='measured';d.sourceNote='user claim - no independent custody check';
 const restored=importNotebook(exportNotebook(d));
 assert.equal(restored.source,'measured');
 assert.deepEqual(restored.trials,d.trials);
 assert.equal(evaluateHistory(restored).order.status,'counterbalanced');
});
test('unindexed legacy notebook remains supported and marked unrecorded',()=>{
 const d=syntheticChallenge();
 for(const trial of d.trials)delete trial.sampleIndex;
 const roundTrip=importNotebook(exportNotebook(d));
 assert.equal(roundTrip.trials.every(t=>t.sampleIndex===undefined),true);
 assert.equal(evaluateHistory(roundTrip).order.status,'unrecorded');
 assert.equal(evaluateHistory(roundTrip).verdict,'challenged');
});
test('order index must be complete, bounded, unique and pairwise adjacent',()=>{
 const base=syntheticChallenge({count:8});
 const mutate=[
   n=>{delete n.trials[0].sampleIndex;},
   n=>{n.trials[1].sampleIndex=n.trials[0].sampleIndex;},
   n=>{n.trials[0].sampleIndex=-1;},
   n=>{n.trials[0].sampleIndex=1.5;},
   n=>{n.trials[0].sampleIndex=1000000001;},
   n=>{n.trials[0].sampleIndex=234;},
 ];
 for(const alteration of mutate) {
  const n=structuredClone(base);alteration(n);assert.throws(()=>validateNotebook(n));
 }
});
test('too-few counterbalanced pairs do not imply history effect regardless of mean',()=>{
 const d=syntheticChallenge({count:8,effect:0,driftPerReading:.7,counterbalanced:false});
 for(let i=0;i<3;i++){
  const ref=d.trials[i*2],cond=d.trials[i*2+1];
  [ref.sampleIndex,cond.sampleIndex]=[cond.sampleIndex,ref.sampleIndex];
 }
 const r=evaluateHistory(d);
 assert.equal(r.order.status,'unbalanced');
 assert.equal(r.order.conditionedFirst,3);
 assert.equal(r.verdict,'inconclusive');
});
test('changing drift changes readings but not the source-visible state inputs',()=>{
 const x=syntheticChallenge({seed:25,driftPerReading:0});
 const y=syntheticChallenge({seed:25,driftPerReading:.15});
 for(let i=0;i<x.trials.length;i++){
   for(const k of ['command','position','rate','history','pairId','sampleIndex'])
     assert.equal(x.trials[i][k],y.trials[i][k]);
   approximately(y.trials[i].jointTorque-x.trials[i].jointTorque,.15*x.trials[i].sampleIndex,1e-8);
 }
});
