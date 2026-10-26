import test from 'node:test';
import assert from 'node:assert/strict';
import {models,families,positions,settings,oracle} from './support/velocity-release-oracle.mjs';
import {compareVelocityReleaseCourses,proposeVelocityReleases,VELOCITY_RELEASE_SCHEMA,velocityReleaseDynamicsInputs,readVelocityReleaseStudy,exportVelocityReleaseStudy} from '../src/coupling/velocity-release.mjs';
import {readViscousReleaseStudy,RELEASE_SCHEMA} from '../src/coupling/viscous-release.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {createVelocityExample} from '../src/coupling/velocity-example.mjs';
import {createViscousExample} from '../src/coupling/viscous-example.mjs';
import {SKEW_INPUT_SCHEMA} from '../src/coupling/dynamics.mjs';

const clone=x=>structuredClone(x);
const fixture=()=>({schema:VELOCITY_RELEASE_SCHEMA,response:createCouplingCourse('reciprocal'),velocity:createVelocityExample('two-frequency'),settings});

test('signed dense inertia/loss release rankings match independent affine matrix exponentials',()=>{
 for(const g of[-.83,.57]){
  const family=families(g),before=JSON.stringify({models,family,positions,settings}),expected=oracle(family);
  const actual=compareVelocityReleaseCourses(models,family,positions,settings);
  let maximumError=0;
  for(const r of actual.releases){
   assert.equal(r.status,'screened');assert.equal(r.comparisons.length,2*models.length);
   for(const comparison of r.comparisons){
    const reference=expected.releases[r.index].comparisons.find(c=>c.modelId===comparison.modelId&&c.baselineFamily===comparison.baselineFamily);
    assert.ok(reference);assert.equal(comparison.curve.length,settings.samples);
    comparison.curve.forEach((row,k)=>{assert.ok(Math.abs(row.time-reference.curve[k].time)<1e-14);maximumError=Math.max(maximumError,Math.abs(row.separation-reference.curve[k].separation));});
    assert.ok(Math.abs(comparison.peak.separation-reference.peak.separation)<2e-8);
   }
   assert.ok(Math.abs(r.score-expected.releases[r.index].score)<2e-8);
  }
  assert.ok(maximumError<2e-8);assert.deepEqual(actual.rankedIndices,expected.rankedIndices);
  assert.equal(JSON.stringify({models,family,positions,settings}),before);
  assert.equal(actual.diagnostics.trajectoryCount,positions.length*models.length*3);
 }
});

test('matched M and D zero-skew equivalence is exact; different fitted parameters can still separate',()=>{
 const same=families(0);same.symmetric={...same.skew};delete same.symmetric.velocitySkew;
 const actual=compareVelocityReleaseCourses(models,same,positions,settings);
 assert.equal(actual.status,'not_separated');assert.deepEqual(actual.proposedIndices,[]);
 for(const r of actual.releases){assert.equal(r.score,0);for(const c of r.comparisons.filter(c=>c.baselineFamily==='symmetric'))assert.ok(c.curve.every(row=>row.separation===0));}
 const different=families(0),expected=oracle(different),comparison=compareVelocityReleaseCourses(models,different,positions,settings);
 assert.ok(comparison.releases.every(r=>r.score>0));
 comparison.releases.forEach((r,i)=>assert.ok(Math.abs(r.score-expected.releases[i].score)<2e-8));
 assert.match(comparison.diagnostics.interpretation,/does not uniquely identify G/);
});

test('all held-source changes leave training and ranking unchanged; raw-source replay recomputes identical results',()=>{
 const source=fixture(),before=JSON.stringify(source),first=proposeVelocityReleases(source),changed=clone(source);
 for(const row of changed.response.challenges)row.torque=row.torque.map((x,i)=>x+(i?43:-31));
 for(const course of changed.velocity.challenge.record.courses)for(const row of course.rows)row.torque=row.torque.map((x,i)=>x+(i?29:-37));
 const second=proposeVelocityReleases(changed);
 for(const key of ['training','releases','rankedIndices','bestIndices','proposedIndices','diagnostics','status'])assert.deepEqual(second[key],first[key],key);
 assert.equal(JSON.stringify(source),before);
 const text=exportVelocityReleaseStudy(source),parsed=JSON.parse(text);
 assert.deepEqual(Object.keys(parsed).sort(),['response','schema','settings','velocity']);
 assert.equal('releases'in parsed,false);assert.equal('training'in parsed,false);
 assert.deepEqual(proposeVelocityReleases(readVelocityReleaseStudy(text)),first);
 assert.equal(first.training.separateMotionUsed,false);assert.equal(first.training.separateResponseUsed,false);
});

test('refused response, native runaway, and step-sensitive courses retain failures and cannot rank',()=>{
 const f=families(-.83);
 const refused=compareVelocityReleaseCourses(models,f,positions,settings,{refusedModels:[{id:'independent',reason:'authored unavailable response'}]});
 assert.equal(refused.status,'unresolved');assert.deepEqual(refused.proposedIndices,[]);
 assert.ok(refused.releases.every(r=>r.status==='response_incomplete'&&r.score===null&&r.comparisons.length===4));
 const explosive=[{...models[0],matrix:[[1e10,0],[0,1e10]]}];
 const failed=compareVelocityReleaseCourses(explosive,f,positions.slice(0,2),settings);
 assert.equal(failed.status,'unresolved');assert.ok(failed.releases.every(r=>r.score===null&&r.comparisons.every(c=>!c.screened&&c.baseline.failure&&c.skew.failure)));
 const sensitive=compareVelocityReleaseCourses(models,f,positions.slice(0,2),{...settings,samples:9,maxStep:.5,positionTolerance:1e-12,rateTolerance:1e-12});
 assert.equal(sensitive.status,'unresolved');assert.ok(sensitive.releases.every(r=>r.score===null&&r.comparisons.some(c=>c.baseline.status==='step_sensitive'||c.skew.status==='step_sensitive')));
 const unsupported=fixture();unsupported.velocity=createVelocityExample('single-uniform');
 const unfit=proposeVelocityReleases(unsupported);assert.equal(unfit.status,'unsupported_training');
 assert.ok(unfit.releases.every(r=>r.score===null));assert.deepEqual(unfit.proposedIndices,[]);
});

test('aggregate three-family work is reserved before any response solver access',()=>{
 let reads=0;const trapped={...models[0]};Object.defineProperty(trapped,'matrix',{get(){reads++;throw Error('solver touched before reservation');}});
 assert.throws(()=>compareVelocityReleaseCourses([trapped],families(.57),positions,{...settings,maxStep:1e-8}),/integration steps/);
 assert.equal(reads,0);
 const actual=compareVelocityReleaseCourses(models,families(.57),positions,settings);
 const intervals=settings.samples-1,substeps=Math.max(1,Math.ceil(settings.duration/intervals/settings.maxStep));
 assert.equal(actual.diagnostics.reservedSteps,intervals*substeps*3*models.length*positions.length*3);
 assert.equal(actual.diagnostics.pairCountPerRelease,2*models.length);
});

test('new and legacy source schemas stay separate and copied parameters retain signed skew with independent arrays',()=>{
 const source=fixture();assert.throws(()=>readViscousReleaseStudy(source));
 assert.throws(()=>readVelocityReleaseStudy({schema:RELEASE_SCHEMA,response:source.response,viscous:createViscousExample('cross'),settings}));
 assert.throws(()=>readVelocityReleaseStudy({...source,result:{status:'proposed'}}));
 let reads=0;const trapped={...source};Object.defineProperty(trapped,'velocity',{get(){reads++;return source.velocity;},enumerable:true});
 assert.throws(()=>readVelocityReleaseStudy(trapped),/accessors/);assert.equal(reads,0);
 const f=families(-.83),input=velocityReleaseDynamicsInputs(f.skew,positions[0],settings);
 assert.equal(input.schema,SKEW_INPUT_SCHEMA);assert.equal(input.velocitySkew,-.83);assert.deepEqual(input.initialRate,[0,0]);
 assert.deepEqual(input.initialPosition,positions[0]);input.inertia[0]=99;input.initialPosition[0]=99;
 assert.notEqual(f.skew.inertia[0],99);assert.notEqual(positions[0][0],99);
 const baseline=velocityReleaseDynamicsInputs(f.diagonal,positions[0],settings);assert.equal(baseline.velocitySkew,0);assert.equal(baseline.dampingCross,0);
 assert.throws(()=>velocityReleaseDynamicsInputs({...f.skew,unsupported:1},positions[0],settings));
 assert.throws(()=>compareVelocityReleaseCourses(models,{...f,diagonal:{...f.diagonal,velocitySkew:.1}},positions,settings),/Loss-only/);
});

test('exact ties retain stable permitted order and threshold equality does not claim separation',()=>{
 const unbiased=[{...models[0],bias:[0,0]}],q=[[.8,.55],[-.8,-.55]],f=families(-.83);
 const first=compareVelocityReleaseCourses(unbiased,f,q,settings);
 assert.equal(first.releases[0].score,first.releases[1].score);assert.ok(first.releases[0].score>settings.minimumSeparation);
 assert.deepEqual(first.rankedIndices,[0,1]);assert.deepEqual(first.bestIndices,[0,1]);assert.deepEqual(first.proposedIndices,[0,1]);
 const threshold=compareVelocityReleaseCourses(unbiased,f,q,{...settings,minimumSeparation:first.releases[0].score});
 assert.equal(threshold.status,'not_separated');assert.deepEqual(threshold.proposedIndices,[]);
 const still=[{...models[0],matrix:[[0,0],[0,0]],bias:[0,0]}];
 const zero=compareVelocityReleaseCourses(still,f,positions,settings);
 assert.ok(zero.releases.every(r=>r.score===0));assert.deepEqual(zero.bestIndices,positions.map((_,i)=>i));assert.equal(zero.status,'not_separated');
});
