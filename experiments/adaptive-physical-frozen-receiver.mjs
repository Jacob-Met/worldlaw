/** Held-out physical-source receiving study: posterior EIG vs preselected static schedule.
 *
 * This evaluator precomputes all *potential* source observations for paired
 * counterfactual comparisons, but sends a policy only the values at indices it
 * explicitly requests. The separate streaming instrument proves that real
 * on-demand acquisition produces source-equivalent measurements. No policy
 * receives the hidden source oracle, other times, or the held-out labels.
 *
 * No external scientific inference: one known synthetic physical pendulum,
 * one fixed offered law family, caller-declared Gaussian sensor. The exact
 * original law is INCLUDED, and missing-law experiments must be reported
 * separately. Fixed schedule selection uses entirely different sensor seeds.
 */
import {pathToFileURL} from 'node:url';
import {planTrajectoryExperiment} from '../src/trajectory/planner.mjs';
import {qualifyTrajectoryPlan} from '../src/experiment-design/qualify-trajectory-plan.mjs';
import {acquireVirtualPendulum} from '../src/trajectory/virtual-experiment.mjs';
import {planAdaptiveGaussianReading} from '../src/trajectory/adaptive-gaussian-sensor.mjs';
import {UNITS} from '../src/science/torque-discovery.mjs';

export const RECEIVER_SCHEMA='worldlaw.adaptive-physical-source-heldout/v1';
export const FROZEN_RELEASE={
  initialPosition:1.8,initialRate:0,duration:8,sampleInterval:.04
};
export const FROZEN_SENSOR_COHORTS=[
  {sigma:.025,correlationTime:0},
  {sigma:.05,correlationTime:0},
  {sigma:.04,correlationTime:.5},
  {sigma:.05,correlationTime:1.2}
];
export const FROZEN_SELECTION_SEEDS=[11000,11063];
export const FROZEN_HELDOUT_SEEDS=[51000,51255];
const SOURCE_POSITIONS=[0,25,50,75,100,125,150,175,200];
const PAIRS=[];
for(let i=1;i<SOURCE_POSITIONS.length;i++)
  for(let j=i+1;j<SOURCE_POSITIONS.length;j++)PAIRS.push([i,j]);
const makeLaw=(id,rate,gravity)=>({
  schema:'worldlaw.torque-model/v1',id,units:{...UNITS},
  terms:[{id:'rate',coefficient:rate},{id:'gravity',coefficient:gravity}]
});
export function frozenDiscovery(){
  const candidates=[
    makeLaw('physical-reference',-.24,-2.2),
    makeLaw('weak-damping',-.18,-2.2),
    makeLaw('strong-damping',-.30,-2.2),
    makeLaw('weak-gravity',-.24,-2.1),
    makeLaw('strong-gravity',-.24,-2.3)
  ];
  return {
    schema:'worldlaw.discovery/v1',units:{...UNITS},
    candidates,competitive:candidates,
    trainingRuns:[{id:'frozen-model-family-derived-before-heldout-51000'}]
  };
}
function frozenPlan(){
  const plan=planTrajectoryExperiment(frozenDiscovery(),{
    inertia:.8,
    bounds:{
      initialPosition:{min:FROZEN_RELEASE.initialPosition,max:FROZEN_RELEASE.initialPosition},
      initialRate:{min:0,max:0}
    },
    positionCount:1,rateCount:1,duration:8,sampleInterval:.04,
    maxStep:.002,maxTotalSteps:200000
  });
  if(plan.status!=='proposed')
    throw Error('Frozen physical release is not prospectively informative: '+plan.status);
  const qualification=qualifyTrajectoryPlan(frozenDiscovery(),plan);
  if(qualification.status!=='screen_passed')
    throw Error('Frozen physical release failed the independent two-resolution screen: '+qualification.status);
  const models=plan.selected.predictions.map(m=>({
    modelId:m.modelId,
    rows:SOURCE_POSITIONS.map(index=>{
      const original=m.rows[index];
      return {time:original.time,position:original.position};
    })
  }));
  return {plan,qualification,models};
}
function generatedSource(seed,cohort){
  return acquireVirtualPendulum({
    ...FROZEN_RELEASE,seed,noiseSigma:cohort.sigma,
    ...(cohort.correlationTime>0?{
      noiseCorrelationTime:cohort.correlationTime}: {})
  },{existingRuns:[]});
}
function oneTrial(models,cohort,source){
  const config={sigma:cohort.sigma,
    correlationTime:cohort.correlationTime,
    maxReadings:2,decisionThreshold:.98,
    modelMismatchAlpha:.001
  };
  const actual=sampleIndex=>{
    if(!Number.isSafeInteger(sampleIndex)||sampleIndex<1||sampleIndex>=SOURCE_POSITIONS.length)
      throw Error('Policy requested an unscheduled physical time.');
    const record=source.samples[SOURCE_POSITIONS[sampleIndex]];
    if(record.time!==models[0].rows[sampleIndex].time)
      throw Error('Physical-source clock drift.');
    // Leak only one requested sensor record, not a full run, truth, model
    // identity, rate, or the independent physical source's oracle provenance.
    return {sampleIndex,time:record.time,position:record.position};
  };
  function evaluate(readings){
    const result=planAdaptiveGaussianReading(models,config,readings);
    const truth=result.models.find(m=>m.modelId==='physical-reference');
    return {
      correct:Number(result.selectedModelId==='physical-reference'),
      conditionalDecision:Number(result.status==='conditional_decision_ready'),
      correctDecision:Number(result.status==='conditional_decision_ready'&&
        result.selectedModelId==='physical-reference'),
      modelMismatch:Number(result.status==='all_offered_models_mismatch'),
      negLogTrueMass:-Math.log(Math.max(Number.MIN_VALUE,truth.conditionalWeight)),
      measuredCount:readings.length,
      maximumConditionalWeight:result.maximumConditionalWeight
    };
  }
  const staticResults={};
  for(const pair of PAIRS)
    staticResults[pair.join(',')]=evaluate(pair.map(actual));
  const history=[],actions=[];
  for(let iteration=0;iteration<2;iteration++){
    const decision=planAdaptiveGaussianReading(models,config,history);
    if(decision.status!=='next_reading_proposed')break;
    const index=decision.proposed.sampleIndex;
    if(actions.length&&index<=actions.at(-1))
      throw Error('Adaptive policy requested a timestamp before its acquired prefix.');
    history.push(actual(index));
    actions.push(index);
  }
  return {staticResults,adaptive:{...evaluate(history),actions},
    heldoutFutureReadingsAccessedByPolicy:history.length,
    allPotentialSourceReadingsHeldByEvaluator:true};
}
const accumulator=()=>({
  n:0,correct:0,conditionalDecisions:0,correctDecisions:0,
  mismatches:0,reads:0,negativeLogTrueMass:0
});
function add(stats,trial){
  stats.n++;
  stats.correct+=trial.correct;
  stats.conditionalDecisions+=trial.conditionalDecision;
  stats.correctDecisions+=trial.correctDecision;
  stats.mismatches+=trial.modelMismatch;
  stats.reads+=trial.measuredCount;
  stats.negativeLogTrueMass+=trial.negLogTrueMass;
}
function complete(s){
  return {...s,
    correctnessRate:s.n?s.correct/s.n:null,
    conditionalDecisionRate:s.n?s.conditionalDecisions/s.n:null,
    correctDecisionRate:s.n?s.correctDecisions/s.n:null,
    mismatchRate:s.n?s.mismatches/s.n:null,
    meanReadings:s.n?s.reads/s.n:null,
    meanNegLogTrueMass:s.n?s.negativeLogTrueMass/s.n:null
  };
}
function receiveCohort(models,cohort,selection,final){
  const stat=()=>Object.fromEntries(PAIRS.map(p=>[p.join(','),accumulator()]));
  const selectionStatic=stat();
  for(let seed=selection[0];seed<=selection[1];seed++){
    const trial=oneTrial(models,cohort,generatedSource(seed,cohort));
    for(const [k,v]of Object.entries(trial.staticResults))add(selectionStatic[k],v);
  }
  const selected=Object.keys(selectionStatic).sort((a,b)=>
    selectionStatic[a].negativeLogTrueMass/selectionStatic[a].n-
    selectionStatic[b].negativeLogTrueMass/selectionStatic[b].n||
    a.localeCompare(b,(undefined),{numeric:true}))[0];
  const staticResults=stat(),adaptive=accumulator();
  const actions={};
  for(let seed=final[0];seed<=final[1];seed++){
    const trial=oneTrial(models,cohort,generatedSource(seed,cohort));
    add(adaptive,trial.adaptive);
    const action=trial.adaptive.actions.join(',');
    actions[action]=(actions[action]??0)+1;
    for(const [k,v]of Object.entries(trial.staticResults))add(staticResults[k],v);
  }
  const fixed=complete(staticResults[selected]);
  const all=Object.fromEntries(Object.entries(staticResults).map(([k,s])=>[k,complete(s)]));
  const winnerOnFinal=Object.entries(all).sort((a,b)=>
    b[1].correctDecisionRate-a[1].correctDecisionRate||a[0].localeCompare(b[0]))[0];
  return {
    sensor:cohort,
    selectionSeedRange:selection,
    heldoutSeedRange:final,
    selectionCriterion:'lowest mean negative log mass on independent selection sensor seeds, frozen before heldout',
    selectedFixedSchedule:selected.split(',').map(Number),
    selectedFixedSchedule: selected,
    selectedFixed:fixed,
    adaptive:complete(adaptive),
    allFixed:all,
    posthocBestFixedOnlyDiagnostic:{schedule:winnerOnFinal[0],result:winnerOnFinal[1]},
    adaptiveActions:actions,
    qualification:'All heldout trials use the same independently integrated physical virtual source and exactly two or fewer prospective readouts; this is synthetic, not a real sensor calibration.',
    gainVsPreselectedFixed:{
      correctDecisionRate:complete(adaptive).correctDecisionRate-fixed.correctDecisionRate,
      meanNegLogTrueMass:fixed.meanNegLogTrueMass-
        complete(adaptive).meanNegLogTrueMass
    }
  };
}
export function evaluateFrozenPhysicalReceiver(){
  const start=process.hrtime.bigint(),{plan,qualification,models}=frozenPlan();
  const cohorts=FROZEN_SENSOR_COHORTS.map(cohort=>
    receiveCohort(models,cohort,FROZEN_SELECTION_SEEDS,FROZEN_HELDOUT_SEEDS));
  return {
    schema:RECEIVER_SCHEMA,
    sourceCommitNote:'Must bind the exact repo commit from the execution receipt before claiming a controlled result.',
    frozenRelease:FROZEN_RELEASE,
    physicalLaw:{rate:-.24,gravity:-2.2,inertia:.8,command:0},
    virtualSource:'src/trajectory/virtual-experiment.mjs',
    candidateModelIds:models.map(m=>m.modelId),
    trainingModelFingerprint:plan.provenance.modelFingerprint,
    trainingSelectionStatus:plan.status,
    frozenIndependentNumericalQualification:qualification.status,
    selectedInstrumentClockSeconds:SOURCE_POSITIONS.map(i=>i*.04),
    prospectiveReadingBudget:2,
    selectionSeeds:FROZEN_SELECTION_SEEDS,
    untouchedFinalSeeds:FROZEN_HELDOUT_SEEDS,
    cohortCount:cohorts.length,cohorts,
    elapsedEvaluationWallSeconds:Number(process.hrtime.bigint()-start)/1e9,
    limitations:[
      'Physical plant is one explicit synthetic pendulum already in the offered finite family; this is not new law discovery.',
      'Evaluation precomputes entire potential sensor trajectory to share the same Gaussian noise across counterfactual static/adaptive policies; only selected measurements reach the planner.',
      'For actual selected-only acquisition, source-equivalent on-demand RK4/sensor behavior has separate legacy comparison tests.',
      'Fixed schedule selected only on disjoint earlier sensor seeds, all 28 possible coarse-grid pairs shown, posthoc best is not offered as prospective policy.',
      'Source and candidate equations share parameterization and smoothness; neither missing-physics transfer nor real equipment is established.',
      'Decision threshold and Gaussian covariance are declared, not physical confidence calibration.'
    ]
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(evaluateFrozenPhysicalReceiver(),null,2));
