/** Independent sparse Gaussian reading receiver.
 *
 * The planner has already selected laws, a physical release and timestamps,
 * without reading new observations. Only post-planning sensor readings enter
 * this likelihood evaluation. No challenge observations, oracle coefficients
 * or full unmeasured trajectory enter model selection. This is a conditional
 * comparison inside the offered training-derived finite hypothesis set, not
 * discovery of a unique law or training on eight irregular samples.
 */
import {planTrajectoryExperiment} from './planner.mjs';
import {qualifyTrajectoryPlan} from '../experiment-design/qualify-trajectory-plan.mjs';
import {acquireVirtualPendulumReadings} from './virtual-experiment.mjs';

export const SPARSE_RECEIVING_SCHEMA='worldlaw.sparse-discrimination/v1';
export const SPARSE_EXPERIMENT_SCHEMA='worldlaw.sparse-experiment/v1';
export class SparseDiscriminationError extends Error {
  constructor(message,code='invalid_sparse_evidence'){super(message);this.name='SparseDiscriminationError';this.code=code;}
}
const requireThat=(condition,message,code)=>{if(!condition)throw new SparseDiscriminationError(message,code);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/** Evaluate fixed shortlisted models on measurements at the plan's *actual*
 * sampled indices only. The model ordering, requested sample times, noise
 * variance and release must match exactly or the input is rejected.
 */
export function receiveSparseReadings(plan,evidence){
  requireThat(object(plan)&&plan.schema==='worldlaw.trajectory-plan/v1'&&
    plan.method==='finite-grid_minimax_independent_gaussian_discrimination'&&
    plan.status==='proposed'&&object(plan.selected)&&object(plan.selected.power),
    'Use an informative noise-aware prospective trajectory plan.', 'invalid_plan');
  const {selected}=plan, sigma=plan.options.noiseSigma, requested=selected.power.readings;
  requireThat(finite(sigma)&&sigma>0&&sigma<=.05&&
    selected.power.status==='distinguishable'&&Array.isArray(requested)&&requested.length>=1&&
    requested.length<=128,'Plan must have a finite positive noise scale and a concrete distinguishing reading subset.','invalid_plan');
  requireThat(object(evidence)&&evidence.schema==='worldlaw.virtual-pendulum-sparse/v1'&&
    evidence.kind==='synthetic'&&Array.isArray(evidence.readings)&&
    object(evidence.source)&&typeof evidence.source.recordingId==='string'&&
    evidence.source.instrumentId==='worldlaw.virtual-pendulum/v1',
    'Supply real source-labeled sparse virtual-instrument measurements.', 'invalid_sparse_evidence');
  requireThat(evidence.source.positionNoiseSigma===sigma&&
    evidence.initialPosition===selected.initialPosition&&evidence.initialRate===selected.initialRate&&
    evidence.source.duration===selected.duration&&evidence.source.sampleInterval===selected.sampleInterval,
    'The acquired sensor noise or physical release differs from the prospectively selected experiment.',
    'protocol_mismatch');
  requireThat(evidence.measurementCount===requested.length&&
    evidence.source.measuredSampleCount===requested.length&&
    Array.isArray(evidence.source.sampleIndices)&&
    evidence.source.sampleIndices.length===requested.length&&
    evidence.readings.length===requested.length,
    'Sparse acquisition must preserve the exact declared sensor reading budget.', 'protocol_mismatch');
  for(let i=0;i<requested.length;i++){
    const r=evidence.readings[i],p=requested[i];
    requireThat(object(r)&&Number.isSafeInteger(r.sampleIndex)&&r.sampleIndex===p.sampleIndex&&
      evidence.source.sampleIndices[i]===p.sampleIndex&&r.time===p.time&&
      finite(r.position)&&r.command===0,
      'Observation time/index/command does not match the frozen prospective plan.', 'protocol_mismatch');
  }
  requireThat(Array.isArray(selected.predictions)&&selected.predictions.length>=2&&
    selected.predictions.length<=16,'A sparse comparison needs two or more complete prospective laws.', 'invalid_plan');
  const modelIds=new Set(), evaluated=selected.predictions.map(model=>{
    requireThat(object(model)&&typeof model.modelId==='string'&&!modelIds.has(model.modelId)&&
      Array.isArray(model.rows),'Models and predictions must be uniquely identified.', 'invalid_plan');
    modelIds.add(model.modelId);
    let energy=0,maxAbsResidualRad=0;
    for(let i=0;i<requested.length;i++){
      const expected=model.rows[requested[i].sampleIndex];
      requireThat(object(expected)&&expected.time===requested[i].time&&finite(expected.position),
        'Candidate predictions do not cover the exact acquired timestamps.', 'invalid_plan');
      const residual=evidence.readings[i].position-expected.position;
      energy+=(residual/sigma)**2;
      maxAbsResidualRad=Math.max(maxAbsResidualRad,Math.abs(residual));
    }
    requireThat(finite(energy),'Sparse prediction likelihood exceeded the finite scoring range.','numerical_failure');
    return {modelId:model.modelId,normalizedSquaredResidual:energy,maxAbsResidualRad};
  });
  evaluated.sort((a,b)=>a.normalizedSquaredResidual-b.normalizedSquaredResidual||a.modelId.localeCompare(b.modelId));
  const best=evaluated[0].normalizedSquaredResidual;
  let mass=0;
  const weighted=evaluated.map(item=>{
    const w=Math.exp(-.5*(item.normalizedSquaredResidual-best));
    mass+=w;
    return {...item,relativeLikelihood:w};
  });
  requireThat(finite(mass)&&mass>0,'Gaussian likelihood normalization failed.','numerical_failure');
  const candidates=weighted.map(item=>({...item,conditionalEqualPriorWeight:item.relativeLikelihood/mass}));
  const decisionMarginChi2=candidates[1].normalizedSquaredResidual-candidates[0].normalizedSquaredResidual;
  return {schema:SPARSE_RECEIVING_SCHEMA,status:'conditional_discrimination_only',
    recordingId:evidence.source.recordingId,
    selectedModelId:candidates[0].modelId,
    sampleIndices:requested.map(r=>r.sampleIndex),
    sampleTimesSeconds:requested.map(r=>r.time),
    measuredReadingCount:requested.length,unmeasuredPositionsConsumed:0,
    sigmaRad:sigma,candidates,decisionMarginChi2,
    bestResidualNormZ:Math.sqrt(best),
    modelScope:'Only the original training-competitive hypotheses that the planner evaluated; an omitted or wrong law cannot be ruled out.',
    inferenceMeaning:'Equal-prior relative Gaussian likelihood among offered frozen predictions with independently declared homoscedastic sensor sigma. This does not refit coefficients, authenticate the source, establish physical causal truth, or calibrate confidence.',
    limitations:['The virtual apparatus still integrates intervening physical dynamics, but measures only the selected positions.',
      'An initial condition supplied to the apparatus is not counted as a noisy sensor measurement.',
      'Unobserved timestamps are not synthesized as evidence or used in the receiver.',
      'No held-out challenge, oracle truth or training coefficients from the instrument source are inspected.',
      'Equal-prior conditional weights may be misleading if all offered models are wrong, noise assumptions fail, or numerical errors are appreciable.']};
}

/** One deterministically reproducible guarded cold invocation.
 * Both the grid forecast and an independent RK4 numerical qualification are
 * completed before the instrument is invoked. The refusal is retained as
 * a result, not an implicit or forced measurement.
 */
export function runSparseExperiment(discovery,settings,{seed,existingRuns}={}){
  requireThat(object(settings)&&finite(settings.noiseSigma)&&settings.noiseSigma>0,
    'A real sparse experiment requires declared positive position sensor sigma.', 'invalid_design');
  const plan=planTrajectoryExperiment(discovery,settings);
  const numerical=qualifyTrajectoryPlan(discovery,plan);
  const permitted=plan.status==='proposed'&&numerical.status==='screen_passed';
  if(!permitted)return {schema:SPARSE_EXPERIMENT_SCHEMA,status:'acquisition_refused',
    plan,numericalQualification:numerical,evidence:null,receiving:null,
    acquisitionPerformed:false};
  requireThat(Number.isSafeInteger(seed)&&seed>=0&&seed<=4294967295,
    'An independent sparse acquisition needs an explicit seeded noise realization.', 'invalid_request');
  requireThat(Array.isArray(existingRuns)&&existingRuns.length>=1,
    'Pass complete retained source evidence as existingRuns for replay protection.', 'invalid_history');
  const indices=plan.selected.power.readings.map(r=>r.sampleIndex);
  const evidence=acquireVirtualPendulumReadings({...plan.selected.acquisitionRequest,
    noiseSigma:plan.options.noiseSigma,seed,sampleIndices:indices},
    {existingRuns});
  const receiving=receiveSparseReadings(plan,evidence);
  return {schema:SPARSE_EXPERIMENT_SCHEMA,status:'acquired_sparse_evidence',
    plan,numericalQualification:numerical,evidence,receiving,acquisitionPerformed:true};
}
