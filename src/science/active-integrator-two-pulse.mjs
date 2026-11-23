/** Exact two-pulse design for one continuously observed scalar integrator. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';

export const TWO_PULSE_SCHEMA = 'worldlaw.active-integrator-two-pulse/v1';
export const TWO_PULSE_READINGS = 'worldlaw.active-integrator-two-pulse-readings/v1';
const {Z, Q, add, sub, mul, div, fmt, parseSource} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
const need = (ok, message) => { if (!ok) throw Error('Two-pulse experiment: ' + message); };
const compare = (a, b) => a.n*b.d < b.n*a.d ? -1 : a.n*b.d > b.n*a.d ? 1 : 0;
const max = (a, b) => compare(a,b) >= 0 ? a : b;
const min = (a, b) => compare(a,b) <= 0 ? a : b;
const inside = (value, range) => compare(value, range[0]) >= 0 && compare(value, range[1]) <= 0;
const band = (value, error) => [sub(value,error), add(value,error)];
const overlap = (first, second) => {
  const lo = max(first[0],second[0]), hi = min(first[1],second[1]);
  return compare(lo,hi) <= 0 ? [lo,hi] : null;
};
const differences = (a, b) => [sub(a[0],b[1]), sub(a[1],b[0])];

// Measurements can exceed the coefficient and command budget even on a
// short trajectory, and the initial offset is unknown. Preserve exact decimal
// integers and rationals throughout the same notebook input-size boundary.
function parseReading(input) {
  if (typeof input === 'number') {
    need(Number.isSafeInteger(input), 'use an exact integer or a rational string for each reading');
    input = String(input);
  }
  need(typeof input === 'string' && input.length <= 524288 && /^[+-]?[0-9]+(?:[/][1-9][0-9]*)?$/.test(input),
    'expected an exact reading in integer or rational notation within the notebook byte limit');
  const [numerator, denominator = '1'] = input.split('/');
  return Q(BigInt(numerator), BigInt(denominator));
}

function parse(request) {
  need(request?.schema === TWO_PULSE_SCHEMA && Object.keys(request).sort().join(',') ===
    'amplitudes,hypotheses,initialState,noiseBound,schema', 'expected the declared scalar integrator source fields');
  need(request.initialState === 'single-unknown-offset', 'one persistent unknown initial state is required');
  need(Array.isArray(request.amplitudes) && request.amplitudes.length >= 1 && request.amplitudes.length <= 8,
    'offer one to eight amplitudes');
  const amplitudes = request.amplitudes.map(parseSource);
  need(new Set(amplitudes.map(fmt)).size === amplitudes.length, 'declared amplitudes must be distinct');
  need(Array.isArray(request.hypotheses) && request.hypotheses.length >= 2 && request.hypotheses.length <= 8,
    'offer two to eight polynomial laws');
  const ids = request.hypotheses.map(law => law?.id);
  need(ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)) &&
    new Set(ids).size === ids.length, 'each law needs a distinct identifier');
  const rates = request.hypotheses.map(law => {
    need(Object.keys(law).sort().join(',') === 'coefficients,id' && Array.isArray(law.coefficients) && law.coefficients.length >= 1 && law.coefficients.length <= 5,
      'each incremental response needs one to five coefficients in ascending order');
    const coeff = law.coefficients.map(parseSource);
    return amplitudes.map(u => coeff.reduceRight((acc, v) => add(mul(acc,u),v), Z()));
  });
  const eps = parseSource(request.noiseBound);
  need(eps.n >= 0n, 'noise bound must be nonnegative');
  return {ids, amplitudes, rates, error: add(eps,eps)};
}

// For each law, existence of one common unknown offset is exactly pairwise
// intersection of the three scalar intervals for the measured offsets. With
// d=y1-y0 and t=y2-y0 these bound d, t and t-d. For a pair of laws, eliminate
// t from the last two bands and intersect with the first. Endpoints are closed.
function ambiguityRange(firstA, firstB, secondA, secondB, error) {
  const d = overlap(band(firstA,error), band(firstB,error));
  const t = overlap(band(add(firstA,secondA),error), band(add(firstB,secondB),error));
  const increment = overlap(band(secondA,error), band(secondB,error));
  return d && t && increment ? overlap(d,differences(t,increment)) : null;
}

function analyzeFirst({ids, amplitudes, rates, error}, first) {
  const ranges = rates.map(row => band(row[first],error));
  const boundaries = new Map(ranges.flat().map(v => [fmt(v),v]));
  const candidates = amplitudes.map((_,second) => {
    const ties = [];
    for (let i=0; i<rates.length; i++) for (let j=i+1; j<rates.length; j++) {
      const range = ambiguityRange(rates[i][first],rates[j][first],rates[i][second],rates[j][second],error);
      if (range) {
        ties.push({pair:[ids[i],ids[j]],range});
        for (const point of range) boundaries.set(fmt(point),point);
      }
    }
    return ties;
  });
  const points = [...boundaries.values()].sort(compare);
  const cells = [];
  for (let i=0; i<points.length; i++) {
    cells.push({lo:points[i],hi:points[i],point:true,sample:points[i]});
    if (i+1<points.length) cells.push({lo:points[i],hi:points[i+1],point:false,
      sample:div(add(points[i],points[i+1]),Q(2n))});
  }
  const policy = [];
  for (const cell of cells) {
    const possible = ids.filter((_,i) => inside(cell.sample,ranges[i]));
    if (!possible.length) continue;
    const ties = candidates.map(pairs => pairs.find(row => inside(cell.sample,row.range)));
    const action = possible.length === 1 ? null : ties.findIndex(w => !w);
    policy.push({...cell,possible,action, ties});
  }
  return {first,policy,candidates};
}

function compile(request) {
  const data = parse(request);
  const trials = data.amplitudes.map((_,i) => analyzeFirst(data,i));
  const optimal = trials.filter(t => t.policy.every(cell => cell.action !== -1))
    .sort((a,b) => Number(a.policy.some(c => c.action !== null)) -
      Number(b.policy.some(c => c.action !== null)))[0];
  const first = optimal ? fmt(data.amplitudes[optimal.first]) : null;
  const fixed = trials.flatMap(t => t.candidates.map((pairs,j) => ({
    pulses:[fmt(data.amplitudes[t.first]),fmt(data.amplitudes[j])],
    ambiguousPairs:pairs.map(z => z.pair)})));
  const plan = {schema:TWO_PULSE_SCHEMA,initialState:'single-unknown-offset',noiseBound:fmt(div(data.error,Q(2n))),
    status:optimal?'certified_adaptive_policy':'no_guaranteed_two_pulse_policy',
    firstAmplitude:first,worstReadings:optimal?(optimal.policy.some(c => c.action !== null)?3:2):null,
    fixedSchedules:fixed,
    cells:optimal ? optimal.policy.map(c => ({kind:c.point?'point':'open',range:[fmt(c.lo),fmt(c.hi)],
      consistentHypothesisIds:c.possible,nextAmplitude:c.action===null?null:fmt(data.amplitudes[c.action])})) : [],
    refusals:optimal ? [] : trials.map(t => {
      const failed=t.policy.find(c => c.action===-1);
      return {firstAmplitude:fmt(data.amplitudes[t.first]),firstDifference:fmt(failed.sample),
        ambiguousContinuationPairs:failed.ties.map((w,i) => ({amplitude:fmt(data.amplitudes[i]),pair:w.pair}))};
    })};
  return {plan,data,optimal};
}

export const designTwoPulse = request => compile(request).plan;

export function receiveTwoPulse(request, frozen, supplied, previous=null) {
  const {plan,data,optimal} = compile(request);
  need(JSON.stringify(plan)===JSON.stringify(frozen), 'frozen policy changed');
  need(optimal, 'no certified policy to execute');
  need(supplied?.schema===TWO_PULSE_READINGS && typeof supplied.source==='string' &&
    supplied.source.trim().length>=8 && ['supplied','synthetic'].includes(supplied.acquisition),
    'declare the measurement source and acquisition');
  const round=previous?2:1;
  need(supplied.round===round && (!previous || (previous.status==='continue_frozen_policy' && Array.isArray(previous.readings) && previous.readings.length===2)),
    'round is closed or out of order');
  const amplitude = round===1 ? plan.firstAmplitude : previous.nextAmplitude;
  need(fmt(parseSource(supplied.amplitude))===amplitude, 'applied pulse differs from the frozen branch');
  const expectedTicks=round===1?[0,1]:[2];
  need(Array.isArray(supplied.observations) && supplied.observations.length===expectedTicks.length &&
    supplied.observations.every((r,i)=>r?.tick===expectedTicks[i]), 'supply the ordered readings for this pulse only');
  const current=supplied.observations.map(r=>parseReading(r.value));
  const values=previous ? [...previous.readings.map(parseReading),...current] : current;
  const d=sub(values[1],values[0]);
  const cell=optimal.policy.find(c=>c.point ? compare(d,c.lo)===0 : compare(c.lo,d)<0 && compare(d,c.hi)<0);
  let ids=cell?.possible??[];
  if (previous) {
    need(cell && cell.action!==null && previous.round===1 && previous.appliedAmplitude===plan.firstAmplitude &&
      amplitude===fmt(data.amplitudes[cell.action]) && JSON.stringify(cell.possible)===JSON.stringify(previous.consistentHypothesisIds),
      'preceding result does not implement the frozen prefix');
    const j=cell.action;
    const t=sub(values[2],values[0]), last=sub(values[2],values[1]);
    ids=data.ids.filter((id,i)=>ids.includes(id) &&
      inside(t,band(add(data.rates[i][optimal.first],data.rates[i][j]),data.error)) &&
      inside(last,band(data.rates[i][j],data.error)));
  }
  const status=ids.length===0?'all_hypotheses_falsified':ids.length===1?'one_hypothesis_consistent':'continue_frozen_policy';
  need(!previous || ids.length<=1, 'certificate contradicts the final ambiguous readout');
  return {schema:'worldlaw.active-integrator-two-pulse-result/v1',round,status,readings:values.map(fmt),
    appliedAmplitude:amplitude,consistentHypothesisIds:ids,
    nextAmplitude:status==='continue_frozen_policy'?fmt(data.amplitudes[cell.action]):null,
    physicalProvenanceVerified:false,source:supplied.source,acquisition:supplied.acquisition};
}
