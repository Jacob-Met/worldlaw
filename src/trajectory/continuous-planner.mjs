/** Design only. No measured positions, hidden instrument, acquisition or scoring input. */
import {rollout, TrajectoryRolloutError} from './forward.mjs';

const SCHEMA = 'worldlaw.continuous-command-plan/v1';
const PRIME = [2, 3, 5, 7, 11, 13, 17, 19];
const FIELDS = new Set(['inertia','initialPosition','initialRate','duration','dt','maxStep',
  'amplitudeBounds','segmentDurations','positionDomain','noiseSigma','starts','sweeps',
  'maxTotalSteps','maxRefinementError','rateDomain','minSeparation']);

function check(ok, message) {
  if (!ok) throw new RangeError(message);
}
function integer(x, lo, hi, name) {
  check(Number.isSafeInteger(x) && x >= lo && x <= hi, 'Invalid '+name);
  return x;
}
function bounds(pair, name) {
  check(Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) &&
    Math.max(Math.abs(pair[0]), Math.abs(pair[1])) <= 1e6 && pair[0] < pair[1], 'Invalid '+name);
  return [...pair];
}
function ticks(seconds, dt) {
  const count = Math.round(seconds/dt);
  check(Number.isFinite(seconds) && seconds > 0 && Number.isSafeInteger(count) &&
    count >= 1 && count <= 9999 && Math.abs(count*dt-seconds) <= 16*Number.EPSILON*seconds,
    'Every duration must occupy whole sample intervals');
  return count;
}
function radical(index, base) {
  let value = 0, weight = 1/base;
  while (index > 0) {
    value += (index % base)*weight;
    index = Math.floor(index/base);
    weight /= base;
  }
  return value;
}

/** A validated request owns contiguous half-open index intervals.
 * At the terminal sample return the final amplitude; it drives no interval.
 */
export function scheduledAmplitude(segments, i) {
  check(Number.isSafeInteger(i) && i>=0 && segments.length>0, 'Invalid schedule index');
  const segment = segments.find(s => s.startIndex<=i && i<s.endIndex);
  if (segment) return segment.amplitude;
  if (i===segments.at(-1).endIndex) return segments.at(-1).amplitude;
  throw new RangeError('Index outside segment schedule');
}

export function planContinuousExperiment(models, config) {
  check(config && Object.keys(config).every(k => FIELDS.has(k)), 'Unknown design field');
  const c = {...config};
  for (const name of ['duration','dt','maxStep','inertia','noiseSigma','maxRefinementError'])
    check(Number.isFinite(c[name]) && c[name] > 0, 'Invalid '+name);
  check(c.maxStep <= c.dt && c.maxStep/2 > 0 && c.inertia <= 1e12, 'Unsupported integrator settings');
  check(Number.isFinite(c.minSeparation) && c.minSeparation >= 0, 'Invalid minSeparation');
  const domain = bounds(c.positionDomain,'positionDomain');
  const rateDomain = bounds(c.rateDomain ?? [-1e6,1e6], 'rateDomain');
  const [lo, hi] = bounds(c.amplitudeBounds,'amplitudeBounds');
  check(Number.isFinite(c.initialPosition) && c.initialPosition >= domain[0] &&
    c.initialPosition <= domain[1] && Number.isFinite(c.initialRate) && c.initialRate>=rateDomain[0] && c.initialRate<=rateDomain[1],
    'Initial state outside bounds');
  integer(c.starts, 2, 32, 'starts');
  integer(c.sweeps, 1, 24, 'sweeps');
  integer(c.maxTotalSteps, 1, 10000000, 'maxTotalSteps');
  check(Array.isArray(models) && models.length >= 2 && models.length <= 16 &&
    Array.from(models).every(m => m?.schema === 'worldlaw.torque-model/v1' &&
      typeof m.id === 'string' && m.id.trim() && Array.isArray(m.terms)) &&
    new Set(models.map(m => m.id)).size === models.length, 'Require two to sixteen uniquely named torque models');
  check(Array.isArray(c.segmentDurations) && c.segmentDurations.length >= 4 &&
    c.segmentDurations.length <= 8, 'Require four to eight fixed segments');
  const lengths = Array.from(c.segmentDurations, seconds => ticks(seconds,c.dt));
  const n = ticks(c.duration,c.dt);
  check(lengths.reduce((a,b) => a+b, 0) === n, 'Segment partition differs from duration');
  const times = Array.from({length:n+1}, (_, i) => i*c.dt);
  const stepsAt = h => times.slice(1).reduce((a,t,i) => a+Math.max(1,Math.ceil((t-times[i])/h)),0);
  const coarse = stepsAt(c.maxStep), fine = stepsAt(c.maxStep/2);
  const maxDesigns = c.starts*(1+2*lengths.length*c.sweeps);
  const work = {maxDesigns, maxTotalSteps:c.maxTotalSteps, coarseStepsPerModel:coarse,
    fineStepsPerModel:fine, reservedSteps:models.length*(maxDesigns*coarse+fine),
    designsEvaluated:0, rolloutCalls:0, chargedSteps:0, completedSteps:0, rejectedDesigns:0};
  const diagnostics = {models:models.map(m=>m.id), failedRollouts:[], pairCount:models.length*(models.length-1)/2,
    minSeparation:c.minSeparation,positionDomain:domain,rateDomain,rateDomainCheck:'scheduled endpoints; engine absolute state bound also applies at RK4 stages', units:{position:'rad',command:'N·m',time:'s'},
    objectiveDefinition:'minimum pairwise RMS over all postinitial positions / declared noise sigma',
    method:'deterministic bounded multistart coordinate search; no global optimality certificate',
    numericalCheck:'all rivals; consecutive RK4 step limits; no physical acquisition'};
  const refused = reason => ({schema:SCHEMA,status:'refused',reason,request:null,
    times:[],predictions:[],objective:null,work,diagnostics});
  if (!Number.isSafeInteger(work.reservedSteps) || work.reservedSteps>c.maxTotalSteps || fine>1000000)
    return refused('step_budget');
  function schedule(amplitudes) {
    let end = 0;
    return lengths.map((length,j) => {
      const startIndex = end; end += length;
      return {startIndex,endIndex:end,amplitude:amplitudes[j]};
    });
  }
  function simulate(amplitudes, h, charge) {
    const segments = schedule(amplitudes);
    const samples = times.map((time,i) => ({time,position:c.initialPosition,
      command:scheduledAmplitude(segments,i)}));
    const run = {id:'prospective',label:'Prospective command',kind:'unknown',
      source:{label:'Planner placeholders; future positions ignored'},inertia:c.inertia,
      initialRate:c.initialRate,samples};
    const predictions = [];
    for (const model of models) {
      work.rolloutCalls++; work.chargedSteps+=charge;
      try {
        const r=rollout(model,run,{maxStep:h,maxSteps:charge,positionDomain:domain});
        work.completedSteps+=r.diagnostics.steps;
        if (r.rows.some(row=>row.rate<rateDomain[0] || row.rate>rateDomain[1]))
          throw new TrajectoryRolloutError('Rate outside declared endpoint bounds','rate_domain');
        predictions.push({modelId:model.id,position:r.rows.map(row=>row.predicted)});
      } catch (e) {
        if (!(e instanceof TrajectoryRolloutError) ||
            !['position_domain','rate_domain','runaway_state','numerical_failure'].includes(e.code)) throw e;
        if (diagnostics.failedRollouts.length<16)
          diagnostics.failedRollouts.push({modelId:model.id,code:e.code,amplitudes:[...amplitudes],maxStep:h});
        return null;
      }
    }
    let score=Infinity;
    for (let i=0;i<predictions.length;i++) for (let k=0;k<i;k++) {
      let sum=0;
      for (let t=1;t<=n;t++) sum+=(predictions[i].position[t]-predictions[k].position[t])**2;
      score=Math.min(score,Math.sqrt(sum/n)/c.noiseSigma);
    }
    return Number.isFinite(score) ? {score,predictions,amplitudes:[...amplitudes]} : null;
  }

  function evaluate(a) {
    work.designsEvaluated++;
    const result=simulate(a,c.maxStep,coarse);
    if (!result) work.rejectedDesigns++;
    return result;
  }
  let best=null;
  for (let s=0;s<c.starts;s++) {
    let a=lengths.map((_,j)=>lo+(hi-lo)*(s===0 ? .5 : radical(s,PRIME[j])));
    let local=evaluate(a);
    for (let sweep=0;sweep<c.sweeps;sweep++) {
      const delta=(hi-lo)*(.5**(sweep+1));
      for (let j=0;j<a.length;j++) {
        // Compare both directions about the identical current coordinate.
        let next=local;
        for (const direction of [-1,1]) {
          const x=Math.max(lo,Math.min(hi,a[j]+direction*delta));
          if (x===a[j]) continue;
          const proposal=[...a]; proposal[j]=x;
          const candidate=evaluate(proposal);
          if (candidate && (!next || candidate.score>next.score)) next=candidate;
        }
        if (next) { local=next; a=next.amplitudes; }
      }
    }
    if (local && (!best || local.score>best.score)) best=local;
  }
  if (!best) return refused('no_full_roster_feasible_schedule');
  const checked=simulate(best.amplitudes,c.maxStep/2,fine);
  if (!checked) return refused('selected_schedule_refinement_failed');
  let maxError=0;
  for (let i=0;i<models.length;i++) for (let t=1;t<=n;t++)
    maxError=Math.max(maxError,Math.abs(best.predictions[i].position[t]-checked.predictions[i].position[t]));
  Object.assign(diagnostics,{coarseObjective:best.score,fineObjective:checked.score,
    maxRefinementErrorObserved:maxError,maxRefinementErrorAllowed:c.maxRefinementError});
  if (maxError>c.maxRefinementError) return refused('numerically_unresolved');
  if (checked.score<=0) return refused('no_model_separation');
  if (checked.score<c.minSeparation) return refused('insufficient_separation');
  const request={schema:'worldlaw.continuous-command-request/v1',inertia:c.inertia,
    initialPosition:c.initialPosition,initialRate:c.initialRate,duration:times[n],dt:c.dt,
    noiseSigma:c.noiseSigma,segments:schedule(best.amplitudes),
    commandConvention:'hold amplitude on [startIndex*dt,endIndex*dt); terminal value unused'};
  return {schema:SCHEMA,status:'planned',request,times,predictions:checked.predictions,
    objective:checked.score,work,diagnostics};
}
