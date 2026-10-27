import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTorquePredictor} from '../src/science/torque-discovery.mjs';
import {scanBalanceCandidates} from '../src/science/balance-candidates.mjs';

const model = terms => ({schema:'worldlaw.torque-model/v1',
  terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const window = {minPosition:-2,maxPosition:2,cells:128,refinements:64};
const cubic = model({command:1,rate:-0.8,spring:1,cubic:-1});

test('the same executed cubic law has three numerical candidates and one after a command change',()=>{
  const original = JSON.stringify(cubic);
  const zero = scanBalanceCandidates(cubic,{...window,command:0});
  assert.deepEqual(zero.candidates.map(row=>row.position),[-1,0,1]);
  assert.ok(zero.candidates.every(row=>row.kind==='sampled_zero'));
  const three = scanBalanceCandidates(cubic,{...window,command:0.3});
  const one = scanBalanceCandidates(cubic,{...window,command:0.4});
  assert.equal(three.candidates.length,3);
  assert.equal(one.candidates.length,1);
  for (const report of [zero,three,one]) {
    const predict = prepareTorquePredictor(report.source.model);
    for (const row of report.candidates) {
      assert.equal(row.residual,predict(report.source.command,row.position,0));
      assert.ok(Math.abs(row.residual)<1e-12);
      assert.ok(row.finalBracket[0]<=row.position && row.position<=row.finalBracket[1]);
      assert.ok(row.finalBracket[0]>=row.initialBracket[0] && row.finalBracket[1]<=row.initialBracket[1]);
      assert.ok(row.iterations<=64);
    }
    assert.equal(report.coverage.exhaustive,false);
    assert.match(report.interpretation,/tangent roots/);
    assert.ok(report.evaluations<=129+128*64);
  }
  assert.equal(JSON.stringify(cubic),original);
  zero.source.model.terms[0].coefficient = 99;
  assert.equal(cubic.terms[0].coefficient,1);
});

test('endpoints and shared sampled zeros appear exactly once',()=>{
  const result = scanBalanceCandidates(model({cubic:1,spring:-1}),{
    minPosition:-1,maxPosition:1,cells:2});
  assert.deepEqual(result.candidates.map(row=>row.position),[-1,0,1]);
  assert.ok(result.candidates.every(row=>row.iterations===0));
  assert.equal(result.evaluations,3);
});

test('a missed tangent and a coarse sign bracket do not claim complete roots or residual convergence',()=>{
  const tangent = scanBalanceCandidates(model({cubic:1,spring:-3,bias:2}),{
    minPosition:0.2,maxPosition:1.8,cells:3});
  assert.equal(prepareTorquePredictor(tangent.source.model)(0,1,0),0);
  assert.equal(tangent.candidates.length,0);
  assert.equal(tangent.coverage.exhaustive,false);
  const coarse = scanBalanceCandidates(model({cubic:1,bias:-2}),{
    minPosition:1,maxPosition:2,cells:1,refinements:1});
  assert.equal(coarse.candidates.length,1);
  assert.equal(coarse.candidates[0].termination,'iteration_limit');
  assert.notEqual(coarse.candidates[0].residual,0);
  assert.deepEqual(coarse.candidates[0].finalBracket,[1,1.5]);
});

test('sign comparison survives tiny values and bisection stops at adjacent floating-point positions',()=>{
  const tiny = scanBalanceCandidates(model({spring:1e-200}),{minPosition:-1,maxPosition:1,cells:1});
  assert.equal(tiny.candidates.length,1);
  assert.equal(tiny.candidates[0].kind,'sign_change');
  assert.equal(tiny.candidates[0].position,0);
  const irrational = scanBalanceCandidates(model({cubic:1,bias:-2}),{
    minPosition:1,maxPosition:2,cells:1,refinements:64});
  const row = irrational.candidates[0];
  assert.ok(['adjacent_floats','floating_zero'].includes(row.termination));
  assert.ok(row.finalBracket[1]-row.finalBracket[0]<=Number.EPSILON);
  assert.ok(row.iterations<=64);
});

test('only individually vanishing declared terms certify the at-rest structural case',()=>{
  const zero = scanBalanceCandidates(model({
    command:2,command_position:3,rate:4,coulomb:5,quadratic:6,rate_squared:7,cubic:0,
  }),{...window,command:0});
  assert.equal(zero.status,'all_terms_vanish_at_rest');
  assert.equal(zero.coverage.allTermsVanishAtRest,true);
  assert.equal(zero.evaluations,0);
  assert.equal(zero.candidates.length,0);
  const cancellation = scanBalanceCandidates(model({command:1,bias:-1}),{
    minPosition:0,maxPosition:2,command:1,cells:2});
  assert.equal(cancellation.status,'finite_scan');
  assert.equal(cancellation.coverage.allTermsVanishAtRest,false);
  assert.equal(cancellation.candidates.length,3);
  // The declared predictor's order, including its rounding, is retained.
  const ordered = scanBalanceCandidates(model({command:1e18,bias:1,command_position:-1e18}),{
    minPosition:0.5,maxPosition:1.5,command:1,cells:2});
  assert.ok(ordered.candidates.some(row=>row.position===1 && row.residual===0));
});

test('nonzero feature/contribution underflow refuses the entire scan, including midpoint failures',()=>{
  const numeric = error=>error.code==='unresolved_numeric';
  for (const [law,settings] of [
    [model({command_position:1}),{command:Number.MIN_VALUE,minPosition:0.5,maxPosition:1,cells:1}],
    [model({cubic:1}),{minPosition:1e-200,maxPosition:2e-200,cells:1}],
    [model({gravity:Number.MIN_VALUE}),{minPosition:0.001,maxPosition:0.002,cells:1}],
    [model({cosine:Number.MIN_VALUE}),{minPosition:1.5,maxPosition:1.6,cells:1}],
    [model({spring:Number.MIN_VALUE,bias:Number.MIN_VALUE}),{minPosition:-2,maxPosition:1,cells:1}],
  ]) assert.throws(()=>scanBalanceCandidates(law,settings),numeric);
  const genuineZero = scanBalanceCandidates(model({cubic:0}),{
    minPosition:1e-200,maxPosition:2e-200,cells:1});
  assert.equal(genuineZero.status,'all_terms_vanish_at_rest');
  const tinyConstant = scanBalanceCandidates(model({bias:Number.MIN_VALUE}),window);
  assert.equal(tinyConstant.candidates.length,0);
});

test('finite settings, model admission, grid resolution and work bounds are enforced',()=>{
  for (const settings of [
    {...window,minPosition:NaN}, {...window,maxPosition:Infinity},
    {...window,minPosition:2}, {...window,command:1e6+1},
    {...window,cells:0}, {...window,cells:4097}, {...window,cells:2.5},
    {...window,refinements:0}, {...window,refinements:65},
  ]) assert.throws(()=>scanBalanceCandidates(cubic,settings));
  assert.throws(()=>scanBalanceCandidates(model({spring:1}),{
    minPosition:1,maxPosition:1+Number.EPSILON,cells:2}),error=>error.code==='unresolved_numeric');
  assert.throws(()=>scanBalanceCandidates(model({unknown:1}),window));
  assert.throws(()=>scanBalanceCandidates(model({spring:Infinity}),window));
  const max = scanBalanceCandidates(model({bias:1}),{
    minPosition:-1e6,maxPosition:1e6,cells:4096,refinements:64});
  assert.equal(max.evaluations,4097);
  assert.equal(max.candidates.length,0);
});
