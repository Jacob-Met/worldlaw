// Separate research candidate; does not replace the qualified Studio solver.
import {fitSoftL1Columns,SOFT_L1_MAX_BACKTRACKS,SOFT_L1_MAX_WORK,SOFT_L1_GRADIENT_TOLERANCE} from './robust-budget-probe.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
import {splitResidual} from './split-multicolumn.mjs';
export function sharedIterationWork(n,p,targetMax,scale,maxIterations=96){
 const levels=[];let level=Math.max(scale,targetMax);while(level>scale){levels.push(level);level/=10;}levels.push(scale);const maxCalls=levels.length+2;
 return 3*((n+p)*(p*p+p+1)+n*(124*p+5*p+20+5*(80*p+40)))+n*((maxCalls+1)*(p*p+p+1)+maxIterations*(2*(p*p+p+1)+2*SOFT_L1_MAX_BACKTRACKS*(p+1)+3*(p+1))+(2*maxCalls+1)*(62*p+1)+(maxCalls+1)*(5*p+8));
}
export function heterogeneousWork(n,p,targetMax,scale,maxIterations=96){
 let level=Math.max(scale,targetMax),count=1;while(level>scale){count++;level/=10;}const maxCalls=count+2;
 return sharedIterationWork(n,p,targetMax,scale,maxIterations)+n*(p+1+2*maxCalls+1+3*(2+5));
}
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const finite=a=>dense(a)&&a.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6);
function sum(a,b){const s=a+b,v=s-a;return [s,(a-(s-v))+(b-v)];}
function add(p,x){const [s,e]=sum(p[0],x);return sum(s,e+p[1]);}
export function fitHeterogeneousColumns(columns,target,ratios,scale,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['maxIterations','maxWork'].includes(k)))return {status:'refused'};
 const {maxIterations=96,maxWork=SOFT_L1_MAX_WORK}=options;
 if(!finite(target)||target.length<2||target.length>4096||!dense(columns)||!columns.length||columns.length>9||columns.length>target.length||!columns.every(c=>finite(c)&&c.length===target.length)||!Number.isFinite(scale)||scale<1e-7||scale>1e6||!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>96||!Number.isInteger(maxWork)||maxWork<0||maxWork>SOFT_L1_MAX_WORK)return {status:'refused'};
 if(!finite(ratios)||ratios.length!==target.length||ratios.some(r=>r<1e-6))return {status:'refused'};
 const design=columns.map(c=>c.map((v,i)=>v/ratios[i])),normalizedTarget=target.map((v,i)=>v/ratios[i]);
 if(!normalizedTarget.every(v=>Math.abs(v)<=1e6)||!design.every(c=>c.every(v=>Math.abs(v)<=1e6)))return {status:'normalized-range-refused'};
 const residuals=values=>splitResidual(columns,target,values).map((v,i)=>v/ratios[i]);
 const levels=[];let level=Math.max(scale,...normalizedTarget.map(Math.abs));while(level>scale){levels.push(level);level/=10;}levels.push(scale);
 const n=target.length,p=columns.length,maxCalls=levels.length+2;
 // Native work plus conservative compensated residual/gradient accounting.
 // Each call has at most two split-residual passes (62 arithmetic operations
 // per feature pair), plus an original-scale final pass. No prefix is fitted.
 const reservedWork=heterogeneousWork(n,p,Math.max(...normalizedTarget.map(Math.abs)),scale,maxIterations);
 if(!maxIterations||reservedWork>maxWork)return {status:'work-limit',reservedWork,iterations:0,calls:0};
 const qr=fitLinearColumns(design,normalizedTarget);if(!qr)return {status:'rank-unavailable',reservedWork};
 let pairs=qr.coefficients.map(v=>[v,0]),iterations=0,calls=0;const history=[],norms=design.map(c=>Math.hypot(...c));
 const gradient=s=>{const r=residuals(pairs),psi=r.map(v=>v/Math.hypot(1,v/s));return Math.max(...design.map((c,j)=>Math.abs(c.reduce((a,x,i)=>a+x*psi[i],0))/norms[j]))/Math.sqrt(n);};
 for(const current of levels)for(let round=0;round<(current===scale?3:1);round++){
  const available=Math.min(current===scale?32:4,maxIterations-iterations);if(available<1)break;
  const fit=fitSoftL1Columns(design,residuals(pairs),current,{coefficients:columns.map(()=>0),conditionEstimate:qr.conditionEstimate},available);
  calls++;iterations+=fit.iterations??0;history.push({scale:current,permittedIterations:available,iterations:fit.iterations??0,status:fit.status});
  if(!fit.coefficients||!fit.coefficients.every(Number.isFinite))return {status:'arithmetic-unresolved',reservedWork,iterations,calls,history};
  pairs=pairs.map((p,i)=>add(p,fit.coefficients[i]));const g=gradient(current);
  if(!Number.isFinite(g))return {status:'arithmetic-unresolved',reservedWork,iterations,calls,history};
  if(g<=SOFT_L1_GRADIENT_TOLERANCE*current)break;
 }
 // At most three damped exact-curvature corrections; every trial is reserved above.
 for(let stepIndex=0;stepIndex<3&&gradient(scale)>SOFT_L1_GRADIENT_TOLERANCE*scale;stepIndex++){
  const residual=residuals(pairs),weights=residual.map(r=>1/Math.hypot(1,r/scale)),sqrtH=weights.map(w=>w**1.5);
  const augmented=design.map((c,j)=>[...c.map((v,i)=>v/norms[j]*sqrtH[i]),...columns.map((_,q)=>q===j?1e-6:0)]),right=[...residual.map((r,i)=>r/Math.sqrt(weights[i])),...columns.map(()=>0)];
  if(!right.every(Number.isFinite)||!augmented.every(c=>c.every(Number.isFinite)))break;
  const curvature=fitLinearColumns(augmented,right);if(!curvature)break;
  let accepted=false;
  for(let back=0;back<5;back++){
   const alpha=2**-back,correction=curvature.coefficients.map((v,j)=>alpha*v/norms[j]),trial=pairs.map((p,j)=>add(p,correction[j]));
   const change=splitResidual(columns,target.map(()=>0),correction.map(v=>[v,0])).map((v,i)=>v/ratios[i]);let difference=[0,0];
   for(let i=0;i<n;i++)difference=add(difference,2*scale*change[i]*(2*residual[i]+change[i])/(Math.hypot(scale,residual[i]+change[i])+Math.hypot(scale,residual[i])));
   if(Number.isFinite(difference[0])&&difference[0]+difference[1]<0){pairs=trial;history.push({method:'damped_exact_curvature',alpha,difference:difference[0]+difference[1]});accepted=true;break;}
  }
  if(!accepted)break;
 }
 const g=gradient(scale);if(!Number.isFinite(g)||g>SOFT_L1_GRADIENT_TOLERANCE*scale)return {status:'stationarity-unresolved',curvatureSteps:history.filter(h=>h.method==='damped_exact_curvature').length,pairs,reservedWork,iterations,calls,history,gradient:g};
 return {objective:'declared_ratio_soft_l1',curvatureSteps:history.filter(h=>h.method==='damped_exact_curvature').length,conditionEstimate:qr.conditionEstimate,status:'converged',schema:'worldlaw.split-continuation-research/v1',pairs,scale,gradient:g,reservedWork,iterations,calls,history};
}
