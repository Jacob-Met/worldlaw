import test from 'node:test';
import assert from 'node:assert/strict';
import {gravityRun} from '../experiments/integral-discovery-92be.mjs';
import {discover,DEFAULT_TERMS,predict} from '../src/science/torque-discovery.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {discoverAngular,DEFAULT_ANGULAR_TERMS,rolloutAngular} from '../src/trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {investigateAngleReference,exportReferenceInvestigation,reopenReferenceInvestigation} from '../src/representation/angle-reference.mjs';
export const make=(id,position,{cubic=.4,sigma=0,offset=0,dt=.02}={})=>{const r=gravityRun({id,position,cubic,sigma,dt});return {...r,dynamics:'unforced_scalar_rotation',inertia:null,samples:r.samples.map(({time,position})=>({time,position:position+offset}))};};
export const bundle=(opts={})=>({schema:'worldlaw.angular-bundle/v1',label:'Independent nonlinear restoring oracle',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[make('a',1.5,opts),make('b',-1.3,opts)],challengeRuns:[make('c',2.1,opts)]});
const settings={offsets:[-.3,-.15,0,.15,.3],fit:{terms:[...DEFAULT_ANGULAR_TERMS,'cubic'],noiseSigma:.0001}};

test('cubic term repairs a known omitted restoring law on an independent changed-amplitude release',()=>{
 for(const cubic of [.4,1.2]){
  const r=investigateAngleReference(bundle({cubic}),settings),m=r.search.selected.model;
  assert.equal(m.id,'rate+gravity+cubic');assert.equal(r.search.selected.offset,0);
  assert.equal(m.terms.find(t=>t.id==='cubic').coefficientUnit,'1/(rad²·s²)');
  assert.ok(Math.abs(m.terms.find(t=>t.id==='cubic').coefficient+cubic/.8)<.00001);
  assert.equal(r.libraryBaseline.status,'residual_mismatch');
  assert.ok(r.comparisons[0].selected.rollout.metrics.positionRMSE<.000001);
  assert.ok(r.comparisons[0].withoutCubic.rollout.metrics.positionRMSE>.05);
  assert.equal(m.absoluteTorqueIdentified,false);assert.equal(m.physicalInertia,null);
 }
});
test('absence of cubic does not force a needless term and old defaults stay explicit',()=>{
 const b=bundle({cubic:0});
 assert.equal(investigateAngleReference(b,settings).search.selected.model.id,'rate+gravity');
 for(const fit of [discoverAngularWeak,discoverAngular])assert.deepEqual(fit(b.trainingRuns).options.terms,[...DEFAULT_ANGULAR_TERMS]);
 const known=gravityRun({id:'known'});assert.deepEqual(discoverIntegral([known]).options.terms,[...DEFAULT_TERMS]);
 const rows=known.samples.slice(0,50).map((r,i)=>({command:0,position:r.position,rate:i*.01,jointTorque:-Math.sin(r.position)}));
 assert.deepEqual(discover(rows).options.terms,[...DEFAULT_TERMS]);
 assert.equal(investigateAngleReference(b,{offsets:[0]}).libraryBaseline,undefined);
});
test('cubic executes with correct sign and units through shared torque and angular integral paths',()=>{
 assert.equal(predict({schema:'worldlaw.torque-model/v1',terms:[{id:'cubic',coefficient:-2}]},{command:0,position:-3,rate:0}),54);
 const b=bundle(),r=discoverAngular(b.trainingRuns,{terms:['rate','gravity','cubic'],noiseSigma:.001});
 assert.ok(r.selected.terms.some(t=>t.id==='cubic'));
 assert.ok(rolloutAngular(r.selected,b.challengeRuns[0]).metrics.positionRMSE<.01);
 const invalid=structuredClone(r.selected);invalid.terms.find(t=>t.id==='cubic').coefficientUnit='N·m/rad³';
 assert.throws(()=>rolloutAngular(invalid,b.challengeRuns[0]),/units/);
});
test('both library winners remain training-only and input-only reopen recomputes ablation',()=>{
 const b=bundle(),r=investigateAngleReference(b,settings);
 b.challengeRuns[0].samples.slice(1).forEach((s,i)=>s.position+=.3*Math.sin(i));
 const changed=investigateAngleReference(b,settings);
 assert.deepEqual(changed.search,r.search);assert.deepEqual(changed.libraryBaseline,r.libraryBaseline);
 const saved=exportReferenceInvestigation(r);assert.equal(saved.includes('libraryBaseline'),false);
 assert.deepEqual(reopenReferenceInvestigation(saved),r);
});
test('shifted cubic is tested only in its declared coordinate and recovers a supported offset',()=>{
 const r=investigateAngleReference(bundle({offset:.15}),settings);
 assert.equal(r.search.selected.offset,.15);assert.equal(r.search.selected.model.id,'rate+gravity+cubic');
 assert.ok(r.comparisons[0].selected.rollout.metrics.positionRMSE<.000001);
});
test('small motions retain competing explanations rather than certifying cubic',()=>{
 const runs=[make('small',.03,{sigma:.001}),make('small2',-.025,{sigma:.001})];
 const r=discoverAngularWeak(runs,{terms:settings.fit.terms,noiseSigma:.001});
 assert.ok(r.competitive.length>1||r.diagnostics.identifiability!=='finite_library_local_only');
});
test('adding cubic cannot silently repair an unsupported forcing law',()=>{
 const b=bundle();for(const run of b.trainingRuns)run.samples.forEach(s=>{s.position+=.2*Math.sin(7*s.time);});
 const r=discoverAngularWeak(b.trainingRuns,settings.fit);
 assert.equal(r.diagnostics.adequacy,'residual_mismatch');
});
