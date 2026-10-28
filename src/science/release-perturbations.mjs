// Reconstructed R2 after source reset. Uses actual maintained executors.
import {compareStudioDynamics,STUDIO_COMPARISON_LIMITS as LIMITS} from './studio-dynamics-comparison.mjs';
export function compareReleasePerturbations(discovery,initial,displacement,settings={},policy={}) {
 if(!Array.isArray(discovery?.competitive)||!discovery.competitive.length)throw new TypeError('Supply original competitive laws');
 for(const k of ['position','rate'])if(!Number.isFinite(initial?.[k])||!Number.isFinite(displacement?.[k]))throw new TypeError('Declare finite release and perturbation coordinates');
 const positionScale=policy.positionScale,rateScale=policy.rateScale;
 if(!Number.isFinite(positionScale)||positionScale<=0||!Number.isFinite(rateScale)||rateScale<=0)throw new TypeError('Declare positive finite angle and rate scales');
 const norm=(q,v)=>Math.hypot(q/positionScale,v/rateScale),initialDistance=norm(displacement.position,displacement.rate);
 if(!Number.isFinite(initialDistance)||initialDistance===0)throw new RangeError('Declare a nonzero resolved perturbation');
 const plus={position:initial.position+displacement.position,rate:initial.rate+displacement.rate},minus={position:initial.position-displacement.position,rate:initial.rate-displacement.rate};
 if(['position','rate'].some(k=>displacement[k]!==0&&(plus[k]===initial[k]||minus[k]===initial[k])))throw new RangeError('Perturbation is not representable at this release');
 const executedDistances={positive:norm(plus.position-initial.position,plus.rate-initial.rate),negative:norm(minus.position-initial.position,minus.rate-initial.rate)};
 if(Object.values(executedDistances).some(x=>!Number.isFinite(x)||x===0))throw new RangeError('Executed perturbation distance is unresolved');
 const budget=policy.maxTotalEvaluations??LIMITS.maxTotalEvaluations;
 if(!Number.isSafeInteger(budget)||budget<3||budget>LIMITS.maxTotalEvaluations)throw new RangeError('Invalid complete-course evaluation budget');
 const run=start=>compareStudioDynamics(discovery,start,settings,{maxTotalEvaluations:Math.floor(budget/3),maxTotalSamples:Math.floor(LIMITS.maxTotalSamples/3)});
 const baseline=run(initial),positive=run(plus),negative=run(minus),complete=[baseline,positive,negative].every(x=>x.status==='completed');
 const base={schema:'worldlaw.release-perturbations/v1',status:complete?'completed':'incomplete',initial:{...initial},displacement:{...displacement},scales:{position:positionScale,rate:rateScale},initialDistance,executedDistances,baseline,positive,negative,interpretation:'Executed finite-amplitude release differences in explicitly scaled coordinates. Not a variational derivative, global bound, calibrated uncertainty or stability proof.'};
 if(!complete)return base;
 const results=baseline.results.map((row,index)=>{let maximumAmplification=0,maximumTime=0,maximumSide=null;
 const samples=row.trajectory.map((p,i)=>{const values={};for(const [side,course]of [['positive',positive],['negative',negative]]){const q=course.results[index].trajectory[i];const amplification=norm(q.position-p.position,q.rate-p.rate)/executedDistances[side];if(!Number.isFinite(amplification))throw new RangeError('Scaled difference overflowed');values[side]=amplification;if(amplification>maximumAmplification){maximumAmplification=amplification;maximumTime=p.time;maximumSide=side;}}return {time:p.time,...values};});
 return {index,id:row.id,samples,maximumAmplification,maximumTime,maximumSide};});
 return {...base,results};
}

