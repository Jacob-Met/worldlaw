import test from 'node:test';import assert from 'node:assert/strict';
import {identifyInertia} from '../src/coupling/inertia-identification.mjs';
import {createInertiaExample,analyticInertiaMotion} from '../src/coupling/inertia-example.mjs';
import {compareCoupledDynamics,defaultDynamicsInputs,MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION} from '../src/coupling/dynamics.mjs';
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('analytic motion and torque identify the offered matrix and challenge a different start through maintained solver',()=>{
 const record=createInertiaExample(),before=JSON.stringify(record),result=identifyInertia(record),p=result.primary;
 assert.equal(p.status,'candidate');p.coefficients.forEach((x,i)=>near(x,[1.4,.4,1.4,.2,.2][i]));
 assert.equal(p.rank,5);assert.ok(p.meanTorqueBalanceRmse<1e-8);assert.equal(JSON.stringify(record),before);
 assert.equal(result.samplingComparison.alternate.status,'candidate');assert.ok(Math.max(...result.samplingComparison.absoluteCoefficientDifferences)<1e-5);
 const model={schema:'worldlaw.coupled-torque-model/v1',id:'independent',matrix:[[-2,0],[0,-2]],bias:[0,0]};
 const inputs={...defaultDynamicsInputs(),schema:MATRIX_INPUT_SCHEMA,interpretation:MATRIX_INTERPRETATION,...p.simulationParameters,initialPosition:[-.2,.9],initialRate:[.1,-.2],duration:6,samples:301,maxStep:.002};
 const forecast=compareCoupledDynamics([model],inputs).results[0];assert.equal(forecast.status,'screened');
 for(const row of forecast.refined.rows){const expected=analyticInertiaMotion(row.time,inputs.initialPosition,inputs.initialRate);row.position.forEach((x,i)=>near(x,expected.position[i],1e-6));}
});
test('constant and affine source motion have no spurious inertial excitation after roundoff suppression',()=>{
 for(const rate of [[0,0],[.3,-.7]]){
  const record=createInertiaExample();record.courses[0].rows=record.courses[0].rows.map(r=>({...r,position:[1000+rate[0]*r.time,-700+rate[1]*r.time],torque:rate.map(v=>.2*v)}));
  const p=identifyInertia(record).primary;assert.equal(p.status,'unidentified');assert.equal(p.rank,rate[0]===0?0:2);assert.ok(p.roundoffSuppressedFeatures>0);
 }
});
test('single-mode and negated force preserve nonidentification and invalid physical coefficients',()=>{
 const single=createInertiaExample();single.courses[0].rows.forEach(r=>{r.position[1]=r.position[0];r.torque[1]=r.torque[0];});
 assert.equal(identifyInertia(single).primary.status,'unidentified');
 const wrong=createInertiaExample();wrong.courses[0].rows.forEach(r=>r.torque=r.torque.map(x=>-x));
 const p=identifyInertia(wrong).primary;assert.equal(p.status,'outside_supported_family');assert.equal(p.simulationParameters,null);assert.ok(p.coefficients);
});
test('irregular retained clocks and translated coordinates retain supported coefficients and source endpoints',()=>{
 const record=createInertiaExample();record.courses[0].rows=record.courses[0].rows.filter((_,i)=>i%7!==3);
 const original=identifyInertia(record,{windowSamples:61,stride:30});
 for(const r of record.courses[0].rows){r.time+=123;r.position[0]+=70;r.position[1]-=90;}
 const changed=identifyInertia(record,{windowSamples:61,stride:30});
 changed.primary.coefficients.forEach((x,i)=>near(x,original.primary.coefficients[i],1e-8));
 assert.equal(changed.primary.rows.at(-1).lastRow,record.courses[0].rows.length-1);
 assert.equal(changed.samplingComparison.alternate.rows.at(-1).lastRow,record.courses[0].rows.length-1);
});
test('the full calculation refuses its work boundary before fitting and JSON source replay recomputes',()=>{
 const record=createInertiaExample(),replay=identifyInertia(JSON.stringify(record));assert.deepEqual(replay,identifyInertia(record));
 for(const options of [{windowSamples:4},{windowSamples:402},{stride:0},{stride:81},{windowSamples:901}])assert.throws(()=>identifyInertia(record,options));
 const long=createInertiaExample();long.courses[0].rows=Array.from({length:6000},(_,i)=>({time:i/100,position:[Math.sin(i/100),Math.cos(i/100)],torque:[1,2]}));
 assert.throws(()=>identifyInertia(long,{windowSamples:401,stride:1}),/complete.*quadrature/);
});
