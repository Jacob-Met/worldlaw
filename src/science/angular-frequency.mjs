/** Training-only conditional periodic response, with source-coordinate execution. */
import {fitLinearColumns} from './linear-fit.mjs';
import {validateRows, MAX_TEXT_LENGTH} from '../data.mjs';
import {exportSession, restoreSession} from '../session.mjs';
import {executeStudioDynamics} from './studio-dynamics.mjs';
export const FREQUENCY_SCHEMA='worldlaw.angular-frequency-inputs/v1';
export const MAX_FREQUENCY_WORK=160000000;
const allowed=['command','rate','spring','bias'];
const insist=(ok,message)=>{if(!ok)throw Error(message);};
export function frequencySettings(raw={}) {
  insist(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).every(k=>['min','max','points','noiseSigma','ambiguityDelta','nuisance'].includes(k)),'Unknown angular-frequency settings.');
  const s={min:.25,max:4.25,points:129,noiseSigma:.01,ambiguityDelta:6,nuisance:['command','rate','bias'],...raw};
  insist(Number.isFinite(s.min)&&Number.isFinite(s.max)&&s.min>0&&s.min<1&&s.max>1&&s.max<=32&&s.min<s.max,'Frequency range must contain 1 strictly, with 0 < min < max ≤ 32.');
  insist(Number.isInteger(s.points)&&s.points>=9&&s.points<=257,'Use 9–257 complete profile points.');
  insist(Number.isFinite(s.noiseSigma)&&s.noiseSigma>=1e-9&&s.noiseSigma<=1e6,'Noise must be between 1e-9 and 1e6 N·m.');
  insist(Number.isFinite(s.ambiguityDelta)&&s.ambiguityDelta>=0&&s.ambiguityDelta<=100,'Ambiguity score must be in [0,100].');
  insist(Array.isArray(s.nuisance)&&s.nuisance.length<=4&&new Set(s.nuisance).size===s.nuisance.length&&s.nuisance.every(x=>allowed.includes(x)),'Nuisance library must be unique command, rate, spring or bias terms.');
  return {...s,nuisance:[...s.nuisance]};
}
const value=(id,r)=>id==='spring'?r.position:id==='bias'?1:r[id];
function fitAt(rows,frequency,s) {
  const candidates=[],failures=[];
  for(let mask=0;mask<2**s.nuisance.length;mask++){
    const ids=s.nuisance.filter((_,i)=>mask&(1<<i));
    const columns=ids.map(id=>rows.map(r=>value(id,r)));
    if(frequency!==null)columns.push(rows.map(r=>Math.sin(frequency*r.position)),rows.map(r=>Math.cos(frequency*r.position)));
    const fitted=fitLinearColumns(columns,rows.map(r=>r.jointTorque));
    if(!fitted||fitted.coefficients.some(x=>Math.abs(x)>1e18)){failures.push({terms:ids,reason:'rank_or_numerical_refusal'});continue;}
    const terms=ids.map((id,i)=>({id,coefficient:fitted.coefficients[i]}));
    const sine=frequency===null?0:fitted.coefficients[ids.length],cosine=frequency===null?0:fitted.coefficients[ids.length+1];
    const model={schema:'worldlaw.angular-frequency-model/v1',frequency,terms,sine,cosine};
    const errors=rows.map(r=>r.jointTorque-predictAngularFrequency(model,r));
    const rmse=Math.hypot(...errors)/Math.sqrt(rows.length),parameterCount=columns.length+(frequency!==null&&frequency!==1?1:0);
    const score=rows.length*Math.log(Math.max(rmse*rmse,s.noiseSigma*s.noiseSigma))+parameterCount*Math.log(rows.length);
    candidates.push({...model,rmse,score,parameterCount,conditionEstimate:fitted.conditionEstimate});
  }
  candidates.sort((a,b)=>a.score-b.score||a.parameterCount-b.parameterCount);
  return {frequency,selected:candidates[0]??null,candidates,failures};
}
export function predictAngularFrequency(model,row) {
  insist(model?.schema==='worldlaw.angular-frequency-model/v1'&&Array.isArray(model.terms)&&model.terms.length<=4&&new Set(model.terms.map(t=>t.id)).size===model.terms.length,'Invalid periodic response model.');
  insist(model.frequency===null||(Number.isFinite(model.frequency)&&model.frequency>0&&model.frequency<=32),'Invalid angular frequency.');
  for(const k of ['command','position','rate'])insist(typeof row?.[k]==='number'&&Number.isFinite(row[k])&&Math.abs(row[k])<=1e6,'Invalid response coordinate.');
  for(const t of model.terms)insist(allowed.includes(t.id)&&Number.isFinite(t.coefficient)&&Math.abs(t.coefficient)<=1e18,'Invalid response coefficient.');
  insist(Number.isFinite(model.sine)&&Number.isFinite(model.cosine)&&Math.abs(model.sine)<=1e18&&Math.abs(model.cosine)<=1e18&&(model.frequency!==null||(model.sine===0&&model.cosine===0)),'Invalid periodic coefficients.');
  const prediction=model.terms.reduce((sum,t)=>sum+t.coefficient*value(t.id,row),0)+(model.frequency===null?0:model.sine*Math.sin(model.frequency*row.position)+model.cosine*Math.cos(model.frequency*row.position));
  insist(Number.isFinite(prediction),'Response prediction overflow.');return prediction;
}
export function evaluateAngularFrequency(model,raw) {
  const rows=validateRows(raw,{allowEmpty:true}).map(r=>{const prediction=predictAngularFrequency(model,r);return {...r,prediction,residual:r.jointTorque-prediction};});
  return {rows,count:rows.length,rmse:rows.length?Math.hypot(...rows.map(r=>r.residual))/Math.sqrt(rows.length):null};
}
export function discoverAngularFrequency(raw,requested={}, {maxWork=MAX_FREQUENCY_WORK}={}) {
  const training=validateRows(raw),settings=frequencySettings(requested);
  insist(!training.some(r=>Object.hasOwn(r,'torqueNoiseRatio')),'Periodic investigation uses ordinary least squares; declared reading ratios are not silently ignored.');
  // Complete coarse grid, mandatory baseline, and two 17-point local grids.
  const count=settings.points+1+1+34,columns=settings.nuisance.length+2;
  const reserved=count*2**settings.nuisance.length*training.length*(columns*columns+columns+1);
  insist(Number.isSafeInteger(maxWork)&&maxWork>0&&maxWork<=MAX_FREQUENCY_WORK&&reserved<=maxWork,'Complete angular-frequency search exceeds work limit; no partial profile fitted.');
  const frequencies=[...new Set([1,...Array.from({length:settings.points},(_,i)=>settings.min+(settings.max-settings.min)*i/(settings.points-1))])].sort((a,b)=>a-b);
  const profile=frequencies.map(k=>({...fitAt(training,k,settings),stage:'coarse'}));
  const noPeriod=fitAt(training,null,settings),baseline=profile.find(c=>c.frequency===1);
  // Refine the smallest raw residual basin, not a receiving error or a noise-floor tie.
  let best=profile.filter(c=>c.selected).sort((a,b)=>a.selected.rmse-b.selected.rmse||a.frequency-b.frequency)[0];
  let radius=(settings.max-settings.min)/(settings.points-1);
  for(let level=0;level<2&&best;level++){
    const lo=Math.max(settings.min,best.frequency-radius),hi=Math.min(settings.max,best.frequency+radius);
    const refined=Array.from({length:17},(_,i)=>({...fitAt(training,lo+(hi-lo)*i/16,settings),stage:'refine-'+(level+1)}));
    profile.push(...refined);best=[best,...refined].filter(c=>c.selected).sort((a,b)=>a.selected.rmse-b.selected.rmse||a.frequency-b.frequency)[0];radius=(hi-lo)/16;
  }
  const ranked=[noPeriod,...profile].filter(c=>c.selected).map(c=>c.selected).sort((a,b)=>a.score-b.score||a.parameterCount-b.parameterCount||Math.abs((a.frequency??1)-1)-Math.abs((b.frequency??1)-1));
  insist(ranked.length,'No estimable response family.');
  const selected=ranked[0],competitive=ranked.filter(c=>c.score-selected.score<=settings.ambiguityDelta);
  const supported=competitive.filter(c=>c.frequency!==null),frequenciesCompetitive=[...new Set(supported.map(c=>c.frequency))].sort((a,b)=>a-b);
  const status=selected.rmse>3*settings.noiseSigma?'residual_mismatch':selected.frequency===null?'nonperiodic_preferred':selected.frequency===settings.min||selected.frequency===settings.max?'search_boundary':'conditional_periodic_response';
  return {schema:'worldlaw.angular-frequency-profile/v1',settings,training,profile,noPeriod,baseline,selected,competitiveFrequencies:frequenciesCompetitive,status,
    work:{reserved,limit:maxWork},limitations:['Finite coarse profile with two local refinements in one training-residual basin; not a global continuous optimum.','Frequency, phase and coefficients are conditional response descriptions, not identified gearing, sensor calibration or physical cause.','Score and competitive samples are heuristic, not probability or confidence intervals. Aliasing and narrow angle support can hide different periods.','All original training rows are retained. Separate receiving values never enter selection.']};
}
/** Conjugate q=kθ, qdot=kω into the maintained adaptive torque solver. */
export function simulateAngularFrequency(model,initial,settings={}) {
  predictAngularFrequency(model,{command:0,position:0,rate:0});
  const k=model.frequency??1,terms=model.terms.map(t=>({...t,coefficient:t.coefficient/(['rate','spring'].includes(t.id)?k:1)}));
  if(model.frequency!==null)terms.push({id:'gravity',coefficient:model.sine},{id:'cosine',coefficient:model.cosine});
  const result=executeStudioDynamics({schema:'worldlaw.torque-model/v1',terms},{position:k*initial.position,rate:k*initial.rate},{...settings,inertia:(settings.inertia??1)/k,
    positionTolerance:(settings.positionTolerance??1e-10)*k,rateTolerance:(settings.rateTolerance??1e-10)*k});
  return {...result,diagnostics:{...result.diagnostics,positionToleranceRad:result.diagnostics.positionToleranceRad/k,rateToleranceRadPerSecond:result.diagnostics.rateToleranceRadPerSecond/k},trajectory:result.trajectory.map(r=>({...r,position:r.position/k,rate:r.rate/k})),coordinateTransform:{frequency:k,returnedCoordinates:'original angle and angular rate'}};
}
export function exportAngularFrequencyInputs(session,settings) {
  const text=JSON.stringify({schema:FREQUENCY_SCHEMA,notebook:JSON.parse(exportSession(session)),settings:frequencySettings(settings)});
  insist(new TextEncoder().encode(text).length<=MAX_TEXT_LENGTH,'Frequency inputs exceed 2 MB.');return text;
}
export function restoreAngularFrequencyInputs(text) {
  insist(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_TEXT_LENGTH,'Frequency inputs exceed 2 MB.');
  const raw=JSON.parse(text);insist(raw?.schema===FREQUENCY_SCHEMA&&Object.keys(raw).sort().join(',')==='notebook,schema,settings','Invalid source-only frequency notebook.');
  return {session:restoreSession(JSON.stringify(raw.notebook)),settings:frequencySettings(raw.settings)};
}
