import {predictionSensitivity,MAX_RECEIVING_ROWS} from './prediction-sensitivity.mjs';
export const MAX_CONTRAST_PAIRS=MAX_RECEIVING_ROWS*(MAX_RECEIVING_ROWS-1)/2;
const interpretation='Pairwise necessary compatibility checks under one shared training-reading perturbation. An outside result flags a contradiction in the computed contrast envelope, subject to the numerical qualification below; passing every pair does not establish one perturbation explaining all rows. Fixed coordinates and structure; not joint feasibility, confidence or physical qualification.';
const numericalQualification='Floating-point influence differences with an engineering cancellation screen, not certified interval arithmetic or a bound on all QR error.';
export function predictionContrasts(model,training,receiving,options={}){
 const marginal=predictionSensitivity(model,training,receiving,options);
 const base={schema:'worldlaw.prediction-contrast/v1',marginal,contrastAssessed:false,receivingCount:marginal.receivingCount,expectedPairCount:marginal.receivingCount*(marginal.receivingCount-1)/2,maxPairs:MAX_CONTRAST_PAIRS,interpretation,numericalQualification,pairs:[]};
 if(marginal.status!=='computed')return {...base,status:'marginal-unavailable',reason:marginal.status};
 if(marginal.rows.length<2)return {...base,status:'insufficient-pairs'};
 if(base.expectedPairCount>MAX_CONTRAST_PAIRS)return {...base,status:'contrast-work-limit'};
 const pairs=[],readingRadius=marginal.settings.receivingRadius,trainingRadius=marginal.settings.trainingRadius;
 for(let a=0;a<marginal.rows.length;a++)for(let b=a+1;b<marginal.rows.length;b++){
  const first=marginal.rows[a],second=marginal.rows[b];
  let amplification=0;const signs=[];
  for(let i=0;i<first.influence.length;i++){
   const weight=first.influence[i]-second.influence[i];
   amplification+=Math.abs(weight);signs.push(weight>0?'+':weight<0?'-':'0');
  }
  const center=first.refittedPrediction-second.refittedPrediction;
  const radius=trainingRadius*amplification;
  const observedCenter=first.observedTorque-second.observedTorque;
  const observedRadius=2*readingRadius;
  const prediction=[center-radius,center+radius],observation=[observedCenter-observedRadius,observedCenter+observedRadius];
  // Retain the pre-cancellation scale and both underlying arithmetic screens.
  const uncancelledRadius=first.independentCoefficientBoxRadius+second.independentCoefficientBoxRadius;
  const numericalTolerance=first.numericalTolerance+second.numericalTolerance+256*Number.EPSILON*Math.max(1,Math.abs(first.refittedPrediction),Math.abs(second.refittedPrediction),Math.abs(first.observedTorque),Math.abs(second.observedTorque),uncancelledRadius,radius,observedRadius);
  const gap=Math.max(prediction[0]-observation[1],observation[0]-prediction[1]);
  if(![amplification,center,radius,observedCenter,observedRadius,uncancelledRadius,numericalTolerance,gap,...prediction,...observation].every(Number.isFinite))return {...base,status:'contrast-numerical-failure',reason:'nonfinite_pair_arithmetic'};
  pairs.push({index:pairs.length,firstRow:a,secondRow:b,orientation:'first minus second',center,radius,prediction,observedCenter,observedRadius,observation,amplification,uncancelledRadius,gap,numericalTolerance,status:gap>numericalTolerance?'outside':gap>=-numericalTolerance?'numerical-boundary':'not-excluded',upperWitnessSigns:signs.join('')});
 }
 return {...base,status:'computed',contrastAssessed:true,pairs,outsideCount:pairs.filter(p=>p.status==='outside').length,boundaryCount:pairs.filter(p=>p.status==='numerical-boundary').length,notExcludedCount:pairs.filter(p=>p.status==='not-excluded').length};
}
// Decode only a selected witness from a freshly computed report; this is never
// a saved-result admission or source-replay mechanism.
export function contrastWitness(report,pairIndex){
 if(report?.schema!=='worldlaw.prediction-contrast/v1'||report.status!=='computed'||!Number.isSafeInteger(pairIndex)||pairIndex<0||pairIndex>=report.pairs.length)throw new Error('Choose a computed contrast pair.');
 const pair=report.pairs[pairIndex],signs=pair.upperWitnessSigns,radius=report.marginal.settings.trainingRadius;
 if(typeof signs!=='string'||signs.length!==report.marginal.trainingCount||!/^[+0-]*$/.test(signs)||!Number.isFinite(radius)||radius<0)throw new Error('Malformed contrast witness.');
 const upperWitnessOffsets=Array.from(signs,s=>s==='+'?radius:s==='-'?-radius:0);
 return {firstRow:pair.firstRow,secondRow:pair.secondRow,orientation:pair.orientation,upperWitnessOffsets,lowerWitnessOffsets:upperWitnessOffsets.map(v=>-v)};
}
