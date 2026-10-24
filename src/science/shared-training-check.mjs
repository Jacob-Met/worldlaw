import {predictionSensitivity} from './prediction-sensitivity.mjs';
import {evaluate,predict} from './torque-discovery.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
export const SHARED_CERTIFICATE_SCHEMA='worldlaw.shared-training-certificate/v1';
const fields=['command','position','rate','jointTorque'];
const qualification='Numerical checks of the computed fixed-coordinate, fixed-structure least-squares envelope. Engineering arithmetic screens do not certify QR error, global physical feasibility, confidence or law adequacy.';
const cleanRows=rows=>rows.map(row=>Object.fromEntries(fields.map(key=>[key,row[key]])));
// Internal prepared context shared by candidate generation; public certificate
// admission always calls prepareSharedTraining again from raw source inputs.
export function prepareSharedTraining(model,training,receiving,options={}){
 const marginal=predictionSensitivity(model,training,receiving,options);
 if(marginal.status!=='computed')return {marginal,status:'unavailable',reason:marginal.status};
 const admitted=cleanRows(evaluate(model,training).rows),queries=cleanRows(evaluate(model,receiving).rows);
 const source={schema:'worldlaw.shared-training-source/v1',model:{schema:model.schema,terms:model.terms.map(t=>({id:t.id,coefficient:t.coefficient}))},training:admitted,receiving:queries,settings:{...marginal.settings}};
 const columns=model.terms.map(t=>admitted.map(row=>predict({...model,terms:[{id:t.id,coefficient:1}]},row)));
 return {status:'prepared',marginal,model,training:admitted,receiving:queries,columns,sourceKey:JSON.stringify(source)};
}
export function makeSharedCertificate(context,kind,values){
 return {schema:SHARED_CERTIFICATE_SCHEMA,sourceKey:context.sourceKey,kind,values:[...values]};
}
function admittedCertificate(context,certificate){
 if(!certificate||certificate.schema!==SHARED_CERTIFICATE_SCHEMA||!['training-offsets','receiving-separator'].includes(certificate.kind)||typeof certificate.sourceKey!=='string'||!Array.isArray(certificate.values))throw new Error('Malformed shared-training certificate.');
 if(certificate.sourceKey!==context.sourceKey)throw new Error('Certificate source, structure, receiving order or declared radii changed. Recompute from the retained inputs.');
 const expected=certificate.kind==='training-offsets'?context.training.length:context.receiving.length;
 if(certificate.values.length!==expected||certificate.values.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new Error('Certificate must retain one finite value for every source row.');
 const bound=certificate.kind==='training-offsets'?context.marginal.settings.trainingRadius:1;
 if(certificate.values.some(x=>Math.abs(x)>bound))throw new Error('Certificate vector exceeds its declared bound.');
 if(certificate.kind==='receiving-separator'&&!certificate.values.some(x=>x!==0))throw new Error('A separating vector must be nonzero.');
}
function checkSeparator(context,certificate){
 const rows=context.marginal.rows,v=certificate.values,n=context.training.length;
 const projected=Array.from({length:n},(_,i)=>rows.reduce((sum,row,j)=>sum+v[j]*row.influence[i],0));
 const discrepancy=rows.reduce((sum,row,j)=>sum+v[j]*(row.observedTorque-row.refittedPrediction),0);
 const trainingSupport=context.marginal.settings.trainingRadius*projected.reduce((sum,x)=>sum+Math.abs(x),0);
 const receivingSupport=context.marginal.settings.receivingRadius*v.reduce((sum,x)=>sum+Math.abs(x),0);
 const support=trainingSupport+receivingSupport;
 const magnitude=rows.reduce((sum,row,j)=>sum+Math.abs(v[j])*(Math.abs(row.observedTorque)+Math.abs(row.refittedPrediction)),0);
 const uncancelled=rows.reduce((sum,row,j)=>sum+Math.abs(v[j])*row.independentCoefficientBoxRadius,0);
 const underlying=rows.reduce((sum,row,j)=>sum+Math.abs(v[j])*row.numericalTolerance,0);
 const numericalTolerance=underlying+512*Number.EPSILON*Math.max(1,magnitude,support,uncancelled);
 const gap=discrepancy-support;
 if(![...projected,discrepancy,trainingSupport,receivingSupport,support,magnitude,uncancelled,numericalTolerance,gap].every(Number.isFinite))return {status:'unresolved',reason:'separator-numerical-range'};
 return {status:gap>numericalTolerance?'verified-separation':'unresolved',reason:gap>numericalTolerance?'positive-computed-envelope-separation':'no-separated-computed-envelope',receivingCount:rows.length,weights:[...v],trainingProjection:projected,discrepancy,trainingSupport,receivingSupport,support,gap,numericalTolerance};
}
function checkOffsets(context,certificate){
 const offsets=certificate.values,rows=context.marginal.rows,readingRadius=context.marginal.settings.receivingRadius;
 const target=context.training.map((row,i)=>row.jointTorque+offsets[i]);
 let fitted,refittedRows;
 try{
  fitted=fitLinearColumns(context.columns,target);
  if(!fitted)return {status:'unresolved',reason:'independent-refit-rank-unavailable'};
  const refitted={...context.model,terms:context.model.terms.map((term,i)=>({id:term.id,coefficient:fitted.coefficients[i]}))};
  refittedRows=evaluate(refitted,context.receiving).rows;
 }catch{return {status:'unresolved',reason:'independent-refit-refused'};}
 const checked=[];
 for(let j=0;j<rows.length;j++){
  const row=rows[j],terms=row.influence.map((value,i)=>value*offsets[i]);
  const reconstructed=row.refittedPrediction+terms.reduce((sum,x)=>sum+x,0),refitted=refittedRows[j].prediction;
  const scale=Math.max(1,Math.abs(row.observedTorque),Math.abs(reconstructed),Math.abs(refitted),terms.reduce((sum,x)=>sum+Math.abs(x),0));
  const numericalTolerance=row.numericalTolerance+512*Number.EPSILON*scale;
  const linearMargin=readingRadius-Math.abs(row.observedTorque-reconstructed),refitMargin=readingRadius-Math.abs(row.observedTorque-refitted),agreementError=Math.abs(refitted-reconstructed);
  if(![reconstructed,refitted,numericalTolerance,linearMargin,refitMargin,agreementError].every(Number.isFinite))return {status:'unresolved',reason:'witness-numerical-range'};
  checked.push({index:j,reconstructedPrediction:reconstructed,refittedPrediction:refitted,observedTorque:row.observedTorque,linearMargin,refitMargin,agreementError,numericalTolerance,strictInterior:linearMargin>numericalTolerance&&refitMargin>numericalTolerance&&agreementError<=numericalTolerance});
 }
 const accepted=checked.every(row=>row.strictInterior);
 return {status:accepted?'verified-interior-witness':'unresolved',reason:accepted?'one-offset-vector-received-by-every-original-box':readingRadius===0?'zero-radius-contact-is-not-certified':checked.some(row=>row.agreementError>row.numericalTolerance)?'influence-and-independent-refit-disagree':'candidate-outside-or-near-original-boundary',receivingCount:checked.length,offsets:[...offsets],refittedCoefficients:[...fitted.coefficients],rows:checked};
}
// Trusted-context internal helper. Never admit an imported prepared context.
export function checkPreparedCertificate(context,certificate){
 if(context.status!=='prepared')return {status:'unresolved',reason:context.reason,qualification};
 admittedCertificate(context,certificate);
 return {...(certificate.kind==='training-offsets'?checkOffsets(context,certificate):checkSeparator(context,certificate)),qualification};
}
export function checkSharedTrainingCertificate(model,training,receiving,options,certificate){
 const context=prepareSharedTraining(model,training,receiving,options);
 return checkPreparedCertificate(context,certificate);
}
