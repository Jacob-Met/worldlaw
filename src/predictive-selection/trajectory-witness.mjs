import {normalizeAngularRuns, normalizeAngularForecastRun} from '../trajectory/angular-discovery.mjs';
import {reservePredictionWork} from './select.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
const insist = (ok, message) => { if (!ok) throw Error(message); };
/** Executable conditional witnesses; not continuum bounds or confidence intervals. */
export function seekTrajectoryWitnesses(seed, rawTraining, prospect, options) {
  const training = normalizeAngularRuns(rawTraining), o = clone(options);
  insist(prospect && Object.keys(prospect).sort().join(',') === 'initialPosition,initialRate,times',
    'Prospect accepts only declared starts and times, never observations');
  insist(Array.isArray(prospect.times) && prospect.times.length >= 2, 'Declare future schedule');
  const future = normalizeAngularForecastRun({
    id: 'declared-prospect', kind: 'unknown', dynamics: 'unforced_scalar_rotation', inertia: null,
    initialRate: prospect.initialRate, source: {label: 'Declared prospective schedule; no receiving observations'},
    samples: prospect.times.map(time => ({time, position: prospect.initialPosition}))
  });
  insist(Number.isInteger(o.sweeps) && o.sweeps >= 1 && o.sweeps <= 20, 'Bound sweeps 1–20');
  insist(Number.isFinite(o.maxStep) && o.maxStep >= 1e-5 && o.maxStep <= .1, 'Bound solver step');
  insist(Number.isFinite(o.trainingTolerance) && o.trainingTolerance >= 0 && o.trainingTolerance <= 1, 'Declare training tolerance 0–1 rad');
  insist(Number.isFinite(o.numericalTolerance) && o.numericalTolerance > 0 && o.numericalTolerance <= .01, 'Declare numerical screen');
  insist(Array.isArray(seed.terms) && seed.terms.length >= 1 && seed.terms.length <= 8 &&
    new Set(seed.terms.map(t => t.id)).size === seed.terms.length, 'Offer distinct coefficient coordinates');
  insist(Array.isArray(o.bounds) && o.bounds.length === seed.terms.length &&
    o.bounds.every((b, i) => Array.isArray(b) && b.length === 2 && b.every(Number.isFinite) &&
      b[0] <= seed.terms[i].coefficient && seed.terms[i].coefficient <= b[1] && b[0] < b[1] &&
      Math.max(...b.map(Math.abs)) <= 1e6), 'Explicit finite coefficient bounds must contain seed');
  const maximumEvaluations = 1 + 4 * seed.terms.length * o.sweeps;
  const reservation = reservePredictionWork([...training, future], o.maxStep, maximumEvaluations);
  insist(Number.isSafeInteger(o.maxTotalSteps) && o.maxTotalSteps >= 1 && o.maxTotalSteps <= 4000000 &&
    reservation.steps <= o.maxTotalSteps && reservation.rows <= 262144,
    'Complete two-direction search exceeds reservation');
  const trials = [];
  function evaluate(values) {
    const model = {...clone(seed),
      terms: seed.terms.map((term, i) => ({...term, coefficient: values[i]})),
      metrics: {meaning: 'Seed metrics do not apply to witness coefficients'}};
    // Equation is derived display metadata. Never retain seed text after coefficients change.
    // The maintained angular receiver consumes schema/units/scale/terms, not this text.
    delete model.equation;
    const trial = {index: trials.length, values: [...values], model, status: 'failed'};
    trials.push(trial);
    try {
      let squares = 0, count = 0;
      for (const run of training) {
        const r = rolloutAngularWithResolution(model, run, {
          maxStep: o.maxStep, maxSteps: reservePredictionWork([run], o.maxStep).steps});
        insist(r.resolution.status === 'compared' &&
          r.resolution.maxAbsPositionDifference <= o.numericalTolerance, 'Training numerically unresolved');
        for (let j = 0; j < run.samples.length; j++) {
          squares += (r.rollout.rows[j].predicted - run.samples[j].position) ** 2; count++;
        }
      }
      trial.trainingRMSE = Math.sqrt(squares / count);
      if (trial.trainingRMSE > o.trainingTolerance) {
        trial.status = 'outside_training_tolerance'; return trial;
      }
      const r = rolloutAngularWithResolution(model, future, {
        maxStep: o.maxStep, maxSteps: reservePredictionWork([future], o.maxStep).steps});
      insist(r.resolution.status === 'compared' &&
        r.resolution.maxAbsPositionDifference <= o.numericalTolerance, 'Prospect numerically unresolved');
      trial.status = 'admitted';
      trial.predictions = r.rollout.rows.map(({time, predicted, rate}) => ({time, position: predicted, rate}));
      trial.endpoint = trial.predictions.at(-1).position;
      trial.resolution = r.resolution;
    } catch (error) { trial.error = error.message; }
    return trial;
  }
  const first = evaluate(seed.terms.map(t => t.coefficient)), witnesses = [];
  if (first.status === 'admitted') for (const direction of [-1, 1]) {
    let best = first, steps = o.bounds.map(b => (b[1] - b[0]) / 4);
    for (let sweep = 0; sweep < o.sweeps; sweep++) {
      let improved = false;
      for (let j = 0; j < steps.length; j++) {
        const centre = best.values[j];
        for (const sign of [-1, 1]) {
          const values = [...best.values]; values[j] = centre + sign * steps[j];
          if (values[j] < o.bounds[j][0] || values[j] > o.bounds[j][1]) continue;
          const trial = evaluate(values);
          if (trial.status === 'admitted' && direction * trial.endpoint > direction * best.endpoint) {
            best = trial; improved = true;
          }
        }
      }
      if (!improved) steps = steps.map(step => step / 2);
    }
    witnesses.push(best.index);
  }
  const span = witnesses.length === 2 ? trials[witnesses[1]].endpoint - trials[witnesses[0]].endpoint : null;
  return {training, prospect: clone(prospect), options: o, reservation, maximumEvaluations, trials, witnesses, span,
    status: span === null ? 'seed_not_admitted' : span > 0 ? 'distinct_witnesses' : 'no_distinct_witness_found',
    meaning: 'Two bounded local-search executable witnesses conditional on declared training tolerance and prospective starts. Neither extrema nor confidence or continuum coverage. Failure to find disagreement does not establish identification.'};
}
