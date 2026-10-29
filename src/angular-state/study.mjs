/** Explicit angular-state observations; no torque measurement or inertia is invented. */
import {normalizeAngularRuns,normalizeAngularBundle,ANGULAR_MODEL_UNITS,ANGULAR_COEFFICIENT_UNITS,DEFAULT_ANGULAR_TERMS} from '../trajectory/angular-discovery.mjs';
import {discoverAngularWeak} from '../trajectory/angular-weak.mjs';
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
import {predict} from '../science/torque-discovery.mjs';
import {rolloutAngularWithResolution} from '../trajectory/angular-resolution.mjs';
import {reservePredictionWork} from '../predictive-selection/select.mjs';
const clone=x=>JSON.parse(JSON.stringify(x)),insist=(ok,message)=>{if(!ok)throw Error(message);};
const text=(s,label)=>{insist(typeof s==='string'&&s.trim()&&s.length<=500,label+' needs bounded text.');return s;};
const finite=(x,label,bound=1e6)=>{insist(typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=bound,label+' must be finite and bounded.');return x;};
const runOf=r=>({id:r.id,label:r.label,kind:r.kind,dynamics:'unforced_scalar_rotation',inertia:null,initialRate:r.samples[0].rate,source:r.source,samples:r.samples.map(({time,position})=>({time,position}))});
export function normalizeAngularStateStudy(raw){
 insist(raw?.schema==='worldlaw.angular-state-study/v1','Use a worldlaw.angular-state-study/v1 source document.');
 const units={time:'s',position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'};
 insist(raw.units&&Object.keys(raw.units).length===4&&Object.entries(units).every(([k,v])=>raw.units[k]===v),'Declare s, rad, rad/s and rad/s² state units.');
 insist(Array.isArray(raw.trainingRecords)&&raw.trainingRecords.length>=1&&raw.trainingRecords.length<=4,'Supply 1–4 original training records.');
 const trainingRecords=raw.trainingRecords.map(record=>{
  insist(record&&typeof record==='object'&&!Array.isArray(record),'Training records must be objects.');
  insist(['sensor','derived','analytic','unknown'].includes(record.accelerationOrigin),'Declare sensor, derived, analytic or unknown acceleration origin.');
  const channels=record.channels;insist(channels&&typeof channels==='object','Declare each source channel.');
  const channelCopy=Object.fromEntries(['position','rate','angularAcceleration'].map(k=>[k,text(channels[k],k+' source channel')]));
  insist(Array.isArray(record.samples)&&record.samples.length>=17&&record.samples.length<=4096,'Each state record needs 17–4096 original rows.');
  const samples=record.samples.map(row=>{
   insist(row&&typeof row==='object'&&Object.keys(row).length===4&&['time','position','rate','angularAcceleration'].every(k=>Object.hasOwn(row,k)),'Each state row must contain exactly time, position, rate and angularAcceleration.');
   return {time:finite(row.time,'Time',1e12),position:finite(row.position,'Position'),rate:finite(row.rate,'Rate'),angularAcceleration:finite(row.angularAcceleration,'Angular acceleration')};
  });
  const normalized=normalizeAngularRuns([runOf({...record,samples})])[0];
  insist(typeof normalized.source.recordingId==='string'&&normalized.source.recordingId.trim(),'Declare the original recording identity.');
  return {...normalized,samples,channels:channelCopy,accelerationOrigin:record.accelerationOrigin};
 });
 insist(trainingRecords.reduce((n,r)=>n+r.samples.length,0)<=4096,'At most 4096 complete training state rows are supported.');
 const trainingRuns=normalizeAngularRuns(trainingRecords.map(runOf));
 insist(new Set(trainingRecords.map(r=>r.source.recordingId)).size===trainingRecords.length,'Do not relabel one acquisition as multiple original training records.');
 insist(Array.isArray(raw.challengeRuns)&&raw.challengeRuns.length<=4,'Declare zero to four separate challenge recordings.');
 const challengeRuns=raw.challengeRuns.length?normalizeAngularBundle({schema:'worldlaw.angular-bundle/v1',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns,challengeRuns:raw.challengeRuns}).challengeRuns:[];
 return {schema:raw.schema,label:text(raw.label,'Study label'),units:{time:'s',position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},trainingRecords,challengeRuns};
}
function discoverAngularStates(records,input={}){
 const terms=input.terms??DEFAULT_ANGULAR_TERMS,noiseSigma=input.noiseSigma??.3,maxTerms=input.maxTerms??Math.min(4,terms.length);
 insist(Array.isArray(terms)&&terms.length>=1&&terms.length<=8&&new Set(terms).size===terms.length&&terms.every(id=>Object.hasOwn(ANGULAR_COEFFICIENT_UNITS,id)),'Offer unique supported angular terms.');
 insist(Number.isInteger(maxTerms)&&maxTerms>=0&&maxTerms<=terms.length,'Invalid maximum term count.');finite(noiseSigma,'Acceleration noise');insist(noiseSigma>=1e-12,'Acceleration noise must be positive.');
 const readings=records.flatMap(r=>r.samples),target=readings.map(r=>r.angularAcceleration);
 // Shared feature evaluation only. The private unit-basis proxy is not an observed torque or an exported physical model.
 const columns=terms.map(id=>readings.map(row=>predict({schema:'worldlaw.torque-model/v1',terms:[{id,coefficient:1}]},{command:0,position:row.position,rate:row.rate})));
 const candidates=[],refused=[];
 for(let mask=0;mask<2**terms.length;mask++){
  const indices=terms.map((_,i)=>i).filter(i=>mask&(1<<i));if(indices.length>maxTerms)continue;
  const id=indices.map(i=>terms[i]).join('+')||'zero',fit=fitLinearColumns(indices.map(i=>columns[i]),target);
  if(!fit){refused.push({id,reason:'rank_deficient_or_nonfinite'});continue;}
  if(fit.coefficients.some(x=>Math.abs(x)>1e18)){refused.push({id,reason:'coefficient_range'});continue;}
  const residuals=target.map((y,j)=>y-indices.reduce((sum,i,k)=>sum+fit.coefficients[k]*columns[i][j],0)),rmse=Math.hypot(...residuals)/Math.sqrt(target.length),score=target.length*Math.log(Math.max(rmse**2,noiseSigma**2))+indices.length*Math.log(target.length);
  if(!Number.isFinite(score)){refused.push({id,reason:'nonfinite_score'});continue;}
  const fittedTerms=indices.map((i,k)=>({id:terms[i],coefficient:fit.coefficients[k],coefficientUnit:ANGULAR_COEFFICIENT_UNITS[terms[i]]}));
  candidates.push({schema:'worldlaw.angular-model/v1',id,terms:fittedTerms,units:{...ANGULAR_MODEL_UNITS},equation:'α = '+(fittedTerms.map(t=>`${Number(t.coefficient.toPrecision(6))}·${t.id}`).join(' + ')||'0'),physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',method:'explicit_angular_state_linear_regression',domain:Object.fromEntries(['position','rate'].map(k=>[k,{min:Math.min(...readings.map(r=>r[k])),max:Math.max(...readings.map(r=>r[k]))}])),metrics:{count:target.length,rmse,maxAbsResidual:Math.max(...residuals.map(Math.abs)),score,residualUnits:'rad/s²',conditionEstimate:fit.conditionEstimate,rank:indices.length}});
 }
 insist(candidates.length,'No finite executable angular-state candidate.');candidates.sort((a,b)=>a.metrics.score-b.metrics.score||a.terms.length-b.terms.length);
 return {selected:candidates[0],candidates,refused,options:{terms:[...terms],maxTerms,noiseSigma},libraryRank:linearColumnRank(columns),meaning:'Finite-library fit to explicitly supplied angular acceleration. Source coordinates/rates can be noisy and correlated; the score is heuristic, not calibrated evidence.'};
}
export function createAngularStateStudy(raw,options={}){
 const source=normalizeAngularStateStudy(raw),trainingRuns=source.trainingRecords.map(runOf),direct=discoverAngularStates(source.trainingRecords,options.direct);
 const settings={maxStep:.01,maxNumericalDifference:.001,maxTotalSteps:1000000,weak:{terms:direct.options.terms,maxTerms:direct.options.maxTerms,noiseSigma:.003,windowDuration:.3,windowStride:.1},...clone(options)};
 finite(settings.maxStep,'Solver step',.1);insist(settings.maxStep>=1e-5,'Solver step too small.');finite(settings.maxNumericalDifference,'Numerical screen',1);insist(settings.maxNumericalDifference>=0,'Numerical screen must be nonnegative.');insist(Number.isSafeInteger(settings.maxTotalSteps)&&settings.maxTotalSteps>=1&&settings.maxTotalSteps<=1000000,'Reserve 1–1000000 rollout integration steps.');
 let weak;try{weak={status:'fitted',discovery:discoverAngularWeak(trainingRuns,settings.weak)};}catch(error){weak={status:'refused',error:error.message};}
 const models=[{role:'state-observation',model:direct.selected},...(weak.status==='fitted'?[{role:'position-only-weak',model:weak.discovery.selected}]:[])];
 const runs=[...trainingRuns.map(run=>({run,role:'training-reconstruction'})),...source.challengeRuns.map(run=>({run,role:'separate-challenge'}))];
 const reservation=reservePredictionWork(runs.map(x=>x.run),settings.maxStep,models.length),results=[];
 for(const model of models)for(const item of runs){
  const common={modelRole:model.role,modelId:model.model.id,runId:item.run.id,evidenceRole:item.role};
  if(reservation.steps>settings.maxTotalSteps||reservation.rows>65536){results.push({...common,status:'refused',error:'Complete forecast reservation exceeds declared work; no partial course was run.'});continue;}
  try{const receipt=rolloutAngularWithResolution(model.model,item.run,{maxStep:settings.maxStep,maxSteps:reservePredictionWork([item.run],settings.maxStep).steps});results.push({...common,status:receipt.resolution.status==='compared'&&receipt.resolution.positionRMSEDifference<=settings.maxNumericalDifference?'screened':'numerically-unresolved',...receipt});}catch(error){results.push({...common,status:'failed',error:error.message});}
 }
 return {schema:'worldlaw.angular-state-result/v1',source,options:{...settings,direct:direct.options},direct,weak,reservation,results,limitations:'Training reconstructions are in-sample. Multiple sensor channels of one course are not independent acquisitions. No clock alignment, channel calibration, physical inertia, absolute torque or sensor accuracy is inferred. Source channel labels are caller declarations. Extra measured state channels supply additional information, not proof that their fitted law is better.'};
}
export const saveAngularStateStudy=state=>JSON.stringify({schema:'worldlaw.angular-state-notebook/v1',source:state.source,options:state.options});
export function reopenAngularStateStudy(text){insist(typeof text==='string'&&text.length<=3000000,'Use a source notebook below 3 MB.');const raw=JSON.parse(text);insist(raw.schema==='worldlaw.angular-state-notebook/v1','Unsupported state notebook.');return createAngularStateStudy(raw.source,raw.options);}
