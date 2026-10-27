import{searchChallengePrecision}from'./challenge-precision.mjs';
export const FAMILY_PRODUCTS_LIMIT=16777216;
export function compareChallengeFamilies(state,eventIndex,throughEvent,trainingRadius,declarations,{maxIterations=512,maxProducts=FAMILY_PRODUCTS_LIMIT}={}){
 if(!Number.isInteger(eventIndex)||!Number.isInteger(throughEvent)||eventIndex<1||throughEvent<eventIndex||throughEvent>=state.history.length||!state.history[eventIndex].challenge||!state.history[throughEvent].challenge)throw Error('Choose original independent challenge endpoints.');
 if(!Number.isSafeInteger(maxIterations)||maxIterations<0||maxIterations>4096||!Number.isSafeInteger(maxProducts)||maxProducts<0||maxProducts>FAMILY_PRODUCTS_LIMIT)throw Error('Declare bounded complete-family iteration and matrix work.');
 const anchor=state.history[eventIndex].challenge,models=anchor.models,n=anchor.beforeCount,m=state.history.slice(eventIndex,throughEvent+1).reduce((sum,h)=>sum+(h.challenge?.rows.length??0),0);
 if(!Array.isArray(models)||models.length<1||models.length>128||!Number.isInteger(n)||n<1||n>4096)throw Error('Original family population exceeds maintained bounds.');
 const requestedProducts=3*n*m*maxIterations*models.length,preparationCells=n*m*models.length;
 const base={modelCount:models.length,trainingCount:n,receivingCount:m,requestedProducts,preparationCells,maxProducts,rows:[],interpretation:'Every original retained structure uses one common original-training perturbation across this entire challenge course. Families are checked separately; witnesses do not identify a true law, and unsupported or exhausted searches are not exclusions. Original ranking and fitting remain unchanged.'};
 if(m>128||requestedProducts>maxProducts||preparationCells>1048576)return{...base,status:'complete-work-refused',reason:'Complete original family/course exceeds row, preparation or search reservation; no model subset was searched.'};
 const perModelProducts=3*n*m*maxIterations;
 const rows=models.map((model,index)=>{try{const result=searchChallengePrecision(state,eventIndex,index,throughEvent,trainingRadius,declarations,{maxIterations,maxProducts:perModelProducts});return{index,id:model.id,status:result.status,reason:result.reason??result.check?.reason??'',iterationsPerformed:result.iterationsPerformed??0,matrixTermsUsed:result.matrixTermsUsed??0};}catch(error){return{index,id:model.id,status:'unavailable',reason:error.message,iterationsPerformed:0,matrixTermsUsed:0};}});
 const counts=Object.fromEntries(['verified-interior-witness','verified-separation','unresolved','unavailable'].map(k=>[k,rows.filter(r=>r.status===k).length]));
 return{...base,status:counts['verified-separation']===models.length?'all-original-families-separated':'complete-family-comparison',rows,counts,matrixTermsUsed:rows.reduce((sum,r)=>sum+r.matrixTermsUsed,0)};
}
