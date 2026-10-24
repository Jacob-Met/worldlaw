import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {fitRecovery,evaluateRecovery,predictRecovery,validateRecovery,exportRecovery,importRecovery,RECOVERY_SCHEMA} from '../src/unknown-lab/recovery-response.mjs';
// Analytic observations deliberately independent of the finite response fitter.
function run(id,delay,value,{sigma=.002,oneway=false}={}){
 const evidence=syntheticChallenge({seed:100+id,count:16,effect:0,noiseSigma:sigma,orderStrategy:oneway?'oneway':'shuffled'});
 for(const row of evidence.trials)row.jointTorque=1.3*row.command-.7*row.position+.06*row.sampleIndex+(row.history==='conditioned'?value:0);
 delete evidence.simulation;
 return {recordingId:'r'+id,protocolId:'p',delaySeconds:delay,evidence};
}
function fixture(response=d=>.6*Math.exp(-d/2)){
 return {schema:RECOVERY_SCHEMA,source:'synthetic',protocolId:'p',protocolNote:'Fixed preparation; matched stationary readout after waiting.',amplitudeBounds:[-1,1],tauSeconds:[.5,2,8],training:[run(1,0,response(0)),run(2,1,response(1))],challenges:[run(3,3,response(3)),run(4,5,response(5))]};
}
test('separate recovery observations discriminate executable decaying response',()=>{
 const n=fixture(),r=evaluateRecovery(n),c=r.fit.candidates.find(c=>c.id==='decay:2');
 assert.equal(c.status,'compatible');assert.ok(Math.abs(c.amplitude-.6)<1e-10);
 assert.equal(r.tests.find(t=>t.id==='decay:2').status,'compatible');
 assert.equal(r.fit.candidates.find(c=>c.id==='persistent').status,'training_contradiction');
});
test('persistent and zero controls retain their own compatible structures',()=>{
 assert.equal(evaluateRecovery(fixture(()=>.6)).tests.find(t=>t.id==='persistent').status,'compatible');
 const r=evaluateRecovery(fixture(()=>0));assert.ok(r.fit.candidates.every(c=>c.status==='compatible'));
});
test('challenge values cannot affect fit, forecast or declared amplitude range',()=>{
 const n=fixture(),f=fitRecovery(n),p=predictRecovery(f,[2,4]);
 n.challenges[0]=run(9,3,-.8);
 assert.deepEqual(fitRecovery(n),f);assert.deepEqual(predictRecovery(fitRecovery(n),[2,4]),p);
 assert.equal(evaluateRecovery(n).tests.find(t=>t.id==='decay:2').status,'challenged');
});
test('unbalanced training blocks every candidate, unbalanced challenge remains incomplete',()=>{
 const n=fixture();n.training[0]=run(8,0,.6,{oneway:true});assert.equal(fitRecovery(n).status,'unqualified_order');
 const m=fixture();m.challenges[0]=run(8,3,.6*Math.exp(-1.5),{oneway:true});assert.equal(evaluateRecovery(m).tests.find(t=>t.id==='decay:2').status,'incomplete');
});
test('qualified contradiction survives another unqualified challenge',()=>{
 const n=fixture();n.challenges=[run(8,3,-.8),run(9,4,.1,{oneway:true})];
 assert.equal(evaluateRecovery(n).tests.find(t=>t.id==='decay:2').status,'challenged');
});
test('joint amplitude constraints catch inconsistent challenges despite individual overlap',()=>{
 const n=fixture(()=>0);n.training=[run(1,0,0,{sigma:.3}),run(2,1,0,{sigma:.3})];
 n.challenges=[run(3,3,.1,{sigma:.01}),run(4,5,-.1,{sigma:.01})];
 const r=evaluateRecovery(n),p=r.tests.find(t=>t.id==='persistent');
 assert.ok(p.rows.every(row=>row.range[0]<=row.estimate&&row.range[1]>=row.estimate));assert.equal(p.status,'challenged');
});
test('renaming pairs/recordings and permuting rows does not permit reuse',()=>{
 const n=fixture();const dupe=structuredClone(n.training[0]);dupe.recordingId='renamed';dupe.evidence.trials.reverse();for(const row of dupe.evidence.trials){row.pairId='renamed-'+row.pairId;row.sampleIndex+=100;}
 n.challenges=[dupe];assert.throws(()=>validateRecovery(n),/reused/);
});
test('protocol, source, identity, delay and work bounds refuse before fitting',()=>{
 for(const change of [n=>n.training[0].protocolId='other',n=>n.training[0].evidence.source='measured',n=>n.training[0].delaySeconds=61,n=>n.tauSeconds=Array.from({length:17},(_,i)=>i+1),n=>n.amplitudeBounds=[1,-1],n=>n.challenges[0].recordingId='r1']){
  const n=fixture();change(n);assert.throws(()=>validateRecovery(n));
 }
});
test('input-only notebook replay reproduces every prediction without trusting result fields',()=>{
 const n=fixture(),before=JSON.stringify(n),result=evaluateRecovery(n);n.result={forged:true};
 assert.deepEqual(evaluateRecovery(importRecovery(exportRecovery(n))),result);
 delete n.result;assert.equal(JSON.stringify(n),before);
});
test('out-of-family responses keep no-candidate result; negative amplitude remains executable',()=>{
 assert.equal(fitRecovery(fixture(d=>.3+d*.4)).status,'no_candidate');
 const n=fixture(d=>-.6*Math.exp(-d/2));assert.equal(evaluateRecovery(n).tests.find(t=>t.id==='decay:2').status,'compatible');
});
test('late-only recordings refuse exponentially unexcited coefficients without nonfinite output',()=>{
 const n=fixture(()=>0);n.training[0].delaySeconds=59;n.training[1].delaySeconds=60;n.tauSeconds=[.05];
 const f=fitRecovery(n),c=f.candidates.find(c=>c.kind==='decay');assert.equal(c.status,'insufficient_excitation');assert.equal(c.amplitudeRange,null);assert.ok(Number.isFinite(c.amplitude));
});
test('representative coefficient belongs to the simultaneous admissible range',()=>{
 const n=fixture(()=>0);n.training=[run(1,0,0,{sigma:.1}),run(2,1,.18,{sigma:.1}),run(5,2,0,{sigma:.1})];
 const c=fitRecovery(n).candidates.find(c=>c.id==='persistent');assert.equal(c.status,'compatible');
 assert.ok(c.amplitude>=c.amplitudeRange[0]&&c.amplitude<=c.amplitudeRange[1]);
});
test('large admitted notebook compact export reopens; aggregate byte overflow refuses',()=>{
 const n=fixture(),runs=Array.from({length:48},(_,i)=>({recordingId:'large-'+i,protocolId:'p',delaySeconds:i,evidence:syntheticChallenge({count:128,seed:i})}));
 n.training=runs.slice(0,32);n.challenges=runs.slice(32,40);
 const exported=exportRecovery(n);assert.ok(new TextEncoder().encode(exported).length<=2000000);assert.ok(exported.startsWith('{"schema"'));
 const reopened=importRecovery(exported);assert.deepEqual(reopened.training,n.training);assert.deepEqual(reopened.challenges,n.challenges);
 n.challenges=runs.slice(32);assert.throws(()=>exportRecovery(n),/aggregate 2 MB/);
 assert.throws(()=>importRecovery('😀'.repeat(600000)),/under 2 MB/);
});
