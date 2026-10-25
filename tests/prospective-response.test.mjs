import test from 'node:test';
import assert from 'node:assert/strict';
import {prospectiveResponse} from '../src/science/prospective-response.mjs';
import {fitLinearColumns} from '../src/science/linear-fit.mjs';
import {TERMS,predict} from '../src/science/torque-discovery.mjs';
const terms=['command','spring','bias'];
const training=Array.from({length:17},(_,i)=>({command:(i-8)/4,position:(i-8)/8,rate:0}));
const offers=[{command:1,position:.5,rate:0},{command:1,position:.49999,rate:0},{command:1,position:0,rate:0}];
const queries=[{command:-.7,position:.25,rate:0},{command:2,position:-.3,rate:0}];
test('rank gain does not conceal amplification; complete attaining witnesses refit',()=>{
 const r=prospectiveResponse(training,offers,queries,terms,.01);assert.equal(r.offers[0].status,'rank-unavailable');assert.ok(r.offers[1].maxHalfWidth>1000*r.offers[2].maxHalfWidth);
 for(const offer of r.offers.filter(o=>o.status==='computed'))for(const query of offer.queries){const rows=[...training,offer.input],columns=[rows.map(p=>p.command),rows.map(p=>p.position),rows.map(()=>1)];const fit=fitLinearColumns(columns,query.upperWitnessOffsets);const actual=fit.coefficients[0]*query.input.command+fit.coefficients[1]*query.input.position+fit.coefficients[2];assert.ok(Math.abs(actual-query.halfWidth)<1e-9);assert.equal(query.weights.length,18);}
});
test('original/receiving torque changes cannot alter prospective response',()=>{
 const a=prospectiveResponse(training,offers,queries,terms,.01),b=prospectiveResponse(training.map((p,i)=>({...p,jointTorque:100*i})),offers.map(p=>({...p,jointTorque:NaN})),queries.map(p=>({...p,jointTorque:Infinity})),terms,.01);assert.deepEqual(a,b);
});
test('complete size budget and malformed declarations refuse without partial claims',()=>{
 const rows=Array.from({length:255},(_,i)=>({...training[i%17]}));const r=prospectiveResponse(rows,Array.from({length:32},()=>offers[2]),queries,terms,.01);assert.equal(r.status,'work-limit');assert.deepEqual(r.offers,[]);
 assert.throws(()=>prospectiveResponse(training,[{}],queries,terms,.01));assert.throws(()=>prospectiveResponse(training,offers,queries,terms,-1));assert.throws(()=>prospectiveResponse(training,offers,queries,['command','command'],.01));
});
test('input order covariance and zero-radius hypothesis remain explicit',()=>{
 const forward=prospectiveResponse(training,[offers[2]],queries,terms,.01),reverse=prospectiveResponse([...training].reverse(),[offers[2]],queries,terms,.01);
 for(let j=0;j<queries.length;j++)assert.ok(Math.abs(forward.offers[0].queries[j].halfWidth-reverse.offers[0].queries[j].halfWidth)<1e-12);
 const zero=prospectiveResponse(training,[offers[2]],queries,terms,0);assert.ok(zero.offers[0].queries.every(q=>q.halfWidth===0));
 // A wrong physical basis could still miss every query at zero declared noise;
 // there is deliberately no receiving-adequacy status or invented center.
 assert.ok(zero.offers[0].queries.every(q=>!('prediction' in q)&&!('observedTorque' in q)));
});

test('complete current optional basis retains evaluator-owned features',()=>{
 const rows=Array.from({length:40},(_,i)=>({command:Math.sin(i*1.31)*2,position:Math.cos(i*.71)*2,rate:Math.sin(i*.43)*3}));
 const offer={command:.23,position:-.83,rate:1.14},query={command:-.43,position:.37,rate:-.91};
 const allTerms=TERMS.map(t=>t.id),result=prospectiveResponse(rows,[offer],[query],allTerms,.01);
 assert.equal(result.offers[0].status,'computed');
 const witness=result.offers[0].queries[0],course=[...rows,offer];
 const columns=allTerms.map(id=>course.map(p=>predict({schema:'worldlaw.torque-model/v1',terms:[{id,coefficient:1}]},p)));
 const fitted=fitLinearColumns(columns,witness.upperWitnessOffsets);
 const actual=predict({schema:'worldlaw.torque-model/v1',terms:allTerms.map((id,i)=>({id,coefficient:fitted.coefficients[i]}))},query);
 assert.ok(Math.abs(actual-witness.halfWidth)<1e-11);assert.equal(witness.weights.length,41);
});
