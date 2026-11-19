/** Controlled physical-course adapter for prospective sequential Gaussian EIG.
 *
 * Preserve the established discovery -> selected release -> independent
 * two-resolution numerical qualification -> virtual instrument boundary.
 * The planner sees only the frozen model forecasts and the sensor readings
 * actually measured in the preceding steps. The virtual plant and its oracle
 * never enter the information design. This is not physical actuation,
 * probabilistic calibration, or automatic structure discovery.
 */
import {planTrajectoryExperiment} from './planner.mjs';
import {qualifyTrajectoryPlan} from '../experiment-design/qualify-trajectory-plan.mjs';
import {
  openVirtualPendulumSensorStream,VIRTUAL_PENDULUM_INSTRUMENT
} from './virtual-experiment.mjs';
import {planAdaptiveGaussianReading} from './adaptive-gaussian-sensor.mjs';

export const ADAPTIVE_EXPERIMENT_SCHEMA='worldlaw.adaptive-virtual-experiment/v1';
const fail=(condition,message)=>{if(!condition)throw Error(message);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x);

function validateSensorOptions(config){
  fail(object(config),'Supply an explicit prospective Gaussian sensor configuration.');
  const keys=new Set(['sigma','correlationTime','maxReadings','decisionThreshold',
    'timeCostPerSecond','minimumInformationNats','quadratureToleranceNats',
    'workLimit','priors']);
  fail(Object.keys(config).every(key=>keys.has(key)),
    'Unsupported adaptive sensor field; physical truth and posthoc observations are not planner settings.');
  fail(finite(config.sigma)&&config.sigma>=1e-12&&config.sigma<=.05,
    'The controlled virtual sensor supports sigma between 1e-12 and .05 rad.');
  const tau=config.correlationTime??0;
  fail(finite(tau)&&tau>=0&&tau<=1e8,'Declare a fixed finite nonnegative sensor OU time constant.');
  fail(Number.isInteger(config.maxReadings)&&config.maxReadings>=1&&config.maxReadings<=32,
    'Declare a prospective one-to-32 reading budget.');
  return {...config,correlationTime:tau};
}
function supportsInstrument(plan){
  const selected=plan.selected;
  if(!selected)return false;
  const a=selected.acquisitionRequest,I=VIRTUAL_PENDULUM_INSTRUMENT;
  return plan.options.inertia===I.inertia&&plan.options.command===I.command&&
    a.initialPosition>=I.allowedInitialPosition.min&&
    a.initialPosition<=I.allowedInitialPosition.max&&
    a.initialRate>=I.allowedInitialRate.min&&
    a.initialRate<=I.allowedInitialRate.max&&
    a.duration>=I.allowedDuration.min&&a.duration<=I.allowedDuration.max&&
    a.sampleInterval>=I.allowedSampleInterval.min&&
    a.sampleInterval<=I.allowedSampleInterval.max;
}

/** One complete physical-course receiving experiment on a reproducible
 * independent virtual plant. No refit is asserted from sparse positions.
 *
 * A missing/noisy model may produce a confident but wrong conditional answer.
 * This is deliberately preserved in the receiving, not called causal truth.
 */
export function runAdaptiveVirtualExperiment(discovery,design,sensorConfiguration,
  {seed,existingRuns}={}){
  fail(object(design),'Declare release bounds and a numerical solver budget.');
  const sensorOptions=validateSensorOptions(sensorConfiguration);
  fail(!('noiseSigma' in design)&&!('noiseTargetZ' in design)&&
    !('noiseMaxReadings' in design)&&!('noiseCorrelationTime' in design)&&
    !('noiseCorrelationTimeMax' in design),
    'Supply physical release settings separately from the adaptive sensor; avoid the static sensor selector.');
  // Model shortlist and selected release are frozen before this method admits
  // any measurement. Numeric qualification is inherited from the maintained
  // independent solver and physically unsupported requests are refused.
  const plan=planTrajectoryExperiment(discovery,design);
  const numericalQualification=qualifyTrajectoryPlan(discovery,plan);
  const permitted=plan.status==='proposed'&&
    numericalQualification.status==='screen_passed'&&supportsInstrument(plan);
  if(!permitted)return {
    schema:ADAPTIVE_EXPERIMENT_SCHEMA,status:'acquisition_refused',
    plan,numericalQualification,
    instrumentCompatible:supportsInstrument(plan),
    evidence:null,receiving:null,acquisitionPerformed:false,
    trace:[],
    refusal:'The physical release must be informative, screen-passed and compatible with the fixed virtual instrument before measurement.'
  };
  fail(Number.isSafeInteger(seed)&&seed>=0&&seed<=4294967295,
    'Provide the independently selected unsigned 32-bit seed before acquisition.');
  fail(Array.isArray(existingRuns),'Supply retained evidence explicitly as existingRuns.');
  const input={...plan.selected.acquisitionRequest,
    noiseSigma:sensorOptions.sigma,seed,
    ...(sensorOptions.correlationTime>0?
      {noiseCorrelationTime:sensorOptions.correlationTime}:{})};
  const models=plan.selected.predictions;
  fail(models.every(model=>Array.isArray(model.rows)&&
    model.rows.length===Math.round(input.duration/input.sampleInterval)+1),
    'Fitted candidate predictions and independent virtual sensor clock differ.');
  const virtualSensor=openVirtualPendulumSensorStream(input,{existingRuns});
  const readings=[],trace=[];
  try{
    for(let count=0;count<sensorOptions.maxReadings;count++){
      const before=planAdaptiveGaussianReading(models,sensorOptions,readings);
      if(before.status!=='next_reading_proposed')break;
      const proposal=before.proposed;
      const observed=virtualSensor.readAt(proposal.sampleIndex);
      fail(observed.time===proposal.time,'Virtual sensor returned a different scheduled timestamp.');
      readings.push(observed);
      trace.push({
        round:readings.length,
        prospective:{...proposal},
        priorConditionalWeights:before.models.map(m=>({...m})),
        actualObservation:{...observed},
        unmeasuredPositionsConsumed:0
      });
    }
    const receiving=planAdaptiveGaussianReading(models,sensorOptions,readings);
    if(!readings.length)return {
      schema:ADAPTIVE_EXPERIMENT_SCHEMA,
      status:'acquisition_refused_no_useful_next_measurement',
      plan,numericalQualification,receiving,
      evidence:null,trace,acquisitionPerformed:false,
      interpretation:'The finite offered laws and declared sensor cannot justify one prospective reading; no virtual sensor was invoked.'
    };
    const evidence=virtualSensor.evidence();
    fail(evidence.measurementCount===trace.length&&
      evidence.source.sampleIndices.every((index,i)=>index===trace[i].actualObservation.sampleIndex),
      'Adaptive sensor evidence ledger diverged from its prior proposal trace.');
    return {
      schema:ADAPTIVE_EXPERIMENT_SCHEMA,status:'acquired_adaptive_evidence',
      plan,numericalQualification,evidence,receiving,trace,
      acquisitionPerformed:true,
      instrument:'synthetic independent explicit-equation pendulum',
      actualSensorReadings:evidence.measurementCount,
      unmeasuredPositionsConsumed:0,
      initialCandidateModelIds:models.map(m=>m.modelId),
      interpretation:'A real virtual sensor was called one future timestamp at a time. Posterior and next experiment are conditional on frozen offered law candidates and declared Gaussian noise; no unknown truth or refit is established.'
    };
  }finally{virtualSensor.close();}
}
