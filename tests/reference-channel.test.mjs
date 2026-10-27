import test from 'node:test';
import assert from 'node:assert/strict';
import {compatibleGainIntervals,correctedInterval,analyzeReferenceStudy,validateReferenceStudy,exportReferenceStudy,importReferenceStudy} from '../src/unknown-lab/reference-channel.mjs';
import {referenceExample} from '../src/unknown-lab/reference-example.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
test('signed and zero gains agree with independent pointwise overlap oracle',()=>{
 for(const m of [[-2,-1],[-1,1],[0,0],[1,2]])for(const r of [[-2,-1],[-1,1],[0,0],[1,2]]){
  const regions=compatibleGainIntervals(m,r,[-3,3]);
  for(let k=-96;k<=96;k++){
   const g=k/32,p=r.map(x=>x*g).sort((a,b)=>a-b),expected=p[1]>=m[0]&&p[0]<=m[1];
   assert.equal(regions.some(([lo,hi])=>g>=lo&&g<=hi),expected,JSON.stringify({m,r,g,regions}));
  }
 }
 assert.deepEqual(compatibleGainIntervals([1,2],[0,0],[-2,2]),[]);
 assert.deepEqual(compatibleGainIntervals([0,0],[0,0],[-2,2]),[[-2,2]]);
});
test('artifact-only raw contrast is challenged but declared correction includes zero',()=>{
 const r=analyzeReferenceStudy(referenceExample());assert.equal(r.fit.status,'compatible');assert.equal(r.joint.status,'compatible');
 assert.ok(r.points.every(p=>p.main.verdict==='challenged'&&p.correctedInterval[0]<=0&&p.correctedInterval[1]>=0));
});
test('additional effect, changing gain, and absent reference reject artifact model conditionally',()=>{
 for(const kind of ['additional-effect','changing-gain','zero-reference'])assert.equal(analyzeReferenceStudy(referenceExample(kind)).fit.status,'contradicted',kind);
 assert.equal(analyzeReferenceStudy(referenceExample('negative-gain')).joint.status,'compatible');
});
test('training fit is unchanged by challenges; known contradiction dominates unqualified challenge',()=>{
 const s=referenceExample(),before=analyzeReferenceStudy(s).fit;
 for(const t of s.runs[3].main.notebook.trials)if(t.history==='conditioned')t.jointTorque+=.4;
 for(const t of s.runs[4].main.notebook.trials)delete t.sampleIndex;
 const r=analyzeReferenceStudy(s);assert.deepEqual(r.fit,before);assert.equal(r.joint.status,'contradicted');assert.equal(r.joint.unqualifiedCount,1);
});
test('all challenges must share one gain, not independently refit',()=>{
 const s=referenceExample();s.gainBounds=[0,2];
 for(const run of s.runs.slice(0,3)){run.main.notebook.noiseSigma=1;run.reference.notebook.noiseSigma=1;}
 for(const [i,g] of [[3,.3],[4,1.7],[5,1]]){
  const run=s.runs[i];
  for(const t of run.main.notebook.trials)if(t.history==='conditioned')t.jointTorque+=(g-1)*.7*(-Math.expm1(-run.duration/1.5));
 }
 const r=analyzeReferenceStudy(s);assert.ok(r.challenges.every(p=>p.status==='compatible'));assert.equal(r.joint.status,'contradicted');
});
test('full declared range controls correction and originals round-trip unchanged',()=>{
 assert.deepEqual(correctedInterval([2,3],[-2,4],[-1,2]),[-6,7]);
 const s=referenceExample(),original=copy(s);const out=analyzeReferenceStudy(s);assert.deepEqual(s,original);
 const reopened=importReferenceStudy(exportReferenceStudy(s));assert.deepEqual(reopened,s);assert.deepEqual(analyzeReferenceStudy(reopened),out);
});
test('reuse, mixed provenance, malformed bounds/assumptions and acquisition identities refuse',()=>{
 const mutate=[s=>s.runs[1].main.notebook=s.runs[0].main.notebook,s=>s.runs[0].reference.acquisitionId=s.runs[0].main.acquisitionId,s=>s.runs[0].main.notebook.source='measured',s=>s.gainBounds=[1,-1],s=>s.gainBounds=[0,null],s=>s.assumptions.stableGain=''];
 for(const f of mutate){const s=referenceExample();f(s);assert.throws(()=>validateReferenceStudy(s));}
});
test('maximum public run ID round-trips; longer IDs refuse before flattened duration admission',()=>{
 const s=referenceExample();s.runs[0].id='x'.repeat(54);assert.equal(importReferenceStudy(exportReferenceStudy(s)).runs[0].id.length,54);
 s.runs[0].id+='x';assert.throws(()=>validateReferenceStudy(s),/1–54/);
});
test('inadequate training and unqualified challenges retain explicit incompleteness',()=>{
 const s=referenceExample();s.runs[2].role='challenge';assert.equal(analyzeReferenceStudy(s).fit.status,'insufficient-training');
 const t=referenceExample();for(const row of t.runs[3].reference.notebook.trials)delete row.sampleIndex;
 assert.equal(analyzeReferenceStudy(t).joint.status,'incomplete');
});
