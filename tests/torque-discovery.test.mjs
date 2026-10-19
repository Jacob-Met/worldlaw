import test from 'node:test';
import assert from 'node:assert/strict';
import {discover, predict, evaluate, planExperiment, revise, simulate, DiscoveryError} from '../src/science/torque-discovery.mjs';
import {createLab, executeLab} from '../src/science/virtual-lab.mjs';

// Independently authored deterministic conditions and analytic target laws.
// These do not call the inference feature builder or its predictor to create truth.
function grid(law, count = 121) {
  return Array.from({length:count}, (_, i) => {
    const command = Math.sin(i*1.379)*0.9;
    const rate = Math.cos(i*2.417)*1.8;
    const position = Math.sin(i*0.793+0.4)*2.5;
    return {command, rate, position, jointTorque:law(command,position,rate)};
  });
}
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual-expected) <= tolerance, `${actual} differs from ${expected}`);
function coefficient(model, id) { return model.terms.find(term => term.id === id)?.coefficient; }

test('independent spring + quadratic drag fixture selects structure and coefficients', () => {
  const observations = grid((u,x,v) => 2.1*u - 0.7*x - 0.23*v*Math.abs(v));
  const fitted = discover(observations, {noiseSigma:1e-6});
  assert.equal(fitted.selected.id, 'command+spring+quadratic');
  near(coefficient(fitted.selected,'command'),2.1);
  near(coefficient(fitted.selected,'spring'),-0.7);
  near(coefficient(fitted.selected,'quadratic'),-0.23);
  const heldOut = [{command:-0.33,position:3.2,rate:-2.7,jointTorque:2.1*(-.33)-.7*3.2-.23*(-2.7)*2.7}];
  assert.ok(evaluate(fitted.selected,heldOut).rmse < 1e-10);
});

test('independent Coulomb + gravity fixture does not inherit spring hypothesis', () => {
  const fitted = discover(grid((u,x,v) => -0.6*Math.sign(v)-1.9*Math.sin(x)+0.17),{noiseSigma:1e-6});
  assert.equal(fitted.selected.id,'coulomb+gravity+bias');
  near(coefficient(fitted.selected,'coulomb'),-.6);
  near(coefficient(fitted.selected,'gravity'),-1.9);
  near(predict(fitted.selected,{command:0,position:0,rate:0}),.17);
});

test('bounded-library omitted-physics counterexample is retained as mismatch', () => {
  const fitted = discover(grid((u,x,v) => 0.8*u-0.4*x*x*x+0.15*v),{noiseSigma:0.002});
  assert.equal(fitted.diagnostics.adequacy,'residual_mismatch');
  assert.ok(fitted.selected.metrics.rmse > .02);
  assert.ok(fitted.diagnostics.trainingRmseInNoiseUnits > 10);
});

test('narrow-angle ambiguity drives an experiment then independent prediction improves', () => {
  const lab = createLab();
  const first = discover(lab.initialSamples, lab.options);
  assert.equal(first.selected.id,'command+rate+spring+bias');
  assert.equal(first.diagnostics.selectionAmbiguous,true);
  assert.ok(first.competitive.some(model => model.id === 'command+rate+gravity+bias'));
  const plan = planExperiment(first,lab.candidateInputs);
  assert.equal(plan.status,'proposed');
  assert.ok(Math.abs(plan.selected.input.position)>2.3);
  assert.ok(plan.selected.disagreement>4);
  assert.deepEqual(plan.selected.extrapolation,['position']);
  const snapshot = JSON.stringify(first);
  const measurement = executeLab(plan.selected.input);
  const next = revise(first,[measurement]);
  assert.equal(next.selected.id,'command+rate+gravity+bias');
  assert.equal(next.observations.length,65);
  assert.equal(first.observations.length,64);
  assert.equal(JSON.stringify(first),snapshot,'refitting must preserve the prior evidence and hypotheses');
  const before = evaluate(first.selected,lab.evaluationSamples).rmse;
  const after = evaluate(next.selected,lab.evaluationSamples).rmse;
  assert.ok(before>1 && after<.002 && after<before/500);
  assert.ok(next.revision.before.rmse>4);
});

test('held-out evaluation never mutates or leaks into fit or acquisition', () => {
  const lab = createLab(), fitted = discover(lab.initialSamples,lab.options);
  const before = JSON.stringify(fitted);
  const plan = planExperiment(fitted,lab.candidateInputs);
  evaluate(fitted.selected,lab.evaluationSamples.map(row => ({...row,jointTorque:1e6})));
  assert.equal(JSON.stringify(fitted),before);
  assert.deepEqual(planExperiment(fitted,lab.candidateInputs),plan);
  assert.deepEqual(discover(lab.initialSamples,lab.options),fitted);
  assert.deepEqual(evaluate(fitted.selected,[]),{count:0,rmse:null,maxAbsResidual:null,rows:[]});
});

test('constant/zero excitation cannot be mislabeled structurally identifiable', () => {
  const fitted = discover(Array.from({length:12},()=>({command:0,position:0,rate:0,jointTorque:0})));
  assert.equal(fitted.selected.id,'zero');
  assert.equal(fitted.diagnostics.identifiability,'insufficient_excitation');
  assert.equal(fitted.diagnostics.selectionAmbiguous,true);
  assert.equal(fitted.diagnostics.fullLibraryRank,1);
  assert.ok(fitted.diagnostics.rankDeficientCandidates>0);
  assert.equal(planExperiment(fitted,[{command:1,position:1,rate:1}]).status,'uninformative');
});

test('scale-aware QR recovers a tiny excitation with a large coefficient', () => {
  const observations = Array.from({length:40},(_,i)=> {
    const command=(i-20)*1e-9;
    return {command,position:0,rate:0,jointTorque:2e7*command+0.03};
  });
  const fitted = discover(observations,{terms:['command','bias'],noiseSigma:1e-10});
  assert.equal(fitted.selected.id,'command+bias');
  near(coefficient(fitted.selected,'command'),2e7,1e-7);
  near(coefficient(fitted.selected,'bias'),.03,1e-12);
  assert.ok(fitted.selected.metrics.conditionEstimate<2);
});

test('tiny irrelevant feature rejects only unexecutable candidates, not the useful law', () => {
  const observations = Array.from({length:40},(_,i)=>({
    command:Math.sin(i*.7), position:Math.cos(i*1.3)*1e-25,
    rate:Math.cos(i*2.1), jointTorque:2*Math.sin(i*.7),
  }));
  const result = discover(observations,{noiseSigma:.001});
  assert.equal(result.selected.id,'command');
  near(coefficient(result.selected,'command'),2);
  assert.ok(result.selected.metrics.rmse < 1e-14);
  assert.ok(result.diagnostics.unexecutableCandidates > 0);
});

test('serialized discovery remains executable and revision-compatible', () => {
  const lab=createLab();
  const original=discover(lab.initialSamples,lab.options);
  const restored=JSON.parse(JSON.stringify(original));
  const point={command:.4,position:.9,rate:-.2};
  near(predict(restored.selected,point),predict(original.selected,point));
  assert.deepEqual(revise(restored,[executeLab(point)]),revise(original,[executeLab(point)]));
});

test('RK4 agrees with independent harmonic-oscillator solution', () => {
  const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:-4}]};
  const trajectory=simulate(model,{position:1,rate:0},{duration:2.37,dt:.01,inertia:1,command:0});
  const final=trajectory.at(-1);
  assert.equal(final.time,2.37);
  near(final.position,Math.cos(2*2.37),2e-8);
  near(final.rate,-2*Math.sin(2*2.37),2e-8);
  assert.ok(trajectory.every((row,i)=>i===0 || row.time>trajectory[i-1].time));
});

test('RK4 handles a nonmultiple final step and refuses runaway or invalid setup', () => {
  const model={schema:'worldlaw.torque-model/v1',terms:[{id:'bias',coefficient:2}]};
  const final=simulate(model,{position:.2,rate:.1},{duration:.025,dt:.01,inertia:2}).at(-1);
  near(final.position,.2+.1*.025+.5*.025**2,1e-12);
  near(final.rate,.125,1e-12);
  assert.throws(()=>simulate(model,{position:0,rate:0},{dt:0}),DiscoveryError);
  assert.throws(()=>simulate(model,{position:0,rate:0},{duration:100,dt:1e-6}),DiscoveryError);
  assert.throws(()=>simulate({schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:1e12}]},{position:1,rate:0}),DiscoveryError);
});

test('invalid or underdetermined inputs fail explicitly instead of emitting NaNs', () => {
  const samples=grid((u,x,v)=>u);
  assert.throws(()=>discover(samples.slice(0,7)),DiscoveryError);
  assert.throws(()=>discover([...samples,{command:0,position:NaN,rate:0,jointTorque:0}]),DiscoveryError);
  assert.throws(()=>discover(samples,{terms:['command','command']}),DiscoveryError);
  assert.throws(()=>discover(samples,{noiseSigma:0}),DiscoveryError);
  assert.throws(()=>discover(samples,{maxTerms:8}),DiscoveryError);
  assert.throws(()=>predict({schema:'worldlaw.torque-model/v1',terms:[{id:'arbitrary-code',coefficient:1}]},{command:1,position:0,rate:0}),DiscoveryError);
  assert.throws(()=>revise(discover(samples),[]),DiscoveryError);
});

test('parameter drift is retained as conflicting residual evidence, not asserted solved', () => {
  const samples=grid((u,x,v)=>1.4*u-.3*v-.9*x);
  const fitted=discover(samples,{noiseSigma:.001});
  const changed=grid((u,x,v)=>1.4*u-.3*v-1.8*x,30);
  const revised=revise(fitted,changed);
  assert.ok(revised.revision.before.rmse>.5);
  assert.equal(revised.diagnostics.adequacy,'residual_mismatch');
  assert.equal(revised.observations.length,151);
});
