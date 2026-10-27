import {predictionSensitivity} from './prediction-sensitivity.mjs';
import {evaluate,TERMS} from './torque-discovery.mjs';
import {screenIntervalPairs,selectSeparatingCandidate} from '../experiment-design/interval-separation.mjs';
export function planTrainingResponse(discovery,inputs,radii,trainingRadius){
 if(!Number.isFinite(trainingRadius)||trainingRadius<0||trainingRadius>1e6)throw Error('Declare a finite original-reading radius from 0 to 1000000 N·m.');
 if(['command','position','rate'].some(k=>radii[k]!==0))throw Error('Training-response planning requires exact coordinates; coordinate bounds are not dropped.');
 if((discovery.options.loss??'least_squares')!=='least_squares')throw Error('Training-response planning requires ordinary least squares.');
 if(!Number.isFinite(radii.jointTorque)||radii.jointTorque<0||radii.jointTorque>1e6)throw Error('Declare a valid future reading radius.');
 const models=discovery.competitive,training=discovery.observations;
 if(!Array.isArray(inputs)||!inputs.length||!models.length)throw Error('Provide original offered inputs and competing models.');
 const evaluations=models.length*inputs.length,products=evaluations*training.length,pairComparisons=inputs.length*models.length*(models.length-1)/2;
 const base={method:'training_response_separation',trainingRadius,radii:{...radii},evaluations,products,pairComparisons,modelIds:models.map(m=>m.id),selected:null,ranked:[]};
 if(inputs.length>128||training.length>256||evaluations>8192||products>1048576||pairComparisons>65536)return {...base,status:'work-limit'};
 evaluate(models[0],inputs.map(x=>({...x,jointTorque:0})));
 if(models.some(m=>!m.terms.length||m.terms.some(t=>!TERMS.some(x=>x.id===t.id))))return {...base,status:'training-unavailable',reason:'Every candidate must have a nonempty maintained named-term structure.'};
 // Zero response is solely a query adapter for the maintained influence routine;
 // it never enters training or supplies an acquired reading.
 const reports=models.map(m=>predictionSensitivity(m,training,inputs.map(x=>({...x,jointTorque:0})),{trainingRadius,receivingRadius:radii.jointTorque}));
 if(reports.some(r=>r.status!=='computed'))return {...base,status:'training-unavailable',reason:'At least one complete candidate response is unavailable.',outcomes:reports.map((r,i)=>({id:models[i].id,status:r.status}))};
 const ranked=inputs.map((input,index)=>{
  const intervals=reports.map((r,i)=>{const x=r.rows[index];return {id:models[i].id,interval:[x.prediction[0]-x.numericalTolerance,x.prediction[1]+x.numericalTolerance]};});
  const pairs=screenIntervalPairs(intervals,radii.jointTorque),separated=pairs.filter(p=>p.separable).length;
  return {index,input:Object.fromEntries(['command','position','rate'].map(k=>[k,input[k]])),intervals,pairs,separated,allSeparated:pairs.length>0&&separated===pairs.length,withinBudget:true,cost:1,extrapolation:[...new Set(reports.flatMap(r=>r.rows[index].extrapolation))],disagreement:Math.max(...intervals.map(x=>x.interval[1]))-Math.min(...intervals.map(x=>x.interval[0]))};
 });
 const selected=selectSeparatingCandidate(ranked,'index','cost');return {...base,status:selected?'proposed':'uninformative',ranked,selected,separation:selected?.allSeparated?'full':selected?'partial':'none'};
}

export function receiveTrainingResponse(discovery,rows,radii,trainingRadius,used=0){
 const requested=2*discovery.competitive.length*rows.length;
 const base={trainingRadius,receivingRadius:radii.jointTorque,requested,evaluations:0,modelCount:discovery.competitive.length};
 if(!Number.isSafeInteger(used)||used<0||used+requested>8192)return {...base,status:'unavailable',reason:'Cumulative complete receiving work exceeds 8192 model-row evaluations.'};
 try{
  const admission=planTrainingResponse(discovery,rows,radii,trainingRadius);
  if(!['proposed','uninformative'].includes(admission.status))return {...base,evaluations:admission.status==='work-limit'?0:requested,status:'unavailable',reason:admission.reason??admission.status};
  // Retain counts only; raw sources reconstruct every selected-model detail.
  const summaries=discovery.competitive.map(m=>{const p=predictionSensitivity(m,discovery.observations,rows,{trainingRadius,receivingRadius:radii.jointTorque});return {id:m.id,outside:p.outsideCount,boundary:p.boundaryCount,rows:p.rows.length};});
  const excluded=summaries.filter(m=>m.outside>0).length;
  return {...base,evaluations:requested,status:excluded===summaries.length?'all-excluded':'not-all-excluded',excluded,summaries};
 }catch(error){return {...base,evaluations:requested,status:'unavailable',reason:error.message};}
}
