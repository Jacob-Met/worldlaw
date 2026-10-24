import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveCoupledModes,inspectModeTrajectory,transformModeRow} from '../src/coupling/modes.mjs';
import {defaultDynamicsInputs,compareCoupledDynamics} from '../src/coupling/dynamics.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {analyzeCouplingNotebook} from '../src/coupling/notebook.mjs';
const model=(matrix=[[-2,1],[1,-3]],bias=[.1,-.2],id='reciprocal')=>({schema:'worldlaw.coupled-torque-model/v1',id,matrix,bias,domain:[{min:-2,max:2},{min:-2,max:2}]});
const inputs=()=>({...defaultDynamicsInputs(),inertia:[2,.5],damping:[.2,.2]});
test('unequal inertia modes preserve response, instantaneous power and the maintained motion',()=>{
 const m=model(),input=inputs(),trajectory=compareCoupledDynamics([m],input).results[0],mode=inspectModeTrajectory(m,input,trajectory);
 assert.equal(mode.status,'available');assert.equal(mode.rows.length,241);assert.equal(mode.trajectoryStatus,'screened');
 assert.ok(Math.abs(mode.eigenvalues[0]+.807417596432748)<1e-12);assert.ok(Math.abs(mode.eigenvalues[1]+6.192582403567251)<1e-12);
 assert.ok(Math.abs(mode.damping[0][1])>.05);assert.ok(mode.numerical.offDiagonalResidual<1e-12);
 for(const v of Object.values(mode.checks))assert.ok(v<1e-12);
 for(const row of trajectory.refined.rows){
  const x=transformModeRow(mode,row),originalAcceleration=row.torque.map((v,i)=>(v-input.damping[i]*row.rate[i])/Math.sqrt(input.inertia[i]));
  for(let axis=0;axis<2;axis++){
   const transformed=mode.basis[0][axis]*originalAcceleration[0]+mode.basis[1][axis]*originalAcceleration[1];
   const predicted=mode.stiffness[axis][0]*x.position[0]+mode.stiffness[axis][1]*x.position[1]+mode.bias[axis]-mode.damping[axis][0]*x.rate[0]-mode.damping[axis][1]*x.rate[1];
   assert.ok(Math.abs(predicted-transformed)<1e-12);
  }
 }
});
test('repeated, unstable and zero stiffness retain qualified outcomes rather than invented frequencies',()=>{
 const input={...inputs(),inertia:[1,1]};
 const repeated=deriveCoupledModes(model([[-2,0],[0,-2]]),input);assert.equal(repeated.axisAmbiguity,true);assert.deepEqual(repeated.stability,['restoring','restoring']);
 const mixed=deriveCoupledModes(model([[2,0],[0,0]]),input);assert.deepEqual(mixed.stability,['anti-restoring','near_zero']);assert.deepEqual(mixed.frequencies,[null,null]);
 const asymmetric=deriveCoupledModes(model([[-2,1],[.9,-3]],[0,0],'directional'),input);assert.equal(asymmetric.status,'asymmetric');assert.equal(asymmetric.basis,undefined);
 assert.throws(()=>deriveCoupledModes(model(),{...input,inertia:[0,1]}),/at least/);
});
test('real fitted candidates remain distinct and source evidence never changes',()=>{
 const notebook=createCouplingCourse(),before=JSON.stringify(notebook),analysis=analyzeCouplingNotebook(notebook),input=inputs(),study=compareCoupledDynamics(analysis.discovery.candidates,input);
 const result=analysis.discovery.candidates.map(m=>inspectModeTrajectory(m,input,study.results.find(r=>r.modelId===m.id)));
 assert.equal(result.length,3);assert.equal(result.find(r=>r.modelId==='directional').status,'asymmetric');
 for(const r of result.filter(r=>r.status==='available'))for(const v of Object.values(r.checks))assert.ok(v<1e-12);
 assert.equal(JSON.stringify(notebook),before);
 const m=analysis.discovery.candidates[0];assert.throws(()=>inspectModeTrajectory(m,input,{...study.results[0],modelId:'wrong'}),/identities/);
 const absent=inspectModeTrajectory(m,input,{modelId:m.id,status:'failed',refined:null});assert.equal(absent.trajectoryStatus,'unavailable');assert.deepEqual(absent.rows,[]);
});
test('a single learned direction yields the analytic undamped mode in the maintained solver',()=>{
 const m=model([[-2,1],[1,-3]],[0,0]),input={...inputs(),damping:[0,0],maxStep:.002},mode=deriveCoupledModes(m,input),amplitude=.4;
 input.initialPosition=mode.directions[0].map(v=>v*amplitude);input.initialRate=[0,0];
 const trajectory=compareCoupledDynamics([m],input).results[0],received=inspectModeTrajectory(m,input,trajectory);
 assert.equal(trajectory.status,'screened');
 for(const row of received.rows){assert.ok(Math.abs(row.position[0]-amplitude*Math.cos(mode.frequencies[0]*row.time))<1e-10);assert.ok(Math.abs(row.position[1])<1e-12);}
});
