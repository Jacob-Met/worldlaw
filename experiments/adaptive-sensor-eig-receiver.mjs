/** Frozen receiving comparison of a genuinely observation-adaptive two-reading
 * Gaussian policy against ALL six fixed two-reading schedules.
 *
 * The generator has hidden synthetic truth and a common independently sampled
 * OU noise process on the entire possible clock. Each policy is shown only the
 * positions at its chosen sensor timestamps; potential observations elsewhere
 * remain inside this evaluator. Nothing here proves physical mechanism truth.
 *
 * This course is declared in source before the first receiving run. Any
 * subsequent changed parameters constitute another, explicitly development,
 * experiment. Report all fixed schedules, never choose a winner on final truth.
 */
import {pathToFileURL} from 'node:url';
import {planAdaptiveGaussianReading} from '../src/trajectory/adaptive-gaussian-sensor.mjs';
import {designCorrelatedReadings} from '../src/trajectory/correlated-gaussian-discriminator.mjs';

export const RECEIVING_SCHEMA='worldlaw.adaptive-eig-frozen-receiver/v1';
export const FROZEN_SEEDS=[0x1a62e3d1,0x3b65f271,0x9c02a13d,0xe427b50f];
export const FROZEN_COHORTS=[
  {sigma:.28,tau:0},{sigma:.55,tau:0},
  {sigma:.45,tau:.35},{sigma:.75,tau:1.1}
];
export const FROZEN_REPETITIONS=48; // each of six offered laws receives 48 trials
const TIMES=[0,1,2,3,4];
const PAIRS=[[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];

function nextUniform(seed){
  let state=seed>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)+.5)/4294967296;
}
function standardGaussian(rand){
  return Math.sqrt(-2*Math.log(rand()))*Math.cos(2*Math.PI*rand());
}
function frozenLaws(){
  // Three mutually exclusive families: t1 identifies the family and a
  // family-specific later timestamp identifies the law. No fixed two
  // timestamps identify all six, while an adaptive two-stage policy can.
  const means=[
    [0,-5,4,0,0],[0,-5,-4,0,0],
    [0,0,0,4,0],[0,0,0,-4,0],
    [0,5,0,0,4],[0,5,0,0,-4],
  ];
  return means.map((values,i)=>({modelId:'offered-law-'+i,
    rows:TIMES.map((time,k)=>({time,position:values[k]}))}));
}
function noiseProcess(rand,sigma,tau){
  const errors=TIMES.map(()=>0);
  for(let i=1;i<TIMES.length;i++){
    const fresh=standardGaussian(rand)*sigma;
    if(tau===0||i===1)errors[i]=fresh;
    else{
      const gap=(TIMES[i]-TIMES[i-1])/tau;
      const rho=Math.exp(-gap);
      errors[i]=rho*errors[i-1]+Math.sqrt(-Math.expm1(-2*gap))*fresh;
    }
  }
  return errors;
}
function actualAt(models,label,errors,index){
  return {sampleIndex:index,time:TIMES[index],
    position:models[label].rows[index].position+errors[index]};
}
function fixedPolicy(models,config,observed,indexPair,truth){
  const result=planAdaptiveGaussianReading(models,config,indexPair.map(i=>observed(i)));
  return {correct:Number(result.selectedModelId===models[truth].modelId),
    abstention:Number(result.status!=='conditional_decision_ready'),reads:indexPair.length};
}
function adaptivePolicy(models,config,observed,truth){
  const history=[],actions=[];
  for(let step=0;step<config.maxReadings;step++){
    const current=planAdaptiveGaussianReading(models,config,history);
    if(current.status!=='next_reading_proposed')break;
    const index=current.proposed.sampleIndex;
    if(actions.length&&index<=actions[actions.length-1])throw Error('Adaptive clock violated.');
    actions.push(index);
    history.push(observed(index));
  }
  const result=planAdaptiveGaussianReading(models,config,history);
  return {correct:Number(result.selectedModelId===models[truth].modelId),
    abstention:Number(result.status!=='conditional_decision_ready'),
    reads:history.length,actions};
}
const accumulator=()=>({total:0,correct:0,abstentions:0,readings:0});
function add(s,x){s.total++;s.correct+=x.correct;s.abstentions+=x.abstention;s.readings+=x.reads;}
function finish(s){
  return {...s,accuracy:s.total?s.correct/s.total:null,
    abstentionRate:s.total?s.abstentions/s.total:null,
    meanReadingCount:s.total?s.readings/s.total:null};
}
function maintainedChoice(models,config){
  const planner=designCorrelatedReadings(models,{
    sigma:config.sigma,targetZ:3.29,maxReadings:2,
    correlationTime:config.correlationTime,
  });
  const picked=planner.readings.map(x=>x.sampleIndex);
  return {indices:picked,status:planner.status,
    note:'Unmodified maintained correlated maximin plan; insufficient/uncertain certificates remain insufficient/uncertain.'};
}
export function runFrozenAdaptiveReceiver(){
  const models=frozenLaws(),cohorts=[],allAdaptive=accumulator();
  const overallFixed=Object.fromEntries(PAIRS.map(p=>[p.join(','),accumulator()]));
  for(let cohort=0;cohort<FROZEN_COHORTS.length;cohort++){
    const {sigma,tau}=FROZEN_COHORTS[cohort],
      config={sigma,correlationTime:tau,maxReadings:2,decisionThreshold:.98};
    const rand=nextUniform(FROZEN_SEEDS[cohort]);
    const adaptive=accumulator();
    const fixed=Object.fromEntries(PAIRS.map(p=>[p.join(','),accumulator()]));
    const choice=maintainedChoice(models,config),maintained=accumulator();
    const actions={};
    let sameNoisePairings=0;
    for(let repeat=0;repeat<FROZEN_REPETITIONS;repeat++)for(let truth=0;truth<models.length;truth++){
      const errors=noiseProcess(rand,sigma,tau),observed=i=>actualAt(models,truth,errors,i);
      const a=adaptivePolicy(models,config,observed,truth);
      add(adaptive,a);add(allAdaptive,a);
      const route=a.actions.join(',');actions[route]=(actions[route]??0)+1;
      for(const pair of PAIRS){
        const outcome=fixedPolicy(models,config,observed,pair,truth);
        add(fixed[pair.join(',')],outcome);
        add(overallFixed[pair.join(',')],outcome);
      }
      if(choice.indices.length===2)add(maintained,
        fixedPolicy(models,config,observed,choice.indices,truth));
      sameNoisePairings++;
    }
    cohorts.push({cohort,noise:{sigma,tau},balancedTruths:models.length,
      repeatedPerTruth:FROZEN_REPETITIONS,pairedNoiseRealizations:sameNoisePairings,
      adaptive:finish(adaptive),fixed:Object.fromEntries(Object.entries(fixed).map(([k,v])=>[k,finish(v)])),
      maintainedCorrelated:{plan:choice,outcome:finish(maintained)},adaptiveActions:actions});
  }
  const allFixed=Object.fromEntries(Object.entries(overallFixed).map(([k,v])=>[k,finish(v)]));
  const bestPosthocFixed=Math.max(...Object.values(allFixed).map(x=>x.accuracy));
  const adaptiveResult=finish(allAdaptive);
  const report={schema:RECEIVING_SCHEMA,
    source:'independent frozen synthetic Gaussian observation evaluator; no physical measurement or unknown-law transfer',
    sampleClock:TIMES,lawCount:models.length,
    frozenSeeds:FROZEN_SEEDS,frozenCohorts:FROZEN_COHORTS,
    repetitionsPerLawPerCohort:FROZEN_REPETITIONS,
    selectionRule:'prospective one-dimensional Gaussian mixture information from frozen finite laws, recalculated only after sensor observation',
    comparison:'every fixed two-reading schedule using identical hidden truth/noise potential outcomes; maintained maximin schedule included separately',
    evaluationTarget:'classify an offered true law using at most two real revealed synthetic sensor values',
    adaptiveOverall:adaptiveResult,allSixFixedSchedules:allFixed,
    posthocBestFixedAccuracyDiagnosticOnly:bestPosthocFixed,
    adaptiveBeatsAllFixedOnTheseParticularSyntheticCohorts:
      adaptiveResult.accuracy>bestPosthocFixed,
    cohorts,
    limits:['Finite offered six-law structural fixture; not independently discovered real equations.',
      'Heldout is seeded and source-frozen but from the same known authored mechanism family.',
      'No claim of globally optimal adaptive policy, external calibration or hardware safety.',
      'Generator materializes unobserved potential noise values only within the evaluator, not inside the adaptive policy.',
      'Selecting the empirically best fixed schedule after seeing final labels is invalid as prospective policy; posthoc number is a descriptive upper comparator.']};
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(runFrozenAdaptiveReceiver(),null,2));
