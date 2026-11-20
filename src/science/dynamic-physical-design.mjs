/**
 * Time-resolved, exact structural experiment design for declared linear latent dynamics.
 *
 * This lifts each offered future channel into its row at the original state:
 *     y_{j,t} = C_j A^t x_0 + known_affine_input + error.
 * Any KNOWN affine input cancels from the row space. Unknown process innovations,
 * unknown A, time-varying private sensor errors and shared input uncertainty do
 * NOT cancel; they require additional latent variables in the supplied model.
 *
 * It is a SOURCE-ONLY structural compiler: it does not fit A from measured data,
 * read a real sensor, or certify a physical instrument's drift or noise. Results
 * are conditional on the independently checked transition/measurement contract.
 */
import {designPhysicalAnchors,propagatePhysicalObservation}
  from './physical-identifiability.mjs';

export const DYNAMIC_PHYSICAL_SCHEMA='worldlaw.dynamic-physical-design/v1';
const error=(reason)=>{throw Error('Dynamic physical design: '+reason);};
const check=(condition,reason)=>{if(!condition)error(reason);};
const idPattern=/^[a-zA-Z_][a-zA-Z0-9_.:-]{0,63}$/;
function rows(value,label,n,max){
  check(Array.isArray(value)&&value.length>=1&&value.length<=max,
    label+' must contain 1–'+max+' source-declared rows');
  const seen=new Set();
  return value.map((v,i)=>{
    check(v&&typeof v==='object'&&!Array.isArray(v),label+' row '+i+' is invalid');
    check(typeof v.id==='string'&&idPattern.test(v.id)&&!seen.has(v.id),
      label+' IDs must be unique and stable');
    check(Array.isArray(v.coefficients)&&v.coefficients.length===n,
      label+' '+v.id+' needs '+n+' exact latent coefficients');
    seen.add(v.id);
    return v;
  });
}
function duration(value,label){
  check(Number.isSafeInteger(value)&&value>=0&&value<=12,label+' must be an integer in 0–12');
  return value;
}
const copied=object=>JSON.parse(JSON.stringify(object));

export function designDynamicPhysicalReadings(request){
  check(request&&typeof request==='object'&&!Array.isArray(request),
    'provide a declared time-resolved physical measurement contract');
  check(request.schema===DYNAMIC_PHYSICAL_SCHEMA,
    'explicit worldlaw.dynamic-physical-design/v1 schema is required');
  check(request.evolution&&typeof request.evolution==='object',
    'a source-declared time-homogeneous linear transition is required');
  const variables=request.variables;
  check(Array.isArray(variables)&&variables.length>=2&&variables.length<=16,
    'declare 2–16 latent variable IDs');
  const n=variables.length;
  const transition=request.evolution.matrix;
  check(Array.isArray(transition)&&transition.length===n&&
    transition.every(r=>Array.isArray(r)&&r.length===n),
    'the exact latent transition must be n by n');
  check(typeof request.evolution.source==='string'&&request.evolution.source.trim().length>=12,
    'name the independent source or explicit hypothetical assumption for the transition');
  check(request.evolution.source.length<=2048,
    'transition provenance exceeds the source contract budget');
  const horizon=duration(request.horizon,'horizon');
  check(horizon>=1,'one or more future ticks must be offered');
  const baseline=rows(request.observations,'initial observations',n,128);
  const sensors=rows(request.futureSensors,'future sensor menu',n,16);
  const targets=rows(request.targets,'target functionals',n,16);
  const schedule=[];
  const matrix=transition;
  for(const sensor of sensors){
    check(Number.isSafeInteger(sensor.cost)&&sensor.cost>=1&&sensor.cost<=1e9,
      'future sensor '+sensor.id+' must have a positive integer acquisition cost');
  }
  const offeredTicks=request.offeredTicks??Array.from({length:horizon},(_,i)=>i+1);
  check(Array.isArray(offeredTicks)&&offeredTicks.length>=1&&offeredTicks.length<=horizon,
    'offer one or more bounded future sampling ticks');
  check(new Set(offeredTicks).size===offeredTicks.length&&
    offeredTicks.every(t=>Number.isSafeInteger(t)&&t>=1&&t<=horizon),
    'future sampling ticks must be unique integers in 1–horizon');
  const sortedTicks=[...offeredTicks].sort((a,b)=>a-b);
  const propagated=new Map();
  for(const sensor of sensors){
    let coefficients=sensor.coefficients;
    for(let tick=1;tick<=horizon;tick++){
      coefficients=propagatePhysicalObservation(coefficients,matrix);
      if(sortedTicks.includes(tick)){
        const id=sensor.id+'.t'+tick;
        const item={id,coefficients,cost:sensor.cost,
          source:(sensor.source??'declared channel')+'; tick='+tick+
            '; conditional on transition '+request.evolution.source};
        schedule.push(item);
        propagated.set(id,{sensorId:sensor.id,tick,cost:sensor.cost});
      }
    }
  }
  check(schedule.length<=32,
    'future channel × tick menu exceeds 32 exact anchor candidates; reduce offeredTicks or futureSensors');
  // Frozen target at original time or at a future prediction time.
  const targetRows=targets.map(target=>{
    const tick=duration(target.atTick??0,'target '+target.id+' atTick');
    check(tick<=horizon,'target time exceeds horizon');
    let coefficients=target.coefficients;
    for(let i=0;i<tick;i++)coefficients=propagatePhysicalObservation(coefficients,matrix);
    return {id:target.id,coefficients};
  });
  const source={
    variables,observations:baseline,anchors:schedule,targets:targetRows,
    maxAnchors:request.maxReadings??Math.min(schedule.length,8),
    workLimit:request.workLimit??50000,
  };
  const proof=designPhysicalAnchors(source);
  const selection=proof.selection?.map(s=>({...propagated.get(s.id),
    id:s.id,coefficients:s.coefficients,source:s.source}));
  return {
    schema:DYNAMIC_PHYSICAL_SCHEMA,
    status:proof.status,
    scientificStatus:'conditional_structural_design_only',
    dynamicsAreDeclaredNotValidated:true,
    actualPhysicalActionsPerformed:false,
    fittedOrReadHeldoutMeasurements:false,
    inputAndProcessNoiseBoundary:'Known affine inputs do not improve linear row rank. Unmodeled stochastic innovations, unsynchronized clocks or changing error states invalidate this finite-dimensional transition.',
    latentDimension:n,horizon,
    offeredTicks:sortedTicks,initialSensors:baseline.map(s=>s.id),
    candidateSensors:sensors.map(s=>s.id),transitionSource:request.evolution.source,
    targetIds:targets.map(t=>t.id),
    schedule:selection,
    numFutureReadings:selection?.length??null,
    readingCost:proof.totalCost??null,
    proof,
    interpretation:'This is an exact source-declared finite-choice structural row-space certificate, not a measured law or calibrated sensor. Minimum means number of future readings; costs break equal-count ties. Authenticate the dynamics independently before attempting physical use.',
  };
}
export function replayDynamicPhysicalReadings(request,certificate){
  const fresh=designDynamicPhysicalReadings(request);
  check(certificate?.schema===DYNAMIC_PHYSICAL_SCHEMA&&
    JSON.stringify(certificate)===JSON.stringify(fresh),
    'certificate or source transition changed; regenerate the complete exact proof');
  return {valid:true,scientificStatus:fresh.scientificStatus,
    actionsPerformed:false};
}
