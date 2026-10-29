import{normalizeAngularRuns,normalizeAngularForecastRun}from'../trajectory/angular-discovery.mjs';
import{reservePredictionWork}from'../predictive-selection/select.mjs';
import{receiveJointState}from'../joint-state/receiver.mjs';
import{fitPrefixInitialState}from'./fit.mjs';
const copy=x=>JSON.parse(JSON.stringify(x)),need=(ok,m)=>{if(!ok)throw Error(m);};
/** Finite executable disagreements, never a confidence interval or continuum bound. */
export function receivePrefixStartWitnesses(model,rawPrefix,prospect,options){
 const prefix=normalizeAngularRuns([rawPrefix])[0],o=copy(options);
 need(prospect&&Object.keys(prospect).join(',')==='times'&&Array.isArray(prospect.times),'Prospect accepts only times, never future observations');
 need(prospect.times[0]===prefix.samples[0].time&&prospect.times.at(-1)>prefix.samples.at(-1).time,'Forecast starts at original initialization and extends beyond prefix');
 need(Number.isFinite(o.maxPrefixRMSE)&&o.maxPrefixRMSE>=0&&o.maxPrefixRMSE<=1,'Explicit conditional prefix residual limit0–1rad required; not calibrated uncertainty');
 need(Number.isInteger(o.gridCount)&&o.gridCount>=3&&o.gridCount<=17&&o.gridCount%2===1&&Number.isInteger(o.sweeps)&&o.sweeps>=0&&o.sweeps<=16,'Bound complete offered search');
 const future=normalizeAngularForecastRun({id:'prefix-start-prospect',kind:'unknown',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:prefix.initialRate,source:{label:'Declared forecast schedule; no future readings'},samples:prospect.times.map(time=>({time,position:prefix.samples[0].position}))});
 const maximumEvaluations=1+o.gridCount**2+4*o.sweeps,reservation=reservePredictionWork([prefix,future],o.maxStep,maximumEvaluations);
 need(Number.isSafeInteger(o.maxTotalSteps)&&o.maxTotalSteps>0&&o.maxTotalSteps<=4000000&&reservation.steps<=o.maxTotalSteps&&reservation.rows<=262144,'Complete prefix-search and all offered forecasts exceed budget');
 const fit=fitPrefixInitialState(model,rawPrefix,o),trials=[];
 for(const[originalIndex,t]of fit.trials.entries()){
  if(t.status!=='screened'||t.rmse>o.maxPrefixRMSE){trials.push({originalIndex,offsets:t.offsets,prefixRMSE:t.rmse,status:t.status==='screened'?'outside_declared_prefix_limit':t.status});continue;}
  const input=copy(future);input.samples[0].position+=t.offsets[0];input.initialRate+=t.offsets[1];
  try{const r=receiveJointState(model,input,{maxStep:o.maxStep,maxSteps:reservePredictionWork([future],o.maxStep).steps});need(r.rollout.rows.length===future.samples.length,'Complete forecast required');const screened=r.resolution.status==='compared'&&r.resolution.maxAbsPositionDifference<=o.screen&&r.resolution.maxAbsRateDifference<=o.screen;trials.push({originalIndex,offsets:t.offsets,prefixRMSE:t.rmse,status:screened?'admitted':'forecast_unresolved',resolution:r.resolution,predictions:screened?r.rollout.rows.map(({time,predicted,rate})=>({time,position:predicted,rate})):null});}catch(e){trials.push({originalIndex,offsets:t.offsets,prefixRMSE:t.rmse,status:'forecast_failed',error:e.message});}
 }
 const admitted=trials.filter(t=>t.status==='admitted');let disagreement=null;
 if(admitted.length>=2)for(let i=0;i<future.samples.length;i++){if(future.samples[i].time<=prefix.samples.at(-1).time)continue;let low=admitted[0],high=low;for(const t of admitted){if(t.predictions[i].position<low.predictions[i].position)low=t;if(t.predictions[i].position>high.predictions[i].position)high=t;}const difference=high.predictions[i].position-low.predictions[i].position;if(!disagreement||difference>disagreement.positionDifference)disagreement={time:future.samples[i].time,positionDifference:difference,lowTrial:low.originalIndex,highTrial:high.originalIndex};}
 return{fit,prospect:copy(prospect),options:o,reservation,maximumEvaluations,trials,disagreement,status:disagreement?.positionDifference>0?'distinct_admitted_start_witnesses':admitted.length?'no_distinct_witness_found':'no_admitted_witness',meaning:'Finite conditional initialization witnesses for a frozen law and an explicit prefix residual limit. Future observations are not inputs. Disagreement is executable, not a bound on all possible predictions; no disagreement does not establish identification. Residual limit is not calibrated measurement uncertainty.'};
}
