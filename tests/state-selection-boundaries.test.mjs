import test from 'node:test';
import assert from 'node:assert/strict';
import {createRmsAccumulator} from '../src/science/stable-rms.mjs';
import {discoverTrajectoryEvolution} from '../src/science/trajectory-operator-synthesis.mjs';
import {forecastStateTrajectory} from '../src/science/state-trajectory.mjs';

const base={estimator:'free-stlsq',windowPoints:33,stride:8,grammar:{degree:1,unary:[],rational:false,flux:false},thresholds:[.05],ridges:[.001]};
const zero=id=>({schema:'worldlaw.state-trajectory/v1',id,kind:'oscillator',samples:Array.from({length:129},(_,i)=>({time:i*.025,state:[0,0],command:0}))});

test('RMS retains representable large and tiny magnitudes and weighted counts',()=>{
  for(const magnitude of [1e200,1e-200]){
    const a=createRmsAccumulator();a.add(magnitude,3);a.add(-magnitude);
    assert.equal(a.value(),magnitude);assert.equal(a.count,4);
  }
  const ordinary=createRmsAccumulator();ordinary.add(3);ordinary.add(4);
  assert.equal(ordinary.value(),Math.sqrt(12.5));assert.equal(ordinary.ordinarySum,25);
  ordinary.add(Infinity);assert.ok(Number.isNaN(ordinary.value()));
});

test('finite huge suffixes cannot be admitted by overflowing residual and signal squares',()=>{
  const selected=zero('selection');for(let i=11;i<selected.samples.length;i++)selected.samples[i].state=[1e200,1e200];
  for(const selectionScaling of ['raw','channel-noise']){
    const result=discoverTrajectoryEvolution([zero('fit-a'),zero('fit-b')],[selected],{...base,selectionScaling});
    assert.equal(result.status,'abstained');assert.equal(result.reason,'selection_forecast_mismatch');
    assert.ok(Number.isFinite(result.selection.selectionRmse));
    assert.ok(result.selection.selectionRmse>result.diagnostics.tolerance);
    const forecast=forecastStateTrajectory(result.model,selected);
    assert.equal(forecast.status,'forecast');assert.equal(forecast.rmse,1e200);assert.equal(forecast.relativeRmse,1);
  }
  const overflowed=discoverTrajectoryEvolution([zero('fit-a'),zero('fit-b')],[selected],{...base,adequacySignalFraction:1e308});
  assert.equal(overflowed.status,'abstained');assert.equal(overflowed.reason,'nonfinite_tolerance');assert.equal(overflowed.diagnostics.tolerance,null);
});

test('nonfinite observation-noise arithmetic refuses without a positive verdict',()=>{
  const selected=zero('selection');
  for(let i=11;i<selected.samples.length;i++)selected.samples[i].state=[(i%2?1:-1)*1e308,(i%2?1:-1)*1e308];
  for(const selectionScaling of ['raw','channel-noise']){
    const result=discoverTrajectoryEvolution([zero('fit-a'),zero('fit-b')],[selected],{...base,selectionScaling});
    assert.equal(result.status,'abstained');assert.equal(result.selection.forecastReason,'nonfinite_metrics');
    assert.equal(result.selection.selectionRmse,null);assert.equal(result.frontier.length,0);
  }
});

const field=id=>({schema:'worldlaw.state-trajectory/v1',id,kind:'periodic',spacing:1,samples:Array.from({length:65},(_,i)=>({
  time:i*.025,state:Array.from({length:64},(_,j)=>Math.exp(-.3*i*.025)*(.7+.3*Math.sin(j*.7)+.2*Math.cos(j*1.3))),command:Array(64).fill(0)
}))});
test('an over-budget fitted support stays in the menu while affordable candidates forecast',()=>{
  const options={estimator:'free-stlsq',grammar:{basis:'extended-state'},windowPoints:33,stride:8,thresholds:[0,1e6],ridges:[.1],forecastInitialization:'prefix-shooting'};
  const result=discoverTrajectoryEvolution([field('fit')],[field('selection')],options);
  assert.equal(result.candidates.length,2);
  const refused=result.candidates.find(c=>c.forecastStatus==='budget_refused');
  assert.ok(refused.model.terms.length>14);assert.equal(refused.forecastReason,'prefix_expression_work');
  assert.equal(refused.selectionRmse,null);assert.equal(refused.fitStatus,'converged');
  assert.ok(refused.forecastWork[0].prefixExpressions>8388608);
  const affordable=result.candidates.find(c=>c.forecastStatus==='forecast');
  assert.equal(affordable.model.terms.length,0);assert.ok(Number.isFinite(affordable.selectionRmse));
  const all=discoverTrajectoryEvolution([field('fit')],[field('selection')],{...options,thresholds:[0]});
  assert.equal(all.status,'abstained');assert.equal(all.reason,'all_forecasts_budget_refused');
});

test('all QR work refusals retain their fit cause instead of a fabricated forecast mismatch',()=>{
  const kinetic=id=>({schema:'worldlaw.state-trajectory/v1',id,kind:'kinetic',samples:Array.from({length:129},(_,i)=>({
    time:i*.025,state:[Math.exp(-.3*i*.025),Math.exp(-.7*i*.025)],command:[0,0]
  }))});
  const result=discoverTrajectoryEvolution([kinetic('fit')],[kinetic('selection')],{...base,maxWorkPerRow:1});
  assert.equal(result.status,'abstained');assert.equal(result.reason,'all_fits_refused');
  assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].fitStatus,'refused');
  assert.equal(result.model,null);assert.equal(result.frontier.length,0);
});
