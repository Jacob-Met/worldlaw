// Separate research candidate; does not replace the qualified Studio solver.
import {fitSoftL1Columns,SOFT_L1_MAX_BACKTRACKS,SOFT_L1_MAX_WORK,SOFT_L1_GRADIENT_TOLERANCE} from './robust-budget-probe.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
import {splitResidual} from './split-multicolumn.mjs';
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const finite=a=>dense(a)&&a.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6);
function sum(a,b){const s=a+b,v=s-a;return [s,(a-(s-v))+(b-v)];}
function add(p,x){const [s,e]=sum(p[0],x);return sum(s,e+p[1]);}
export function fitSharedIterationColumns(columns,target,scale,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['maxIterations','maxWork'].includes(k)))return {status:'refused'};
 const {maxIterations=64,maxWork=SOFT_L1_MAX_WORK}=options;
 if(!finite(target)||target.length<2||target.length>4096||!dense(columns)||!columns.length||columns.length>9||columns.length>target.length||!columns.every(c=>finite(c)&&c.length===target.length)||!Number.isFinite(scale)||scale<1e-7||scale>1e6||!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>64||!Number.isInteger(maxWork)||maxWork<0||maxWork>SOFT_L1_MAX_WORK)return {status:'refused'};
 const levels=[];let level=Math.max(scale,...target.map(Math.abs));while(level>scale){levels.push(level);level/=10;}levels.push(scale);
 const n=target.length,p=columns.length,maxCalls=levels.length+2;
 // Native work plus conservative compensated residual/gradient accounting.
 // Each call has at most two split-residual passes (62 arithmetic operations
 // per feature pair), plus an original-scale final pass. No prefix is fitted.
 const reservedWork=n*((maxCalls+1)*(p*p+p+1)+maxIterations*(2*(p*p+p+1)+2*SOFT_L1_MAX_BACKTRACKS*(p+1)+3*(p+1))+(2*maxCalls+1)*(62*p+1)+(maxCalls+1)*(5*p+8));
 if(!maxIterations||reservedWork>maxWork)return {status:'work-limit',reservedWork,iterations:0,calls:0};
 const qr=fitLinearColumns(columns,target);if(!qr)return {status:'rank-unavailable',reservedWork};
 let pairs=qr.coefficients.map(v=>[v,0]),iterations=0,calls=0;const history=[],norms=columns.map(c=>Math.hypot(...c));
 const gradient=s=>{const r=splitResidual(columns,target,pairs),psi=r.map(v=>v/Math.hypot(1,v/s));return Math.max(...columns.map((c,j)=>Math.abs(c.reduce((a,x,i)=>a+x*psi[i],0))/norms[j]))/Math.sqrt(n);};
 for(const current of levels)for(let round=0;round<(current===scale?3:1);round++){
  const available=Math.min(current===scale?32:4,maxIterations-iterations);if(available<1)break;
  const fit=fitSoftL1Columns(columns,splitResidual(columns,target,pairs),current,{coefficients:columns.map(()=>0),conditionEstimate:qr.conditionEstimate},available);
  calls++;iterations+=fit.iterations??0;history.push({scale:current,permittedIterations:available,iterations:fit.iterations??0,status:fit.status});
  if(!fit.coefficients||!fit.coefficients.every(Number.isFinite))return {status:'arithmetic-unresolved',reservedWork,iterations,calls,history};
  pairs=pairs.map((p,i)=>add(p,fit.coefficients[i]));const g=gradient(current);
  if(!Number.isFinite(g))return {status:'arithmetic-unresolved',reservedWork,iterations,calls,history};
  if(g<=SOFT_L1_GRADIENT_TOLERANCE*current)break;
 }
 const g=gradient(scale);if(!Number.isFinite(g)||g>SOFT_L1_GRADIENT_TOLERANCE*scale)return {status:'stationarity-unresolved',reservedWork,iterations,calls,history,gradient:g};
 return {status:'converged',schema:'worldlaw.split-continuation-research/v1',pairs,scale,gradient:g,reservedWork,iterations,calls,history};
}
