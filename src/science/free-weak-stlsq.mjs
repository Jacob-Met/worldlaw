import {fitLinearColumns,linearColumnRank} from './linear-fit.mjs';
const requireFit=(ok,reason)=>{if(!ok)throw new RangeError(reason);};
function vector(x,n){
  requireFit(Array.isArray(x)||(ArrayBuffer.isView(x)&&!(x instanceof DataView)),'Expected a numeric vector');
  requireFit(x.length===n,'Inconsistent equation counts');
  const a=Array.from(x);requireFit(a.every(Number.isFinite),'Nonfinite or missing observation');return a;
}
function unit(a){
  const peak=Math.max(...a.map(Math.abs));
  if(!peak)return {peak:0,length:0,values:a.map(()=>0)};
  const scaled=a.map(x=>x/peak),length=Math.hypot(...scaled);
  return {peak,length,values:scaled.map(x=>x/length)};
}
// Recover products without overflowing an otherwise representable ratio.
function product(numerators,denominators=[]){
  if(denominators.some(x=>!Number.isFinite(x)||x===0)||numerators.some(x=>!Number.isFinite(x)))return NaN;
  if(numerators.includes(0))return 0;
  let m=1,e=0;
  for(const [factors,dividing] of [[numerators,false],[denominators,true]])for(const x of factors){
    const j=Math.min(1023,Math.floor(Math.log2(Math.abs(x)))),a=x/2**j;
    m=dividing?m/a:m*a;e+=dividing?-j:j;
  }
  while(Math.abs(m)>=2){m/=2;e++;}while(Math.abs(m)<1){m*=2;e--;}
  if(e>1023||e< -1075)return NaN;
  const value=e< -1022?(m*2**(e+1074))*Number.MIN_VALUE:m*2**e;
  return Number.isFinite(value)&&value!==0?value:NaN;
}
function prepare(row,p){
  const n=row?.target?.length;
  requireFit(Number.isInteger(n)&&n>=1&&n<=4096,'Invalid equation count');
  requireFit(Array.isArray(row.columns)&&row.columns.length===p,'Feature roster differs');
  const x=Array.from(row.columns,c=>unit(vector(c,n))),y=unit(vector(row.target,n));
  const ids=Array.from({length:p},(_,j)=>j);
  return {n,x,y,eligible:ids.filter(j=>x[j].peak!==0),zeros:ids.filter(j=>x[j].peak===0)};
}
function solve(row,threshold,ridge,maxFits,maxWork){
  const {n,x,y,eligible,zeros}=row;
  let active=y.peak?eligible.slice():[],fits=0,work=0;const trace=[];
  const result=(status,more={})=>({status,active:active.slice(),fits,work,zeroColumns:zeros.slice(),trace,...more});
  const charge=units=>{if(units>maxWork-work)return false;work+=units;return true;};
  const empty=reason=>{
    const trainRmse=product([y.peak,y.length],[Math.sqrt(n)]);
    return Number.isFinite(trainRmse)?result('converged',{reason,coefficients:[],normalizedCoefficients:[],supportRank:0,trainRmse,relativeTrainResidual:y.peak?1:0,dataRankDeficient:false}):result('numeric_failure',{stage:'empty_rmse'});
  };
  if(!active.length)return empty(y.peak?'all_columns_zero':'zero_target');
  for(;;){
    const k=active.length;
    if(fits>=maxFits)return result('iteration_limit');
    const data=active.map(j=>x[j].values);
    if(!ridge&&k>n)return result('data_rank_deficient',{rankUpperBound:n});
    const nr=n+(ridge>0?k:0);
    if(!charge(nr*k*k))return result('work_limit',{stage:'solve'});
    fits++;
    const A=ridge>0?data.map((c,i)=>c.concat(Array.from({length:k},(_,j)=>i===j?Math.sqrt(ridge):0))):data;
    const b=ridge>0?y.values.concat(Array(k).fill(0)):y.values;
    const fit=fitLinearColumns(A,b);
    if(!fit){
      if(ridge>0)return result('augmented_qr_refused');
      if(!charge(n*k*k))return result('qr_refused_rank_unmeasured');
      const rank=linearColumnRank(data);
      return result(rank<k?'data_rank_deficient':'numeric_qr_refusal',{supportRank:rank});
    }
    const beta=fit.coefficients,kept=active.filter((_,i)=>beta[i]!==0&&Math.abs(beta[i])>=threshold);
    trace.push({fitted:active.slice(),kept:kept.slice()});
    if(!kept.length){active=[];return empty('threshold_removed_all');}
    if(kept.length<k){active=kept;continue;}
    if(!charge(n*k*k))return result('work_limit',{stage:'final_data_rank'});
    const supportRank=linearColumnRank(data);
    const coefficients=beta.map((v,i)=>product([v,y.peak,y.length],[x[active[i]].peak,x[active[i]].length]));
    const residual=y.values.map((v,t)=>v-data.reduce((s,c,j)=>s+c[t]*beta[j],0));
    const relativeTrainResidual=Math.hypot(...residual),trainRmse=product([relativeTrainResidual,y.peak,y.length],[Math.sqrt(n)]);
    if(!coefficients.every(Number.isFinite)||!Number.isFinite(trainRmse))return result('numeric_failure',{stage:'physical_recovery'});
    return result('converged',{reason:'stable_support',coefficients,normalizedCoefficients:beta.slice(),supportRank,trainRmse,relativeTrainResidual,qrPivotRatio:fit.conditionEstimate,dataRankDeficient:supportRank<k});
  }
}
/** Free support within the supplied response-independent finite feature bank.
 * Each output is fitted independently at the SAME threshold/ridge pair. Whole
 * separate recordings, not these training errors, must choose the joint model.
 * There is no top-k truncation, family mask, coefficient tying or final OLS refit.
 */
export function fitFreeWeakSTLSQ(rows,{thresholds=[.025,.05,.1,.2],ridges=[1e-6,1e-3,.1],maxFits=257,maxWorkPerRow=50000000}={}){
  requireFit(Array.isArray(rows)&&rows.length>=1&&rows.length<=2,'Expected one or two response rows');
  const p=rows[0]?.columns?.length;
  requireFit(Number.isInteger(p)&&p>=1&&p<=256,'Invalid feature count');
  requireFit(Number.isInteger(maxFits)&&maxFits>=1&&maxFits<=257,'Invalid fit limit');
  requireFit(Number.isSafeInteger(maxWorkPerRow)&&maxWorkPerRow>=1&&maxWorkPerRow<=200000000,'Invalid QR work budget');
  const menu=(a,max)=>Array.isArray(a)&&a.length>=1&&a.length<=max&&new Set(a).size===a.length&&Array.from(a).every(v=>Number.isFinite(v)&&v>=0);
  requireFit(menu(thresholds,8)&&menu(ridges,4)&&ridges.every(v=>v<=1),'Invalid threshold/ridge menu');
  requireFit(rows.length*thresholds.length*ridges.length*maxWorkPerRow<=3200000000,'Aggregate QR budget exceeded');
  const prepared=Array.from(rows,row=>prepare(row,p)),candidates=[];
  for(const ridge of ridges)for(const threshold of thresholds){
    const equations=prepared.map(row=>solve(row,threshold,ridge,maxFits,maxWorkPerRow));
    candidates.push({ridge,threshold,status:equations.every(r=>r.status==='converged')?'converged':'refused',equations});
  }
  return {schema:'worldlaw.free-weak-stlsq/v1',featureCount:p,candidates,
    normalization:'L2 per feature and response, no centering; explicit constant column',
    termination:'Strict support subsets at every changing step; unfinished fits refuse.',
    structuralIdentification:false};
}
