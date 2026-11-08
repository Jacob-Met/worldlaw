import {test} from 'node:test';
import assert from 'node:assert/strict';
import {propagateFiniteTime} from '../src/finite-time/variational.mjs';
import {rolloutAngular} from '../src/trajectory/angular-discovery.mjs';
const coeffUnits={spring:'1/s²',rate:'1/s',gravity:'rad/s²',quadratic:'1/rad',bias:'rad/s²',cubic:'1/(rad²·s²)',cosine:'rad/s²',coulomb:'rad/s²'};
const model=(terms)=>({schema:'worldlaw.angular-model/v1',scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',
  physicalInertia:null,absoluteTorqueIdentified:false,units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},
  terms:terms.map(([id,coefficient])=>({id,coefficient,coefficientUnit:coeffUnits[id]}))});
const run=(q=1,v=.2)=>({id:'authored-1',label:'authored',kind:'synthetic',dynamics:'unforced_scalar_rotation',
  inertia:null,initialRate:v,source:{label:'authored numeric research, no physical acquisition'},
  samples:[0,.25,.5,1,2].map(t=>({time:t,position:q}))});
const near=(got,want,tol=1e-7)=>assert.ok(Math.abs(got-want)<tol,`got ${got}, expected ${want}`);
test('harmonic finite-time derivative equals analytic state-transition matrix',()=>{
 const m=model([['spring',-4]]), r=run(1,0), out=propagateFiniteTime(m,r);
 for(const row of out.rows){
  const t=row.time, c=Math.cos(2*t), s=Math.sin(2*t);
  near(row.position,c,2e-8);
  near(row.transition[0][0],c,2e-8);
  near(row.transition[0][1],s/2,2e-8);
  near(row.transition[1][0],-2*s,2e-8);
  near(row.transition[1][1],c,2e-8);
 }
 assert.equal(out.combinedReservedSteps,out.steps*2);
});
test('nonlinear smooth gravity and damping differentiate unchanged retained solver',()=>{
 const m=model([['gravity',-2.3],['rate',-.4],['quadratic',-.08],['cubic',.09],['cosine',-.01],['bias',.2]]), r=run(.6,.27);
 const out=propagateFiniteTime(m,r,{maxStep:.005});
 const eps=1e-5, opt={maxStep:.005,maxSteps:2000};
 const forward=(q,v)=>rolloutAngular(m,run(q,v),opt).rows;
 const qp=forward(.6+eps,.27), qm=forward(.6-eps,.27),
       vp=forward(.6,.27+eps), vm=forward(.6,.27-eps);
 for(let i=0;i<out.rows.length;i++){
  const mat=out.rows[i].transition;
  near(mat[0][0],(qp[i].predicted-qm[i].predicted)/(2*eps),3e-5);
  near(mat[0][1],(vp[i].predicted-vm[i].predicted)/(2*eps),3e-5);
  near(mat[1][0],(qp[i].rate-qm[i].rate)/(2*eps),3e-5);
  near(mat[1][1],(vp[i].rate-vm[i].rate)/(2*eps),3e-5);
 }
});
test('later source positions cannot alter finite-time prediction or tangent matrix',()=>{
 const m=model([['spring',-4],['rate',-.2]]), original=run(.7,.2);
 const changed=structuredClone(original);changed.samples.slice(1).forEach((p,i)=>p.position=i*100000+300000);
 const first=propagateFiniteTime(m,original), second=propagateFiniteTime(m,changed);
 assert.deepEqual(first.rows,second.rows);
});
test('Coulomb nonsmooth model refuses (no false smooth derivative)',()=>{
 assert.throws(()=>propagateFiniteTime(model([['coulomb',-.2]]),run()),e=>e.code==='unsupported_nonsmooth');
});
test('invalid step budget refused before any full reference execution',()=>{
 assert.throws(()=>propagateFiniteTime(model([['spring',-4]]),run(),{maxStep:.01,maxTotalSteps:2}),e=>e.code==='step_limit');
});
test('bias-only law has exact affine transition',()=>{
 const out=propagateFiniteTime(model([['bias',.8]]),run(.5,-.3));
 for(const {time,transition} of out.rows){
  near(transition[0][0],1);near(transition[0][1],time);
  near(transition[1][0],0);near(transition[1][1],1);
 }
});
test('positive linear spring shows growth, not a guaranteed stability verdict',()=>{
 const result=propagateFiniteTime(model([['spring',1]]),run(.5,0));
 assert.ok(result.rows.at(-1).transition[0][0]>3);
 assert.ok(result.limitations.some(s=>s.includes('not a guaranteed')));
});

