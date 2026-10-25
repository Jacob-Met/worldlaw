import test from 'node:test';
import assert from 'node:assert/strict';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
import {analyzeProbeMixtures} from '../src/unknown-lab/probe-mixture.mjs';
test('out-of-domain coefficients retain refusal and never extrapolate overflow forecasts',()=>{
 const s=probeExample('mixed');
 for(const run of s.runs){run.probe.rate=run.role==='training'?run.probe.rate*1e-308:1e6;for(const row of run.notebook.trials)row.rate=run.probe.rate;}
 const c=analyzeProbeMixtures(s).candidates[0];
 assert.equal(c.status,'outside-coefficient-domain');
 assert.ok(c.coefficients.every(Number.isFinite));assert.ok(Math.abs(c.coefficients[1])>1e307);
 assert.deepEqual(c.training,[]);assert.deepEqual(c.challenges,[]);
 assert.match(c.reason,/No forecast/);
});
test('mixed offset and rate transfer with a residual degree of freedom',()=>{
 const r=analyzeProbeMixtures(probeExample('mixed'));
 const c=r.candidates.find(c=>c.id==='offset-rate');
 assert.equal(c.status,'training-screen-passed');
 assert.ok(Math.abs(c.coefficients[0]-.4)<.002);
 assert.ok(Math.abs(c.coefficients[1]+.7)<.002);
 assert.ok(c.challenges.every(p=>p.status==='within-screen'));
 assert.equal(r.candidates.at(-1).status,'insufficient-training');
});
test('changed challenge cannot train coefficients and remains a contradiction',()=>{
 const s=probeExample('mixed'),before=analyzeProbeMixtures(s).candidates[0];
 for(const t of s.runs.at(-1).notebook.trials)if(t.history==='conditioned')t.jointTorque+=1;
 const after=analyzeProbeMixtures(s).candidates[0];
 assert.deepEqual(after.coefficients,before.coefficients);
 assert.deepEqual(after.training,before.training);
 assert.equal(after.challenges.at(-1).status,'outside-screen');
 assert.equal(after.challenges.at(-1).prediction,before.challenges.at(-1).prediction);
});
test('constant rate training refuses an unidentifiable mixed response',()=>{
 const s=probeExample('mixed');
 for(const run of s.runs.filter(r=>r.role==='training')){run.probe.rate=.1;for(const t of run.notebook.trials)t.rate=.1;}
 assert.equal(analyzeProbeMixtures(s).candidates[0].status,'rank-deficient');
});
test('unqualified challenge remains unresolved and missing training order blocks fitting',()=>{
 const s=probeExample('mixed');for(const t of s.runs.at(-1).notebook.trials)delete t.sampleIndex;
 assert.equal(analyzeProbeMixtures(s).candidates[0].challenges.at(-1).status,'order-confounded');
 for(const t of s.runs[0].notebook.trials)delete t.sampleIndex;
 assert.equal(analyzeProbeMixtures(s).candidates[0].status,'order-confounded');
});
test('joint three-term recovery predicts separate probes and retains omitted nonlinear failure',()=>{
 const s=probeExample('mixed');
 s.runs[3].role='training';
 for(const run of s.runs){
  const old=.4-.7*run.probe.rate;
  const replacement=.2+.3*run.probe.rate-.4*Math.sin(run.probe.position);
  for(const row of run.notebook.trials)if(row.history==='conditioned')row.jointTorque+=replacement-old;
 }
 const c=analyzeProbeMixtures(s).candidates.at(-1);
 assert.equal(c.status,'training-screen-passed');
 for(const [i,expected]of [.2,.3,-.4].entries())assert.ok(Math.abs(c.coefficients[i]-expected)<.004);
 assert.ok(c.challenges.every(p=>p.status==='within-screen'));
 const before=structuredClone(c.coefficients);
 for(const row of s.runs.at(-1).notebook.trials)if(row.history==='conditioned')row.jointTorque+=.2;
 const changed=analyzeProbeMixtures(s).candidates.at(-1);
 assert.deepEqual(changed.coefficients,before);
 assert.equal(changed.challenges.at(-1).status,'outside-screen');
});
