/** Reproducible, synthetic-only comparison; oracle never enters discovery. */
import {pathToFileURL} from 'node:url';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {deriveTorqueObservations} from '../src/science/trajectory-observations.mjs';
import {discover} from '../src/science/torque-discovery.mjs';

export function gaussian(seed) {
  let state = seed >>> 0;
  const uniform = () => {state = (1664525 * state + 1013904223) >>> 0; return (state + .5) / 4294967296;};
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}

// Closed-form damped spring with constant torque: no inference or fitted forward solver.
export function springRun({id = 'spring', position = 1.2, rate = .3, command = 0, duration = 6, dt = .025,
  inertia = .8, stiffness = 2.2, damping = .22, gain = 1.3, sigma = 0, seed = 1} = {}) {
  const noise = gaussian(seed), equilibrium = gain * command / stiffness, alpha = damping / (2 * inertia);
  const frequency = Math.sqrt(stiffness / inertia - alpha ** 2), a = position - equilibrium, b = (rate + alpha * a) / frequency;
  const samples = Array.from({length: Math.round(duration / dt) + 1}, (_, i) => {
    const time = i * dt;
    return {time, position: equilibrium + Math.exp(-alpha * time) * (a * Math.cos(frequency * time) + b * Math.sin(frequency * time)) + sigma * noise(), command};
  });
  return {id, label: 'Independent analytic damped spring', kind: 'synthetic', inertia, initialRate: rate, samples,
    source: {label: 'Closed-form underdamped oscillator; seeded iid Gaussian angle perturbations'}};
}

// Separately coded high-resolution RK4 truth; explicit equation has no feature library/model import.
export function gravityRun({id = 'gravity', position = 1.2, rate = .3, command = 0, duration = 6, dt = .025,
  inertia = .8, stiffness = 2.2, damping = .22, gain = 1.3, sigma = 0, seed = 1, cubic = 0} = {}) {
  const initialRate = rate, noise = gaussian(seed), samples = [{time: 0, position: position + sigma * noise(), command}];
  const acceleration = (p, v) => (gain * command - stiffness * Math.sin(p) - damping * v - cubic * p ** 3) / inertia;
  for (let i = 1; i <= Math.round(duration / dt); i++) {
    const steps = Math.ceil(dt / .0005), h = dt / steps;
    for (let j = 0; j < steps; j++) {
      const ap = rate, av = acceleration(position, rate);
      const bp = rate + h * av / 2, bv = acceleration(position + h * ap / 2, bp);
      const cp = rate + h * bv / 2, cv = acceleration(position + h * bp / 2, cp);
      const dp = rate + h * cv, dv = acceleration(position + h * cp, dp);
      position += h * (ap + 2 * bp + 2 * cp + dp) / 6;
      rate += h * (av + 2 * bv + 2 * cv + dv) / 6;
    }
    samples.push({time: i * dt, position: position + sigma * noise(), command});
  }
  // Initial rate is the physical start, not the evolved variable.
  return {id, label: 'Independent fine-step damped pendulum', kind: 'synthetic', inertia,
    initialRate, samples,
    source: {label: 'Independent explicit-equation RK4 at ≤0.0005s; seeded iid Gaussian angle perturbations'}};
}

// Exact drag fixtures isolate the first-derivative-dependent library path.
export function dragRun({id = 'drag', position = .4, rate = 2.2, sigma = 0, seed = 1, coulomb = false} = {}) {
  const inertia = .8, drag = .7, noise = gaussian(seed), duration = coulomb ? 1 : 4, dt = .025;
  return {id, label: coulomb ? 'Analytic constant-sign Coulomb drag' : 'Analytic quadratic drag', kind: 'synthetic',
    inertia, initialRate: rate, source: {label: 'Independent closed-form drag solution; no velocity-zero crossing'},
    samples: Array.from({length: Math.round(duration / dt) + 1}, (_, i) => {
      const time = i * dt;
      const displacement = coulomb ? rate * time - Math.sign(rate) * drag * time * time / (2 * inertia) :
        Math.sign(rate) * inertia / drag * Math.log1p(drag * Math.abs(rate) * time / inertia);
      return {time, position: position + displacement + sigma * noise(), command: 0};
    })};
}

export function fitDerivative(runs, sigma, {windowSize = 9, maxTerms = 4, terms} = {}) {
  const derived = runs.map(run => deriveTorqueObservations(run.samples, {inertia: run.inertia, windowSize, positionSigma: sigma}));
  const propagated = derived.flatMap(result => result.estimates.map(row => row.jointTorqueSigma)).sort((a, b) => a - b);
  const noiseSigma = Math.max(1e-6, propagated[Math.floor(propagated.length / 2)]);
  return discover(derived.flatMap(result => result.observations), {noiseSigma, maxTerms, ...(terms ? {terms} : {})});
}

export async function runComparison() {
  const {rollout} = await import('../src/trajectory/forward.mjs');
  const rows = [];
  for (const [family, makeRun] of [['spring', springRun], ['gravity', gravityRun]]) {
    const heldOut = makeRun({id: `${family}-heldout`, position: 2.15, rate: -.65, command: -.18, duration: 8});
    for (const sigma of [0, .0001, .001, .01]) for (const seed of [11, 29, 73]) {
      const training = [
        makeRun({id: 'train-a', position: .8, rate: .3, command: .1, sigma, seed}),
        makeRun({id: 'train-b', position: -1.3, rate: -.2, command: -.3, sigma, seed: seed + 100}),
        makeRun({id: 'train-c', position: 1.65, rate: .6, command: .35, sigma, seed: seed + 200}),
      ];
      const integral = discoverIntegral(training, {noiseSigma: Math.max(1e-6, sigma)});
      const derivative = fitDerivative(training, sigma);
      const a = rollout(integral.selected, heldOut, {maxStep: .005}), b = rollout(derivative.selected, heldOut, {maxStep: .005});
      rows.push({family, sigma, seed, integralModel: integral.selected.id, derivativeModel: derivative.selected.id,
        integralPositionRMSE: a.metrics.positionRMSE, derivativePositionRMSE: b.metrics.positionRMSE,
        integralTrainingRMSE: integral.selected.metrics.rmse, integralWhitenedTrainingRMSE: integral.selected.metrics.whitenedRmse,
        derivativeTrainingTorqueRMSE: derivative.selected.metrics.rmse,
        integralCoefficients: integral.selected.terms, derivativeCoefficients: derivative.selected.terms});
    }
  }
  // Retained failures: a wrong supplied initial rate and fast undersampled dynamics.
  const badRate = springRun({id: 'wrong-initial-rate', duration: 8}); badRate.initialRate += .25;
  const exactTest = springRun({id: 'wrong-rate-heldout', position: -.8, rate: -.5, duration: 8});
  const wrongRateIntegral = discoverIntegral([badRate], {terms: ['rate', 'spring', 'bias'], noiseSigma: .001, maxTerms: 3});
  const wrongRateDerivative = fitDerivative([badRate], 0, {terms: ['rate', 'spring', 'bias'], maxTerms: 3});
  const coarse = springRun({id: 'coarse-fast', dt: .15, duration: 6, stiffness: 35, damping: .2});
  const coarseTest = springRun({id: 'coarse-heldout', position: -.8, rate: -.5, dt: .025, duration: 6, stiffness: 35, damping: .2});
  const coarseIntegral = discoverIntegral([coarse], {terms: ['rate', 'spring'], noiseSigma: .001, maxTerms: 2});
  const cubicTraining = [gravityRun({id: 'cubic-a', position: .6, cubic: .8}), gravityRun({id: 'cubic-b', position: -.9, cubic: .8, command: .1})];
  const cubicDiscovery = discoverIntegral(cubicTraining, {noiseSigma: .001, maxTerms: 4});
  const cubicTest = gravityRun({id: 'cubic-heldout', position: 2.4, rate: -.6, cubic: .8});
  const wrongInertiaTraining = springRun({id: 'wrong-inertia-training', duration: 8}); wrongInertiaTraining.inertia *= 1.25;
  const wrongInertiaDiscovery = discoverIntegral([wrongInertiaTraining], {terms: ['rate', 'spring'], noiseSigma: .0001, maxTerms: 2});
  const wrongInertiaTest = springRun({id: 'wrong-inertia-heldout', position: -.8, rate: -.5, duration: 8});
  const consistentWrongInertiaTest = {...wrongInertiaTest, inertia: wrongInertiaTest.inertia * 1.25};
  return {schema: 'worldlaw.integral-comparison/v1', syntheticOnly: true,
    selectionProtocol: 'Each method ranks on training only; held-out altered-start rollout never changes selection.',
    positionUnits: 'rad', rows, retainedCounterexamples: [
      {case: 'incorrect_initial_rate_plus_0.25_rad_per_s', integralPositionRMSE: rollout(wrongRateIntegral.selected, exactTest).metrics.positionRMSE,
        derivativePositionRMSE: rollout(wrongRateDerivative.selected, exactTest).metrics.positionRMSE,
        integralModel: wrongRateIntegral.selected, derivativeModel: wrongRateDerivative.selected},
      {case: 'coarse_fast_oscillator_quadrature_bias', integralPositionRMSE: rollout(coarseIntegral.selected, coarseTest).metrics.positionRMSE,
        trueStiffness: 35, integralModel: coarseIntegral.selected},
      {case: 'omitted_cubic_restoring_torque', integralPositionRMSE: rollout(cubicDiscovery.selected, cubicTest).metrics.positionRMSE,
        trainingAdequacy: cubicDiscovery.diagnostics.adequacy, integralModel: cubicDiscovery.selected},
      {case: 'miscalibrated_inertia_can_preserve_trajectory_predictions', trueInertia: .8, declaredInertia: 1, trueSpringCoefficient: -2.2,
        consistentWrongInertiaPositionRMSE: rollout(wrongInertiaDiscovery.selected, consistentWrongInertiaTest).metrics.positionRMSE,
        correctedInertiaPositionRMSE: rollout(wrongInertiaDiscovery.selected, wrongInertiaTest).metrics.positionRMSE,
        integralModel: wrongInertiaDiscovery.selected},
    ]};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runComparison(), null, 2));
}
