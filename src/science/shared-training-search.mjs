import {prepareSharedTraining,makeSharedCertificate,checkPreparedCertificate,checkSharedTrainingCertificate} from './shared-training-check.mjs';
export const SHARED_SEARCH_MAX_ITERATIONS=4096;
export const SHARED_SEARCH_MAX_PRODUCTS=67108864;
function settings(options){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['trainingRadius','receivingRadius','maxIterations','maxProducts'].includes(k)))throw new Error('Unknown shared-training search option.');
 const maxIterations=Object.hasOwn(options,'maxIterations')?options.maxIterations:512,maxProducts=Object.hasOwn(options,'maxProducts')?options.maxProducts:16777216;
 if(!Number.isSafeInteger(maxIterations)||maxIterations<0||maxIterations>SHARED_SEARCH_MAX_ITERATIONS||!Number.isSafeInteger(maxProducts)||maxProducts<0||maxProducts>SHARED_SEARCH_MAX_PRODUCTS)throw new Error('Search iteration/product budgets must be bounded nonnegative integers.');
 const radii={};for(const key of ['trainingRadius','receivingRadius'])if(Object.hasOwn(options,key))radii[key]=options[key];
 return {radii,maxIterations,maxProducts};
}
export function searchSharedTraining(model,training,receiving,options={}){
 const declared=settings(options),context=prepareSharedTraining(model,training,receiving,declared.radii);
 const base={schema:'worldlaw.shared-training-search/v1',marginal:context.marginal,settings:{...context.marginal.settings,maxIterations:declared.maxIterations,maxProducts:declared.maxProducts},status:'unresolved',certificate:null,check:null,iterationsPerformed:0,matrixTermsUsed:0,interpretation:'Bounded search for independently checked numerical evidence about one shared training-reading perturbation. No convergence completeness, certified QR error, adequate-law or physical-feasibility claim. Search exhaustion is unresolved.'};
 if(context.status!=='prepared')return {...base,reason:context.reason};
 const rows=context.marginal.rows,n=context.training.length,m=rows.length,rtrain=context.marginal.settings.trainingRadius,rreceive=context.marginal.settings.receivingRadius;
 const perIteration=3*n*m;
 const frobeniusSquared=rows.reduce((sum,row)=>sum+row.influence.reduce((s,v)=>s+v*v,0),0);
 if(!Number.isFinite(frobeniusSquared))return {...base,reason:'search-numerical-scale'};
 const offsets=Array(n).fill(0);let iterationsPerformed=0,matrixTermsUsed=0,bestSeparation=null,lastWitnessReason=null;
 const finish=(certificate,check)=>{
  const independent=checkSharedTrainingCertificate(model,training,receiving,declared.radii,certificate);
  if(independent.status!==check.status)return {...base,reason:'independent-certificate-recheck-disagrees',iterationsPerformed,matrixTermsUsed,bestSeparation};
  return {...base,status:independent.status,reason:independent.reason,certificate,check:independent,iterationsPerformed,matrixTermsUsed};
 };
 for(let iteration=0;iteration<declared.maxIterations;iteration++){
  if(matrixTermsUsed+perIteration>declared.maxProducts)return {...base,reason:'matrix-work-budget',iterationsPerformed,matrixTermsUsed,bestSeparation,lastWitnessReason};
  matrixTermsUsed+=perIteration;iterationsPerformed++;
  const predictions=rows.map(row=>row.refittedPrediction+row.influence.reduce((sum,value,i)=>sum+value*offsets[i],0));
  if(!predictions.every(Number.isFinite))return {...base,reason:'search-prediction-range',iterationsPerformed,matrixTermsUsed};
  // Strict original-box interior is needed; contact is not silently accepted.
  if(predictions.every((p,j)=>rreceive-Math.abs(rows[j].observedTorque-p)>rows[j].numericalTolerance)){
   const certificate=makeSharedCertificate(context,'training-offsets',offsets),check=checkPreparedCertificate(context,certificate);
   if(check.status==='verified-interior-witness')return finish(certificate,check);
   lastWitnessReason=check.reason;
  }
  // Inset boxes guide search away from boundary-only candidates. This cannot
  // strengthen a separator: its checker always uses ORIGINAL declared radii.
  const residual=predictions.map((p,j)=>{const difference=rows[j].observedTorque-p;return Math.sign(difference)*Math.max(0,Math.abs(difference)-rreceive/2);});
  const maximum=Math.max(...residual.map(Math.abs));
  if(!Number.isFinite(maximum))return {...base,reason:'search-residual-range',iterationsPerformed,matrixTermsUsed};
  const gradient=Array.from({length:n},(_,i)=>rows.reduce((sum,row,j)=>sum+row.influence[i]*residual[j],0));
  if(!gradient.every(Number.isFinite))return {...base,reason:'search-gradient-range',iterationsPerformed,matrixTermsUsed};
  if(maximum>0){
   const weights=residual.map(x=>x/maximum),certificate=makeSharedCertificate(context,'receiving-separator',weights),check=checkPreparedCertificate(context,certificate);
   if(check.status==='verified-separation')return finish(certificate,check);
   if(Number.isFinite(check.gap)&&(!bestSeparation||check.gap>bestSeparation.gap))bestSeparation={weights,gap:check.gap,numericalTolerance:check.numericalTolerance};
  }
  if(frobeniusSquared===0)return {...base,reason:rreceive===0?'zero-radius-contact-is-not-certified':'no-search-direction',iterationsPerformed,matrixTermsUsed,bestSeparation,lastWitnessReason};
  let changed=false;
  for(let i=0;i<n;i++){
   const next=Math.max(-rtrain,Math.min(rtrain,offsets[i]+gradient[i]/frobeniusSquared));
   if(!Number.isFinite(next))return {...base,reason:'search-update-range',iterationsPerformed,matrixTermsUsed};
   changed ||= next!==offsets[i];offsets[i]=next;
  }
  if(!changed)return {...base,reason:rreceive===0?'zero-radius-contact-is-not-certified':'search-stalled-without-certificate',iterationsPerformed,matrixTermsUsed,bestSeparation,lastWitnessReason};
 }
 return {...base,reason:'iteration-budget',iterationsPerformed,matrixTermsUsed,bestSeparation,lastWitnessReason};
}
