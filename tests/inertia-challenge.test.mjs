import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeInertia,readInertiaChallenge,exportInertiaChallenge} from '../src/coupling/inertia-challenge.mjs';
import {identifyInertia} from '../src/coupling/inertia-identification.mjs';
import {prepareInertiaWeakComparison} from '../src/coupling/inertia-weak.mjs';
import {createInertiaExample,analyticInertiaMotion} from '../src/coupling/inertia-example.mjs';
import {createInertiaCounterexample} from '../src/coupling/inertia-counterexample.mjs';

const fitSettings={windowSamples:81,stride:40};
const settings={...fitSettings,toleranceNm:[0.001,0.001],correspondence:'Authored controls use the same angle order, signs, units and stated force convention; no physical acquisition.'};
const training=record=>({record,settings:fitSettings});
function positive(){
 const record=createInertiaExample();record.source.label='Separate authored initial state';record.courses[0].id='separate-start';
 record.courses[0].rows=record.courses[0].rows.map(({time})=>{const r=analyticInertiaMotion(time,[-.32,.8],[.1,-.2]);return {time,position:r.position,torque:r.position.map(q=>-2*q)};});
 return record;
}
function omitted(){
 const record=createInertiaCounterexample();record.source.label='Changed-frequency authored actuator record';record.courses[0].id='changed-frequency';
 record.courses[0].rows=record.courses[0].rows.map(({time:t})=>{
  const q=[Math.sin(2*t+.31),Math.cos(t-.27)],v=[2*Math.cos(2*t+.31),-Math.sin(t-.27)],a=[-4*q[0],-q[1]];
  return {time:t,position:q,torque:[2*a[0]+.3*a[1]+.2*v[0]+.5*q[0],.3*a[0]+1.5*a[1]+.4*v[1]+.8*q[1]]};
 });return record;
}
function weightedContinuous(f,a,b){
 const n=1024,h=1/n;let sum=0;
 for(let i=0;i<=n;i++){const u=i*h;sum+=(i===0||i===n?1:i%2?4:2)*30*u*u*(1-u)*(1-u)*f(a+(b-a)*u);}
 return sum*h/3;
}

test('separate motion passes the frozen law and changed challenge torques cannot refit training',()=>{
 const source=createInertiaExample(),next=positive(),before=JSON.stringify({source,next,settings}),result=challengeInertia(training(source),next,settings);
 assert.equal(result.primary.status,'within_declared_tolerance');assert.ok(result.primary.rmseNm<1e-6);
 assert.deepEqual(result.training,identifyInertia(source,fitSettings));assert.equal(result.diagnostics.challengeFitted,false);
 const changed=structuredClone(next);for(const r of changed.courses[0].rows)r.torque[0]+=.03;
 const failed=challengeInertia(training(source),changed,settings);assert.equal(failed.primary.status,'exceeds_declared_tolerance');
 assert.deepEqual(failed.training,result.training);assert.deepEqual(failed.coefficients,result.coefficients);
 assert.equal(JSON.stringify({source,next,settings}),before);
});

test('changed frequencies expose the hidden restoring force using independent continuous residuals',()=>{
 const result=challengeInertia(training(createInertiaCounterexample()),omitted(),settings);
 assert.ok(result.training.primary.meanTorqueBalanceRmse<1e-7);assert.equal(result.training.primary.rank,5);
 assert.ok(Math.abs(result.coefficients[0]-1.5)<1e-6);assert.ok(Math.abs(result.coefficients[2]-1.3)<1e-6);
 assert.equal(result.primary.status,'exceeds_declared_tolerance');assert.ok(Math.abs(result.primary.rmseNm-.8141494179519615)<1e-9);
 let maximum=0;
 for(const r of result.primary.rows){const f=r.axis===0?t=>-1.5*Math.sin(2*t+.31):t=>.6*Math.cos(t-.27);maximum=Math.max(maximum,Math.abs(r.residual-weightedContinuous(f,r.start,r.end)));}
 assert.ok(maximum<2.8e-5,'PWL source and independent continuous control retain their interpolation difference');
});

test('a challenge need not identify new parameters and coarser rows use the same frozen coefficients',()=>{
 const next=positive();next.courses[0].rows=next.courses[0].rows.map(({time:t})=>({time:t,position:[.3+.2*t,-.7-.4*t],torque:[.04,-.08]}));
 const result=challengeInertia(training(createInertiaExample()),next,settings);
 assert.equal(result.primary.rank,2);assert.equal(result.primary.status,'within_declared_tolerance');
 assert.equal(result.samplingComparison.alternate.rank,2);
 for(const r of result.samplingComparison.alternate.rows){
  assert.equal(r.predictedTorque,r.features.reduce((s,x,j)=>s+x*result.coefficients[j],0));
  assert.equal(r.start,next.courses[0].rows[r.firstRow].time);assert.equal(r.end,next.courses[0].rows[r.lastRow].time);
 }
});

test('relabelled, rebased and subset training blocks cannot pose as separate observations',()=>{
 const source=createInertiaExample(),same=structuredClone(source);
 same.source.label='  '+source.source.label.toUpperCase()+'  ';
 assert.throws(()=>challengeInertia(training(source),same,settings),/distinct source label/);
 same.source.label='Different label';same.courses[0].id='renamed';same.courses[0].rows=same.courses[0].rows.slice(100,201).map(r=>({...r,time:r.time+30}));
 assert.throws(()=>challengeInertia(training(source),same,settings),/five-row/);
});

test('shared unchanged rest values do not reject otherwise different motion, while complete reused courses refuse',()=>{
 const source=createInertiaExample(),next=positive();
 const rest=n=>Array.from({length:n},(_,i)=>({time:i/100,position:[0,0],torque:[0,0]}));
 source.courses.push({id:'initial-rest-reference',rows:rest(81)});next.courses.push({id:'initial-rest-challenge',rows:rest(82)});
 assert.equal(challengeInertia(training(source),next,settings).primary.status,'within_declared_tolerance');
 next.courses[1].rows=rest(81);assert.throws(()=>challengeInertia(training(source),next,settings),/complete challenge course/);
});

test('input-only replay recomputes; unsupported fields, declarations, units and accessors refuse',()=>{
 const input=readInertiaChallenge(exportInertiaChallenge(training(createInertiaExample()),positive(),settings));
 assert.deepEqual(Object.keys(input).sort(),['challenge','schema','settings','training']);
 assert.deepEqual(challengeInertia(input.training,input.challenge,input.settings),challengeInertia(training(createInertiaExample()),positive(),settings));
 assert.throws(()=>readInertiaChallenge({...input,coefficients:[1,0,1,0,0]}),/unsupported fields/);
 assert.throws(()=>challengeInertia(input.training,input.challenge,{...settings,toleranceNm:['0.1',.1]}),/must be numbers/);
 assert.throws(()=>challengeInertia(input.training,input.challenge,{...settings,correspondence:' '}),/Declare how/);
 const bad=structuredClone(input);bad.challenge.units.position='deg';assert.throws(()=>readInertiaChallenge(bad),/Expected exact units/);
 let called=false;const getter={...input};Object.defineProperty(getter,'training',{get(){called=true;throw Error('must not execute');},enumerable:true});
 assert.throws(()=>readInertiaChallenge(getter),/accessors/);assert.equal(called,false);
 const hidden=structuredClone(input);Object.defineProperty(hidden.training.settings,'savedRank',{value:5});
 assert.throws(()=>readInertiaChallenge(hidden),/unsupported fields/);
 const symbol=structuredClone(input);symbol.training.settings[Symbol('savedFit')]=true;
 assert.throws(()=>readInertiaChallenge(symbol),/unsupported fields/);
 const exotic=structuredClone(input);Object.setPrototypeOf(exotic.training.settings,{impliedModel:true});
 assert.throws(()=>readInertiaChallenge(exotic),/plain input object/);
});

test('complete combined quadrature work is refused before fitting either source',()=>{
 const source=createInertiaExample(),next=positive(),wide={windowSamples:401,stride:2};
 source.courses[0].rows=source.courses[0].rows.slice(0,601);next.courses[0].rows=next.courses[0].rows.slice(0,601);
 assert.equal(prepareInertiaWeakComparison(source,wide).reservedSegments,60600);
 assert.equal(prepareInertiaWeakComparison(next,wide).reservedSegments,60600);
 assert.throws(()=>challengeInertia({record:source,settings:wide},next,{...settings,...wide}),/complete training and separate-source comparison/);
});

test('unidentified and unsupported frozen fits are retained as refusals rather than coerced into a law',()=>{
 const source=createInertiaExample();for(const row of source.courses[0].rows)row.torque=row.torque.map(x=>-x);
 assert.throws(()=>challengeInertia(training(source),positive(),settings),/supported positive-definite inertia/);
 const affine=createInertiaExample();for(const row of affine.courses[0].rows)row.position=[row.time,2*row.time];
 assert.throws(()=>challengeInertia(training(affine),positive(),settings),/supported positive-definite inertia/);
});
