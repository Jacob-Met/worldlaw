/** Conditional two-coordinate dynamics, using the maintained torque predictor.
 * Quasi-static fitting never identifies inertia, damping, or a dynamic equation.
 */
import {readSymmetricInertia,solveSymmetricInertia} from './inertia.mjs';
import {readSymmetricDamping} from './damping.mjs';
import {predictCoupling, CouplingError, requireThat, finite, pair} from './science.mjs';
import {analyzeCouplingNotebook, readCouplingNotebook} from './notebook.mjs';

export const INPUT_SCHEMA = 'worldlaw.coupling-dynamics-input/v1';
export const NOTEBOOK_SCHEMA = 'worldlaw.coupling-dynamics-notebook/v1';
export const MATRIX_INPUT_SCHEMA = 'worldlaw.coupling-dynamics-input/v2';
export const MATRIX_NOTEBOOK_SCHEMA = 'worldlaw.coupling-dynamics-notebook/v2';
export const MATRIX_INTERPRETATION = 'position-torque-with-declared-symmetric-inertia-and-damping';
export const LOSS_INPUT_SCHEMA = 'worldlaw.coupling-dynamics-input/v3';
export const LOSS_NOTEBOOK_SCHEMA = 'worldlaw.coupling-dynamics-notebook/v3';
export const LOSS_INTERPRETATION = 'position-torque-with-declared-symmetric-inertia-and-symmetric-loss';
export const STEP_BUDGET = 120000;
const STATE_BOUND = 1e6;
const UNITS = Object.freeze({position:'rad', rate:'rad/s', inertia:'kg·m²', damping:'N·m·s/rad', time:'s'});
const inputKeys = ['schema','interpretation','declaration','units','inertia','damping','initialPosition','initialRate','duration','samples','maxStep','positionTolerance','rateTolerance'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function exactKeys(value, keys, label) {
  requireThat(record(value) && Object.keys(value).every(key=>keys.includes(key)), label+' contains unknown fields.');
}
function positive(value,name,max) {
  finite(value,name,max);requireThat(value>0,name+' must be positive.');return value;
}
function label(value,name) {
  requireThat(typeof value==='string' && value.trim().length>0 && value.length<=1000,name+' needs nonempty text of at most 1000 characters.');
  return value;
}
export function defaultDynamicsInputs() {
  return {schema:INPUT_SCHEMA,interpretation:'position-torque-with-declared-inertia-and-damping',
    declaration:'Authored exploration: constant diagonal inertia and separately declared viscous damping; no physical calibration.',
    units:{...UNITS},inertia:[1,1],damping:[.15,.15],initialPosition:[.6,0],initialRate:[0,0],
    duration:4,samples:241,maxStep:.01,positionTolerance:.0001,rateTolerance:.0001};
}
export function readDynamicsInputs(raw) {
  const loss=raw?.schema===LOSS_INPUT_SCHEMA,matrix=loss||raw?.schema===MATRIX_INPUT_SCHEMA;
  exactKeys(raw,loss?[...inputKeys,'inertiaCross','dampingCross']:matrix?[...inputKeys,'inertiaCross']:inputKeys,'Dynamics inputs');
  requireThat(loss?raw.interpretation===LOSS_INTERPRETATION:matrix?raw.interpretation===MATRIX_INTERPRETATION:raw.schema===INPUT_SCHEMA && raw.interpretation==='position-torque-with-declared-inertia-and-damping',
    'Explicitly declare the position-torque dynamical interpretation.');
  exactKeys(raw.units,Object.keys(UNITS),'Dynamics units');
  requireThat(Object.entries(UNITS).every(([key,value])=>raw.units[key]===value),'Declare the exact dynamics units.');
  const inertia=pair(raw.inertia,'inertia',1e6),damping=pair(raw.damping,'damping',1e6);
  requireThat(inertia.every(x=>x>=1e-9),'Each constant diagonal inertia must be at least 1e-9 kg·m².');
  requireThat(damping.every(x=>x>=0),'Each declared viscous damping coefficient must be nonnegative.');
  if(matrix)readSymmetricInertia(inertia,raw.inertiaCross);
  if(loss)readSymmetricDamping(damping[0],damping[1],raw.dampingCross);
  const inputs={schema:loss?LOSS_INPUT_SCHEMA:matrix?MATRIX_INPUT_SCHEMA:INPUT_SCHEMA,...(matrix?{inertiaCross:raw.inertiaCross}:{}),...(loss?{dampingCross:raw.dampingCross}:{}),interpretation:raw.interpretation,declaration:label(raw.declaration,'Dynamics declaration'),units:{...UNITS},
    inertia,damping,initialPosition:pair(raw.initialPosition,'initialPosition'),initialRate:pair(raw.initialRate,'initialRate'),
    duration:positive(raw.duration,'duration',100),samples:raw.samples,maxStep:positive(raw.maxStep,'maxStep',1),
    positionTolerance:positive(raw.positionTolerance,'positionTolerance',1e3),rateTolerance:positive(raw.rateTolerance,'rateTolerance',1e3)};
  requireThat(Number.isSafeInteger(inputs.samples)&&inputs.samples>=2&&inputs.samples<=1001,'Use 2–1001 output samples.');
  requireThat(inputs.maxStep>=1e-8,'maxStep must be at least 1e-8 seconds.');
  requireThat(inputs.positionTolerance>=1e-12&&inputs.rateTolerance>=1e-12,'Numerical tolerances must be at least 1e-12 in their declared units.');
  return inputs;
}
function grid(inputs, count, comparisons=1) {
  requireThat(Number.isInteger(count)&&count>=1&&count<=6,'Compare one to six executable models.');
  requireThat(Number.isSafeInteger(comparisons)&&comparisons>=1&&comparisons<=1024,'Reserve one to 1024 complete comparisons.');
  const intervals=inputs.samples-1,delta=inputs.duration/intervals,substeps=Math.max(1,Math.ceil(delta/inputs.maxStep));
  const requiredSteps=intervals*substeps*3*count*comparisons;
  requireThat(Number.isSafeInteger(requiredSteps)&&requiredSteps<=STEP_BUDGET,
    'The complete coarse/refined comparison exceeds '+STEP_BUDGET+' integration steps. Shorten the duration or increase the step.','step_limit');
  return {intervals,delta,substeps,requiredSteps};
}
/** Share the exact solver reservation when a consumer compares many courses. */
export function reserveDynamicsSteps(rawInputs,modelCount,comparisons=1) {
  return grid(readDynamicsInputs(rawInputs),modelCount,comparisons);
}
function domainOf(model) {
  if(!Array.isArray(model.domain)||model.domain.length!==2)return null;
  return model.domain.every(d=>record(d)&&Number.isFinite(d.min)&&Number.isFinite(d.max)&&d.min<=d.max)
    ?model.domain.map(d=>({min:d.min,max:d.max})):null;
}
function checkedState(state) {
  requireThat(state.every(Number.isFinite),'Coupled dynamics became nonfinite.','numerical_failure');
  requireThat(state.every(v=>Math.abs(v)<=STATE_BOUND),'Coupled dynamics exceeded the ±'+STATE_BOUND+' executable state bound.','runaway_state');
}
function integrate(model,inputs,setup,refinement) {
  const steps=setup.substeps*refinement,h=setup.delta/steps,domain=domainOf(model);
  const loss=inputs.schema===LOSS_INPUT_SCHEMA;
  const mass=loss||inputs.schema===MATRIX_INPUT_SCHEMA?readSymmetricInertia(inputs.inertia,inputs.inertiaCross):null;
  let state=[...inputs.initialPosition,...inputs.initialRate],time=0,firstOutside=null;
  const ranges=state.slice(0,2).map(v=>({min:v,max:v}));
  function mark(values,t) {
    checkedState(values);
    for(let axis=0;axis<2;axis++) {
      ranges[axis].min=Math.min(ranges[axis].min,values[axis]);ranges[axis].max=Math.max(ranges[axis].max,values[axis]);
    }
    if(domain&&!firstOutside) {
      const axes=[0,1].filter(a=>values[a]<domain[a].min||values[a]>domain[a].max);
      if(axes.length)firstOutside={time:t,position:values.slice(0,2),axes};
    }
  }
  const derivative=(values,t)=>{
    mark(values,t);
    const torque=predictCoupling(model,values.slice(0,2));
    // Keep the original subtraction/order when cross loss is zero for exact v2 parity.
    const force=torque.map((value,axis)=>value-inputs.damping[axis]*values[axis+2]);
    if(loss&&inputs.dampingCross!==0)for(let axis=0;axis<2;axis++)force[axis]-=inputs.dampingCross*values[3-axis];
    const acceleration=mass?solveSymmetricInertia(mass,force)
      :torque.map((value,axis)=>(value-inputs.damping[axis]*values[axis+2])/inputs.inertia[axis]);
    requireThat(acceleration.every(Number.isFinite),'Coupled acceleration became nonfinite.','numerical_failure');
    return [values[2],values[3],...acceleration];
  };
  const row=()=>({time,position:state.slice(0,2),rate:state.slice(2),torque:predictCoupling(model,state.slice(0,2))});
  const rows=[];mark(state,0);rows.push(row());
  try {
    for(let sample=1;sample<=setup.intervals;sample++) {
      for(let step=0;step<steps;step++) {
        time=(sample-1)*setup.delta+step*h;
        const a=derivative(state,time),b=derivative(state.map((v,i)=>v+(h*a[i])/2),time+h/2);
        const c=derivative(state.map((v,i)=>v+(h*b[i])/2),time+h/2),d=derivative(state.map((v,i)=>v+h*c[i]),time+h);
        // Same scale-before-sum convention as the maintained scalar trajectory solver.
        state=state.map((v,i)=>v+(h*a[i])/6+(h*b[i])/3+(h*c[i])/3+(h*d[i])/6);
        mark(state,time+h);
      }
      time=sample===setup.intervals?inputs.duration:sample*setup.delta;
      rows.push(row());
    }
    return {rows,steps:setup.intervals*steps,maximumStep:h,evaluatedPositionRanges:ranges,domain,
      firstOutside,domainStatus:domain?(firstOutside?'outside_observed_range':'evaluated_states_within_observed_range'):'observed_range_unavailable'};
  } catch(error) {
    if(!(error instanceof CouplingError))throw error;
    error.failureTime=time;error.lastOutput=rows.at(-1);throw error;
  }
}
function compareOne(model,inputs,setup) {
  let stage='coarse',coarse;
  try {
    coarse=integrate(model,inputs,setup,1);stage='refined';
    const refined=integrate(model,inputs,setup,2);
    const maxPositionDifference=[0,0],maxRateDifference=[0,0];
    for(let i=0;i<coarse.rows.length;i++)for(let axis=0;axis<2;axis++) {
      maxPositionDifference[axis]=Math.max(maxPositionDifference[axis],Math.abs(coarse.rows[i].position[axis]-refined.rows[i].position[axis]));
      maxRateDifference[axis]=Math.max(maxRateDifference[axis],Math.abs(coarse.rows[i].rate[axis]-refined.rows[i].rate[axis]));
    }
    const passed=maxPositionDifference.every(v=>v<=inputs.positionTolerance)&&maxRateDifference.every(v=>v<=inputs.rateTolerance);
    return {modelId:model.id,label:model.label??model.id,status:passed?'screened':'step_sensitive',coarse,refined,
      screen:{maxPositionDifference,maxRateDifference,positionTolerance:inputs.positionTolerance,rateTolerance:inputs.rateTolerance,
        method:'two_nested_fixed_step_RK4_runs_at_common_output_times',interpretation:'Step agreement is a numerical comparison, not an error bound or physical validation.'}};
  } catch(error) {
    if(!(error instanceof CouplingError))throw error;
    return {modelId:model.id,label:model.label??model.id,status:'failed',
      failure:{stage,code:error.code,message:error.message,time:error.failureTime??0,lastOutput:error.lastOutput??null},
      coarse:coarse??null,refined:null,screen:null};
  }
}
/** All candidates share one complete work reservation and identical source inputs. */
export function compareCoupledDynamics(models,rawInputs) {
  requireThat(Array.isArray(models),'Supply the executable model array.');
  const inputs=readDynamicsInputs(rawInputs),setup=grid(inputs,models.length);
  requireThat(new Set(models.map(m=>m?.id)).size===models.length,'Compared model identities must be distinct.');
  // Validate the real predictor for every model before executing a partial comparison.
  for(const model of models)predictCoupling(model,inputs.initialPosition);
  const results=models.map(model=>compareOne(model,inputs,setup));
  const loss=inputs.schema===LOSS_INPUT_SCHEMA,matrix=loss||inputs.schema===MATRIX_INPUT_SCHEMA,mass=matrix?readSymmetricInertia(inputs.inertia,inputs.inertiaCross):null;
  return {schema:loss?'worldlaw.coupling-dynamics-comparison/v3':matrix?'worldlaw.coupling-dynamics-comparison/v2':'worldlaw.coupling-dynamics-comparison/v1',inputs,results,
    diagnostics:{method:'classical_RK4',equation:loss?'q′ = v; M v′ = predictedTorque(q) − D v':matrix?'q′ = v; M v′ = predictedTorque(q) − diag(damping) v':'q′ = v; v′ᵢ = (predictedTorqueᵢ(q) − dampingᵢ vᵢ) / inertiaᵢ',
      ...(matrix?{inertia:{matrix:mass.matrix,minimumEigenvalue:mass.minimumEigenvalue,conditionInfinity:mass.conditionInfinity,qualification:mass.qualification}}:{}),
      ...(loss?{damping:readSymmetricDamping(inputs.damping[0],inputs.damping[1],inputs.dampingCross)}:{}),
      reservedSteps:setup.requiredSteps,stepBudget:STEP_BUDGET,observationsResetState:false,stateMagnitudeLimit:STATE_BOUND,
      physicalValidity:'not_established',limitations:['Quasi-static observations do not identify this dynamic equation, inertia, damping or physical topology.',
        loss?'Constant symmetric positive-definite inertia and positive-semidefinite viscous loss are assumed; configuration-dependent inertia and nonlinear loss are not modeled.':matrix?'Constant symmetric positive-definite inertia and independent viscous damping are assumed; configuration-dependent inertia and its velocity terms are not modeled.':'Only constant diagonal inertia and independent viscous damping are assumed.',
        'Domain checks inspect evaluated numerical states, not every point of a continuous trajectory.',
        'Agreement of two step sizes is not a bound on numerical error; both can miss unresolved behavior.']}};
}
export function createCoupledDynamicsStudy(rawNotebook,rawInputs) {
  const analysis=analyzeCouplingNotebook(rawNotebook);
  requireThat(analysis.discovery.candidates.length>0,'No executable response family is available.','unidentifiable');
  const comparison=compareCoupledDynamics(analysis.discovery.candidates,rawInputs);
  return {...comparison,source:analysis.notebook.source,selectedModelId:analysis.discovery.selected?.id??null,
    trainingStatus:analysis.discovery.diagnostics.adequacy,refusedModels:analysis.discovery.refused,
    evidenceCounts:{training:analysis.notebook.training.length+analysis.notebook.revisions.length,challenges:analysis.notebook.challenges.length},
    models:analysis.discovery.candidates.map(m=>({id:m.id,label:m.label,trainingRmse:m.metrics.rmse,
      competitive:analysis.discovery.competitive.some(c=>c.id===m.id)}))};
}
export function readDynamicsNotebook(input) {
  if(typeof input==='string') {
    requireThat(new TextEncoder().encode(input).length<=3*1024*1024,'Motion notebook exceeds 3 MB.');
    try{input=JSON.parse(input);}catch{throw new CouplingError('Motion notebook must be valid JSON.');}
  }
  exactKeys(input,['schema','evidence','inputs'],'Motion notebook');
  requireThat([NOTEBOOK_SCHEMA,MATRIX_NOTEBOOK_SCHEMA,LOSS_NOTEBOOK_SCHEMA].includes(input.schema),'Choose a WORLDLAW coupled motion notebook.');
  const inputs=readDynamicsInputs(input.inputs),schema=inputs.schema===LOSS_INPUT_SCHEMA?LOSS_NOTEBOOK_SCHEMA:inputs.schema===MATRIX_INPUT_SCHEMA?MATRIX_NOTEBOOK_SCHEMA:NOTEBOOK_SCHEMA;
  requireThat(input.schema===schema,'Motion notebook and inertia-input versions must agree.');
  return {schema,evidence:readCouplingNotebook(input.evidence),inputs};
}
export function exportDynamicsNotebook(evidence,inputs) {
  const schema=inputs?.schema===LOSS_INPUT_SCHEMA?LOSS_NOTEBOOK_SCHEMA:inputs?.schema===MATRIX_INPUT_SCHEMA?MATRIX_NOTEBOOK_SCHEMA:NOTEBOOK_SCHEMA;
  const text=JSON.stringify(readDynamicsNotebook({schema,evidence,inputs}));
  requireThat(new TextEncoder().encode(text).length<=3*1024*1024,'Motion notebook exceeds 3 MB.');
  return text;
}
