import test from 'node:test';
import assert from 'node:assert/strict';
import {localMotionResponse} from '../src/science/local-motion-response.mjs';
import {predict, TERMS} from '../src/science/torque-discovery.mjs';
import {executeStudioDynamics} from '../src/science/studio-dynamics.mjs';
import {energyBudget} from '../src/science/energy-budget.mjs';

const law = terms => ({schema:'worldlaw.torque-model/v1',
  terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const course = (position=.37,rate=.7) => [{time:0,position,rate},{time:1,position,rate}];
const inspect = (model,states=course(),options={inertia:1,command:.8}) =>
  localMotionResponse(model,states,options);
const near = (actual,expected,tolerance=1e-10) =>
  assert.ok(Math.abs(actual-expected) <= tolerance*Math.max(1,Math.abs(expected)),
    'Expected '+actual+' near '+expected);

test('executed restoring and inverted springs retain opposite local response despite dissipative rate work',()=>{
  const results=[];
  for(const spring of [-4,4]){
    const model=law({spring,rate:-.2}),options={inertia:1,command:0,duration:3,dt:.01};
    const run=executeStudioDynamics(model,{position:.01,rate:0},options);
    const result=inspect(model,run.trajectory,options),budget=energyBudget(model,run.trajectory,options);
    assert.equal(result.rows.length,run.trajectory.length);
    assert.equal(result.counts.available,301);assert.equal(result.counts.stationaryEquation,0);
    assert.equal(result.rows[0].torqueByPosition,spring);
    assert.equal(result.rows[0].torqueByRate,-.2);
    assert.equal(budget.final.positiveRateWork,0);
    assert.ok(budget.final.rateWork<0);
    results.push({result,last:run.trajectory.at(-1)});
  }
  assert.equal(results[0].result.rows[0].modes.pattern,'decaying');
  assert.equal(results[1].result.rows[0].modes.pattern,'one_growing_one_decaying');
  assert.ok(Math.abs(results[1].last.position)>100*Math.abs(results[0].last.position));
  near(results[0].last.position,.0069910847015946815,1e-8);
  near(results[1].last.position,1.5807733327320481,1e-8);
});

test('closed-form constant-coefficient modes distinguish damping, oscillation and neutral drift',()=>{
  const cases=[
    {spring:-3,rate:-4,roots:[-3,-1],pattern:'decaying'},
    {spring:-4,rate:-4,roots:[-2,-2],pattern:'decaying'},
    {spring:4,rate:0,roots:[-2,2],pattern:'one_growing_one_decaying'},
    {spring:0,rate:-2,roots:[-2,0],pattern:'neutral_position_decaying_rate'},
    {spring:0,rate:2,roots:[0,2],pattern:'neutral_position_growing_rate'},
    {spring:0,rate:0,roots:[0,0],pattern:'position_drift'}
  ];
  for(const c of cases){
    const row=inspect(law({spring:c.spring,rate:c.rate}),course(0,0)).rows[0];
    assert.equal(row.modes.pattern,c.pattern);assert.equal(row.stationaryEquation,true);
    row.modes.eigenvalues.forEach((root,i)=>{near(root.real,c.roots[i]);assert.equal(root.imaginary,0);});
  }
  for(const rate of [-.2,0,.2]){
    const row=inspect(law({spring:-4,rate})).rows[0],m=row.modes;
    near(m.eigenvalues[0].real,rate/2);
    near(Math.abs(m.eigenvalues[0].imaginary),Math.sqrt(4-rate*rate/4));
    assert.equal(m.pattern,rate<0?'decaying':rate>0?'growing':'neutral_oscillation');
  }
});

test('all maintained terms and their mixture agree with independent central differences away from discontinuity',()=>{
  const inputs=[{command:.8,position:.37,rate:.7},{command:-.4,position:-.91,rate:-1.2}];
  const models=TERMS.map(({id})=>law({[id]:-.9}));
  models.push(law(Object.fromEntries(TERMS.map(({id},i)=>[id,(i%2?-1:1)*(i+1)/10]))));
  for(const model of models)for(const input of inputs){
    const h=1e-5,row=inspect(model,course(input.position,input.rate),{inertia:2,command:input.command}).rows[0];
    const dq=(predict(model,{...input,position:input.position+h})-predict(model,{...input,position:input.position-h}))/(2*h);
    const dv=(predict(model,{...input,rate:input.rate+h})-predict(model,{...input,rate:input.rate-h}))/(2*h);
    near(row.torqueByPosition,dq,2e-8);near(row.torqueByRate,dv,2e-8);
    near(row.jacobian[1][0],row.torqueByPosition/2);
    near(row.jacobian[1][1],row.torqueByRate/2);
  }
});

test('Coulomb zero-rate states remain unavailable without dropping adjacent executed states',()=>{
  const states=[{time:0,position:.3,rate:-1},{time:.5,position:.2,rate:0},{time:1,position:.3,rate:1}];
  const r=inspect(law({spring:-4,rate:-.2,coulomb:-.3}),states);
  assert.deepEqual(r.counts,{available:2,nonsmooth:1,unresolvedNumeric:0,stationaryEquation:0});
  assert.equal(r.rows.length,3);assert.equal(r.rows[1].status,'nonsmooth');
  assert.equal(r.rows[1].torqueByRate,null);assert.equal(r.rows[1].jacobian,null);
  assert.equal(r.rows[1].modes,null);assert.equal(r.rows[1].torqueByPosition,-4);
  assert.equal(r.rows[0].torqueByRate,-.2);assert.equal(r.rows[2].torqueByRate,-.2);
});

test('quadratic rate terms and an identically zero Coulomb coefficient are differentiable at zero',()=>{
  const r=inspect(law({spring:-1,quadratic:-3,rate_squared:2,coulomb:0}),course(.2,0));
  assert.equal(r.counts.nonsmooth,0);assert.equal(r.counts.available,2);
  assert.equal(r.rows[0].torqueByRate,0);
  assert.equal(r.rows[0].modes.pattern,'neutral_oscillation');
  const positive=inspect(law({rate_squared:-2}),course(.2,1)).rows[0];
  const negative=inspect(law({rate_squared:-2}),course(.2,-1)).rows[0];
  assert.equal(positive.torqueByRate,-4);assert.equal(negative.torqueByRate,4);
});

test('strong rate feedback keeps the slow root, while representational overflow and underflow stay unresolved',()=>{
  const slow=inspect(law({spring:-1e-18,rate:-1e18})).rows[0];
  assert.equal(slow.modes.pattern,'decaying');
  const roots=slow.modes.eigenvalues.map(x=>x.real);
  assert.ok(Math.abs((roots[0]+1e18)/1e18)<1e-12);
  assert.ok(Math.abs((roots[1]+1e-36)/1e-36)<1e-12);
  assert.notEqual(roots[1],0);
  for(const [model,inertia] of [[law({spring:-Number.MIN_VALUE}),1e12],
    [law({spring:-1}),Number.MIN_VALUE],[law({spring:-Number.MIN_VALUE,rate:-1e18}),1]]){
    const r=inspect(model,course(0,0),{inertia,command:0});
    assert.equal(r.counts.unresolvedNumeric,2);assert.equal(r.counts.available,0);
    assert.equal(r.rows[0].status,'unresolved_numeric');
    assert.ok(r.rows[0].modes===null||r.rows[0].modes.eigenvalues===null);
  }
});

test('small signed derivative contributions survive cancellation of much larger admitted terms',()=>{
  const row=inspect(law({spring:1e18,cubic:1/3,command_position:-1e18}),course(1,0),{inertia:1,command:1}).rows[0];
  assert.equal(row.torqueByPosition,1);assert.equal(row.positionResponse,'amplifying');
});

test('response recomputes the law and preserves all input values without trusting cached torque',()=>{
  const model=law({spring:-4,rate:-.2}),states=course();
  states[0].jointTorque=999;states[1].jointTorque=-999;
  const before=JSON.stringify({model,states}),r=inspect(model,states);
  assert.equal(JSON.stringify({model,states}),before);
  near(r.rows[0].jointTorque,-4*.37-.2*.7);
  model.terms[0].coefficient=8;states[0].position=9;
  assert.equal(r.source.model.terms[0].coefficient,-4);assert.equal(r.rows[0].position,.37);
});

test('zero tangent modes do not certify nonlinear stability or stationary motion with nonzero bias',()=>{
  const model=law({cubic:4}),atRest=inspect(model,course(0,0),{inertia:1,command:0});
  assert.equal(atRest.rows[0].stationaryEquation,true);
  assert.equal(atRest.rows[0].modes.pattern,'position_drift');
  const nearby=executeStudioDynamics(model,{position:.1,rate:0},{duration:3,dt:.01});
  assert.ok(nearby.trajectory.at(-1).position>.1);
  const biased=inspect(law({bias:1}),course(0,0)).rows[0];
  assert.equal(biased.stationaryEquation,false);assert.equal(biased.modes.pattern,'position_drift');
});

test('malformed models, source courses and declarations refuse rather than return a partial analysis',()=>{
  const good=law({spring:-1}),valid=course();
  for(const bad of [{schema:'future',terms:[]},law({unrecognized:1}),
    {schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:1},{id:'spring',coefficient:2}]},
    law({spring:Infinity})])assert.throws(()=>inspect(bad));
  for(const states of [[],[valid[0]],Array.from({length:10002},(_,i)=>({time:i/100,position:0,rate:0})),
    [{...valid[0],time:NaN},valid[1]],[valid[0],{...valid[1],time:0}],
    [valid[0],{...valid[1],time:1001}],[{...valid[0],position:1e7},valid[1]],
    [{...valid[0],rate:'0'},valid[1]]])assert.throws(()=>inspect(good,states));
  for(const options of [{inertia:0},{inertia:-1},{inertia:Infinity},{inertia:1e13},
    {inertia:1,command:Infinity},{inertia:1,command:1e7}])assert.throws(()=>inspect(good,valid,options));
});

test('nonzero derivative factors that underflow before inertia scaling remain unavailable',()=>{
  const tiny=Number.MIN_VALUE;
  for(const [terms,position,rate,command,axis] of [
    [{quadratic:tiny},.1,.1,.1,'rate'],
    [{rate_squared:tiny},.1,-.1,.1,'rate'],
    [{cubic:tiny},.1,.1,.1,'position'],
    [{command_position:tiny},.1,.1,.1,'position'],
    [{gravity:tiny},Math.acos(.1),.1,.1,'position'],
    [{cosine:tiny},Math.asin(.1),.1,.1,'position']
  ]){
    const result=inspect(law(terms),course(position,rate),{inertia:1,command});
    assert.equal(result.counts.unresolvedNumeric,2);
    assert.equal(result.rows[0].status,'unresolved_numeric');
    assert.equal(result.rows[0][axis+'Response'],'unavailable');
    assert.equal(result.rows[0][axis==='position'?'torqueByPosition':'torqueByRate'],null);
    assert.equal(result.rows[0].jacobian,null);assert.equal(result.rows[0].modes,null);
  }
  // A true zero factor has no lost nonzero contribution.
  for(const terms of [{quadratic:tiny},{rate_squared:tiny},{cubic:tiny},{command_position:tiny},{cosine:tiny}]){
    const result=inspect(law(terms),course(0,0),{inertia:1,command:0});
    assert.equal(result.rows[0].status,'available');
    assert.equal(result.rows[0].modes.pattern,'position_drift');
  }
});
