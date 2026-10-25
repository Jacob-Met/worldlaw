import test from 'node:test';
import assert from 'node:assert/strict';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
import {evaluateHistory} from '../src/unknown-lab/paired-history.mjs';
import {analyzeProbeMixtures} from '../src/unknown-lab/probe-mixture.mjs';
import {inspectProbeMixtureConsistency as inspect,checkProbeMixtureCertificate as check,MIXTURE_CONSISTENCY_SCHEMA,exportProbeMixtureConsistency,importProbeMixtureConsistency} from '../src/unknown-lab/probe-mixture-consistency.mjs';
const request=()=>({schema:MIXTURE_CONSISTENCY_SCHEMA,study:probeExample('mixed'),family:'offset-rate-sine',scope:'training-only',maxIterations:4096,maxProducts:1000000});
test('failed point representative does not erase a feasible joint coefficient witness',()=>{
 const raw=request();raw.family='offset-rate';raw.study.runs=raw.study.runs.slice(0,3);
 for(let i=0;i<3;i++){const run=raw.study.runs[i];for(const row of run.notebook.trials)row.jointTorque=(row.history==='conditioned'&&i===2?1:0)+i*.00001;run.notebook.noiseSigma=i===1?.00001:1;}
 assert.equal(analyzeProbeMixtures(raw.study).candidates[0].status,'training-mismatch');
 const result=inspect(raw);assert.equal(result.status,'verified-interior-witness');assert.deepEqual(result.certificate.values,[0,0]);
});
test('one three-coefficient witness is checked against every original source contrast',()=>{
 const raw=request();raw.scope='all-evidence';const result=inspect(raw);
 assert.equal(result.status,'verified-interior-witness');assert.equal(result.forecast,false);
 const [a,b,c]=result.certificate.values;
 for(const run of raw.study.runs){const p=a+b*run.probe.rate+c*Math.sin(run.probe.position),[lo,hi]=evaluateHistory(run.notebook).interval;assert.ok(p>lo&&p<hi);}
 assert.equal(check(raw,result.certificate).status,result.status);
});
test('later contradictions preserve training-only witness while retrospective family consistency separates',()=>{
 const raw=request(),before=inspect(raw);
 for(const run of raw.study.runs.filter(r=>r.role==='challenge'))for(const row of run.notebook.trials)if(row.history==='conditioned')row.jointTorque+=5;
 const after=inspect(raw);assert.deepEqual(after.certificate.values,before.certificate.values);
 raw.scope='all-evidence';const all=inspect(raw);assert.equal(all.status,'verified-separation');assert.equal(all.forecast,false);
 // Independent support inequality over the explicit coefficient box.
 const weights=all.certificate.values,features=raw.study.runs.map(r=>[1,r.probe.rate,Math.sin(r.probe.position)]),obs=raw.study.runs.map(r=>evaluateHistory(r.notebook));
 const projection=[0,1,2].map(k=>features.reduce((s,x,i)=>s+weights[i]*x[k],0));
 const lhs=obs.reduce((s,o,i)=>s+weights[i]*o.decisionDifference,0),rhs=100*projection.reduce((s,x)=>s+Math.abs(x),0)+obs.reduce((s,o,i)=>s+Math.abs(weights[i])*o.boundary,0);
 assert.ok(lhs>rhs);
});
test('changing raw evidence, family, role scope, certificate coefficients or dimensions refuses',()=>{
 const raw=request(),r=inspect(raw),changed=structuredClone(raw);changed.study.runs[0].notebook.trials[0].jointTorque+=.1;
 assert.throws(()=>check(changed,r.certificate),/source/);
 assert.throws(()=>check({...raw,scope:'all-evidence'},r.certificate),/scope/);
 assert.throws(()=>check({...raw,family:'offset-rate'},r.certificate),/family/);
 assert.throws(()=>check(raw,{...r.certificate,values:[101,0,0]}),/domain/);
 assert.throws(()=>check(raw,{...r.certificate,values:[0,0]}),/domain/);
});
test('zero work, unqualified source and sparse declarations remain unresolved or refuse',()=>{
 const raw=request();assert.equal(inspect({...raw,maxIterations:0}).status,'unresolved');assert.equal(inspect({...raw,maxProducts:0}).reason,'matrix-work-budget');
 for(const row of raw.study.runs[0].notebook.trials)delete row.sampleIndex;
 assert.equal(inspect(raw).reason,'order-confounded');
 delete raw.study.runs[1];assert.throws(()=>inspect(raw),/every original/);
});
test('input-only replay recomputes and ignores forged result fields',()=>{
 const raw=request(),first=inspect(raw);const text=exportProbeMixtureConsistency({...raw,result:'forged'});
 assert.ok(!text.includes('forged'));assert.deepEqual(inspect(importProbeMixtureConsistency(text)),first);
});
