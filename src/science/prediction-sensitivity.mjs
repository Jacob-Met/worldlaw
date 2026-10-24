import {parameterSensitivity} from './parameter-sensitivity.mjs';
import {evaluate,predict} from './torque-discovery.mjs';
export const MAX_RECEIVING_ROWS=128;
const fields=['command','position','rate'];
function radii(options){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['trainingRadius','receivingRadius'].includes(k)))throw new Error('Declare trainingRadius and receivingRadius only.');
 const result={trainingRadius:Object.hasOwn(options,'trainingRadius')?options.trainingRadius:.01,receivingRadius:Object.hasOwn(options,'receivingRadius')?options.receivingRadius:.01};
 for(const [key,value] of Object.entries(result))if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e6)throw new Error(`${key} must be finite and in [0,1000000] N·m.`);
 return result;
}
export function predictionSensitivity(model,training,receiving,options={}){
 const settings=radii(options),checked=evaluate(model,receiving);
 const base={schema:'worldlaw.prediction-sensitivity/v1',trainingCount:training?.length,receivingCount:checked.count,settings,maxReceivingRows:MAX_RECEIVING_ROWS,
 interpretation:'Fixed-coordinate, fixed-structure least-squares response to bounded training-reading changes. Each receiving row has its own extremal perturbation; overlap for every row does not establish one common perturbation explaining them all. Not a confidence interval, feasible-law set, or physical qualification.',
 numericalQualification:'Floating-point QR and linear arithmetic, not certified interval arithmetic. The reported boundary tolerance is an engineering roundoff screen, not a proof of numerical accuracy.'};
 if(checked.count>MAX_RECEIVING_ROWS)return {...base,status:'receiving-work-limit',rows:[]};
 const parameters=parameterSensitivity(model,training,settings.trainingRadius);
 if(parameters.status!=='computed')return {...base,status:parameters.status,rows:[]};
 if(!checked.count)return {...base,status:'no-receiving-observations',rows:[]};
 const admitted=evaluate(model,training).rows;
 const domain=Object.fromEntries(fields.map(k=>[k,{min:Math.min(...admitted.map(r=>r[k])),max:Math.max(...admitted.map(r=>r[k]))}]));
 const refitted={...model,terms:parameters.coefficients.map(c=>({id:c.id,coefficient:c.refittedCoefficient}))};
 const rows=checked.rows.map((observation,index)=>{
  const input=Object.fromEntries(fields.map(k=>[k,observation[k]]));
  const features=parameters.coefficients.map(c=>predict({...model,terms:[{id:c.id,coefficient:1}]},input));
  const influence=admitted.map((_,i)=>parameters.coefficients.reduce((sum,c,j)=>sum+features[j]*c.influence[i],0));
  const radius=settings.trainingRadius*influence.reduce((sum,w)=>sum+Math.abs(w),0);
  const center=predict(refitted,input);
  const independentCoefficientBoxRadius=parameters.coefficients.reduce((sum,c,j)=>sum+Math.abs(features[j])*c.radius,0);
  const absoluteEvaluation=parameters.coefficients.reduce((sum,c,j)=>sum+Math.abs(features[j]*c.refittedCoefficient),0);
  const prediction=[center-radius,center+radius],observed=[observation.jointTorque-settings.receivingRadius,observation.jointTorque+settings.receivingRadius];
  const numericalTolerance=256*Number.EPSILON*Math.max(1,absoluteEvaluation,radius,independentCoefficientBoxRadius,Math.abs(observation.jointTorque),settings.receivingRadius);
  const gap=Math.max(prediction[0]-observed[1],observed[0]-prediction[1]);
  if(![center,radius,independentCoefficientBoxRadius,absoluteEvaluation,numericalTolerance,gap,...prediction,...observed,...influence].every(Number.isFinite))throw new Error('Prediction sensitivity arithmetic overflowed; no partial course is reported.');
  return {index,input,inspectedPrediction:observation.prediction,refittedPrediction:center,observedTorque:observation.jointTorque,prediction,observation:observed,radius,independentCoefficientBoxRadius,influence,upperWitnessOffsets:influence.map(w=>Math.sign(w)*settings.trainingRadius),extrapolation:fields.filter(k=>input[k]<domain[k].min||input[k]>domain[k].max),gap,numericalTolerance,status:gap>numericalTolerance?'outside':gap>=-numericalTolerance?'numerical-boundary':'not-excluded'};
 });
 return {...base,status:'computed',domain,terms:parameters.terms,rows,outsideCount:rows.filter(r=>r.status==='outside').length,boundaryCount:rows.filter(r=>r.status==='numerical-boundary').length,notExcludedCount:rows.filter(r=>r.status==='not-excluded').length};
}
