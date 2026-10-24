import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticChallenge} from '../src/unknown-lab/paired-history.mjs';
import {searchPeriodicCourse as search,checkPeriodicCourse as check,comparePeriodicCourses as compare} from '../src/unknown-lab/periodic-course.mjs';
const fixture=(options={})=>({schema:'worldlaw.periodic-course/v1',boundUnits:{history:'N*m',drift:'N*m/acquisition_step',pair:'N*m'},
 evidence:{schema:'worldlaw.periodic-contrast/v1',notebook:syntheticChallenge({effect:0,cycleDriftAmplitude:.3,orderStrategy:'alternating',noiseSigma:1e-8,...options}),sourceNote:'Authored common sensor family',periodUnit:'acquisition_steps',amplitudeUnit:'N*m',components:[{period:4,amplitudeBound:.3}]},historyBound:.5,driftBound:.1,pairRadius:.01,discrepancyBasis:'Explicit total pair-difference error bound; not inferred from sigma'});
const breakPattern=raw=>{raw.evidence.notebook.trials[1].jointTorque+=.08;raw.evidence.notebook.trials[5].jointTorque-=.08;return raw;};

test('aggregate-compatible readings can contradict every complete shared parameter vector',()=>{
 const raw=breakPattern(fixture()),before=JSON.stringify(raw),r=compare(raw);
 assert.equal(r.aggregate.status,'artifact-sensitive-or-unresolved');
 assert.equal(r.zero.status,'verified-course-separation');assert.equal(r.constant.status,'verified-course-separation');
 assert.ok(r.constant.check.gap>r.constant.check.numericalTolerance);
 assert.deepEqual(check(raw,r.constant.certificate),r.constant.check);assert.equal(JSON.stringify(raw),before);
 assert.deepEqual(compare(JSON.parse(JSON.stringify(r.inputs))),r);
});
test('compatible rank-deficient witness does not identify sensor phase or preparation offset',()=>{
 const raw=fixture(),r=compare(raw);assert.equal(r.zero.status,'verified-course-witness');assert.equal(r.constant.status,'verified-course-witness');
 assert.ok(r.constant.rank<r.constant.activeColumns);assert.equal(r.zero.activeColumns,3);
 const changed=fixture({effect:.7,cycleDriftAmplitude:.1,orderStrategy:'shuffled'});changed.evidence.components[0].amplitudeBound=.15;changed.historyBound=.8;
 const revised=compare(changed);assert.equal(revised.zero.status,'verified-course-separation');assert.equal(revised.constant.status,'verified-course-witness');
});
test('dual support independently agrees with endpoint sums and its extremizing parameters',()=>{
 const raw=breakPattern(fixture());raw.evidence.components.push({period:7.1,amplitudeBound:.01});
 const r=search(raw),v=r.certificate.values,trials=raw.evidence.notebook.trials;assert.equal(r.status,'verified-course-separation');
 let y=0,H=0,D=0,E=0;const phasors=raw.evidence.components.map(()=>[0,0]);
 for(let i=0;i<v.length;i++){
  const ref=trials[2*i],c=trials[2*i+1];y+=v[i]*(c.jointTorque-ref.jointTorque);H+=v[i];D+=v[i]*(c.sampleIndex-ref.sampleIndex);E+=Math.abs(v[i])*raw.pairRadius;
  raw.evidence.components.forEach((k,j)=>{for(const [t,sign]of [[ref,-1],[c,1]]){const angle=2*Math.PI*t.sampleIndex/k.period;phasors[j][0]+=v[i]*sign*Math.cos(angle);phasors[j][1]+=v[i]*sign*Math.sin(angle);}});
 }
 const support=raw.historyBound*Math.abs(H)+raw.driftBound*Math.abs(D)+E+phasors.reduce((s,[a,b],j)=>s+raw.evidence.components[j].amplitudeBound*Math.hypot(a,b),0);
 assert.ok(Math.abs((y-support)-r.check.gap)<1e-12);
 assert.ok(r.check.uncancelledBound>r.check.artifactSupport);
});
test('64 feasible authored courses receive independently checked coefficients without false separators',()=>{
 let seed=81;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(let k=0;k<64;k++){
  const raw=fixture({orderStrategy:k%2?'shuffled':'alternating'}),period=[4,4.2,7.1,9][k%4],h=(random()-.5)*.4,d=(random()-.5)*.04,phase=random()*Math.PI*2,A=random()*.3;
  raw.evidence.components[0].period=period;delete raw.evidence.notebook.simulation;
  const ts=raw.evidence.notebook.trials;
  for(let i=0;i<16;i++)for(const t of ts.slice(2*i,2*i+2))t.jointTorque=Math.sin(i)+(t.history==='conditioned'?h:0)+d*t.sampleIndex+A*Math.cos(2*Math.PI*t.sampleIndex/period+phase)+(random()-.5)*.002;
  const r=search(raw);assert.equal(r.status,'verified-course-witness');const [H,D,a,b]=r.certificate.values;
  for(let i=0;i<16;i++){const ref=ts[2*i],c=ts[2*i+1],f=t=>D*t.sampleIndex+a*Math.cos(2*Math.PI*t.sampleIndex/period)+b*Math.sin(2*Math.PI*t.sampleIndex/period);assert.ok(Math.abs(c.jointTorque-ref.jointTorque-H-f(c)+f(ref))<raw.pairRadius);}
 }
});
test('changed source/bounds or forged certificates refuse; zero budget is unresolved',()=>{
 const raw=fixture(),r=search(raw);
 for(const edit of [x=>x.pairRadius*=2,x=>x.historyBound*=2,x=>x.evidence.notebook.trials[0].jointTorque+=.001,x=>x.evidence.components[0].period+=.1]){const changed=structuredClone(raw);edit(changed);assert.throws(()=>check(changed,r.certificate),/changed/);}
 const forged=structuredClone(r.certificate);forged.values[2]=1;assert.throws(()=>check(raw,forged),/disk/);
 forged.values=Array(r.certificate.values.length);assert.throws(()=>check(raw,forged),/dense/);
 assert.equal(search(raw,{maxIterations:0}).status,'unresolved');assert.equal(search(raw,{maxProducts:0}).reason,'product-budget');
 const contact=fixture({effect:0,cycleDriftAmplitude:0});contact.historyBound=contact.driftBound=contact.evidence.components[0].amplitudeBound=0;contact.pairRadius=0;
 // Neither a zero-radius contact nor a rank diagnostic grants compatibility.
 const out=search(contact);assert.notEqual(out.status,'verified-course-witness');
});
test('malformed units, limits and family data fail before searching',()=>{
 for(const edit of [x=>x.schema='wrong',x=>x.boundUnits.drift='N*m/s',x=>x.pairRadius=-1,x=>x.historyBound=NaN,x=>x.driftBound=1001,x=>x.discrepancyBasis=' ',x=>x.evidence.components=Array(2)]){const raw=fixture();edit(raw);assert.throws(()=>search(raw));}
 for(const o of [{maxIterations:-1},{maxIterations:4097},{maxProducts:Infinity}])assert.throws(()=>search(fixture(),o));
});
