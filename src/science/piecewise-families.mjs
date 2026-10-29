import{FAMILY_PRODUCTS_LIMIT}from'./challenge-families.mjs';
import{piecewiseCalibrationContext}from'./piecewise-calibration.mjs';
import{admitPiecewiseCalibration}from'./piecewise-calibration-source.mjs';
import{piecewiseCheckSource}from'./piecewise-calibration-check.mjs';
import{searchConditionedPiecewise}from'./piecewise-conditioned.mjs';
export function comparePiecewiseFamilies(state,eventIndex,throughEvent,report,association,declarations,checks,basis,residuals,options={}){
 if(Object.keys(options).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Use complete original-family work controls.');
 const {maxIterations=512,maxProducts=FAMILY_PRODUCTS_LIMIT}=options;
 if(!Number.isInteger(eventIndex)||!Number.isInteger(throughEvent)||eventIndex<1||throughEvent<eventIndex||throughEvent>=state.history.length||!state.history[eventIndex].challenge||!state.history[throughEvent].challenge)throw Error('Choose complete original challenge endpoints.');
 if(!Number.isSafeInteger(maxIterations)||maxIterations<0||maxIterations>4096||!Number.isSafeInteger(maxProducts)||maxProducts<0||maxProducts>FAMILY_PRODUCTS_LIMIT)throw Error('Declare bounded complete-family work.');
 if(typeof basis!=='string'||!basis.trim()||basis.length>1000)throw Error('Explicit complete joint source basis required.');
 const admitted=admitPiecewiseCalibration(report),course=piecewiseCheckSource(admitted,checks).course;
 const anchor=state.history[eventIndex].challenge,models=anchor.models,n=anchor.beforeCount,m=state.history.slice(eventIndex,throughEvent+1).reduce((s,h)=>s+(h.challenge?.rows.length??0),0),k=course.checks.length;
 if(!Array.isArray(models)||models.length<1||models.length>128||!Number.isInteger(n)||n<1||n>4096)throw Error('Original retained model population exceeds maintained bounds.');
 if(residuals!==undefined&&(!Array.isArray(residuals)||residuals.length!==n))throw Error('Retain every original row residual; no subset is compared.');
 const latentCount=admitted.standards.length+(residuals===undefined?0:n),perModelProducts=3*latentCount*(m+k)*maxIterations,requestedProducts=perModelProducts*models.length,preparationCells=n*m*models.length;
 const base={modelCount:models.length,trainingCount:n,receivingCount:m,calibrationCount:k,latentCount,requestedProducts,preparationCells,maxProducts,rows:[],interpretation:'Every original structure is assessed separately against the same complete original law and calibration course. A witness is conditional, not a selected true law. Each structure may have its own calibration witness; no common correction across different structures is asserted. Joint separation rejects that combined explanation, not the physical law alone. Original ranking and fitting remain unchanged.'};
 if(m+k>128||requestedProducts>maxProducts||preparationCells>1048576)return{...base,status:'complete-work-refused',reason:'Complete original population exceeds receiving, preparation or search reservation; no subset searched.'};
 const rows=models.map((model,index)=>{try{const c=piecewiseCalibrationContext(state,eventIndex,index,throughEvent,admitted,association,declarations,residuals),r=c.status==='prepared'?searchConditionedPiecewise(c.source,course,basis,{maxIterations,maxProducts:perModelProducts}):{status:'unavailable',reason:c.reason};return{index,id:model.id,status:r.status,reason:r.reason??'',iterationsPerformed:r.iterationsPerformed??0,matrixTermsUsed:r.matrixTermsUsed??0};}catch(e){return{index,id:model.id,status:'unavailable',reason:e.message,iterationsPerformed:0,matrixTermsUsed:0};}});
 const counts=Object.fromEntries(['verified-interior-witness','verified-separation','unresolved','unavailable'].map(k=>[k,rows.filter(r=>r.status===k).length]));
 return{...base,status:counts['verified-separation']===models.length?'all-original-families-separated':'complete-family-comparison',rows,counts,matrixTermsUsed:rows.reduce((s,r)=>s+r.matrixTermsUsed,0)};
}
