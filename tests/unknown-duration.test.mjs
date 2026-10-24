import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {DURATION_SCHEMA,fitDurationModels,analyzeDurationStudy,exportDurationStudy,importDurationStudy} from '../src/unknown-lab/duration-response.mjs';
// Independent analytic observations. No syntheticChallenge or production predictor.
function run(id,duration,contrast,role='training',noise=.001){
 const trials=Array.from({length:16},(_,i)=>{
  const referenceFirst=i%2===0,base=i/100+[...id].reduce((s,c)=>s+c.charCodeAt(0),0)/10000;
  return [{pairId:id+'-'+i,history:'reference',command:0,position:0,rate:0,jointTorque:base,sampleIndex:2*i+(referenceFirst?0:1)},
   {pairId:id+'-'+i,history:'conditioned',command:0,position:0,rate:0,jointTorque:base+contrast,sampleIndex:2*i+(referenceFirst?1:0)}];
 }).flat();
 return {id,duration,role,notebook:{schema:SCHEMA,source:'measured',sourceNote:'Analytic test fixture, not physical evidence',noiseSigma:noise,trials}};
}
const law=t=>.7*(1-Math.exp(-t/1.3));
const training=()=>[.3,1,3].map((t,i)=>run('train'+i,t,law(t)));
const study=runs=>({schema:DURATION_SCHEMA,runs});
test('independent saturation controls retain only matching grid law and predict separate duration',()=>{
 const r=analyzeDurationStudy(study([...training(),run('held',6,law(6),'challenge')]));
 assert.equal(r.fit.status,'single-grid-hypothesis');
 assert.deepEqual(r.fit.candidates.filter(c=>c.compatible).map(c=>c.id),['saturation-1.3']);
 assert.equal(r.challenges[0].predictions[0].status,'compatible');
 assert.ok(r.challenges[0].predictions[0].interval[0]<law(6));
});
test('challenge outcomes cannot affect parameters, training eligibility or frozen predictions',()=>{
 const a=analyzeDurationStudy(study([...training(),run('held',6,law(6),'challenge')]));
 const b=analyzeDurationStudy(study([...training(),run('held',6,-2,'challenge')]));
 assert.deepEqual(a.fit,b.fit);
 assert.deepEqual(a.challenges[0].predictions.map(p=>p.interval),b.challenges[0].predictions.map(p=>p.interval));
 assert.equal(b.challenges[0].predictions[0].status,'contradicted');
});
test('zero response remains ambiguous; constant artifact is distinguished without latent-state claims',()=>{
 const zero=fitDurationModels([0,1,3].map((t,i)=>run('z'+i,t,0)));
 assert.equal(zero.status,'ambiguous');assert.equal(zero.candidates.filter(c=>c.compatible).length,9);
 const constant=fitDurationModels([0,1,3].map((t,i)=>run('c'+i,t,.5)));
 assert.deepEqual(constant.candidates.filter(c=>c.compatible).map(c=>c.family),['constant']);
});
test('omitted duration law rejects complete finite family; high noise preserves ambiguity',()=>{
 assert.equal(fitDurationModels([0,1,3].map((t,i)=>run('o'+i,t,[0,1,-1][i]))).status,'none-compatible');
 assert.equal(fitDurationModels([0,1,3].map((t,i)=>run('n'+i,t,law(t),'training',10))).status,'ambiguous');
});
test('sparse coverage and one-order readings refuse fitting; unqualified challenges stay visible',()=>{
 assert.equal(fitDurationModels(training().slice(0,2)).status,'insufficient-training');
 const one=training();for(const r of one)for(const [i,t]of r.notebook.trials.entries())t.sampleIndex=i;
 assert.equal(fitDurationModels(one).status,'insufficient-training');
 const held=run('held',6,law(6),'challenge');for(const [i,t]of held.notebook.trials.entries())t.sampleIndex=i;
 assert.equal(analyzeDurationStudy(study([...training(),held])).challenges[0].predictions[0].status,'order-confounded');
 assert.throws(()=>fitDurationModels([held]),/training runs only/);
});
test('portable study recomputes; duplicated recordings, source mixing and duration mismatch refuse',()=>{
 const bundle=study(training());assert.deepEqual(importDurationStudy(exportDurationStudy(bundle)),bundle);
 const duplicate=structuredClone(bundle.runs[0]);duplicate.id='relabelled';duplicate.role='challenge';
 assert.throws(()=>analyzeDurationStudy(study([...bundle.runs,duplicate])),/reused/);
 const mixed=structuredClone(bundle);mixed.runs[0].notebook.source='synthetic';
 assert.throws(()=>analyzeDurationStudy(mixed),/separate/);
 assert.throws(()=>importDurationStudy('{'),/Invalid/);
});

test('challenge agreement requires one shared amplitude, not per-run parameter switching',()=>{
 const runs=[0,1,3].map((t,i)=>run('wide'+i,t,.5,'training',.2));
 runs.push(run('heldone',2,.4,'challenge'),run('heldtwo',4,.6,'challenge'));
 const result=analyzeDurationStudy(study(runs));
 assert.ok(result.challenges.every(r=>r.predictions.find(p=>p.id==='constant').status==='compatible'));
 assert.equal(result.jointChallenges.find(c=>c.id==='constant').status,'contradicted');
});

test('virtual duration provenance and independent random streams are enforced',()=>{
 const a={id:'a',role:'training',duration:1,notebook:syntheticChallenge({duration:1,seed:42})};
 assert.throws(()=>analyzeDurationStudy(study([{...a,duration:2}])),/differs from virtual/);
 const b={id:'b',role:'challenge',duration:2,notebook:syntheticChallenge({duration:2,seed:42})};
 assert.throws(()=>analyzeDurationStudy(study([a,b])),/fresh virtual seed/);
});
test('negative amplitude is retained and repeated duration coverage is insufficient',()=>{
 const negative=fitDurationModels([.3,1,3].map((t,i)=>run('negative'+i,t,-law(t))));
 const c=negative.candidates.find(c=>c.compatible);assert.equal(c.id,'saturation-1.3');assert.ok(c.amplitudeInterval[1]<0);
 assert.equal(fitDurationModels([1,1,1].map((t,i)=>run('same-duration'+i,t,.2+i*.001))).status,'insufficient-training');
});

test('unqualified challenges cannot erase contradiction established by qualified challenges',()=>{
 const bad=run('contradict',6,-2,'challenge');
 const unqualified=run('unqualified',4,law(4),'challenge');
 for(const [i,t]of unqualified.notebook.trials.entries())t.sampleIndex=i;
 const result=analyzeDurationStudy(study([...training(),bad,unqualified]));
 assert.equal(result.jointChallenges[0].status,'contradicted');
 assert.equal(result.jointChallenges[0].unqualifiedCount,1);
});
