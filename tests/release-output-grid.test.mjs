import test from 'node:test';
import assert from 'node:assert/strict';
import {compareNearbyReleases} from '../src/science/release-separation.mjs';

const smooth = {schema:'worldlaw.torque-model/v1', terms:[{id:'bias',coefficient:0}]};
const fixed = {schema:'worldlaw.torque-model/v1', terms:[{id:'coulomb',coefficient:-0.5}]};
function run(model, options) {
  const initial = {position:0,rate:2};
  const perturbation = {position:0.25,rate:0};
  const before = JSON.stringify({model,initial,perturbation,options});
  try {
    return compareNearbyReleases(model, initial, perturbation, options);
  } finally {
    assert.equal(JSON.stringify({model,initial,perturbation,options}), before,
      'comparison must preserve its original inputs, including refused requests');
  }
}
function completeGrid(result, duration, intervals, method) {
  assert.equal(result.status, 'completed');
  const courses = Object.values(result.courses);
  assert.equal(courses.length, 3);
  for (const course of courses) {
    assert.equal(course.status, 'completed');
    assert.equal(course.diagnostics.method, method);
    const times = course.trajectory.map(row => row.time);
    assert.equal(times.length, intervals + 1);
    assert.equal(times[0], 0);
    assert.equal(times.at(-1), duration);
    assert.equal(times.filter(time => time === duration).length, 1);
    assert.ok(times.every((time,index) => index === 0 || time > times[index-1]));
    assert.deepEqual(times, courses[0].trajectory.map(row => row.time));
    assert.equal(course.executedDuration, duration);
  }
  assert.equal(result.comparisons.full.status, 'completed');
  assert.equal(result.comparisons.half.status, 'completed');
  assert.equal(result.sizeComparison.status, 'completed');
  assert.equal(result.work.courseCount, 3);
  assert.equal(result.work.reservedMaximumFixedSteps, 3 * intervals);
  assert.equal(result.work.failedCourseWorkUnknown, false);
  return courses;
}

for (const [name,model,method] of [
  ['smooth',smooth,'adaptive_RK4_step_doubling'],
  ['fixed Coulomb',fixed,'classical_RK4'],
]) {
  test(name + ' release comparison admits the maintained 10000-interval endpoint grid', () => {
    const duration = 0.13, dt = 0.000013, maxTrials = 50000;
    const result = run(model, {duration,dt,maxTrials});
    const courses = completeGrid(result, duration, 10000, method);
    assert.equal(result.work.reservedMaximumAdaptiveTrials, 3 * maxTrials);
    if (method === 'classical_RK4') {
      assert.equal(courses.reduce((sum,c) => sum + c.diagnostics.acceptedSteps, 0), 30000);
      assert.equal(result.work.completedAdaptiveTrials, 0);
      for (const course of courses) assert.ok(course.trajectory.every(row => row.rate > 0));
    } else {
      const actualTrials = courses.reduce((sum,c) => sum + c.diagnostics.trials, 0);
      assert.equal(result.work.completedAdaptiveTrials, actualTrials);
      assert.ok(actualTrials > 0 && actualTrials <= result.work.reservedMaximumAdaptiveTrials);
      for (const course of courses) assert.ok(course.diagnostics.trials <= maxTrials);
    }
  });
}

test('a genuine final interval is retained and a genuine 10001st interval is refused', () => {
  const partialDuration = 0.07000000000000002;
  assert.ok(7 * 0.01 < partialDuration);
  const result = run(fixed, {duration:partialDuration,dt:0.01});
  const courses = completeGrid(result, partialDuration, 8, 'classical_RK4');
  for (const course of courses) assert.equal(course.trajectory.at(-2).time, 0.07);
  const duration = 0.13000000000000003, dt = 0.000013;
  assert.ok(10000 * dt < duration, 'negative control requires a real extra interval');
  for (const model of [smooth,fixed]) {
    assert.throws(() => run(model, {duration,dt}),
      error => error.code === 'invalid_input' && /10000 output intervals/.test(error.message));
  }
});

test('already-admitted rounded endpoint reports the actual fixed-course reservation', () => {
  const result = run(fixed, {duration:0.07,dt:0.01});
  const courses = completeGrid(result, 0.07, 7, 'classical_RK4');
  assert.equal(courses.reduce((sum,c) => sum + c.diagnostics.acceptedSteps, 0), 21);
  assert.equal(result.work.reservedMaximumFixedSteps, 21);
  assert.equal(result.work.completedAdaptiveTrials, 0);
});

test('output-grid alignment does not relax adaptive complete-run work refusal', () => {
  const result = run(smooth, {duration:0.2,dt:0.1,maxTrials:1});
  assert.equal(result.status, 'incomplete');
  assert.equal(result.work.reservedMaximumAdaptiveTrials, 3);
  assert.equal(result.work.reservedMaximumFixedSteps, 6);
  assert.equal(result.work.failedCourseWorkUnknown, true);
  for (const course of Object.values(result.courses)) {
    assert.equal(course.status, 'failed');
    assert.equal(course.code, 'step_limit');
    assert.equal(course.partialTrajectoryAvailable, false);
    assert.equal(course.executedDuration, null);
  }
  assert.equal(result.comparisons.full.status, 'unavailable');
  assert.equal(result.comparisons.half.status, 'unavailable');
  assert.equal(result.sizeComparison.status, 'unavailable');
});

test('true interval-limit refusal retains precedence while corrected admission exposes invalid trial budgets', () => {
  assert.throws(() => run(smooth, {duration:0.13000000000000003,dt:0.000013,maxTrials:0}),
    error => error.code === 'invalid_input' && /10000 output intervals/.test(error.message));
  assert.throws(() => run(smooth, {duration:0.13,dt:0.000013,maxTrials:0}),
    error => error.code === 'work_limit' && /maxTrials/.test(error.message));
});
