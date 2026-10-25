import test from 'node:test';
import assert from 'node:assert/strict';
import {gravityRun} from '../experiments/integral-discovery-92be.mjs';
import {investigateAngleReference, exportReferenceInvestigation, reopenReferenceInvestigation} from '../src/representation/angle-reference.mjs';
import {discoverAngularWeak} from '../src/trajectory/angular-weak.mjs';
import {discoverAngular, DEFAULT_ANGULAR_TERMS, rolloutAngular} from '../src/trajectory/angular-discovery.mjs';
import {DEFAULT_TERMS, predict} from '../src/science/torque-discovery.mjs';
import {inspectInputEnclosures} from '../src/science/input-enclosure.mjs';

export function phaseBundle({phase=.237, cubic=0, position=1.5, sigma=0}={}) {
 const make=(id,p)=>{const r=gravityRun({id,position:p,cubic,sigma,dt:.02});return {...r,inertia:null,dynamics:'unforced_scalar_rotation',samples:r.samples.map(s=>({time:s.time,position:s.position+phase}))};};
 return {schema:'worldlaw.angular-bundle/v1',label:'Independent explicit-equation shifted pendulum',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[make('train-a',position),make('train-b',-position*.86)],challengeRuns:[make('challenge',2.1)]};
}
const settings={offsets:[-.3,-.15,0,.15,.3],phaseComparison:true,fit:{terms:['rate','gravity','bias'],maxTerms:3,noiseSigma:1e-6}};

test('off-grid phase is inferred on original angles and executes on a separate release',()=>{
 for(const phase of [.237,-.173]){
  const b=phaseBundle({phase}),r=investigateAngleReference(b,settings),p=r.phaseComparison;
  assert.equal(p.model.id,'rate+gravity+cosine');
  assert.ok(Math.abs(p.periodicComponent.phase-phase)<1e-6);
  assert.ok(Math.abs(p.periodicComponent.amplitude-2.75)<1e-6);
  assert.ok(r.comparisons[0].phase.rollout.metrics.positionRMSE<1e-6);
  assert.ok(r.comparisons[0].selected.rollout.metrics.positionRMSE>.01);
  assert.deepEqual(r.bundle.trainingRuns[0].samples,b.trainingRuns[0].samples);
  assert.equal(p.model.physicalInertia,null);assert.equal(p.model.absoluteTorqueIdentified,false);
  const old=investigateAngleReference(b,{...settings,phaseComparison:false});
  assert.deepEqual(r.search.selected,old.search.selected);assert.deepEqual(r.consistency,old.consistency);
 }
});
test('defaults and zero-phase control do not force a cosine coefficient',()=>{
 assert.ok(!DEFAULT_TERMS.includes('cosine'));assert.ok(!DEFAULT_ANGULAR_TERMS.includes('cosine'));
 const b=phaseBundle({phase:0}),r=investigateAngleReference(b,settings);
 assert.equal(r.phaseComparison.model.id,'rate+gravity');
 assert.equal(investigateAngleReference(b,{...settings,phaseComparison:false}).phaseComparison,undefined);
 assert.throws(()=>investigateAngleReference(b,{...settings,phaseComparison:'yes'}),/boolean/);
});
test('receiving changes never select either model; input-only replay recomputes',()=>{
 const b=phaseBundle(),r=investigateAngleReference(b,settings);
 b.challengeRuns[0].samples.slice(1).forEach((s,i)=>s.position+=.2*Math.sin(i));
 const changed=investigateAngleReference(b,settings);
 assert.deepEqual(changed.phaseComparison,r.phaseComparison);assert.deepEqual(changed.search,r.search);
 assert.ok(changed.comparisons[0].phase.rollout.metrics.positionRMSE>.1);
 const saved=exportReferenceInvestigation(r);assert.ok(!saved.includes('periodicComponent'));
 assert.deepEqual(reopenReferenceInvestigation(saved),r);
});
test('phase library preserves insufficient excitation and omitted-dynamics evidence',()=>{
 const b=phaseBundle();
 const flat=structuredClone(b.trainingRuns);for(const run of flat)for(const s of run.samples)s.position=.237;
 const fit=discoverAngularWeak(flat,{terms:['gravity','cosine','bias'],noiseSigma:1e-6});
 assert.equal(fit.diagnostics.identifiability,'insufficient_excitation');
 const received=investigateAngleReference({...b,trainingRuns:flat},settings);
 assert.equal(received.phaseComparison.phaseStatus,'insufficient_excitation');
 assert.equal(received.phaseComparison.periodicComponent.phase,null);
 assert.ok(received.search.selected);
 const refused=investigateAngleReference(b,{...settings,solver:{maxStep:.01,maxSteps:1}});
 assert.ok(refused.comparisons[0].phase.error);
 assert.ok(refused.phaseComparison.model);
 assert.ok(refused.search.selected);
 const bad=phaseBundle({cubic:1.2});
 const result=investigateAngleReference(bad,settings);
 assert.equal(result.phaseComparison.fitDiagnostics.adequacy,'residual_mismatch');
 assert.ok(result.comparisons[0].phase.rollout.metrics.positionRMSE>.01);
});
test('cosine has matching integral, forward and bounded-input semantics',()=>{
 const b=phaseBundle(),fit=discoverAngular(b.trainingRuns,{terms:['rate','gravity','cosine'],noiseSigma:1e-5});
 assert.ok(rolloutAngular(fit.selected,b.challengeRuns[0]).metrics.positionRMSE<.01);
 const model={schema:'worldlaw.torque-model/v1',terms:[{id:'cosine',coefficient:2},{id:'gravity',coefficient:-3}]};
 assert.equal(predict(model,{command:0,rate:0,position:0}),2);
 for(const position of [-3,-1,0,1,3]){
  const rows=[{position,command:0,rate:0,jointTorque:0}];
  for(const refinementSegments of [0,16]){
   const bound=inspectInputEnclosures(model,rows,{position:.4,rate:0,command:0,jointTorque:0},{refinementSegments}).rows[0].prediction;
   for(let i=0;i<=100;i++){const value=predict(model,{command:0,rate:0,position:position-.4+.008*i});assert.ok(value>=bound[0]&&value<=bound[1]);}
  }
 }
});
