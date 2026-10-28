/** Finite nearby releases through the maintained Studio solver; no new integrator. */
import {prepareTorquePredictor, DiscoveryError} from './torque-discovery.mjs';
import {executeStudioDynamics} from './studio-dynamics.mjs';

const fail = (message, code='invalid_input') => {throw new DiscoveryError(message, code);};
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, name, bound=1e6) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value)>bound)
    fail(name+' must be a finite number with magnitude at most '+bound+'.');
  return value;
};
const DEFAULTS = Object.freeze({duration:4, dt:0.01, inertia:1, command:0,
  relativeTolerance:1e-8, positionTolerance:1e-10, rateTolerance:1e-10, maxTrials:50000});
function settings(options) {
  if (!record(options)) fail('Release comparison settings must be an object.');
  if (Object.keys(options).some(key=>!Object.hasOwn(DEFAULTS,key) && key!=='timeScale'))
    fail('Unknown release comparison setting.');
  const result=Object.fromEntries(Object.entries(DEFAULTS).map(([key,value])=>[key,options[key]===undefined?value:options[key]]));
  finite(result.duration,'duration',1000);finite(result.dt,'dt',1);
  finite(result.inertia,'inertia',1e12);finite(result.command,'command');
  if (result.duration<=0 || result.dt<=0 || result.inertia<=0 || Math.ceil(result.duration/result.dt)>10000)
    fail('Use positive duration, output interval and inertia with at most 10000 output intervals.');
  for (const key of ['relativeTolerance','positionTolerance','rateTolerance']) {
    finite(result[key],key,0.01);
    if (result[key]<1e-14) fail(key+' must be at least 1e-14.');
  }
  if (!Number.isInteger(result.maxTrials) || result.maxTrials<1 || result.maxTrials>100000)
    fail('maxTrials must be an integer from 1 through 100000.','work_limit');
  const timeScale=finite(options.timeScale===undefined?1:options.timeScale,'timeScale');
  if (timeScale<=0) fail('timeScale must be positive seconds.');
  return {solver:result,timeScale};
}
function state(value,name) {
  if (!record(value)) fail(name+' must contain position and rate.');
  return {position:finite(value.position,name+'.position'),rate:finite(value.rate,name+'.rate')};
}
function norm(position,rate,timeScale) {
  const scaledRate=timeScale*rate;
  if (!Number.isFinite(position) || !Number.isFinite(rate) || !Number.isFinite(scaledRate) || (rate!==0 && scaledRate===0))
    fail('A state difference cannot be represented in the declared norm.','unresolved_numeric');
  const value=Math.hypot(position,scaledRate);
  if (!Number.isFinite(value)) fail('The declared state-difference norm is nonfinite.','unresolved_numeric');
  return value;
}
function shifted(initial,requested,scale,name) {
  const shift={position:requested.position*scale,rate:requested.rate*scale};
  const next={position:initial.position+shift.position,rate:initial.rate+shift.rate};
  state(next,name);
  const actual={position:next.position-initial.position,rate:next.rate-initial.rate};
  for (const key of ['position','rate']) {
    if (requested[key]!==0 && (shift[key]===0 || actual[key]===0))
      fail(name+' '+key+' perturbation rounds away at the requested initial state.','unresolved_numeric');
  }
  return {initial:next,requested:shift,actual};
}
function compareCourse(nominal,course,actual,timeScale) {
  if (nominal.status!=='completed' || course.status!=='completed')
    return {status:'unavailable',reason:'A required solver course did not complete.'};
  const a=nominal.trajectory,b=course.trajectory;
  if (a.length!==b.length || a.some((sample,index)=>sample.time!==b[index].time))
    return {status:'unavailable',reason:'The completed courses have different output times.'};
  try {
    const initialDistance=norm(actual.position,actual.rate,timeScale);
    if (!(initialDistance>0)) fail('The actual initial perturbation has zero norm.','unresolved_numeric');
    const rows=a.map((sample,index)=>{
      const positionDifference=b[index].position-sample.position;
      const rateDifference=b[index].rate-sample.rate;
      const distance=norm(positionDifference,rateDifference,timeScale);
      const responseFactor=distance/initialDistance;
      if (!Number.isFinite(responseFactor) || (distance!==0 && responseFactor===0))
        fail('A finite-time response factor cannot be represented.','unresolved_numeric');
      return {time:sample.time,positionDifference,rateDifference,distance,responseFactor};
    });
    const peak=rows.reduce((best,row)=>row.responseFactor>best.responseFactor?row:best,rows[0]);
    return {status:'completed',initialDifference:{...actual},initialDistance,rows,
      sampledMaximum:{time:peak.time,responseFactor:peak.responseFactor},
      executedDuration:a.at(-1).time};
  } catch(error) {
    if (!(error instanceof DiscoveryError)) throw error;
    return {status:'unavailable',code:error.code,reason:error.message};
  }
}

/** Compare one selected direction at two finite amplitudes. No fit or acquisition. */
export function compareNearbyReleases(model,initial,perturbation,options={}) {
  prepareTorquePredictor(model);
  const snapshot={schema:model.schema,terms:model.terms.map(({id,coefficient})=>({id,coefficient}))};
  prepareTorquePredictor(snapshot);
  const start=state(initial,'initial'),delta=state(perturbation,'perturbation');
  if (delta.position===0 && delta.rate===0) fail('Choose a nonzero initial perturbation.');
  const {solver,timeScale}=settings(options);
  const full=shifted(start,delta,1,'full'),half=shifted(start,delta,0.5,'half');
  for (const changed of [full,half]) {
    if (!(norm(changed.actual.position,changed.actual.rate,timeScale)>0))
      fail('The actual initial perturbation has zero norm.','unresolved_numeric');
  }
  const execute=(name,initialState)=>{
    try {
      const result=executeStudioDynamics(snapshot,initialState,solver);
      return {name,status:'completed',initial:{...initialState},trajectory:result.trajectory,
        diagnostics:result.diagnostics,executedDuration:result.trajectory.at(-1).time};
    } catch(error) {
      if (!(error instanceof DiscoveryError)) throw error;
      return {name,status:'failed',initial:{...initialState},code:error.code,reason:error.message,
        executedDuration:null,partialTrajectoryAvailable:false};
    }
  };
  const courses={nominal:execute('nominal',start),full:execute('full',full.initial),half:execute('half',half.initial)};
  const comparisons={full:compareCourse(courses.nominal,courses.full,full.actual,timeScale),
    half:compareCourse(courses.nominal,courses.half,half.actual,timeScale)};
  let sizeComparison={status:'unavailable',reason:'Both finite perturbation comparisons must complete.'};
  if (comparisons.full.status==='completed' && comparisons.half.status==='completed') {
    try {
      const rows=comparisons.full.rows.map((fullRow,index)=>{
        const halfRow=comparisons.half.rows[index];
        const positionDifference=2*halfRow.positionDifference-fullRow.positionDifference;
        const rateDifference=2*halfRow.rateDifference-fullRow.rateDifference;
        const factorDifference=fullRow.responseFactor-halfRow.responseFactor;
        if (!Number.isFinite(factorDifference)) fail('Response-factor disagreement is nonfinite.','unresolved_numeric');
        return {time:fullRow.time,twiceHalfMinusFull:{position:positionDifference,rate:rateDifference,
          distance:norm(positionDifference,rateDifference,timeScale)},factorDifference};
      });
      sizeComparison={status:'completed',rows,
        exactHalfInitialDifference:2*half.actual.position===full.actual.position && 2*half.actual.rate===full.actual.rate,
        interpretation:'Finite amplitude and numerical/rounding sensitivity. This is not a variational derivative, numerical convergence test or integration-error bound.'};
    } catch(error) {
      if (!(error instanceof DiscoveryError)) throw error;
      sizeComparison={status:'unavailable',code:error.code,reason:error.message};
    }
  }
  const complete=Object.values(courses).every(course=>course.status==='completed') && sizeComparison.status==='completed';
  return {schema:'worldlaw.nearby-releases/v1',status:complete?'completed':'incomplete',
    source:{model:snapshot,initial:start,requestedPerturbation:delta},
    settings:{...solver,timeScale},
    norm:{formula:'hypot(delta_position, timeScale * delta_rate)',timeScaleSeconds:timeScale,distanceUnit:'rad',responseFactorUnit:'1'},
    initialPerturbations:{full,half},courses,comparisons,sizeComparison,
    work:{courseCount:3,reservedMaximumAdaptiveTrials:3*solver.maxTrials,
      reservedMaximumFixedSteps:3*Math.ceil(solver.duration/solver.dt),
      completedAdaptiveTrials:Object.values(courses).reduce((sum,course)=>sum+(course.diagnostics?.trials??0),0),
      failedCourseWorkUnknown:Object.values(courses).some(course=>course.status==='failed')},
    interpretation:'Conditional predictions for one declared finite initial-state direction, using the maintained Studio solver. The sampled maximum is not maximum gain over directions or times, an instantaneous spectrum, physical validation, a Lyapunov exponent or a global stability claim. All courses retain their original numerical method and failures.'};
}
