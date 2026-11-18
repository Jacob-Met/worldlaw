/** Controlled held-out comparisons of the incumbent RMS release and the new
 * independently noise-declared finite-schedule discriminator.
 *
 * All planning precedes challenge generation; no challenge metric or instrument
 * source truth enters either planner. The two policies use an identical noise
 * stream seed within each independently evaluated strategy for paired control,
 * but each receives its own complete synthetic recording. Nothing here reduces
 * the physical acquisition sample count or proves out-of-family generalization.
 */
import {pathToFileURL} from 'node:url';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {DESIGN} from './trajectory-planning-92be.mjs';

export const GAUSSIAN_RECEIPT_SCHEMA='worldlaw.gaussian-intervention-comparison/v1';
export const GAUSSIAN_NOISE_LEVELS=[.00002,.0005,.002,.01];
export const GAUSSIAN_FROZEN_SEED_BASES=[20003,30011,40013,50021];
const FIT={noiseSigma:.01,maxTerms:4};
const finiteResult=(model,run)=>{
  try{const metrics=rollout(model,run,{maxStep:.005}).metrics;
    return {status:'finite',modelId:model.id,positionRMSE:metrics.positionRMSE};}
  catch(error){return {status:'failed',modelId:model.id,errorCode:error.code??'unknown_refusal',positionRMSE:null};}
};
const median=values=>{
  if(values.length===0)return null;
  const ordered=[...values].sort((a,b)=>a-b),mid=Math.floor(ordered.length/2);
  return ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;
};
const compactPlan=plan=>({
  status:plan.status,
  release:plan.status==='proposed'?plan.selected.acquisitionRequest:null,
  disagreementRad:plan.selected?.disagreementRad??null,
  ...(!plan.selected?.power?{}:{power:{
    status:plan.selected.power.status,
    readings:plan.selected.power.readings,
    lowerBoundReadings:plan.selected.power.lowerBoundReadings,
    certifiedMinimumReadings:plan.selected.power.certifiedMinimumReadings,
    minPairwiseZ:plan.selected.power.minPairwiseZ,
  }}),
});
function refit(training,challenge,plan,seed,noiseSigma){
  if(plan.status!=='proposed')return null;
  const request={...plan.selected.acquisitionRequest,seed,noiseSigma};
  const acquired=acquireVirtualPendulum(request,{existingRuns:[...training,challenge]});
  const revised=discoverIntegral([...training,acquired],FIT);
  return {received:finiteResult(revised.selected,challenge),
    modelId:revised.selected.id,
    samplesAcquired:acquired.samples.length,
    recordingId:acquired.source.recordingId};
}
function groups(rows){
  return GAUSSIAN_NOISE_LEVELS.map(noiseSigma=>{
    const data=rows.filter(row=>row.noiseSigma===noiseSigma);
    const policy=key=>{
      const accepted=data.filter(r=>r[key].plan.status==='proposed');
      const finite=accepted.filter(r=>r[key].refit?.received.status==='finite');
      return {proposed:accepted.length,finite:finite.length,refused:data.length-accepted.length,
        numericalFailures:accepted.length-finite.length,
        conditionalFiniteMedianRMSE:median(finite.map(r=>r[key].refit.received.positionRMSE))};
    };
    const both=data.filter(row=>row.legacy.refit?.received.status==='finite'&&
      row.gaussian.refit?.received.status==='finite');
    const deltas=both.map(row=>row.gaussian.refit.received.positionRMSE-row.legacy.refit.received.positionRMSE);
    return {noiseSigma,caseCount:data.length,legacy:policy('legacy'),gaussian:policy('gaussian'),
      pairedFiniteCount:both.length,pairedNoiseMinusRmsMedian:median(deltas),
      pairedNoiseWinCount:deltas.filter(d=>d<0).length};
  });
}

/** Returns evidence-preserving results, not a selector tuned on held-out errors. */
export function compareGaussianInterventions(){
  const rows=[];
  for(const noiseSigma of GAUSSIAN_NOISE_LEVELS) for(const seed of GAUSSIAN_FROZEN_SEED_BASES){
    const a=acquireVirtualPendulum({initialPosition:.06,initialRate:0,duration:6.4,sampleInterval:.04,seed,noiseSigma},{existingRuns:[]});
    const b=acquireVirtualPendulum({initialPosition:-.045,initialRate:.025,duration:6.4,sampleInterval:.04,seed:seed+1,noiseSigma},{existingRuns:[a]});
    const training=[a,b],discovery=discoverIntegral(training,FIT);
    const legacy=planTrajectoryExperiment(discovery,DESIGN);
    const gaussian=planTrajectoryExperiment(discovery,{...DESIGN,noiseSigma,noiseTargetZ:3.29,noiseMaxReadings:8});
    // The held-out challenge does not exist when either strategy is planned.
    const challenge=acquireVirtualPendulum({initialPosition:1.9,initialRate:0,duration:8,sampleInterval:.04,
      seed:seed+2,noiseSigma},{existingRuns:training});
    rows.push({noiseSigma,seed,originalModel:discovery.selected.id,
      before:finiteResult(discovery.selected,challenge),
      legacy:{plan:compactPlan(legacy),refit:refit(training,challenge,legacy,seed+3,noiseSigma)},
      gaussian:{plan:compactPlan(gaussian),refit:refit(training,challenge,gaussian,seed+3,noiseSigma)}});
  }
  return {schema:GAUSSIAN_RECEIPT_SCHEMA,
    universe:'one controlled synthetic fixed pendulum; 4 noise amplitudes × 4 seed bases; no independent physical environments',
    planningInput:'two small-angle training recordings, same original shortlist and bounded release grid; challenge created afterward',
    observationBasis:'both policies refit on independently synthesized full scheduled recordings at their declared true noise amplitude; no sparse sensor savings',
    policies:{legacy:'whole-trajectory RMS spread, uncalibrated threshold',
      gaussian:'declared iid Gaussian position sigma, pairwise z>=3.29, max eight distinct prospective read timestamps, maximin greedy'},
    frozenSeedBases:[...GAUSSIAN_FROZEN_SEED_BASES],
    noiseLevels:[...GAUSSIAN_NOISE_LEVELS],
    grouped:groups(rows),rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(compareGaussianInterventions(),null,2));
}
