import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectScalarExcitation} from '../src/science/excitation-design.mjs';
import {discover,predict} from '../src/science/torque-discovery.mjs';
const terms=['command','spring','bias'];
const training=Array.from({length:17},(_,i)=>{const position=(i-8)/8,command=2*position;return {command,position,rate:0,jointTorque:0.2+1.2*command-3*position};});
const offered=[{command:1,position:.5,rate:0},{command:1,position:0,rate:0}];
test('a separate input resolves command/position confounding and the actual fitter receives the reading',()=>{
 const before=discover(training,{terms,maxTerms:3});
 assert.equal(before.candidates.some(m=>m.terms.length===3),false);
 const result=inspectScalarExcitation(training,offered,terms);
 assert.equal(result.rank,2);assert.deepEqual(result.results.map(r=>r.gain),[0,1]);assert.equal(result.selected.index,1);
 const next=discover([...training,{...offered[1],jointTorque:1.4}],{terms,maxTerms:3});
 const full=next.candidates.find(m=>m.terms.length===3);assert.ok(full);
 for(const point of [{command:-.7,position:.25,rate:0},{command:2,position:-.3,rate:0}])assert.ok(Math.abs(predict(full,point)-(.2+1.2*point.command-3*point.position))<1e-12);
});
test('responses are absent from planning and wrong receiving remains a failed law',()=>{
 const a=inspectScalarExcitation(training,offered,terms),b=inspectScalarExcitation(training.map(r=>({...r,jointTorque:NaN})),offered,terms);assert.deepEqual(a,b);
 const wrong=discover([...training,{...offered[1],jointTorque:100}],{terms,maxTerms:3}).candidates.find(m=>m.terms.length===3);
 assert.ok(Math.abs(predict(wrong,{command:-.7,position:.25,rate:0})-(.2+1.2*(-.7)-3*.25))>1);
});
test('no gain, still deficient and full rank are distinct',()=>{
 assert.equal(inspectScalarExcitation(training,[offered[0]],terms).status,'no-rank-gain');
 const partial=inspectScalarExcitation(training,offered,[...terms,'rate']);assert.equal(partial.selected.unresolved,1);
 assert.equal(inspectScalarExcitation([...training,offered[1]],offered,terms).status,'full-rank');
});
test('complete work refused without partial findings and malformed states refuse',()=>{
 const r=inspectScalarExcitation(Array.from({length:4096},()=>training[0]),Array.from({length:128},()=>offered[0]),terms);assert.equal(r.status,'work-limit');assert.deepEqual(r.results,[]);assert.equal(r.selected,null);
 assert.throws(()=>inspectScalarExcitation(training,[{command:1,position:0}],terms));
 assert.throws(()=>inspectScalarExcitation(training,offered,['spring','spring']));
});
