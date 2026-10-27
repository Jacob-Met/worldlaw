import {inspectInputEnclosures} from './input-enclosure.mjs';
export const MAX_BOUNDED_RECEIPT_WORK=8192;
// Consume the maintained receipt's frozen models and original rows. Retain only
// complete per-model counts, not a second model-by-row snapshot history.
export function summarizeBoundedReceipt(receipt,radii,usedEvaluations=0){
 if(!radii)return null;
 if(!Number.isSafeInteger(usedEvaluations)||usedEvaluations<0||usedEvaluations>MAX_BOUNDED_RECEIPT_WORK)throw Error('Invalid cumulative bounded receiving work');
 const requestedEvaluations=receipt.models.length*receipt.rows.length;
 const base={requestedEvaluations,usedEvaluations,limit:MAX_BOUNDED_RECEIPT_WORK,radii:{...radii}};
 if(!receipt.models.length||receipt.models.length>256||usedEvaluations+requestedEvaluations>MAX_BOUNDED_RECEIPT_WORK)return{...base,status:'unavailable',evaluations:0,reason:'Complete prior-model course exceeds the model or cumulative notebook comparison budget; no subset was compared.'};
 try{
  const models=receipt.models.map(model=>{const r=inspectInputEnclosures(model,receipt.rows,radii);return{modelId:model.id,excludedCount:r.excludedCount};});
  const remaining=models.filter(m=>m.excludedCount===0).length;
  return{...base,status:remaining===0?'all-excluded':remaining===models.length?'none-excluded':'some-excluded',evaluations:requestedEvaluations,modelCount:models.length,remaining,models};
 }catch(error){return{...base,status:'unavailable',evaluations:requestedEvaluations,reason:error.message};}
}
export function inspectBoundedReceipt(receipt,index){
 if(!receipt.bounded||receipt.bounded.status==='unavailable')return null;
 if(!Number.isInteger(index)||index<0||index>=receipt.models.length)throw Error('Choose an original prior model');
 return inspectInputEnclosures(receipt.models[index],receipt.rows,receipt.bounded.radii);
}
