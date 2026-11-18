// Replay manual readouts in order, retaining one coefficient per candidate law.
import {planProbeAcquisition} from './probe-planner.mjs';
import {probeModelForCandidate} from './probe-response.mjs';
import {add, sub, cmp, div, mul, enclosure, rational} from './chronos-exact-halfplanes.mjs';

const ordered = (a, b) => cmp(a, b) <= 0 ? [a, b] : [b, a];
const display = ([lo, hi]) => [enclosure(lo).lower, enclosure(hi).upper];

function readoutRange(model, state, radius) {
  const feature = rational(model.feature(state));
  const [lo, hi] = ordered(...model.range.map(value => mul(value, feature)));
  return [sub(lo, radius), add(hi, radius)];
}

function condition(model, state, observation, radius) {
  const feature = rational(model.feature(state));
  if (feature[0] === 0n) {
    return cmp(observation, sub(rational(0), radius)) >= 0 && cmp(observation, radius) <= 0;
  }
  const [lo, hi] = ordered(div(sub(observation, radius), feature), div(add(observation, radius), feature));
  if (cmp(lo, model.range[0]) > 0) model.range[0] = lo;
  if (cmp(hi, model.range[1]) < 0) model.range[1] = hi;
  return cmp(model.range[0], model.range[1]) <= 0;
}

// Closed readout intervals achieve their maximum overlap at a left endpoint.
function assess(models, offer, radius) {
  const intervals = models.map(model => readoutRange(model, offer, radius));
  const worstSurvivors = Math.max(...intervals.map(([point]) =>
    intervals.filter(([lo, hi]) => cmp(lo, point) <= 0 && cmp(point, hi) <= 0).length));
  let separatedPairs = 0;
  let overlap = rational(0);
  for (let i = 1; i < intervals.length; i++) {
    for (const prior of intervals.slice(0, i)) {
      const [lo, hi] = intervals[i];
      const start = cmp(prior[0], lo) > 0 ? prior[0] : lo;
      const end = cmp(prior[1], hi) < 0 ? prior[1] : hi;
      if (cmp(end, start) < 0) {
        separatedPairs++;
      } else {
        const width = sub(end, start);
        overlap = add(overlap, add(div(width, sub(hi, lo)), div(width, sub(prior[1], prior[0]))));
      }
    }
  }
  return {id: offer.id, cost: offer.cost, worstSurvivors, separatedPairs, overlap};
}

export function planSequentialProbe(training, settings, readouts = []) {
  const admission = planProbeAcquisition(training, settings);
  const {probes, contrastRadius, budget} = admission.settings;
  if (!Array.isArray(readouts) || readouts.length > probes.length) throw Error('Provide at most one readout per offered state.');
  const radius = rational(contrastRadius);
  const offers = new Map(probes.map(probe => [probe.id, {...probe, command: admission.training.runs[0]?.probe.command}]));
  let models = admission.models.map(candidate => ({id: candidate.id, feature: probeModelForCandidate(candidate).feature,
    range: candidate.coefficientInterval.map(rational)}));
  let spent = rational(0);
  for (const readout of readouts) {
    const offer = offers.get(readout?.id);
    if (!offer || !Number.isFinite(readout.contrast) || Math.abs(readout.contrast) > 1e6) {
      throw Error('Each bounded measured contrast must identify a distinct offered state.');
    }
    spent = add(spent, rational(offer.cost));
    if (cmp(spent, rational(budget)) > 0) throw Error('Recorded readouts exceed the declared effort budget.');
    offers.delete(offer.id);
    const observed = rational(readout.contrast);
    models = models.filter(model => condition(model, offer, observed, radius));
  }
  const remaining = sub(rational(budget), spent);
  const options = models.length < 2 ? [] : [...offers.values()]
    .filter(offer => cmp(rational(offer.cost), remaining) <= 0)
    .map(offer => assess(models, offer, radius))
    .sort((a, b) => a.worstSurvivors - b.worstSurvivors || b.separatedPairs - a.separatedPairs ||
      cmp(a.overlap, b.overlap) || a.cost - b.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ranked = options.map(({overlap, ...option}) => ({...option, overlap: display([overlap, overlap])}));
  return {interpretation: "Survivors are conditional on the offered family and declared noise bound. A single survivor can be structurally wrong when the true law is absent.",
    models: models.map(model => ({id: model.id, coefficientInterval: display(model.range)})),
    spent: display([spent,spent]), options: ranked, selected: ranked[0] ?? null};
}
