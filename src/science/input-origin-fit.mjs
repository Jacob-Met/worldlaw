// Reconstructed successor: historical results do not certify these bytes.
import {fitHeterogeneousColumns, heterogeneousWork} from './heterogeneous-fit.mjs';
import {SOFT_L1_MAX_WORK, SOFT_L1_GRADIENT_TOLERANCE} from './robust-budget-probe.mjs';
import {productPair} from './split-column.mjs';
import {splitResidual} from './split-multicolumn.mjs';
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const finite=a=>dense(a)&&a.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6);
function add(a,b){const s=a[0]+b[0],v=s-a[0],e=(a[0]-(s-v))+(b[0]-v)+a[1]+b[1],h=s+e;return [h,e-(h-s)];}
export function inputOriginWork(n,p,targetMax,scale,maxIterations=96){return heterogeneousWork(n,p,targetMax,scale,maxIterations)+n*(128*p+64)+128*p;}
export function fitInputOriginColumns(columns,target,ratios,scale,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['maxIterations','maxWork'].includes(k)))return {status:'refused'};
 const {maxIterations=96,maxWork=SOFT_L1_MAX_WORK}=options;
 if(!finite(target)||target.length<2||target.length>4096||!dense(columns)||!columns.length||columns.length>9||columns.length>target.length||!columns.every(c=>finite(c)&&c.length===target.length)||!finite(ratios)||ratios.length!==target.length||ratios.some(r=>r<1e-6)||!Number.isFinite(scale)||scale<1e-7||scale>1e6||!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>96||!Number.isInteger(maxWork)||maxWork<0||maxWork>SOFT_L1_MAX_WORK)return {status:'refused'};
 const bias=columns.findIndex(c=>c.every(v=>v===1));if(bias<0)return {status:'bias-required'};
 const origins=columns.map((c,j)=>j===bias||Math.min(...c)<=0&&Math.max(...c)>=0?0:c[0]);
 const centered=columns.map((c,j)=>c.map(v=>v-origins[j]));
 const normalizedTarget=target.map((v,i)=>v/ratios[i]);
 if(!normalizedTarget.every(v=>Math.abs(v)<=1e6)||!centered.every(c=>c.every((v,i)=>Math.abs(v)<=1e6&&Math.abs(v/ratios[i])<=1e6))||!columns.every(c=>c.every((v,i)=>Math.abs(v/ratios[i])<=1e6)))return {status:'normalized-range-refused'};
 const reservedWork=inputOriginWork(target.length,columns.length,Math.max(...normalizedTarget.map(Math.abs)),scale,maxIterations);
 if(!maxIterations||reservedWork>maxWork)return {status:'work-limit',reservedWork,iterations:0,calls:0};
 const fit=fitHeterogeneousColumns(centered,target,ratios,scale,{maxIterations,maxWork});
 if(fit.status!=='converged')return {...fit,reservedWork,origins};
 const pairs=fit.pairs.map(p=>p.slice());
 for(let j=0;j<pairs.length;j++)if(j!==bias)for(const part of fit.pairs[j]){const product=productPair(origins[j],part);pairs[bias]=add(pairs[bias],[-product[0],-product[1]]);}
 if(!pairs.every(p=>p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e18)))return {status:'mapping-unresolved',reservedWork,origins};
 const residual=splitResidual(columns,target,pairs).map((v,i)=>v/ratios[i]);
 const psi=residual.map(v=>v/Math.hypot(1,v/scale));
 function gradient(design){return Math.max(...design.map(c=>{const normalized=c.map((v,i)=>v/ratios[i]),norm=Math.hypot(...normalized);return Math.abs(normalized.reduce((s,v,i)=>s+v*psi[i],0))/norm;}))/Math.sqrt(target.length);}
 const originalGradient=gradient(columns),centeredGradient=gradient(centered);
 const status=[originalGradient,centeredGradient].every(g=>Number.isFinite(g)&&g<=SOFT_L1_GRADIENT_TOLERANCE*scale)?'converged':'stationarity-unresolved';
 return {...fit,status,pairs,origins,reservedWork,originalGradient,centeredGradient,gradient:Math.max(originalGradient,centeredGradient),objective:'declared_ratio_soft_l1',representation:'original_coordinate_compensated_pairs'};
}
