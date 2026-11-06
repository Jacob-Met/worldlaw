import test from 'node:test';
import assert from 'node:assert/strict';
import {compareLocalMotion,sampleLocalMotionComparison} from '../src/science/local-motion-comparison.mjs';
const law=terms=>({schema:'worldlaw.torque-model/v1',id:'duplicate',equation:'same label',terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const discovery=(...competitive)=>({competitive});
const initial={position:.4,rate:.2},settings={duration:.2,dt:.1};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function course(r,i=0){assert.equal(r.results[i].response.status,'computed');return r.results[i].response.course;}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
test('duplicate IDs/equations keep ordered laws and analytic oscillatory modes',()=>{
 const r=compareLocalMotion(discovery(law({spring:-4}),law({spring:-9})),initial,settings);
 assert.equal(r.status,'completed');assert.equal(r.candidateCount,2);assert.deepEqual(r.results.map(x=>x.index),[0,1]);
 assert.deepEqual(r.results.map(x=>x.id),['duplicate','duplicate']);
 for(const [i,w] of [2,3].entries())for(const row of course(r,i).rows){assert.equal(row.torqueByPosition,-(w**2));assert.equal(row.modes.pattern,'neutral_oscillation');close(row.modes.eigenvalues[0].real,0);close(Math.abs(row.modes.eigenvalues[0].imaginary),w);}
 assert.notEqual(r.motion.results[0].trajectory.at(-1).position,r.motion.results[1].trajectory.at(-1).position);
});
test('linear damping independently has roots minus two and minus one',()=>{
 const r=compareLocalMotion(discovery(law({spring:-4,rate:-6})),initial,{...settings,inertia:2}),row=course(r).rows[0];
 assert.deepEqual(row.jacobian,[[0,1],[-2,-3]]);close(row.modes.eigenvalues[0].real,-2);close(row.modes.eigenvalues[1].real,-1);assert.equal(row.modes.eigenvalues[0].imaginary,0);assert.equal(row.modes.eigenvalues[1].imaginary,0);
});
test('same common index evaluates nonlinear derivatives at each own trajectory',()=>{
 const r=compareLocalMotion(discovery(law({cubic:-1}),law({cubic:-2,bias:1})),initial,settings),last=r.motion.results[0].trajectory.length-1;
 const states=r.motion.results.map(x=>x.trajectory[last]);assert.equal(states[0].time,states[1].time);assert.notEqual(states[0].position,states[1].position);
 for(let i=0;i<2;i++){const row=course(r,i).rows[last],s=states[i];assert.equal(row.index,last);assert.equal(row.time,s.time);assert.equal(row.position,s.position);assert.equal(row.rate,s.rate);assert.equal(row.jointTorque,s.jointTorque);close(row.torqueByPosition,-3*(i+1)*s.position**2);}
});
test('default inertia one and command zero agree with explicit declarations',()=>{
 const d=discovery(law({command:5,command_position:3,spring:-2})),a=compareLocalMotion(d,initial,settings),b=compareLocalMotion(d,initial,{...settings,inertia:1,command:0});
 assert.deepEqual(a.motion.results,b.motion.results);assert.deepEqual(course(a),course(b));assert.equal(course(a).source.inertia,1);assert.equal(course(a).source.command,0);assert.equal(course(a).rows[0].torqueByPosition,-2);
});
test('one execution refusal preserves population, order and original work denominator',()=>{
 const r=compareLocalMotion(discovery(law({spring:-1}),{...law({spring:-2}),schema:'invalid'},law({rate:-1})),initial,settings);
 assert.equal(r.candidateCount,3);assert.equal(r.results.length,3);assert.deepEqual(r.results.map(x=>x.index),[0,1,2]);assert.equal(r.motion.completedCount,2);assert.equal(r.motion.refusedCount,1);
 assert.equal(r.results[1].executionStatus,'refused');assert.equal(r.results[1].response.status,'refused');assert.ok(r.results[1].response.error);
 assert.equal(r.motion.work.perModelEvaluationLimit,Math.floor(r.motion.work.maxTotalEvaluations/3));assert.equal(course(r,0).rows.length,3);assert.equal(course(r,2).rows.length,3);
});
test('Coulomb zero-rate samples remain nonsmooth with no fabricated ordinary modes',()=>{
 const r=compareLocalMotion(discovery(law({coulomb:-1})),{position:0,rate:0},settings);
 assert.equal(r.motion.results[0].status,'completed');assert.equal(course(r).counts.nonsmooth,3);assert.equal(course(r).counts.available,0);
 for(const row of course(r).rows){assert.equal(row.status,'nonsmooth');assert.equal(row.torqueByRate,null);assert.equal(row.jacobian,null);assert.equal(row.modes,null);}
});
test('frozen source and returned numerical snapshots do not alias',()=>{
 const d=freeze(discovery(law({spring:-2}),law({bias:1}))),a=freeze({...initial}),s=freeze({...settings}),before=JSON.stringify({d,a,s});
 const r=compareLocalMotion(d,a,s);assert.equal(JSON.stringify({d,a,s}),before);assert.notEqual(r.results[0].model,d.competitive[0]);
 assert.throws(()=>{r.results[0].model.terms[0].coefficient=99;},TypeError);assert.equal(d.competitive[0].terms[0].coefficient,-2);assert.equal(course(r).source.model.terms[0].coefficient,-2);
});

test('exact sample index preserves own states and all refused rows without interpolation',()=>{
 const r=compareLocalMotion(discovery(law({spring:-1}),{...law({spring:-2}),schema:'invalid'},law({bias:1})),initial,settings);
 const view=sampleLocalMotionComparison(r,1);
 assert.equal(view.candidateCount,3);assert.equal(view.sampleIndex,1);assert.equal(view.time,.1);assert.equal(view.results.length,3);
 for(const i of [0,2]){assert.deepEqual(view.results[i].state,r.motion.results[i].trajectory[1]);assert.deepEqual(view.results[i].response.row,course(r,i).rows[1]);}
 assert.equal(view.results[1].state,null);assert.equal(view.results[1].response.status,'refused');
 for(const invalid of [-1,.5,'1',NaN,Infinity,3,Number.MAX_SAFE_INTEGER])assert.throws(()=>sampleLocalMotionComparison(r,invalid));
 const none=compareLocalMotion(discovery({...law({spring:1}),schema:'invalid'}),initial,settings);
 assert.throws(()=>sampleLocalMotionComparison(none,0));
});
test('an admitted split predictor can execute while unsupported response schema stays refused',()=>{
 // Current ordinary predictor accepts this explicit research representation.
 // Producer response snapshots do not preserve its required fit/status fields.
 // This is a schema seam, NOT an invented unsupported library term.
 const split={schema:'worldlaw.split-torque-experiment/v1',status:'converged',id:'duplicate',equation:'same label',
  terms:[{id:'spring',coefficient:-2}],fit:{schema:'worldlaw.split-continuation-research/v1',status:'converged',pairs:[[-2,0]]}};
 const r=compareLocalMotion(discovery(split,law({spring:-2})),initial,settings);
 assert.equal(r.motion.results[0].status,'completed');assert.equal(r.motion.results[0].trajectory.length,3);
 assert.deepEqual(r.motion.results[0].trajectory,r.motion.results[1].trajectory);
 assert.equal(r.results[0].response.status,'refused');assert.ok(r.results[0].response.error);
 assert.equal(r.results[1].response.status,'computed');assert.equal(r.responseCounts.executedStates,6);
 const sampled=sampleLocalMotionComparison(r,1);assert.deepEqual(sampled.results[0].state,r.motion.results[0].trajectory[1]);assert.equal(sampled.results[0].response.status,'refused');
});


test('selected report retains declarations, work and each source used for derivative scaling',()=>{
 const r=compareLocalMotion(discovery(law({spring:-4}),law({rate:-3})),initial,{...settings,inertia:2,command:7}),v=sampleLocalMotionComparison(r,1);
 assert.deepEqual(v.execution.initial,initial);assert.equal(v.execution.settings.inertia,2);assert.equal(v.execution.settings.command,7);assert.deepEqual(v.execution.work,r.motion.work);
 assert.equal(v.execution.candidateCount,2);assert.equal(v.execution.completedCount,2);assert.equal(v.execution.refusedCount,0);
 for(let i=0;i<2;i++){assert.deepEqual(v.results[i].response.source,course(r,i).source);assert.equal(v.results[i].response.source.inertia,2);assert.equal(v.results[i].response.source.command,7);}
 const defaults=sampleLocalMotionComparison(compareLocalMotion(discovery(law({spring:-1})),initial,settings),0);
 assert.equal(defaults.execution.settings.inertia,1);assert.equal(defaults.execution.settings.command,0);
});
