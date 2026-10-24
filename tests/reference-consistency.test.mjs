import test from 'node:test';
import assert from 'node:assert/strict';
import {gravityRun,springRun} from '../experiments/integral-discovery-92be.mjs';
import {auditAngleReferenceRuns,investigateAngleReference,searchAngleReference,exportReferenceInvestigation,reopenReferenceInvestigation} from '../src/representation/angle-reference.mjs';
const settings={offsets:[-.5,-.3,-.1,0,.1,.3,.5],fit:{noiseSigma:.00001}};
const make=(id,offset,{stiffness=2.2,source=gravityRun,duration=6}={})=>{const r=source({id,position:id==='first'?1.5:-1.3,rate:.2,duration,dt:.02,stiffness});return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:r.initialRate,source:{label:'Independent known-law fixture',recordingId:id},samples:r.samples.map(row=>({time:row.time,position:row.position+offset}))};};
const runs=()=>[make('first',.3),make('second',.3)];
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('shared coordinate survives differing releases without changing pooled model',()=>{
  const evidence=runs(),before=JSON.stringify(evidence),pooled=searchAngleReference(evidence,settings);
  const audit=auditAngleReferenceRuns(freeze(evidence),freeze(structuredClone(settings)));
  assert.equal(audit.status,'shared_grid_reference');assert.deepEqual(audit.sharedOffsets,[.3]);
  assert.deepEqual(searchAngleReference(evidence,settings),pooled);assert.equal(JSON.stringify(evidence),before);
});

test('disjoint supported coordinates expose run mismatch without declaring sensor drift',()=>{
  const audit=auditAngleReferenceRuns([make('first',0),make('second',.3)],settings);
  assert.equal(audit.status,'incompatible_run_references');assert.deepEqual(audit.sharedOffsets,[]);
  assert.deepEqual(audit.runs.map(r=>r.supportedOffsets),[[0],[.3]]);
  assert.ok(audit.runs.every(r=>r.blockers.length===0));assert.match(audit.nextObservation,/Different laws, forces or reference changes/);
});

test('different physical coefficients can share a coordinate despite pooled law mismatch',()=>{
  const evidence=[make('first',0),make('second',0,{stiffness:3.2})];
  assert.equal(searchAngleReference(evidence,settings).status,'residual_mismatch');
  const audit=auditAngleReferenceRuns(evidence,settings);assert.equal(audit.status,'shared_grid_reference');assert.deepEqual(audit.sharedOffsets,[0]);
  assert.match(audit.limits.join(' '),/Shared coordinates do not imply one shared law/);
});

test('inadequate per-run laws withhold coordinate inconsistency instead of blaming a reference',()=>{
  const audit=auditAngleReferenceRuns([make('first',0),make('second',.3)],{...settings,fit:{terms:['rate'],noiseSigma:.00001}});
  assert.equal(audit.status,'model_inadequacy');assert.equal(audit.sharedOffsets,null);
  assert.ok(audit.runs.every(r=>r.blockers.includes('model_inadequacy')));
});

test('stationary and noise-dominated evidence remains insufficient excitation',()=>{
  for(const constant of [true,false]){
    const evidence=runs();evidence[0].samples.forEach((row,i)=>{row.position=.3+(constant?0:.000001*Math.sin(i));});
    const audit=auditAngleReferenceRuns(evidence,{...settings,fit:{noiseSigma:.01}});
    assert.equal(audit.status,'insufficient_excitation');assert.equal(audit.sharedOffsets,null);
    assert.ok(audit.runs[0].blockers.includes('insufficient_excitation'));
  }
});

test('bias/linear-spring equivalence retains a shared ambiguous set',()=>{
  const audit=auditAngleReferenceRuns([make('first',.3,{source:springRun}),make('second',.3,{source:springRun})],
    {...settings,fit:{terms:['rate','spring','bias'],noiseSigma:.0001}});
  assert.equal(audit.status,'ambiguous_shared_reference');assert.ok(audit.sharedOffsets.length>1);
});

test('run and grid boundaries remain separate non-comparisons',()=>{
  assert.equal(auditAngleReferenceRuns([runs()[0]],settings).status,'insufficient_runs');
  assert.equal(auditAngleReferenceRuns(runs(),{...settings,offsets:[0]}).status,'insufficient_grid');
  const edge=auditAngleReferenceRuns([make('first',.5),make('second',0)],settings);
  assert.equal(edge.status,'grid_boundary');assert.equal(edge.sharedOffsets,null);
  const short=auditAngleReferenceRuns([make('first',0,{duration:1.2}),make('second',.3)],settings);
  assert.equal(short.status,'run_fit_unavailable');assert.equal(short.runs[0].selectedOffset,null);
  assert.match(short.runs[0].failures[0].message,/eight weak windows/);
});

test('challenge mutation and input-only replay cannot change run-wise comparison',()=>{
  const bundle={schema:'worldlaw.angular-bundle/v1',label:'Reference-transfer fixture',units:{time:'s',position:'rad',initialRate:'rad/s'},
    trainingRuns:[make('first',0),make('second',.3)],challengeRuns:[make('third',.3,{stiffness:2.4})]};
  const first=investigateAngleReference(bundle,settings);
  bundle.challengeRuns[0].samples.forEach((row,i)=>{row.position+=.2*Math.sin(i*.03);});
  const second=investigateAngleReference(bundle,settings);
  assert.deepEqual(second.consistency,first.consistency);assert.deepEqual(second.search,first.search);
  assert.deepEqual(reopenReferenceInvestigation(exportReferenceInvestigation(first)),first);
  assert.equal(exportReferenceInvestigation(first).includes('consistency'),false);
});

test('reordering training runs preserves shared-set decision and run-specific diagnostics',()=>{
  const evidence=[make('first',0),make('second',.3)];
  const a=auditAngleReferenceRuns(evidence,settings),b=auditAngleReferenceRuns([...evidence].reverse(),settings);
  assert.equal(a.status,b.status);assert.deepEqual(a.sharedOffsets,b.sharedOffsets);
  assert.deepEqual(a.runs,b.runs.reverse());
});

for(const offsets of [[0,.1,.3],[-.3,-.1,0]]) test(`zero winner is still a one-sided grid boundary: ${offsets}`,()=>{
  const audit=auditAngleReferenceRuns([make('first',0),make('second',0)],{...settings,offsets});
  assert.equal(audit.status,'grid_boundary');assert.equal(audit.sharedOffsets,null);
  assert.ok(audit.runs.every(run=>run.selectedOffset===0&&run.blockers.includes('grid_boundary')));
});
