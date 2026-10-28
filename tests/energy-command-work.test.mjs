import test from 'node:test';
import assert from 'node:assert/strict';
import {energyBudget} from '../src/science/energy-budget.mjs';
import {executeStudioDynamics} from '../src/science/studio-dynamics.mjs';

const model = terms => ({schema:'worldlaw.torque-model/v1',
  terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const near = (actual, expected, tolerance=1e-10) =>
  assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);

test('constant-command work closes on an analytically driven oscillator despite sparse unequal samples',()=>{
  // theta=1+cos(t) solves theta''=1-theta. Exact work is displacement.
  const states=[0,Math.PI/2,2*Math.PI].map(time=>({time,position:1+Math.cos(time),rate:-Math.sin(time)}));
  const out=energyBudget(model({command:1,spring:-1}),states,{inertia:1,command:1});
  near(out.rows[1].commandWork,-1);
  near(out.final.commandWork,0);
  near(out.maxAbsBalanceResidual,0);
});

test('position-command work follows kinetic energy of its exact oscillator at turning points',()=>{
  // theta''=-theta is supplied entirely by command_position; no potential terms.
  const states=[0,Math.PI/4,Math.PI].map(time=>({time,position:Math.cos(time),rate:-Math.sin(time)}));
  const out=energyBudget(model({command_position:-1}),states,{inertia:1,command:1});
  near(out.rows[1].commandWork,.25);
  near(out.final.commandWork,0);
  near(out.maxAbsBalanceResidual,0);
});

test('combined command terms preserve signed work through a nonuniform turning course',()=>{
  // u=-2, a=3, b=2: theta=-1.5+cos(2t) solves theta''=-6-4theta.
  // With no potential or drag, work equals independently known kinetic energy.
  const states=[0,.17,.8,Math.PI/2,2.1,Math.PI].map(time=>({
    time,position:-1.5+Math.cos(2*time),rate:-2*Math.sin(2*time)}));
  const out=energyBudget(model({command:3,command_position:2}),states,{inertia:1,command:-2});
  for(let i=0;i<states.length;i++) near(out.rows[i].commandWork,2*Math.sin(2*states[i].time)**2);
  near(out.final.commandWork,0);
});

test('admitted large nearby coordinates retain small nonzero work',()=>{
  // Binary-exact displacement, and an affine torque whose initial value is zero.
  // Triangle area is integral of linearly increasing torque over displacement.
  const p0=2**19, d=2**-20;
  const states=[{time:0,position:p0,rate:0},{time:1,position:p0+d,rate:0}];
  const out=energyBudget(model({command:-p0,command_position:1}),states,{inertia:1,command:1});
  near(out.final.commandWork,d*d/2,1e-25);
});

test('rate quadrature, instantaneous powers and all source inputs remain unchanged',()=>{
  const m=model({command:2,command_position:3,rate:-1,coulomb:2,quadratic:.5});
  const states=[{time:0,position:0,rate:-2},{time:.25,position:1,rate:0},{time:1,position:-1,rate:3}];
  const options={inertia:2,command:-2};
  const before=JSON.stringify({m,states,options});
  const out=energyBudget(m,states,options);
  out.rows.forEach((row,i)=>near(row.commandPower,[8,0,6][i]));
  out.rows.forEach((row,i)=>near(row.ratePower,[4,0,10.5][i]));
  near(out.final.rateWork,4.4375);
  near(out.final.positiveRateWork,4.4375);
  assert.equal(JSON.stringify({m,states,options}),before);
  const dissipative=energyBudget(model({rate:-1}),states,options);
  near(dissipative.final.rateWork,-3.875);
  near(dissipative.final.positiveRateWork,0);
});

test('actual adaptive Studio states avoid coarse command quadrature without claiming a global error bound',()=>{
  for(const [terms,command,inertia] of [
    [{spring:-22500,command:1},2,1],
    [{spring:-22500,command:1.5,command_position:7},-3,2],
  ]) {
    const m=model(terms), options={duration:.501,dt:.02,command,inertia};
    const execution=executeStudioDynamics(m,{position:1,rate:0},options);
    assert.equal(execution.diagnostics.method,'adaptive_RK4_step_doubling');
    assert.equal(execution.diagnostics.globalErrorBound,null);
    const out=energyBudget(m,execution.trajectory,options);
    // Absolute J control: this is a numerical regression, not a solver accuracy guarantee.
    assert.ok(out.maxAbsBalanceResidual<.01,`residual ${out.maxAbsBalanceResidual} J`);
  }
});
