// Research only. Explicit split coefficients; never changes the maintained v1 solver.
import {fitSoftL1Columns,SOFT_L1_MAX_ITERATIONS,SOFT_L1_MAX_BACKTRACKS,SOFT_L1_MAX_WORK} from './robust-fit-research.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
import {splitResidual} from './split-multicolumn.mjs';
const dense = a => Array.isArray(a) && Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const finite = a => dense(a) && a.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6);
function sum(a,b){const s=a+b,v=s-a;return [s,(a-(s-v))+(b-v)];}
function add(p,x){const [s,e]=sum(p[0],x);return sum(s,e+p[1]);}
export function fitContinuationColumns(columns,target,scale,{maxSolves=48,maxWork=SOFT_L1_MAX_WORK}={}){
 if(!finite(target)||target.length<2||target.length>4096||!dense(columns)||!columns.length||columns.length>9||columns.length>target.length||!columns.every(c=>finite(c)&&c.length===target.length)||!Number.isFinite(scale)||scale<1e-7||scale>1e6||!Number.isInteger(maxSolves)||maxSolves<0||maxSolves>72||!Number.isInteger(maxWork)||maxWork<0||maxWork>SOFT_L1_MAX_WORK)return {status:'refused'};
 // Reserve every permitted native solve, including its complete QR and both
 // line searches. This is conservative work, not observed optimizer iterations.
 const n=target.length,p=columns.length;
 const perSolve=n*(p*p+p+1+SOFT_L1_MAX_ITERATIONS*(2*(p*p+p+1)+2*SOFT_L1_MAX_BACKTRACKS*(p+1)+3*(p+1)));
 const reservedWork=n*(p*p+p+1)+maxSolves*perSolve;
 if(reservedWork>maxWork)return {status:'work-limit',reservedWork,history:[]};
 const qr=fitLinearColumns(columns,target);if(!qr)return {status:'rank-unavailable'};
 let pairs=qr.coefficients.map(v=>[v,0]);const history=[],levels=[];
 let level=Math.max(scale,...target.map(Math.abs));while(level>scale){levels.push(level);level/=10;}levels.push(scale);
 const norms=columns.map(c=>Math.hypot(...c));let gradient=Infinity;
 for(const currentScale of levels){
  for(let round=0;round<3;round++){
   if(history.length>=maxSolves)return {status:'work-limit',history};
   const residual=splitResidual(columns,target,pairs);
   const fit=fitSoftL1Columns(columns,residual,currentScale,{coefficients:columns.map(()=>0),conditionEstimate:qr.conditionEstimate});
   history.push({scale:currentScale,status:fit.status,iterations:fit.iterations??0});
   if(!fit.coefficients||!fit.coefficients.every(Number.isFinite))return {status:'arithmetic-unresolved',history};
   pairs=pairs.map((p,i)=>add(p,fit.coefficients[i]));
   const r=splitResidual(columns,target,pairs),psi=r.map(v=>v/Math.hypot(1,v/currentScale));
   gradient=Math.max(...columns.map((c,j)=>Math.abs(c.reduce((s,x,i)=>s+x*psi[i],0))/norms[j]))/Math.sqrt(target.length);
   if(!Number.isFinite(gradient))return {status:'arithmetic-unresolved',history};
   if(gradient<=1e-8*currentScale)break;
  }
 }
 if(gradient>1e-8*scale)return {status:'stationarity-unresolved',history,gradient};
 return {status:'converged',schema:'worldlaw.split-continuation-research/v1',pairs,gradient,scale,history};
}
export function prepareContinuationPredictor(model){
 if(model?.schema!=='worldlaw.split-continuation-research/v1'||model.status!=='converged'||!dense(model.pairs)||!model.pairs.length||model.pairs.length>9||!model.pairs.every(p=>dense(p)&&p.length===2&&p.every(Number.isFinite)))throw new TypeError('Unsupported split response');
 const pairs=model.pairs.map(p=>[...p]);
 return (features,reading=0)=>{
  if(!finite(features)||features.length!==pairs.length||typeof reading!=='number'||!Number.isFinite(reading)||Math.abs(reading)>1e6)throw new TypeError('Invalid split response input');
  const columns=features.map(v=>[v]);
  const residual=splitResidual(columns,[reading],pairs)[0];
  const roundedPrediction=-splitResidual(columns,[0],pairs)[0];
  if(!Number.isFinite(residual)||!Number.isFinite(roundedPrediction))throw new RangeError('Unresolved split arithmetic');
  return {roundedPrediction,residual,roundedResidual:reading-roundedPrediction};
 };
}
