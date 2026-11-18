// Frozen virtual-instrument replay. No challenge records are available to either policy.
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
import {probeModelForCandidate} from '../src/unknown-lab/probe-response.mjs';
import {planProbeCourses} from '../src/unknown-lab/probe-course.mjs';
import {planSequentialProbe} from '../src/unknown-lab/sequential-probe.mjs';

const training = probeExample('ambiguous');
training.runs = training.runs.filter(run => run.role === 'training');
const stats = () => ({studies: 0, readouts: 0, survivors: 0, identified: 0, truthExcluded: 0});
const fixed = stats(), adaptive = stats();
const groups = {recommended:{fixed:stats(),adaptive:stats()},fallback:{fixed:stats(),adaptive:stats()}};
for (let seed = 102001; seed <= 102100; seed++) {
  let state = seed;
  const uniform = () => {state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32;};
  const probes = Array.from({length: 6}, (_, i) => {
    const position = uniform() * 2 - 1;
    return {id: 's' + i, position, rate: Math.sin(position) + (uniform() - .5) * .15, cost: 1};
  });
  const settings = {probes, budget: 2, contrastRadius: .02};
  const model = planProbeCourses(training, settings);
  const selected = model.selected ?? model.courses[0];
  const survivors = planSequentialProbe(training, settings).models;
  const truth = survivors[seed % survivors.length];
  const [lo, hi] = truth.coefficientInterval;
  const coefficient = lo + (hi - lo) * (.1 + .8 * uniform());
  const observations = new Map(probes.map(probe => [probe.id, coefficient * probeModelForCandidate(truth).feature(probe) +
    (2 * uniform() - 1) * settings.contrastRadius * .99]));
  function run(stats, subset, fixedIds) {
    const readouts = [];
    let plan = planSequentialProbe(training, settings, readouts);
    while (readouts.length < 2 && plan.models.length > 1) {
      const id = fixedIds ? fixedIds[readouts.length] : plan.selected?.id;
      if (!id) break;
      readouts.push({id, contrast: observations.get(id)});
      plan = planSequentialProbe(training, settings, readouts);
    }
    for (const metric of [stats, subset]) {
      metric.studies++;
      metric.readouts += readouts.length;
      metric.survivors += plan.models.length;
      metric.identified += Number(plan.models.length === 1 && plan.models[0].id === truth.id);
      metric.truthExcluded += Number(!plan.models.some(m => m.id === truth.id));
    }
  }
  const group = model.selected ? groups.recommended : groups.fallback;
  run(fixed, group.fixed, selected.ids);
  run(adaptive, group.adaptive, null);
}
console.log(JSON.stringify({source:'synthetic', seeds:[102001,102100], fixedCourseWithFirstPairFallback:fixed, adaptive, groups}));
