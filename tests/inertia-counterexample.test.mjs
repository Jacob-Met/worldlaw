import test from 'node:test';
import assert from 'node:assert/strict';
import {createInertiaCounterexample} from '../src/coupling/inertia-counterexample.mjs';
import {identifyInertia} from '../src/coupling/inertia-identification.mjs';
import {readInertiaRecord} from '../src/coupling/inertia-record.mjs';

test('omitted restoring torque yields a convincing wrong inertia; restoring the missing RHS recovers authored truth',()=>{
 const record=createInertiaCounterexample(),original=JSON.stringify(record);
 assert.equal(record.courses[0].rows.length,801);
 assert.deepEqual(readInertiaRecord(original),record);
 assert.match(record.torqueDeclaration,/NOT the complete right-hand side/);
 const result=identifyInertia(record),effective=[1.5,.3,1.3,.2,.4];
 assert.equal(result.primary.status,'candidate');
 assert.equal(result.primary.rank,5);
 result.primary.coefficients.forEach((value,i)=>assert.ok(Math.abs(value-effective[i])<1e-4));
 assert.ok(result.primary.meanTorqueBalanceRmse<1e-6);
 assert.ok(Math.max(...result.samplingComparison.absoluteCoefficientDifferences)<1e-4);
 assert.ok(Math.abs(result.primary.coefficients[0]-2)>.49);
 assert.ok(Math.abs(result.primary.coefficients[2]-1.5)>.19);
 // Independent causal control: include the omitted physical spring contribution.
 const corrected=structuredClone(record);
 corrected.torqueDeclaration='Authored complete RHS: actuator torque plus restoring torque -diag(0.5,0.8) q; modeled viscous loss remains on the left.';
 for(const row of corrected.courses[0].rows){row.torque[0]-=.5*row.position[0];row.torque[1]-=.8*row.position[1];}
 const recovered=identifyInertia(corrected),truth=[2,.3,1.5,.2,.4];
 assert.equal(recovered.primary.status,'candidate');
 recovered.primary.coefficients.forEach((value,i)=>assert.ok(Math.abs(value-truth[i])<1e-4));
 assert.equal(JSON.stringify(record),original);
 assert.deepEqual(createInertiaCounterexample(),record);
});
