import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVelocityStudy,readVelocityStudy,exportVelocityStudy} from '../src/coupling/velocity-comparison.mjs';
import {createVelocityExample} from '../src/coupling/velocity-example.mjs';
import {prepareInertiaWeakComparison} from '../src/coupling/inertia-weak.mjs';
import {viscousLegacyRecord} from '../src/coupling/viscous-comparison.mjs';
import {independentVelocityStudy} from './support/velocity-control.mjs';

test('independent coupled inertia and reversed mixed sinusoid recover symmetric loss and skew separately',()=>{
 const input=independentVelocityStudy(),before=JSON.stringify(input),r=compareVelocityStudy(input);
 const wanted=[2.6,-.37,1.4,.55,.8,-.18,-.42];
 assert.equal(r.skew.primary.status,'candidate');assert.equal(r.skew.primary.rank,7);
 r.skew.primary.coefficients.forEach((x,i)=>assert.ok(Math.abs(x-wanted[i])<2e-6,`${i}: ${x}`));
 assert.equal(r.challenge.skew.outside,0);assert.ok(r.challenge.symmetric.outside>0);
 assert.equal(JSON.stringify(input),before);assert.equal(r.diagnostics.automaticallySelectedFamily,null);
 const G=r.skew.primary.skew.matrix,v=[1.3,-.7];
 assert.equal(v[0]*(G[0][0]*v[0]+G[0][1]*v[1])+v[1]*(G[1][0]*v[0]+G[1][1]*v[1]),0);
});

test('uniform one-frequency rank loss and jitter-induced false candidate both remain visible',()=>{
 const uniform=compareVelocityStudy(createVelocityExample('single-uniform'));
 assert.equal(uniform.skew.primary.rank,4);assert.equal(uniform.skew.primary.status,'unidentified');
 assert.equal(uniform.skew.primary.coefficients,null);assert.equal(uniform.challenge.skew.status,'unsupported_training');
 const jitter=compareVelocityStudy(createVelocityExample('single-irregular'));
 assert.equal(jitter.skew.primary.rank,7);assert.equal(jitter.skew.primary.status,'candidate');
 assert.ok(Math.abs(jitter.skew.primary.coefficients[6]-.3)>1);
 assert.equal(jitter.challenge.skew.status,'exceeds_declared_tolerance');
 assert.ok(jitter.challenge.skew.outside>0);assert.equal(jitter.diagnostics.physicalValidity,'not_established');
});

test('zero skew keeps the symmetric and larger family explanations without automatic adoption',()=>{
 const r=compareVelocityStudy(createVelocityExample('no-skew'));
 assert.ok(Math.abs(r.skew.primary.coefficients[6])<2e-5);
 assert.equal(r.challenge.symmetric.status,'within_declared_tolerance');
 assert.equal(r.challenge.skew.status,'within_declared_tolerance');
 assert.equal(r.diagnostics.automaticallySelectedFamily,null);
});

test('held observations and tolerances cannot alter any primary or alternate training fit',()=>{
 const input=independentVelocityStudy(),a=compareVelocityStudy(input),changed=structuredClone(input);
 for(const row of changed.challenge.record.courses[0].rows)row.torque[0]+=1;
 changed.challenge.settings.toleranceNm=[0,0];changed.challenge.record.source.label='Different held torque';
 const b=compareVelocityStudy(changed);
 for(const family of ['diagonal','symmetric','skew'])assert.deepEqual(b[family],a[family]);
 assert.equal(b.challenge.skew.status,'exceeds_declared_tolerance');assert.ok(b.challenge.skew.outside>0);
 assert.equal(b.diagnostics.challengeFitted,false);
});

test('indefinite symmetric loss is refused even with a finite no-work skew coefficient',()=>{
 const r=compareVelocityStudy(independentVelocityStudy({D:[[.1,.7],[.7,.2]],g:-.8}));
 assert.equal(r.skew.primary.status,'outside_supported_family');assert.match(r.skew.primary.refusal,/semidefinite/);
 assert.equal(r.skew.primary.candidateParameters,null);assert.equal(r.challenge.skew.status,'unsupported_training');
 assert.equal(r.challenge.skew.rmseNm,null);
});

test('source-only replay rederives all reports and rejects derived answers or repeated source',()=>{
 const input=independentVelocityStudy(),text=exportVelocityStudy(input),parsed=JSON.parse(text);
 assert.deepEqual(Object.keys(parsed).sort(),['challenge','schema','training']);
 assert.deepEqual(compareVelocityStudy(text),compareVelocityStudy(input));
 parsed.result={coefficients:[1,2,3]};assert.throws(()=>readVelocityStudy(parsed),/unsupported/);
 const repeated=structuredClone(input);repeated.challenge.record=structuredClone(repeated.training.record);
 repeated.challenge.record.source.label='Renamed';
 for(const c of repeated.challenge.record.courses){c.id+='-renamed';for(const row of c.rows)row.time+=100;}
 assert.throws(()=>readVelocityStudy(repeated),/repeats/);
});

test('strict new source admission rejects wrong meaning, units, accessors and sparse original rows',()=>{
 for(const mutate of [x=>x.training.record.schema='worldlaw.coupled-viscous-observations/v1',x=>x.training.record.interpretation='automatic-discovery',x=>x.training.record.units.position='degrees',x=>delete x.training.record.courses[0].rows[3],x=>x.training.record.source.kind='verified']){
  const x=independentVelocityStudy();mutate(x);assert.throws(()=>readVelocityStudy(x));
 }
 const x=independentVelocityStudy();let ran=false;
 Object.defineProperty(x.training.record,'schema',{get(){ran=true;throw Error('executed');}});
 assert.throws(()=>readVelocityStudy(x),/accessors/);assert.equal(ran,false);
});

test('complete work reserves three training quadratures and one shared challenge quadrature',()=>{
 const input=createVelocityExample('single-irregular'),r=compareVelocityStudy(input);
 const t=prepareInertiaWeakComparison(viscousLegacyRecord(input.training.record),input.training.settings);
 const c=prepareInertiaWeakComparison(viscousLegacyRecord(input.challenge.record),input.challenge.settings);
 assert.equal(r.diagnostics.reservedSegments,3*t.reservedSegments+c.reservedSegments);
 for(const side of [input.training,input.challenge])side.settings={...side.settings,windowSamples:101,stride:1};
 const expensive=prepareInertiaWeakComparison(viscousLegacyRecord(input.training.record),input.training.settings);
 assert.ok(expensive.reservedSegments<100000);assert.ok(2*expensive.reservedSegments<100000);
 assert.throws(()=>compareVelocityStudy(input),e=>e.code==='work_limit'&&/complete three-family/.test(e.message));
});
