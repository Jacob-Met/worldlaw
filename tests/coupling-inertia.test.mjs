import test from 'node:test';
import assert from 'node:assert/strict';
import {readSymmetricInertia,solveSymmetricInertia} from '../src/coupling/inertia.mjs';
import {defaultDynamicsInputs,readDynamicsInputs,compareCoupledDynamics,createCoupledDynamicsStudy,readDynamicsNotebook,exportDynamicsNotebook,MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION} from '../src/coupling/dynamics.mjs';
import {deriveCoupledModes,inspectModeTrajectory,transformModeRow} from '../src/coupling/modes.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook} from '../src/coupling/notebook.mjs';
const model=(matrix=[[0,0],[0,0]],bias=[1,0],id='independent')=>({schema:'worldlaw.coupled-torque-model/v1',id,matrix,bias});
const inputs=(extra={})=>({...defaultDynamicsInputs(),schema:MATRIX_INPUT_SCHEMA,interpretation:MATRIX_INTERPRETATION,inertiaCross:.5,damping:[0,0],initialPosition:[0,0],initialRate:[0,0],duration:1,samples:51,maxStep:.002,...extra});
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],mv=(a,b)=>a.map(r=>dot(r,b));
test('cross inertia creates the independently solved constant-force second-coordinate response',()=>{
 for(const c of [.5,-.5,0]){
  const p=inputs({inertiaCross:c}),result=compareCoupledDynamics([model()],p).results[0];
  assert.equal(result.status,'screened');
  for(const row of result.refined.rows){
   const a=[1/(1-c*c),-c/(1-c*c)];
   for(let i=0;i<2;i++){close(row.position[i],.5*a[i]*row.time**2);close(row.rate[i],a[i]*row.time);}
  }
 }
});
test('unequal inertia and swapped coordinates agree with an independent inverse and original equation',()=>{
 for(const [diag,c,force] of [[[2,5],1,[3,-4]],[[5,2],1,[-4,3]],[[.02,8],-.1,[.4,2]]]){
  const p=inputs({inertia:diag,inertiaCross:c}),factor=readSymmetricInertia(diag,c),actual=solveSymmetricInertia(factor,force);
  const det=diag[0]*diag[1]-c*c,oracle=[(diag[1]*force[0]-c*force[1])/det,(diag[0]*force[1]-c*force[0])/det];
  for(let i=0;i<2;i++)close(actual[i],oracle[i],1e-12);
  mv(factor.matrix,actual).forEach((v,i)=>close(v,force[i],1e-12));
  const row=compareCoupledDynamics([model([[0,0],[0,0]],force)],p).results[0].refined.rows.at(-1);
  row.position.forEach((v,i)=>close(v,.5*oracle[i],1e-9));
 }
});
test('symmetric inertial oscillator follows independent sum/difference solutions and preserves mechanical energy',()=>{
 const p=inputs({initialPosition:[1,0],duration:3,samples:101}),m=model([[-1,0],[0,-1]],[0,0]);
 const result=compareCoupledDynamics([m],p).results[0];assert.equal(result.status,'screened');
 for(const row of result.refined.rows){
  const plus=Math.cos(row.time/Math.sqrt(1.5)),minus=Math.cos(row.time/Math.sqrt(.5));
  close(row.position[0],(plus+minus)/2,1e-10);close(row.position[1],(plus-minus)/2,1e-10);
  const energy=.5*dot(row.rate,mv([[1,.5],[.5,1]],row.rate))+.5*dot(row.position,row.position);
  close(energy,.5,1e-10);
 }
 const damped=compareCoupledDynamics([m],{...p,damping:[.3,.1]}).results[0];
 let energy=Infinity;
 for(const row of damped.refined.rows){
  const next=.5*dot(row.rate,mv([[1,.5],[.5,1]],row.rate))+.5*dot(row.position,row.position);
  assert.ok(next<=energy+1e-12);energy=next;
 }
 assert.ok(energy<.4);
});
test('invalid, indefinite and poorly conditioned declarations refuse before a partial comparison',()=>{
 for(const cross of [1,-1,1.01,NaN,Infinity,undefined,'0.5'])assert.throws(()=>readDynamicsInputs(inputs({inertiaCross:cross})));
 assert.throws(()=>readDynamicsInputs(inputs({inertiaCross:1-1e-12})),/numerical support/);
 assert.throws(()=>readDynamicsInputs(inputs({inertia:[1e-9,1e6],inertiaCross:0})),/numerical support/);
 assert.throws(()=>readDynamicsInputs(inputs({inertia:[1e-9,1e-9],inertiaCross:5e-10})),/numerical support/);
 assert.throws(()=>compareCoupledDynamics([model()],inputs({maxStep:1e-8})),/complete.*steps/);
 assert.throws(()=>readDynamicsInputs({...defaultDynamicsInputs(),inertiaCross:0}),/unknown fields/);
 assert.throws(()=>readDynamicsInputs(inputs({interpretation:defaultDynamicsInputs().interpretation})),/interpretation/);
 assert.throws(()=>readDynamicsInputs(inputs({inertiaMatrix:[[1,.5],[.5,1]]})),/unknown fields/);
 assert.throws(()=>readDynamicsInputs(inputs({units:{...defaultDynamicsInputs().units,inertia:'kg'}})),/units/);
});
test('matrix input-only replay is versioned and neither checks nor source objects change fitted motion',()=>{
 const evidence=createCouplingCourse(),p=inputs(),before=JSON.stringify({evidence,p}),study=createCoupledDynamicsStudy(evidence,p);
 const raw=JSON.parse(exportDynamicsNotebook(evidence,p));assert.equal(raw.schema,'worldlaw.coupling-dynamics-notebook/v2');
 assert.equal(raw.inputs.schema,MATRIX_INPUT_SCHEMA);assert.equal(raw.inputs.inertiaCross,.5);
 assert.deepEqual(Object.keys(raw).sort(),['evidence','inputs','schema']);
 const reopen=readDynamicsNotebook(raw);assert.deepEqual(createCoupledDynamicsStudy(reopen.evidence,reopen.inputs),study);
 assert.throws(()=>readDynamicsNotebook({...raw,schema:'worldlaw.coupling-dynamics-notebook/v1'}),/versions/);
 const legacy=JSON.parse(exportDynamicsNotebook(evidence,defaultDynamicsInputs()));assert.equal(legacy.schema,'worldlaw.coupling-dynamics-notebook/v1');
 assert.throws(()=>readDynamicsNotebook({...legacy,schema:'worldlaw.coupling-dynamics-notebook/v2'}),/versions/);
 const changed=structuredClone(evidence);changed.challenges=changed.challenges.map((row,i)=>({...row,torque:[500+i,-100-i]}));
 assert.deepEqual(createCoupledDynamicsStudy(changed,p).results,study.results);
 assert.equal(JSON.stringify({evidence,p}),before);
});
test('generalized modes satisfy original-coordinate eigen-equations and preserve power and trajectory',()=>{
 const p=inputs({inertia:[2,.7],inertiaCross:-.4,damping:[.2,.1],initialPosition:[.3,-.2]}),m=model([[-2,.6],[.6,-3]],[.1,-.2],'reciprocal');
 const mass=[[2,-.4],[-.4,.7]],mode=deriveCoupledModes(m,p);
 assert.equal(mode.status,'available');assert.equal(mode.inertiaKind,'symmetric');
 for(let i=0;i<2;i++){
  const d=mode.directions[i],left=mv(m.matrix,d),right=mv(mass,d).map(v=>v*mode.eigenvalues[i]);
  left.forEach((v,j)=>close(v,right[j],1e-12));
  close(dot(d,mv(mass,d)),1,1e-12);
 }
 close(dot(mode.directions[0],mv(mass,mode.directions[1])),0,1e-12);
 const trajectory=compareCoupledDynamics([m],p).results[0],inspection=inspectModeTrajectory(m,p,trajectory);
 for(const v of Object.values(inspection.checks))assert.ok(v<1e-12);
 for(const row of trajectory.refined.rows){
  const z=transformModeRow(mode,row),f=row.torque.map((v,i)=>v-p.damping[i]*row.rate[i]);
  const acceleration=solveSymmetricInertia(readSymmetricInertia(p.inertia,p.inertiaCross),f);
  const transformed=transformModeRow(mode,{...row,position:acceleration}).position;
  const expected=mv(mode.stiffness,z.position).map((v,i)=>v+mode.bias[i]-dot(mode.damping[i],z.rate));
  expected.forEach((v,i)=>close(v,transformed[i],1e-12));
 }
 const nonsymmetric=model([[-2,.5],[.4,-3]],[0,0],'directional');
 assert.equal(deriveCoupledModes(nonsymmetric,p).status,'asymmetric');
});
test('one generalized mode produces analytic modal oscillation without cross-mode drift',()=>{
 const p=inputs({inertia:[2,.7],inertiaCross:-.4,duration:3,samples:101}),m=model([[-2,.6],[.6,-3]],[0,0],'reciprocal'),mode=deriveCoupledModes(m,p);
 p.initialPosition=mode.directions[0].map(v=>.4*v);
 const result=compareCoupledDynamics([m],p).results[0],view=inspectModeTrajectory(m,p,result);
 for(const row of view.rows){close(row.position[0],.4*Math.cos(mode.frequencies[0]*row.time),1e-10);close(row.position[1],0,1e-12);}
});
