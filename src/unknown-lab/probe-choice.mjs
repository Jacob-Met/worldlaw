// Prospective choice among every offered singleton and unordered pair.
// The legacy single/pair APIs remain unchanged; this mode uses one exact policy.
import {planProbeAcquisition} from './probe-planner.mjs';
import {compareProbeCourse} from './probe-course.mjs';

export const PROBE_CHOICE_SCHEMA = 'worldlaw.probe-choice/v1';
const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function tupleOrder(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const order = ascii(a[i], b[i]);
    if (order) return order;
  }
  return a.length - b.length;
}
const summary = comparisons => {
  const separated = comparisons.filter(pair => pair.separable).length;
  return {comparisons, separated, total: comparisons.length,
    allSeparated: separated === comparisons.length};
};

export function planProbeChoice(training, input) {
  if (!Array.isArray(input?.probes) || input.probes.length < 1 || input.probes.length > 8) {
    throw Error('Offer one to eight states for complete one- and two-state comparison.');
  }
  // Reuse admission, fitting and source records, but not the legacy epsilon scores.
  const admitted = planProbeAcquisition(training, input);
  const work = {count: 0, limit: 200000};
  const base = {
    schema: PROBE_CHOICE_SCHEMA, training: admitted.training, settings: admitted.settings,
    fitStatus: admitted.fitStatus, models: admitted.models, options: [], selected: null,
    status: 'unavailable', reason: admitted.reason, work: 0,
    qualification: 'Complete offered one- and two-state comparison with one training-admitted coefficient per law across each course. Exact separation is conditional on supplied binary64 features and coefficient endpoints; inherited training screens and transcendental evaluations are not certified bounds. Effort, feasibility and future contrast radius are investigator declarations. This prospective manual request neither acquires evidence nor establishes calibrated confidence, physical safety or mechanism identity; every offered law can be wrong.'
  };
  if (admitted.models.length < 2) return base;

  const radius = admitted.settings.contrastRadius;
  const states = [...admitted.candidates].sort((a, b) => ascii(a.id, b.id)).map(state => ({
    ...state,
    ...summary(compareProbeCourse(admitted.models, [state.probe], radius, work))
  }));
  const options = states.map(state => ({
    ids: [state.id], states: [state], cost: state.cost,
    withinBudget: state.cost <= admitted.settings.budget,
    ...summary(state.comparisons), jointOnly: []
  }));
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const pair = [states[i], states[j]];
      const comparisons = compareProbeCourse(admitted.models, pair.map(state => state.probe), radius, work);
      const cost = pair[0].cost + pair[1].cost;
      options.push({
        ids: pair.map(state => state.id), states: pair, cost,
        withinBudget: cost <= admitted.settings.budget,
        ...summary(comparisons),
        // All calls preserve the same admitted model order, hence comparison index.
        jointOnly: comparisons.filter((comparison, index) => comparison.separable &&
          pair.every(state => !state.comparisons[index].separable)).map(comparison => comparison.hypotheses)
      });
    }
  }
  const selected = options.filter(option => option.withinBudget && option.separated > 0)
    .sort((a, b) => b.separated - a.separated || a.cost - b.cost ||
      a.ids.length - b.ids.length || tupleOrder(a.ids, b.ids))[0] ?? null;
  return {...base, options, selected, work: work.count,
    status: selected ? (selected.allSeparated ? 'all-pairs-separated' : 'partial-separation') : 'no-informative-choice',
    reason: selected
      ? 'Best affordable exact separation count, then least declared effort, fewer states and ASCII identifier order.'
      : 'No affordable offered singleton or two-state course separates a surviving hypothesis pair.'};
}

export function exportProbeChoice(training, input) {
  const plan = planProbeChoice(training, input);
  return JSON.stringify({schema: PROBE_CHOICE_SCHEMA, training: plan.training, settings: plan.settings}, null, 2) + '\n';
}

export function importProbeChoice(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 4000000) {
    throw Error('Use a probe-choice request of at most 4000000 UTF-8 bytes.');
  }
  const raw = JSON.parse(text);
  if (raw?.schema !== PROBE_CHOICE_SCHEMA) throw Error('Expected a WORLDLAW probe-choice request.');
  // Supplied derived fields never influence admission, scores, work or selection.
  return planProbeChoice(raw.training, raw.settings);
}
