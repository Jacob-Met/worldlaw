import {captureExperimentReceipt,inspectExperimentReceipt} from './experiment-receipts.mjs';
export function captureScalarChallenge(discovery,rows,{usedWork=0,usedRows=0}={}){
 const work=(discovery.competitive.length+2)*rows.length;
 if(!Number.isSafeInteger(usedWork)||usedWork<0||!Number.isSafeInteger(usedRows)||usedRows<0||usedWork+work>8192||usedRows+rows.length>4096)throw Error('Complete retained challenge course exceeds8192 model-row work or4096 source rows; no partial challenge is retained.');
 const receipt=captureExperimentReceipt(discovery,discovery,rows);
 delete receipt.after;delete receipt.selectedAfter;
 const summaries=receipt.models.map((_,i)=>{const r=inspectExperimentReceipt(receipt,i);return {id:r.model.id,count:r.count,rmse:r.rmse,maxAbsResidual:r.maxAbsResidual};});
 return {...receipt,work,summaries,interpretation:'Original pre-challenge fitted laws evaluated on separately supplied readings. No challenge row enters fitting, model ranking, experiment planning or parameter search. Errors are not calibrated acceptance tests or physical validation.'};
}
