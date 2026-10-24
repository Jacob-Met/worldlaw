import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDynamicsInputs,readDynamicsInputs,compareCoupledDynamics,createCoupledDynamicsStudy,exportDynamicsNotebook,readDynamicsNotebook,STEP_BUDGET} from '../src/coupling/dynamics.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';

const options=changes=>({...defaultDynamicsInputs(),damping:[0,0],...changes});
const model=(id,matrix,bias=[0,0],domain=[{min:-2,max:2},{min:-2,max:2}])=>({schema:'worldlaw.coupled-torque-model/v1',id,label:id,matrix,bias,units:{position:'rad',torque:'N·m'},domain});
const near=(value,target,tolerance=2e-7)=>assert.ok(Math.abs(value-target)<tolerance,`${value} != ${target} within ${tolerance}`);

test('independent inertias execute analytic oscillators with nonzero starting rates',()=>{
  const m=model('independent',[[-8,0],[0,-.5]]),input=options({inertia:[2,.5],initialPosition:[.7,-.4],initialRate:[.3,.2]});
  const r=compareCoupledDynamics([m],input).results[0];assert.equal(r.status,'screened');
  for(const row of r.refined.rows)for(let a=0;a<2;a++){
    const w=[2,1][a],t=row.time,q=input.initialPosition[a],v=input.initialRate[a];
    near(row.position[a],q*Math.cos(w*t)+v/w*Math.sin(w*t));
    near(row.rate[a],-q*w*Math.sin(w*t)+v*Math.cos(w*t));
  }
  assert.equal(r.refined.rows.at(-1).time,input.duration);
});

test('coupled normal modes transfer motion into the initially still coordinate',()=>{
  const r=compareCoupledDynamics([model('reciprocal',[[-2,1],[1,-2]])],options({initialPosition:[1,0]})).results[0];
  assert.equal(r.status,'screened');
  for(const row of r.refined.rows){
    const t=row.time,a=Math.cos(t),b=Math.cos(Math.sqrt(3)*t);
    near(row.position[0],(a+b)/2);near(row.position[1],(a-b)/2);
    near(row.rate[0],(-Math.sin(t)-Math.sqrt(3)*Math.sin(Math.sqrt(3)*t))/2);
    near(row.rate[1],(-Math.sin(t)+Math.sqrt(3)*Math.sin(Math.sqrt(3)*t))/2);
  }
  assert.ok(Math.abs(r.refined.rows[120].position[1])>.2);
});

test('bias and unequal inertia preserve an independently solved static equilibrium',()=>{
  const q=[1/11,-7/11];
  const r=compareCoupledDynamics([model('reciprocal',[[-4,1],[1,-3]],[1,-2])],options({inertia:[3,.2],initialPosition:q})).results[0];
  assert.equal(r.status,'screened');for(const row of r.refined.rows)for(let a=0;a<2;a++){near(row.position[a],q[a],1e-12);near(row.rate[a],0,1e-12);}
});

test('declared damping follows the analytic damped oscillator and removes mechanical energy',()=>{
  const r=compareCoupledDynamics([model('independent',[[-4,0],[0,-4]])],options({initialPosition:[1,0],damping:[.4,.4]})).results[0];
  const w=Math.sqrt(3.96);let last=2;
  for(const row of r.refined.rows){const t=row.time,e=Math.exp(-.2*t),c=Math.cos(w*t),s=Math.sin(w*t);
    near(row.position[0],e*(c+.2/w*s));near(row.rate[0],-4/w*e*s);
    const energy=.5*row.rate[0]**2+2*row.position[0]**2;assert.ok(energy<=last+1e-10);last=energy;
  }
});

test('a directional response is integrated simultaneously rather than as independent scalar runs',()=>{
  const r=compareCoupledDynamics([model('directional',[[0,2],[0,0]])],options({initialPosition:[0,1],initialRate:[0,.5],duration:2})).results[0];
  for(const row of r.refined.rows){const t=row.time;near(row.position[0],t*t+t*t*t/6,1e-10);near(row.rate[0],2*t+t*t/2,1e-10);near(row.position[1],1+.5*t,1e-11);}
});

test('coarse/fine disagreement stays visible rather than being called a screened prediction',()=>{
  const r=compareCoupledDynamics([model('independent',[[-400,0],[0,-400]])],options({initialPosition:[1,0],duration:1,samples:21,maxStep:.05,positionTolerance:1e-8,rateTolerance:1e-8})).results[0];
  assert.equal(r.status,'step_sensitive');assert.ok(r.screen.maxPositionDifference[0]>1e-5);assert.equal(r.coarse.rows.length,r.refined.rows.length);
});

test('unstable runaway retains a failure and last finite output instead of a completed trajectory',()=>{
  const r=compareCoupledDynamics([model('independent',[[1e5,0],[0,1e5]])],options({initialPosition:[1,0]})).results[0];
  assert.equal(r.status,'failed');assert.equal(r.failure.code,'runaway_state');assert.equal(r.refined,null);assert.ok(Number.isFinite(r.failure.time));
});

test('the complete comparison reserves both resolutions for every model before work',()=>{
  const models=[model('independent',[[-1,0],[0,-1]]),model('reciprocal',[[-2,1],[1,-2]]),model('directional',[[-2,1],[.5,-2]])];
  const result=compareCoupledDynamics(models,options());assert.equal(result.results.length,3);assert.equal(result.diagnostics.reservedSteps,4320);assert.equal(result.diagnostics.stepBudget,STEP_BUDGET);
  assert.throws(()=>compareCoupledDynamics(models,options({duration:100,maxStep:1e-5})),e=>e.code==='step_limit');
});

test('observed-range departure and absent range are explicit and never clamped',()=>{
  const m=model('independent',[[0,0],[0,0]],[0,0],[{min:-.1,max:.1},{min:-.1,max:.1}]);
  const r=compareCoupledDynamics([m],options({initialPosition:[0,0],initialRate:[1,0]})).results[0];
  assert.equal(r.refined.domainStatus,'outside_observed_range');near(r.refined.rows.at(-1).position[0],4,1e-10);
  assert.ok(r.refined.firstOutside.time>0);assert.deepEqual(r.refined.firstOutside.axes,[0]);
  delete m.domain;assert.equal(compareCoupledDynamics([m],options()).results[0].refined.domainStatus,'observed_range_unavailable');
});

test('source inputs and compared model values are not mutated',()=>{
  const models=[model('reciprocal',[[-2,1],[1,-2]])],input=options(),before=JSON.stringify({models,input});
  compareCoupledDynamics(models,input);assert.equal(JSON.stringify({models,input}),before);
});

test('held-aside challenge values never select or alter conditional trajectories',()=>{
  const evidence=createCouplingCourse(),input=options();
  const original=createCoupledDynamicsStudy(evidence,input),altered=structuredClone(evidence);
  altered.challenges=altered.challenges.map((r,i)=>({...r,torque:[10000+i,-10000-i]}));
  const second=createCoupledDynamicsStudy(altered,input);
  assert.deepEqual(second.results,original.results);assert.equal(second.selectedModelId,original.selectedModelId);
  assert.equal(original.diagnostics.observationsResetState,false);assert.equal(original.diagnostics.physicalValidity,'not_established');
});

test('dynamics notebook retains only declared inputs and recomputes the current models on reopen',()=>{
  const evidence=createCouplingCourse('directional'),input=options({inertia:[.4,2],initialPosition:[.1,-.4]});
  const text=exportDynamicsNotebook(evidence,input),parsed=readDynamicsNotebook(text);
  assert.deepEqual(Object.keys(parsed).sort(),['evidence','inputs','schema']);assert.equal(parsed.evidence.source.reference,evidence.source.reference);
  assert.deepEqual(createCoupledDynamicsStudy(parsed.evidence,parsed.inputs),createCoupledDynamicsStudy(evidence,input));
  assert.throws(()=>readDynamicsNotebook({...parsed,result:{claimed:'passed'}}),/unknown fields/);
});

test('unsupported physical declarations, malformed units and invalid numerical controls are refused',()=>{
  const invalid=[{interpretation:'quasi-static-is-dynamics'},{inertia:[0,1]},{inertia:[1e-12,1]},{damping:[-.1,0]},
    {duration:0},{maxStep:0},{samples:1},{samples:1002},{positionTolerance:0},{rateTolerance:NaN},
    {units:{...options().units,inertia:'kg'}},{declaration:''},{initialPosition:[Infinity,0]},{claimedResult:true}];
  for(const change of invalid)assert.throws(()=>readDynamicsInputs(options(change)));
  assert.throws(()=>compareCoupledDynamics([],options()),/one to six/);
  assert.throws(()=>compareCoupledDynamics([model('independent',[[-1,0],[0,-1]]),model('independent',[[-2,0],[0,-2]])],options()),/distinct/);
});
