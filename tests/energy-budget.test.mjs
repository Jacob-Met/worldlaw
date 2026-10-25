import test from 'node:test';
import assert from 'node:assert/strict';
import {energyBudget} from '../src/science/energy-budget.mjs';
import {simulate} from '../src/science/torque-discovery.mjs';
const model=terms=>({schema:'worldlaw.torque-model/v1',terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('independent conservative oscillator preserves kinetic plus relative potential',()=>{
  const states=Array.from({length:101},(_,i)=>({time:i/100,position:Math.cos(i/100),rate:-Math.sin(i/100)}));
  const result=energyBudget(model({spring:-2}),states,{inertia:2});
  near(result.final.energyChange,0);near(result.final.commandWork,0);near(result.final.rateWork,0);
});
test('potential differences differentiate to negative restoring torque including gravity',()=>{
  const m=model({spring:-2,gravity:-3,cubic:-4,bias:.5});
  const p=.7,h=1e-6;
  const evaluate=x=>energyBudget(m,[{time:0,position:.2,rate:0},{time:1,position:x,rate:0}],{inertia:1}).final.potentialEnergy;
  near((evaluate(p+h)-evaluate(p-h))/(2*h),2*p+3*Math.sin(p)+4*p**3-.5,1e-8);
});
test('analytic driven constant acceleration separates command and position-command work',()=>{
  const states=Array.from({length:101},(_,i)=>({time:i/100,position:(i/100)**2/2,rate:i/100}));
  const result=energyBudget(model({command:1}),states,{inertia:2,command:2});
  near(result.final.energyChange,1);near(result.final.commandWork,1);near(result.final.balanceResidual,0);
  const coupled=energyBudget(model({command_position:3}),[{time:0,position:1,rate:2},{time:1,position:3,rate:2}],{inertia:1,command:2});
  near(coupled.final.commandWork,24);
});
test('antidamping is distinct from unstable conservative potential',()=>{
  const states=[{time:0,position:1,rate:1},{time:1,position:2,rate:2}];
  assert.ok(energyBudget(model({rate:1}),states,{inertia:1}).final.positiveRateWork>0);
  near(energyBudget(model({spring:1}),states,{inertia:1}).final.positiveRateWork,0);
  assert.ok(energyBudget(model({rate:-1,coulomb:-.3,quadratic:-.2}),states,{inertia:1}).final.rateWork<0);
});
test('actual maintained RK4 damped law balance improves with refinement',()=>{
  const m=model({spring:-2,rate:-.4});
  const run=dt=>energyBudget(m,simulate(m,{position:1,rate:0},{duration:2,dt,inertia:1}),{inertia:1});
  const coarse=run(.02),fine=run(.01);
  assert.ok(fine.maxAbsBalanceResidual<coarse.maxAbsBalanceResidual*.3);
  assert.ok(fine.final.energyChange<0);near(fine.final.positiveRateWork,0);
});
test('refuses malformed models, nonfinite states and nonmonotone time',()=>{
  const states=[{time:0,position:1,rate:0},{time:1,position:0,rate:1}];
  for(const inertia of [0,-1,NaN,Infinity])assert.throws(()=>energyBudget(model({}),states,{inertia}));
  assert.throws(()=>energyBudget(model({unknown:1}),states,{inertia:1}));
  assert.throws(()=>energyBudget(model({}),[states[0],{...states[1],time:0}],{inertia:1}));
  assert.throws(()=>energyBudget(model({}),[states[0],{...states[1],rate:NaN}],{inertia:1}));
});
