/** Prediction-oriented structure selection using training recordings only. */
import {normalizeAngularRuns,normalizeAngularBundle,ANGULAR_COEFFICIENT_UNITS} from '../trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../trajectory/angular-weak.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const insist=(ok,message)=>{if(!ok)throw new Error(message);};
const DEFAULT_TERMS=['rate','coulomb','spring','gravity','quadratic','bias'];
function settings(input={}){
 const o={terms:DEFAULT_TERMS,maxTerms:4,noiseSigma:.01,ambiguityDelta:6,windowDuration:1,windowStride:.5,rateWindowSize:9,maxStep:.01,maxTotalSteps:2000000,maxPredictionRows:262144,maxNumericalDifference:.001,...input};
 insist(Array.isArray(o.terms)&&o.terms.length>=1&&o.terms.length<=8&&new Set(o.terms).size===o.terms.length&&o.terms.every(t=>Object.hasOwn(ANGULAR_COEFFICIENT_UNITS,t)),'Offer unique supported autonomous terms.');
 insist(Number.isInteger(o.maxTerms)&&o.maxTerms>=0&&o.maxTerms<=o.terms.length,'Invalid maximum structure size.');
 insist(Number.isFinite(o.maxStep)&&o.maxStep>=1e-5&&o.maxStep<=.1,'maxStep must be 0.00001–0.1 seconds.');
 insist(Number.isSafeInteger(o.maxTotalSteps)&&o.maxTotalSteps>=1&&o.maxTotalSteps<=2000000,'Reserve 1–2000000 total integration steps.');
 insist(Number.isSafeInteger(o.maxPredictionRows)&&o.maxPredictionRows>=1&&o.maxPredictionRows<=262144,'Reserve 1–262144 prediction rows.');
 insist(Number.isFinite(o.maxNumericalDifference)&&o.maxNumericalDifference>=0&&o.maxNumericalDifference<=1,'Numerical difference screen must be 0–1 radians.');
 return clone(o);
}
function structures(o){
 const list=[];for(let mask=0;mask<2**o.terms.length;mask++){const terms=o.terms.filter((_,i)=>mask&(1<<i));if(terms.length<=o.maxTerms)list.push({id:terms.join('+')||'zero',terms});}
 insist(list.length<=128,'At most 128 complete offered structures are supported.');return list;
}
export function reservePredictionWork(runs,maxStep,models=1){
 let steps=0,rows=0;
 for(const run of runs){rows+=run.samples.length;for(let i=1;i<run.samples.length;i++){const dt=run.samples[i].time-run.samples[i-1].time;steps+=Math.max(1,Math.ceil(dt/maxStep))+Math.max(1,Math.ceil(dt/(maxStep/2)));}}
 return {steps:steps*models,rows:rows*models};
}
const fitOptions=o=>({terms:o.terms,maxTerms:o.maxTerms,noiseSigma:o.noiseSigma,ambiguityDelta:o.ambiguityDelta,windowDuration:o.windowDuration,windowStride:o.windowStride,rateWindowSize:o.rateWindowSize});
export function selectPredictiveStructure(trainingRuns,input={}){
 const options=settings(input),runs=normalizeAngularRuns(trainingRuns);
 insist(runs.length>=2&&runs.length<=4,'Cross-recording selection requires 2–4 training recordings.');
 const offered=structures(options),reservation=reservePredictionWork(runs,options.maxStep,offered.length);
 insist(reservation.steps<=options.maxTotalSteps,'Complete cross-recording experiment exceeds the integration-step reservation.');
 insist(reservation.rows<=options.maxPredictionRows,'Complete cross-recording experiment exceeds the prediction-row reservation.');
 insist(runs.every(run=>reservePredictionWork([run],options.maxStep).steps<=1000000),'A fold exceeds the maintained solver step limit.');
 // Reuse the maintained cross-role identity/copy screen for each held-out fold.
 // It is a refusal screen, not authentication of independent acquisition.
 const folds=runs.map((held,index)=>{
  const other=runs.filter((_,j)=>j!==index);
  normalizeAngularBundle({schema:'worldlaw.angular-bundle/v1',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:other,challengeRuns:[held]});
  try{return {held,discovery:discoverAngularWeak(other,fitOptions(options)),failure:null};}
  catch(error){return {held,discovery:null,failure:{message:error.message,code:error.code||'fit_failed'}};}
 });
 const pooled=discoverAngularWeak(runs,fitOptions(options));
 const results=offered.map(structure=>{
  const receipts=folds.map(fold=>{
   const model=fold.discovery?.candidates.find(m=>m.id===structure.id);
   if(!model)return {runId:fold.held.id,status:'unavailable',error:fold.failure||{code:'unidentifiable_structure',message:'This offered structure could not be fitted on the other training recordings.'},rollout:null,resolution:null};
   try{
    const budget=reservePredictionWork([fold.held],options.maxStep).steps;
    const receipt=rolloutAngularWithResolution(model,fold.held,{maxStep:options.maxStep,maxSteps:Math.min(1000000,budget)});
    const admitted=receipt.resolution.status==='compared'&&receipt.resolution.positionRMSEDifference<=options.maxNumericalDifference;
    return {runId:fold.held.id,model:clone(model),status:admitted?'complete':'numerically_unresolved',...receipt};
   }catch(error){return {runId:fold.held.id,status:'failed',error:{message:error.message,code:error.code||'prediction_failed'},model:clone(model),rollout:null,resolution:null};}
  });
  const finalModel=pooled.candidates.find(m=>m.id===structure.id)||null;
  const complete=receipts.every(r=>r.status==='complete')&&finalModel!==null;
  const count=runs.reduce((n,r)=>n+r.samples.length-1,0);
  const rmse=complete?Math.hypot(...receipts.map(r=>r.rollout.metrics.positionRMSE*Math.sqrt(r.rollout.metrics.count/count))):null;
  return {...structure,status:complete?'complete':'incomplete',validationRMSE:rmse,finalModel,folds:receipts};
 });
 const ranked=results.filter(r=>r.status==='complete').sort((a,b)=>a.validationRMSE-b.validationRMSE||a.terms.length-b.terms.length||a.id.localeCompare(b.id));
 return {schema:'worldlaw.predictive-selection/v1',options,trainingRuns:clone(runs),reservation,offeredStructureCount:offered.length,
  originalSelectedModel:clone(pooled.selected),originalRanking:pooled.candidates.map(m=>m.id),selectedModel:ranked[0]?.finalModel??null,selectedId:ranked[0]?.id??null,
  status:ranked.length?'selected':'no_complete_candidate',ranking:ranked.map(r=>r.id),results,
  meaning:'Each offered structure is fitted on other training recordings, then freely predicts the omitted training recording. Complete numerically screened fold errors select structure; final coefficients use all training recordings.',
  limitations:['Finite offered library and deterministic predictive criterion, not arbitrary mechanism discovery.','Repeatedly selecting against these training validation folds is model development, not an unbiased final generalization estimate.','Cross-recording identity is caller-declared; copy screening cannot authenticate independence.','Two-step agreement is not convergence; the numerical screen is caller-selected.','Changing initial conditions, forcing, calibration, or apparatus can defeat a common model.','A separate untouched recording is still needed to assess the frozen selected model.']};
}
