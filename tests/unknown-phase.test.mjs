import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge,evaluateHistory,exportNotebook,importNotebook,validateNotebook} from '../src/unknown-lab/paired-history.mjs';
const meanClose=(a,b,t=.055)=>assert.ok(Math.abs(a-b)<t,String(a)+' not near '+String(b));
test('independent periodic sensor artifact aliases fixed AB/BA into a false preparation challenge',()=>{
 const n=syntheticChallenge({seed:41,effect:0,cycleDriftAmplitude:.3,orderStrategy:'alternating'});
 const r=evaluateHistory(n);
 assert.equal(r.order.status,'counterbalanced');
 assert.equal(r.verdict,'challenged','this is a retained counterexample, not a physical-history discovery');
 meanClose(r.decisionDifference,.3);
 assert.ok(r.order.driftPerStep<.04);
 assert.match(r.interpretation,/Nonlinear drift/);
});
test('seeded shuffled balanced AB/BA breaks this exact phase-lock under equal observations',()=>{
 const n=syntheticChallenge({seed:41,effect:0,cycleDriftAmplitude:.3,orderStrategy:'shuffled'});
 const r=evaluateHistory(n);
 assert.equal(r.order.status,'counterbalanced');
 assert.equal(r.order.referenceFirst,8);
 assert.equal(r.order.conditionedFirst,8);
 assert.equal(r.verdict,'inconclusive');
 meanClose(r.decisionDifference,0);
});
test('shuffled scheduling does not destroy a genuine preparation effect',()=>{
 const r=evaluateHistory(syntheticChallenge({seed:41,effect:.8,duration:3,cycleDriftAmplitude:.3,orderStrategy:'shuffled'}));
 assert.equal(r.verdict,'challenged');
 meanClose(r.decisionDifference,.8*(1-Math.exp(-3/1.3)));
});
test('changing order alone preserves every state and noiseless target, no data leakage',()=>{
 const ordered=syntheticChallenge({seed:54,effect:.6,cycleDriftAmplitude:0,driftPerReading:0,orderStrategy:'alternating'});
 const shuffled=syntheticChallenge({seed:54,effect:.6,cycleDriftAmplitude:0,driftPerReading:0,orderStrategy:'shuffled'});
 assert.notDeepEqual(ordered.trials.map(t=>t.sampleIndex),shuffled.trials.map(t=>t.sampleIndex));
 for(let i=0;i<ordered.trials.length;i++){
  for(const k of ['command','position','rate','history','pairId','jointTorque'])
   assert.equal(ordered.trials[i][k],shuffled.trials[i][k]);
 }
});
test('the shuffled sequence and oracle parameters can be reconstructed from portable evidence',()=>{
 const options={seed:47,effect:-.6,duration:1.4,driftPerReading:.13,cycleDriftAmplitude:.2,orderStrategy:'shuffled'};
 const one=syntheticChallenge(options),two=syntheticChallenge(options);
 assert.deepEqual(one,two);
 const restored=importNotebook(exportNotebook(one));
 assert.deepEqual(restored.simulation,{seed:47,count:16,effect:-.6,duration:1.4,driftPerReading:.13,cycleDriftAmplitude:.2,orderStrategy:'shuffled'});
 assert.deepEqual(restored.trials,one.trials);
 assert.deepEqual(evaluateHistory(restored),evaluateHistory(one));
});
test('user-declared measured samples retain pairs but never inherited virtual-only metadata',()=>{
 const n=syntheticChallenge({cycleDriftAmplitude:.2});
 n.source='measured';n.sourceNote='declared independent instrument';
 const restored=importNotebook(exportNotebook(n));
 assert.deepEqual(restored.trials,n.trials);
 assert.equal(restored.simulation,undefined);
 assert.equal(restored.source,'measured');
});
test('invalid strategies, cycle amplitudes and forged simulation metadata fail validation',()=>{
 assert.throws(()=>syntheticChallenge({orderStrategy:'magic'}));
 assert.throws(()=>syntheticChallenge({cycleDriftAmplitude:100}));
 const n=syntheticChallenge({seed:41});
 n.simulation.seed=NaN;
 assert.throws(()=>validateNotebook(n),/seed/);
 const m=syntheticChallenge({seed:41});
 m.simulation.count=5;
 assert.throws(()=>validateNotebook(m),/seed, count or orderStrategy/);
});
