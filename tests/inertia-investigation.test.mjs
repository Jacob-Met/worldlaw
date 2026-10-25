import test from 'node:test';import assert from 'node:assert/strict';
import {createInertiaExample} from '../src/coupling/inertia-example.mjs';
import {identifyInertia} from '../src/coupling/inertia-identification.mjs';
import {readInertiaInvestigation,exportInertiaInvestigation} from '../src/coupling/inertia-investigation.mjs';
test('input-only investigation preserves source and settings and recomputes the weak balance',()=>{
 const record=createInertiaExample(),before=JSON.stringify(record),settings={windowSamples:61,stride:30};
 const text=exportInertiaInvestigation(record,settings),parsed=readInertiaInvestigation(text);
 assert.deepEqual(parsed,{record,settings});assert.deepEqual(identifyInertia(parsed.record,parsed.settings),identifyInertia(record,settings));
 const forged=JSON.parse(text);forged.result={coefficients:[1,0,1,0,0]};assert.throws(()=>readInertiaInvestigation(forged),/unsupported fields/);
 for(const bad of ['61',null,Infinity,4,402])assert.throws(()=>exportInertiaInvestigation(record,{windowSamples:bad,stride:30}));
 assert.equal(JSON.stringify(record),before);assert.deepEqual(readInertiaInvestigation(record).record,record);
 const accessor={};Object.defineProperty(accessor,'schema',{enumerable:true,get(){throw Error('getter executed');}});assert.throws(()=>readInertiaInvestigation(accessor),/ordinary own field/);
});
