import test from 'node:test';
import assert from 'node:assert/strict';
import {compareReleaseCourses,proposeViscousReleases,readViscousReleaseStudy,exportViscousReleaseStudy,RELEASE_SCHEMA,defaultReleaseSettings,releaseDynamicsInputs} from '../src/coupling/viscous-release.mjs';
import {createViscousExample} from '../src/coupling/viscous-example.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {compareCoupledDynamics,defaultDynamicsInputs,reserveDynamicsSteps} from '../src/coupling/dynamics.mjs';

const clone=x=>structuredClone(x),close=(a,b,t=2e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
const model=(id,k)=>({schema:'worldlaw.coupled-torque-model/v1',id,matrix:[[-k,0],[0,-k]],bias:[0,0],domain:[{min:-2,max:2},{min:-2,max:2}]});
const families={diagonal:{inertia:[1.7,1.7],inertiaCross:0,damping:[.55,.55]},symmetric:{inertia:[1.7,1.7],inertiaCross:0,damping:[.55,.55],dampingCross:.32}};
const settings=()=>({...defaultReleaseSettings(),duration:3,samples:121,maxStep:.0125});
const fixture=()=>({schema:RELEASE_SCHEMA,response:createCouplingCourse('reciprocal'),viscous:createViscousExample('cross'),settings:defaultReleaseSettings()});

test('complete release ranking matches independently solved symmetric and antisymmetric modes',()=>{
 const models=['independent','reciprocal','directional'].map((id,i)=>model(id,[1.3,.8,2.1][i])),positions=[[1,1],[1,-1],[.5,.5],[0,0]],s=settings();
 const r=compareReleaseCourses(models,families,positions,s);
 function response(k,d,t){const g=d/(2*1.7),w=Math.sqrt(k/1.7-g*g);return Math.exp(-g*t)*(Math.cos(w*t)+g/w*Math.sin(w*t));}
 const expected=positions.map(q=>Math.min(...models.map(m=>{
  const k=-m.matrix[0][0],plus=(q[0]+q[1])/2,minus=(q[0]-q[1])/2;
  return Math.max(...Array.from({length:s.samples},(_,j)=>{const t=j*s.duration/(s.samples-1),d=response(k,.55,t),a=plus*(d-response(k,.87,t)),b=minus*(d-response(k,.23,t));return Math.hypot(a+b,a-b);}));
 })));
 r.releases.forEach((course,i)=>{assert.equal(course.status,'screened');close(course.score,expected[i]);for(const c of course.comparisons)assert.equal(c.curve.length,s.samples);});
 assert.deepEqual(r.rankedIndices,expected.map((_,i)=>i).sort((a,b)=>expected[b]-expected[a]||a-b));
 assert.equal(r.diagnostics.trajectoryCount,24);assert.equal(r.diagnostics.reservedSteps,120*2*3*3*8);
});

function product(a,b){return a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)));}
function exponential(a,t){
 const n=a.length,I=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
 const norm=Math.max(...a.map(row=>row.reduce((sum,x)=>sum+Math.abs(x*t),0))),s=Math.max(0,Math.ceil(Math.log2(norm/.4)));
 const b=a.map(row=>row.map(x=>x*t/2**s));let term=I.map(r=>[...r]),sum=I.map(r=>[...r]);
 for(let k=1;k<=60;k++){term=product(term,b).map(row=>row.map(x=>x/k));sum=sum.map((row,i)=>row.map((x,j)=>x+term[i][j]));if(Math.max(...term.flat().map(Math.abs))<1e-18)break;}
 for(let i=0;i<s;i++)sum=product(sum,sum);return sum;
}
function affine(model,p){
 const[a,c]=p.inertia,b=p.inertiaCross,det=a*c-b*b,inv=[[c/det,-b/det],[-b/det,a/det]],d=[[p.damping[0],p.dampingCross??0],[p.dampingCross??0,p.damping[1]]],k=product(inv,model.matrix),loss=product(inv,d),bias=inv.map(row=>row[0]*model.bias[0]+row[1]*model.bias[1]);
 return [[0,0,1,0,0],[0,0,0,1,0],[...k[0],-loss[0][0],-loss[0][1],bias[0]],[...k[1],-loss[1][0],-loss[1][1],bias[1]],[0,0,0,0,0]];
}
test('unfamiliar unequal cross-inertia courses agree with an independent affine matrix exponential',()=>{
 const m={...model('reciprocal',1),matrix:[[-3,.8],[.8,-2]],bias:[.12,-.08]},f={diagonal:{inertia:[2.7,.6],inertiaCross:-.4,damping:[.25,.55]},symmetric:{inertia:[2.7,.6],inertiaCross:-.4,damping:[.25,.55],dampingCross:-.22}},q=[[.13,-.78],[-.57,.44],[.4,.31]],s={...settings(),maxStep:.005};
 const r=compareReleaseCourses([m],f,q,s),a=affine(m,f.diagonal),b=affine(m,f.symmetric);
 for(const course of r.releases){const state=[...course.position,0,0,1];let maximum=0;for(const row of course.comparisons[0].curve){const ea=exponential(a,row.time),eb=exponential(b,row.time),delta=[0,1].map(i=>state.reduce((sum,v,j)=>sum+(ea[i][j]-eb[i][j])*v,0)),distance=Math.hypot(...delta);close(row.separation,distance,4e-9);maximum=Math.max(maximum,distance);}close(course.score,maximum,4e-9);}
});

test('training-only proposal covers all nine positions and all response laws; raw source replay is deterministic',()=>{
 const input=fixture(),before=JSON.stringify(input),r=proposeViscousReleases(input);
 assert.equal(JSON.stringify(input),before);assert.equal(r.status,'proposed');assert.deepEqual(r.proposedIndices,[0]);
 assert.equal(r.releases.length,9);assert.equal(r.diagnostics.trajectoryCount,54);assert.equal(r.diagnostics.reservedSteps,77760);
 close(r.releases[0].score,.23044117816066148,1e-12);close(r.releases[4].score,.002222587919864059,1e-12);
 assert.equal(r.training.responseModels.length,3);assert.equal(r.training.separateMotionUsed,false);assert.equal(r.training.separateResponseUsed,false);
 const changed=clone(input);changed.response.challenges.forEach(row=>row.torque=row.torque.map(x=>x+100));changed.viscous.challenge.record.courses.forEach(c=>c.rows.forEach(row=>row.torque=row.torque.map(x=>x-77)));
 const other=proposeViscousReleases(changed);assert.deepEqual(other.releases,r.releases);assert.deepEqual(other.training,r.training);
 const text=exportViscousReleaseStudy(input);assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['response','schema','settings','viscous']);assert.ok(!text.includes('proposedIndices'));assert.deepEqual(proposeViscousReleases(text),r);
});

test('zero-cross equivalence and threshold/tie decisions cannot manufacture a discriminating release',()=>{
 const f=clone(families);f.symmetric={...clone(f.diagonal),dampingCross:0};const m=[model('independent',1)],q=[[1,1],[-1,-1],[0,0]];
 const r=compareReleaseCourses(m,f,q,settings());assert.equal(r.status,'not_separated');assert.deepEqual(r.bestIndices,[0,1,2]);assert.deepEqual(r.proposedIndices,[]);assert.ok(r.releases.every(x=>x.score===0));
 const initial=compareReleaseCourses(m,families,[[1,1],[.99,.99]],settings()),min=(initial.releases[0].score+initial.releases[1].score)/2;
 const tied=compareReleaseCourses(m,families,[[1,1],[.99,.99]],{...settings(),minimumSeparation:min,tieTolerance:1});assert.deepEqual(tied.bestIndices,[0,1]);assert.deepEqual(tied.proposedIndices,[0]);
 const high=compareReleaseCourses(m,families,q,{...settings(),minimumSeparation:1});assert.equal(high.status,'not_separated');assert.deepEqual(high.proposedIndices,[]);
});

test('reserve the entire cross-product before any integration; reject unsupported/partial source populations',()=>{
 let reads=0;const m=model('independent',1);Object.defineProperty(m,'matrix',{get(){reads++;return[[-1,0],[0,-1]];}});
 assert.throws(()=>compareReleaseCourses([m],families,[[0,0],[1,1]],{...settings(),duration:100,maxStep:1e-8,samples:1001}),/exceeds 120000/);assert.equal(reads,0);
 assert.throws(()=>compareReleaseCourses([m],families,[[0,0],[0,0]],settings()),/distinct/);
 const f=clone(families);f.diagonal.dampingCross=.1;assert.throws(()=>compareReleaseCourses([m],f,[[0,0]],settings()),/zero cross/);
 const input=fixture();input.response.permitted=[];assert.throws(()=>readViscousReleaseStudy(input),/at least one/);
 const raw=fixture();raw.hiddenSelection='symmetric';assert.throws(()=>readViscousReleaseStudy(raw),/unsupported fields/);
});

test('every failed, step-sensitive and refused response remains visible and cannot win a release',()=>{
 const failed=compareReleaseCourses([model('independent',-1e12)],families,[[1,1],[-1,-1]],{...settings(),samples:5,maxStep:1});assert.equal(failed.status,'unresolved');assert.equal(failed.releases.length,2);assert.ok(failed.releases.every(r=>r.comparisons[0].diagonal.status==='failed'&&r.score===null));
 const sensitive=compareReleaseCourses([model('independent',100)],families,[[1,1]],{...settings(),duration:1,samples:11,maxStep:.1,positionTolerance:1e-12,rateTolerance:1e-12});assert.equal(sensitive.status,'unresolved');assert.equal(sensitive.releases[0].comparisons[0].diagonal.status,'step_sensitive');assert.deepEqual(sensitive.proposedIndices,[]);
 const refused=compareReleaseCourses([model('independent',1)],families,[[1,1]],settings(),{refusedModels:[{id:'directional',reason:'insufficient_excitation'}]});assert.equal(refused.releases[0].status,'response_incomplete');assert.deepEqual(refused.proposedIndices,[]);
 const unsupported=fixture();unsupported.viscous.training.record.courses.forEach(c=>c.rows.forEach(row=>{row.position=[0,0];row.torque=[0,0];}));const r=proposeViscousReleases(unsupported);assert.equal(r.status,'unsupported_training');assert.deepEqual(r.proposedIndices,[]);assert.equal(r.diagnostics.reservedSteps,0);assert.ok(r.releases.every(x=>x.score===null));
});

test('shared work reservation preserves old dynamics and chosen release reproduces the same course',()=>{
 const p=defaultDynamicsInputs(),m=[model('independent',1)],a=compareCoupledDynamics(m,p);assert.equal(reserveDynamicsSteps(p,1).requiredSteps,a.diagnostics.reservedSteps);assert.equal(reserveDynamicsSteps(p,1,4).requiredSteps,4*a.diagnostics.reservedSteps);
 const s=settings(),r=compareReleaseCourses(m,families,[[.3,-.2]],s),input=releaseDynamicsInputs(families.symmetric,[.3,-.2],s),b=compareCoupledDynamics(m,input);assert.equal(b.results[0].status,r.releases[0].comparisons[0].symmetric.status);assert.deepEqual(input.initialRate,[0,0]);assert.equal(input.samples,s.samples);
});
