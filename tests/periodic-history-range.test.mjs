import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {boundPeriodicHistory,checkRangeQuery} from '../src/unknown-lab/periodic-history-range.mjs';
const bracketHistory=(course,options={})=>boundPeriodicHistory({schema:'worldlaw.periodic-history-range/v1',course,settings:{resolution:.001,maxQueries:32,maxProducts:16777216,...options}});
import {checkFixedPeriodicHistory,searchFixedPeriodicHistory} from '../src/unknown-lab/periodic-course.mjs';
function source(orderStrategy){
 const notebook=syntheticChallenge({orderStrategy});delete notebook.simulation;
 for(const t of notebook.trials)t.jointTorque=(t.history==='conditioned'?.25:0)+.04*t.sampleIndex+.3*Math.sin(Math.PI*t.sampleIndex/2);
 notebook.sourceNote='Authored exact arithmetic-model control, no physical acquisition.';
 return {schema:'worldlaw.periodic-course/v1',boundUnits:{history:'N*m',drift:'N*m/acquisition_step',pair:'N*m'},evidence:{schema:'worldlaw.periodic-contrast/v1',notebook,sourceNote:'Authored period4 bound',periodUnit:'acquisition_steps',amplitudeUnit:'N*m',components:[{period:4,amplitudeBound:.3}]},historyBound:.8,driftBound:.1,pairRadius:.01,discrepancyBasis:'Authored total pair bound'};
}
test('alternating alias retains analytic broad interval and explicitly reaches prior edge',()=>{
 const raw=source('alternating'),before=JSON.stringify(raw),r=bracketHistory(raw),truth=.55-.3*Math.SQRT2-.01;
 assert.equal(r.status,'bracketed');assert.ok(r.outer[0]<=truth&&r.inner[0]>=truth);assert.ok(r.inner[0]-r.outer[0]<=.001);
 assert.equal(r.inner[1],.8);assert.equal(r.sides[1].reason,'prior-bound-compatible');assert.equal(JSON.stringify(raw),before);
});
test('shuffled pattern narrows to analytical history interval; certificates recheck against original observations',()=>{
 const raw=source('shuffled'),r=bracketHistory(raw);assert.equal(r.status,'bracketed');
 assert.ok(r.outer[0]<=.24&&r.inner[0]>=.24);assert.ok(r.inner[1]<=.26&&r.outer[1]>=.26);
 for(const q of r.queries)if(q.certificate){assert.equal(checkRangeQuery(r.inputs,q).status,q.status);assert.throws(()=>checkRangeQuery(r.inputs,{...q,offset:q.offset+.00001}));}
 const left=r.sides[0].witness.certificate,right=r.sides[1].witness.certificate,values=left.values.map((v,i)=>(v+right.values[i])/2),fixed=values[0];
 const key=JSON.parse(left.sourceKey);key.fixedHistory=fixed;
 assert.equal(checkFixedPeriodicHistory(key.inputs,fixed,{...left,sourceKey:JSON.stringify(key),values}).status,'verified-course-witness');
});
test('rejected whole course returns no invented offset range',()=>{
 const raw=source('alternating');raw.evidence.notebook.trials[1].jointTorque+=.08;raw.evidence.notebook.trials[5].jointTorque-=.08;
 const r=bracketHistory(raw);assert.equal(r.status,'incompatible-course');assert.equal(r.inner,null);
});
test('query exhaustion retains conservative original-prior outer bounds',()=>{
 const r=bracketHistory(source('shuffled'),{maxQueries:0});assert.equal(r.status,'unresolved-boundary');assert.deepEqual(r.outer,[-.8,.8]);assert.equal(r.queries.length,0);assert.ok(r.inner[0]===r.inner[1]);
});

test('global estimated matrix budget includes initial and fixed searches; invalid range settings refuse',()=>{
 const raw=source('shuffled');
 const r=bracketHistory(raw,{maxProducts:1024});assert.ok(r.products<=1024);
 if(r.queries)assert.equal(r.products,r.initial.products+r.queries.reduce((s,q)=>s+q.products,0));
 assert.equal(bracketHistory(raw,{maxProducts:0}).status,'unresolved-initial-search');
 for(const options of [{maxQueries:-1},{maxQueries:65},{resolution:NaN},{resolution:0},{maxProducts:Infinity}])assert.throws(()=>bracketHistory(raw,options));
});

test('range replay retains exact original source and rejects nonconvex/unknown family declarations',()=>{
 const raw={schema:'worldlaw.periodic-history-range/v1',course:source('shuffled'),settings:{resolution:.001,maxQueries:32,maxProducts:16777216}};
 const before=JSON.stringify(raw),r=boundPeriodicHistory(raw);assert.equal(JSON.stringify(raw),before);assert.deepEqual(boundPeriodicHistory(JSON.parse(JSON.stringify(r.inputs))),r);
 const band=structuredClone(raw);band.course.evidence.components[0].band=[3.8,4.2];assert.throws(()=>boundPeriodicHistory(band),/fixed-period/);
 const moved=structuredClone(r.inputs);moved.course.evidence.notebook.trials[0].jointTorque+=.01;const q=r.queries.find(q=>q.certificate);assert.throws(()=>checkRangeQuery(moved,q),/changed/);
 for(const value of [null,undefined,NaN,'0',.9])assert.throws(()=>searchFixedPeriodicHistory(raw.course,value));
});
test('negative fixed-offset support keeps its sign and brackets the independent interval',()=>{
 const raw=source('shuffled');raw.driftBound=0;raw.evidence.components[0].amplitudeBound=0;
 for(const t of raw.evidence.notebook.trials)t.jointTorque=t.history==='conditioned'?-.25:0;
 const r=bracketHistory(raw);assert.equal(r.status,'bracketed');
 assert.ok(r.outer[0]<=-.26&&r.inner[0]>=-.26);assert.ok(r.inner[1]<=-.24&&r.outer[1]>=-.24);
 assert.ok(r.sides[0].separator.check.historySupport<0);assert.ok(r.sides[0].separator.check.gap>r.sides[0].separator.check.numericalTolerance);
 assert.equal(checkRangeQuery(r.inputs,r.queries.find(q=>q.side==='lower'&&q.status==='verified-course-separation')).status,'verified-course-separation');
});
