import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate, DiscoveryError} from '../src/science/torque-discovery.mjs';
import {executeStudioDynamics, simulateAdaptiveDynamics} from '../src/science/studio-dynamics.mjs';

const law = terms => ({schema:'worldlaw.torque-model/v1', id:'independent-control', terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const rms = (rows, expected) => Math.hypot(...rows.map(row=>row.position-expected(row.time)))/Math.sqrt(rows.length);
const coded = code => error => error instanceof DiscoveryError && error.code === code;

test('fast analytic oscillators receive automatic refinement on the unchanged output grid', () => {
  for(const omega of [10, 40, 100, 200]) {
    const model=law({spring:-omega*omega}), inputs={position:1,rate:0}, settings={duration:2,dt:.02};
    const report=executeStudioDynamics(model,inputs,settings);
    const error=rms(report.trajectory,t=>Math.cos(omega*t));
    assert.ok(error<4e-5,JSON.stringify({omega,error}));
    assert.equal(report.trajectory.length,101);
    assert.deepEqual(report.trajectory.map(row=>row.time),Array.from({length:101},(_,i)=>i===100?2:i*.02));
    assert.equal(report.diagnostics.method,'adaptive_RK4_step_doubling');
    assert.ok(report.diagnostics.largestAcceptedErrorRatio<=1);
    assert.equal(report.diagnostics.trials,report.diagnostics.acceptedSteps+report.diagnostics.rejectedSteps);
    assert.equal(report.diagnostics.derivativeEvaluations,12*report.diagnostics.trials);
    assert.equal(report.diagnostics.globalErrorBound,null);
    assert.equal(report.diagnostics.observationsResetState,false);
    if(omega<200) {
      const baseline=rms(simulate(model,inputs,settings),t=>Math.cos(omega*t));
      assert.ok(error<baseline/50,JSON.stringify({omega,error,baseline}));
    } else assert.throws(()=>simulate(model,inputs,settings),DiscoveryError);
  }
});

test('changed inertia, equilibrium, initial rate and nonmultiple duration agree with a separate damped oracle', () => {
  for(const inertia of [.002, .7, 3.4]) {
    const omega=37,decay=.8,k=inertia*omega*omega,damping=2*decay*inertia,drive=.4*k;
    const initial={position:1.3,rate:-.7}, duration=1.237;
    const damped=Math.sqrt(omega*omega-decay*decay),offset=initial.position-drive/k;
    const expected=t=>drive/k+Math.exp(-decay*t)*(offset*Math.cos(damped*t)+(initial.rate+decay*offset)/damped*Math.sin(damped*t));
    const model=law({command:1,rate:-damping,spring:-k});
    const report=simulateAdaptiveDynamics(model,initial,{inertia,command:drive,duration,dt:.03});
    assert.ok(rms(report.trajectory,expected)<4e-6);
    assert.equal(report.trajectory.at(-1).time,duration);
    assert.equal(report.trajectory.at(-2).time,1.23);
    assert.equal(report.trajectory[0].position,initial.position);
    assert.equal(report.trajectory[0].rate,initial.rate);
  }
});

test('independent nonlinear analytic courses cover cubic response and both signs of quadratic drag', () => {
  const cubic=simulateAdaptiveDynamics(law({spring:-5.6,cubic:5.6}),{position:0,rate:1},{inertia:2.8,duration:2,dt:.07});
  assert.ok(rms(cubic.trajectory,Math.tanh)<2e-7);
  for(const initialRate of [-3,3]) {
    const b=2.3,inertia=.8,q0=.4;
    const drag=simulateAdaptiveDynamics(law({quadratic:-b*inertia}),{position:q0,rate:initialRate},{inertia,duration:1.337,dt:.05});
    const expected=t=>q0+Math.sign(initialRate)*Math.log1p(b*Math.abs(initialRate)*t)/b;
    assert.ok(rms(drag.trajectory,expected)<2e-7);
    for(const row of drag.trajectory)assert.ok(Math.abs(row.rate-initialRate/(1+b*Math.abs(initialRate)*row.time))<3e-7);
  }
});

test('automatic policy retains exact fixed-step sign-law behavior and does not claim smooth error control', () => {
  const model=law({spring:-4,coulomb:-.6}),initial={position:.8,rate:0},settings={duration:.37,dt:.02};
  const result=executeStudioDynamics(model,initial,settings);
  assert.deepEqual(result.trajectory,simulate(model,initial,settings));
  assert.equal(result.diagnostics.method,'classical_RK4');
  assert.match(result.diagnostics.interpretation,/No local error control or sticking/);
  assert.throws(()=>simulateAdaptiveDynamics(model,initial,settings),coded('unsupported_nonsmooth'));
  assert.equal(executeStudioDynamics(law({spring:-4,coulomb:0}),initial,settings).diagnostics.method,'adaptive_RK4_step_doubling');
});

test('complete-run work exhaustion and precision failure cannot publish a partial or fixed substitute', () => {
  const model=law({spring:-40000});
  for(const run of [simulateAdaptiveDynamics,executeStudioDynamics]) {
    assert.throws(()=>run(model,{position:1,rate:0},{duration:2,dt:.02,maxTrials:10}),coded('step_limit'));
    assert.throws(()=>run(law({}),{position:0,rate:0},{duration:Number.MIN_VALUE,dt:Number.MIN_VALUE}),coded('step_underflow'));
    assert.throws(()=>run(law({spring:1e12}),{position:1,rate:0},{duration:1,dt:.02,maxTrials:300}),
      error=>error instanceof DiscoveryError&&['step_limit','step_underflow'].includes(error.code));
  }
});

test('invalid values refuse before evaluation and source objects remain unchanged', () => {
  const model=law({spring:-10}),initial={position:.4,rate:-.2},settings={duration:.333,dt:.03};
  const before=JSON.stringify({model,initial,settings});
  const first=executeStudioDynamics(model,initial,settings);
  assert.deepEqual(first,executeStudioDynamics(model,initial,settings));
  assert.equal(JSON.stringify({model,initial,settings}),before);
  for(const patch of [
    {dt:0},{dt:NaN},{duration:0},{duration:Infinity},{inertia:0},{command:'1'},
    {duration:100,dt:.00001},{relativeTolerance:0},{positionTolerance:-1},
    {rateTolerance:1},{maxTrials:0},{maxTrials:100001},{maxTrials:1.5},
  ])assert.throws(()=>executeStudioDynamics(model,initial,{...settings,...patch}),DiscoveryError);
  for(const bad of [{position:NaN,rate:0},{position:0,rate:Infinity},{position:1e7,rate:0},null])
    assert.throws(()=>executeStudioDynamics(model,bad,settings),DiscoveryError);
  assert.throws(()=>executeStudioDynamics(law({spring:Infinity}),initial,settings),DiscoveryError);
  assert.throws(()=>executeStudioDynamics(law({unknown:1}),initial,settings),DiscoveryError);
});

test('stricter local scales improve a held-back frequency without fitting or altering the evidence', () => {
  const omega=73,model=law({spring:-omega*omega}),initial={position:.27,rate:.12},settings={duration:1.823,dt:.033};
  const expected=t=>initial.position*Math.cos(omega*t)+initial.rate/omega*Math.sin(omega*t);
  const original=simulateAdaptiveDynamics(model,initial,settings);
  const tighter=simulateAdaptiveDynamics(model,initial,{...settings,relativeTolerance:1e-10,positionTolerance:1e-12,rateTolerance:1e-12});
  assert.ok(rms(tighter.trajectory,expected)<rms(original.trajectory,expected)/10);
  assert.ok(tighter.diagnostics.derivativeEvaluations>original.diagnostics.derivativeEvaluations);
  assert.deepEqual(original.trajectory.map(x=>x.time),tighter.trajectory.map(x=>x.time));
});

test('resolved control pays bounded extra work and the fixed public API is unchanged', () => {
  const model=law({spring:-4}),initial={position:1,rate:0},settings={duration:1,dt:.02};
  const auto=executeStudioDynamics(model,initial,settings);
  assert.ok(auto.diagnostics.trials<=101);
  assert.ok(auto.diagnostics.derivativeEvaluations<=1212);
  const first=simulate(model,initial,settings);
  assert.equal(first.length,51);
  assert.equal(first.at(-1).time,1);
  assert.deepEqual(first,simulate(model,initial,settings));
});
