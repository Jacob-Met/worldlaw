/** Source-only finite-time tangent propagation on WORLDLAW's smooth angular dynamics.
 * No physical inertia identification, acquired observations or calibrated uncertainty.
 */
import {normalizeAngularForecastRun, rolloutAngular, AngularDataError} from '../trajectory/angular-discovery.mjs';

const SCHEMA = 'worldlaw.finite-time-transition/v1';
const LIMIT = 1e6;
const fail = (message, code='invalid_transition') => {throw new AngularDataError(message, code);};
const requireFinite = (number, where) => {
  if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number)>LIMIT) fail(where+' exceeded the finite executable state envelope.','numerical_failure');
  return number;
};
const smoothIds = new Set(['spring','rate','gravity','quadratic','bias','cubic','cosine']);
function coefficients(model) {
  const parsed = new Map();
  for (const term of model.terms) {
    if (term.id==='coulomb' && term.coefficient!==0) fail('Finite-time tangent propagation is unavailable for nonsmooth Coulomb terms.','unsupported_nonsmooth');
    if (!smoothIds.has(term.id) && term.id!=='coulomb') fail('Unsupported angular term for finite-time sensitivity: '+term.id,'unsupported_model');
    parsed.set(term.id,term.coefficient);
  }
  return parsed;
}
const coeff = (terms,id) => terms.get(id) ?? 0;
function tangentDerivative(y,terms) {
  const [q,v,p11,p12,p21,p22]=y;
  const a=coeff(terms,'spring')*q + coeff(terms,'rate')*v +
    coeff(terms,'gravity')*Math.sin(q) + coeff(terms,'quadratic')*v*Math.abs(v) +
    coeff(terms,'bias') + coeff(terms,'cubic')*q*q*q + coeff(terms,'cosine')*Math.cos(q);
  const aq=coeff(terms,'spring')+coeff(terms,'gravity')*Math.cos(q)+
    3*coeff(terms,'cubic')*q*q-coeff(terms,'cosine')*Math.sin(q);
  const av=coeff(terms,'rate')+2*coeff(terms,'quadratic')*Math.abs(v);
  return [v,a,p21,p22,aq*p11+av*p21,aq*p12+av*p22].map((n,i)=>requireFinite(n,'Tangent derivative '+i));
}
function stepRK4(y,h,terms) {
  const k1=tangentDerivative(y,terms);
  const update=(a,k,scale)=>a.map((v,i)=>v+scale*k[i]);
  const k2=tangentDerivative(update(y,k1,h/2),terms);
  const k3=tangentDerivative(update(y,k2,h/2),terms);
  const k4=tangentDerivative(update(y,k3,h),terms);
  return y.map((v,i)=>requireFinite(v+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6,'Tangent state '+i));
}
function boundedSettings(settings) {
  if(!settings || typeof settings!=='object' || Array.isArray(settings))fail('Provide a settings object.');
  const maxStep=settings.maxStep??.01, maxTotalSteps=settings.maxTotalSteps??400000;
  if(typeof maxStep!=='number'||!Number.isFinite(maxStep)||maxStep<1e-5||maxStep>.1)fail('maxStep must be 0.00001–0.1 s.');
  if(!Number.isSafeInteger(maxTotalSteps)||maxTotalSteps<2||maxTotalSteps>1000000)fail('maxTotalSteps must be an integer 2–1000000.');
  return {maxStep,maxTotalSteps};
}
/** Exact sample-times and same RK4 stage dynamics as maintained smooth rollout.
 * Both forward and tangent work are pre-reserved before any execution.
 */
export function propagateFiniteTime(model, rawRun, settings={}) {
  const run=normalizeAngularForecastRun(rawRun);
  const {maxStep,maxTotalSteps}=boundedSettings(settings);
  const divisions=run.samples.slice(1).map((s,i)=>{
    const n=Math.max(1,Math.ceil((s.time-run.samples[i].time)/maxStep));
    if(!Number.isSafeInteger(n)||n<1)fail('Invalid integration subdivision.','step_limit');
    return n;
  });
  const steps=divisions.reduce((sum,n)=>sum+n,0);
  if(!Number.isSafeInteger(steps)||steps>Math.floor(maxTotalSteps/2))fail('Combined reference and tangent execution exceeds the declared step budget.','step_limit');
  // Retain original source-model validation and the original evaluated trajectory.
  // The reference run does not assimilate later measured positions.
  const baseline=rolloutAngular(model,run,{maxStep,maxSteps:steps});
  const terms=coefficients(model);
  let y=[run.samples[0].position,run.initialRate,1,0,0,1];
  const rows=[];
  const record=(index)=>{
    const source=baseline.rows[index];
    if(Math.abs(source.predicted-y[0])>1e-9*Math.max(1,Math.abs(y[0])) ||
       Math.abs(source.rate-y[1])>1e-9*Math.max(1,Math.abs(y[1])))
      fail('Augmented RK4 trajectory differs from the maintained source solver.','solver_parity');
    rows.push({time:source.time,position:source.predicted,rate:source.rate,
      transition:[[y[2],y[3]],[y[4],y[5]]]});
  };
  record(0);
  for(let i=0;i<divisions.length;i++){
    const duration=run.samples[i+1].time-run.samples[i].time;
    const h=duration/divisions[i];
    for(let j=0;j<divisions[i];j++)y=stepRK4(y,h,terms);
    record(i+1);
  }
  return {schema:SCHEMA,modelId:baseline.modelId,runId:run.id,
    sourceLabel:run.source.label,steps,combinedReservedSteps:steps*2,
    units:{time:'s',position:'rad',rate:'rad/s',transition:[['1','s'],['1/s','1']]},
    rows,method:'smooth_tangent_equations_RK4_with_maintained_forward_parity',
    limitations:[
      'The state-transition matrix is a local derivative of a declared, smooth angular model, not a guaranteed nonlinear perturbation envelope.',
      'The physical inertia and absolute torque scale remain unknown.',
      'Finite-step RK4 accuracy, coefficient uncertainty and actual physical validity are not established by this calculation.',
      'Coulomb discontinuities and unsupported terms refuse rather than returning a misleading derivative.',
    ]};
}

