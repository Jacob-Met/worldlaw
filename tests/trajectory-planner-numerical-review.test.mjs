import test from 'node:test';
import assert from 'node:assert/strict';
import {planTrajectoryExperiment} from './support/trajectory-planner-baseline.mjs';
import {rolloutWithResolution} from '../src/trajectory/resolution.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

const dampingModel = k => ({schema: 'worldlaw.torque-model/v1', id: `damping-${k}`,
  terms: [{id: 'rate', coefficient: -k}], units: {...UNITS}});
const discovery = models => ({schema: 'worldlaw.discovery/v1', units: {...UNITS},
  selected: models[0], candidates: models, competitive: models, trainingRuns: [{id: 'independent-analytic-case'}]});
const release = maxStep => ({inertia: 1, bounds: {initialPosition: {min: 0, max: 0}, initialRate: {min: 1, max: 1}},
  duration: .1, sampleInterval: .1, maxStep, minDisagreement: .01});
const scheduledRun = {id: 'unobserved-linear-damping', label: 'Numerical prediction schedule', kind: 'synthetic',
  source: {label: 'Analytic counterexample; future positions are placeholders, not measurements'}, inertia: 1, initialRate: 1,
  samples: [{time: 0, position: 0, command: 0}, {time: .1, position: 0, command: 0}]};

// Independent exact solution of omega'=-k*omega, theta'=omega, theta(0)=0,
// omega(0)=1. This reference never calls WORLDLAW's forward solver.
const exactPosition = (k, t) => -Math.expm1(-k * t) / k;

test('retained counterexample: finite default-step RK4 disagreement is not physical model separation', () => {
  const models = [300, 301].map(dampingModel), plan = planTrajectoryExperiment(discovery(models), release(.01));
  const exactSeparation = Math.abs(exactPosition(300, .1) - exactPosition(301, .1));
  assert.equal(plan.status, 'proposed');
  assert.ok(plan.selected.disagreementRad > .012 && plan.selected.disagreementRad < .013);
  assert.ok(exactSeparation < .000012);
  assert.ok(plan.selected.disagreementRad / exactSeparation > 1000);
  const checks = models.map(model => rolloutWithResolution(model, scheduledRun, {maxStep: .01, maxSteps: 1000}));
  assert.ok(checks.every(check => check.resolution.status === 'compared'));
  assert.ok(checks.every(check => check.resolution.positionRMSEDifference > plan.selected.disagreementRad));
  assert.ok(plan.selected.predictions.every(model => model.rows.at(-1).rate > 20));
  assert.ok(Math.exp(-300 * .1) < 1e-12);
});

test('reducing the integration step recovers the independent exact non-discriminating result', () => {
  const models = [300, 301].map(dampingModel), plan = planTrajectoryExperiment(discovery(models), release(.0001));
  const exactSeparation = Math.abs(exactPosition(300, .1) - exactPosition(301, .1));
  assert.equal(plan.status, 'uninformative');
  assert.ok(Math.abs(plan.selected.disagreementRad - exactSeparation) < 1e-14);
  const checks = models.map(model => rolloutWithResolution(model, scheduledRun, {maxStep: .0001, maxSteps: 4000}));
  assert.ok(checks.every(check => check.resolution.positionRMSEDifference < 1e-12));
});

test('even a coarse and refined finite pair can disagree by a radian without hitting the state limit', () => {
  const models = [100, 101].map(dampingModel), plan = planTrajectoryExperiment(discovery(models), release(.1));
  assert.equal(plan.status, 'proposed');
  assert.ok(plan.selected.disagreementRad > .09);
  assert.ok(Math.abs(exactPosition(100, .1) - exactPosition(101, .1)) < .0001);
  const checks = models.map(model => rolloutWithResolution(model, scheduledRun, {maxStep: .1, maxSteps: 100}));
  assert.ok(checks.every(check => check.resolution.status === 'compared' && check.resolution.positionRMSEDifference > .9));
});
