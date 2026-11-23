import test from 'node:test';
import assert from 'node:assert/strict';
import {TERMS, DEFAULT_TERMS, UNITS, predict} from '../src/science/torque-discovery.mjs';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
import {inspectInputEnclosures} from '../src/science/input-enclosure.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

const units = {time:'s', position:'rad', command:'N·m', inertia:'kg·m²', initialRate:'rad/s'};
const options = {terms:['command','command_cubic'], maxTerms:2, noiseSigma:1e-8,
  windowDuration:0.25, windowStride:0.125};
const law = {schema:'worldlaw.torque-model/v1', id:'authored', units:UNITS,
  terms:[{id:'command',coefficient:1.25},{id:'command_cubic',coefficient:-0.75}]};

function analyticRun(levels) {
  const dt = 1/256, inertia = 1.5, initialRate = -0.125;
  let position = 0.5, rate = initialRate;
  const samples = [];
  for (let i = 0; i <= 2048; i++) {
    const u = levels[Math.floor(i/64) % levels.length];
    samples.push({time:i*dt, position, command:u});
    const acceleration = (1.25*u - 0.75*u**3)/inertia;
    position += rate*dt + 0.5*acceleration*dt**2;
    rate += acceleration*dt;
  }
  return {id:'independent-piecewise-parabolas',label:'Analytic parabolas',kind:'synthetic',units,inertia,initialRate,
    source:{label:'Analytic left-held constant-acceleration intervals'},samples};
}

test('cubic command has torque-inverse-squared coefficient units and is opt-in', () => {
  assert.equal(DEFAULT_TERMS.includes('command_cubic'), false);
  assert.equal(TERMS.find(t => t.id === 'command_cubic').coefficientUnit, '1/(N·m)²');
  assert.equal(predict(law,{command:-0.5,position:0,rate:0}), -0.53125);
});

test('sign reversal alone does not identify u against u³', () => {
  const result = discoverWeak([analyticRun([1,-1])], options);
  assert.equal(result.diagnostics.fullLibraryRank, 1);
  assert.equal(result.diagnostics.identifiability, 'insufficient_excitation');
  const a = result.candidates.find(c => c.id === 'command');
  const b = result.candidates.find(c => c.id === 'command_cubic');
  assert.equal(a.terms[0].coefficient, b.terms[0].coefficient);
  assert.equal(a.metrics.score, b.metrics.score);
});

test('interior commands separate both gains, execute forward and ignore terminal command', () => {
  const run = analyticRun([1,-0.5,-1,0.375]);
  const fit = discoverWeak([run], options);
  assert.equal(fit.diagnostics.fullLibraryRank, 2);
  assert.equal(fit.selected.id, 'command+command_cubic');
  assert.ok(Math.abs(fit.selected.terms[0].coefficient-1.25) < 0.004);
  assert.ok(Math.abs(fit.selected.terms[1].coefficient+0.75) < 0.004);
  const before = rollout(law,run);
  assert.ok(before.metrics.maxAbsError < 1e-9);
  const changed = structuredClone(run);
  changed.samples.at(-1).command = -16.125;
  const after = discoverWeak([changed],options);
  assert.deepEqual(after.selected.terms,fit.selected.terms);
  assert.equal(after.selected.metrics.rmse,fit.selected.metrics.rmse);
  assert.deepEqual(rollout(law,changed).rows.map(r=>r.predicted),before.rows.map(r=>r.predicted));
});

test('uncertain-input enclosure cubes command endpoints in both refinement paths',()=>{
  const model={...law,terms:[{id:'command_cubic',coefficient:1},{id:'spring',coefficient:1},{id:'cubic',coefficient:1}]};
  const obs=[{command:-2,rate:8,position:1,jointTorque:-6}];
  const radii={command:0.5,rate:0,position:0.1,jointTorque:0};
  for(const refinementSegments of [0,4]) {
    const r=inspectInputEnclosures(model,obs,radii,{refinementSegments});
    const [lo,hi]=r.rows[0].prediction;
    assert.ok(lo <= (-2.5)**3 + 0.9 + 0.9**3);
    assert.ok(hi >= (-1.5)**3 + 1.1 + 1.1**3);
    assert.ok(lo > -16 && hi < 0);
  }
});
