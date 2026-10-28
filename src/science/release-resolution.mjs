import {compareReleasePerturbations as compare} from './release-perturbations.mjs';
export function screenReleaseResolution(discovery,initial,displacement,settings,scales,allowance){
 if(!Number.isFinite(allowance)||allowance<0)throw new RangeError('Declare nonnegative numerical difference allowance');
 const tighter={...settings};
 for(const [k,f]of [['relativeTolerance',1e-8],['positionTolerance',1e-10],['rateTolerance',1e-10]]){const v=settings[k]??f;tighter[k]=Math.max(1e-14,v/100);if(!(tighter[k]<v))throw new RangeError('Two distinct supported tolerances required');}
 const policy={...scales,maxTotalEvaluations:120000},original=compare(discovery,initial,displacement,settings,policy),refined=compare(discovery,initial,displacement,tighter,policy);
 const assessment=original.baseline.results.map(r=>({index:r.index,method:r.diagnostics?.method??null,toleranceRefinement:r.status==='completed'&&r.diagnostics?.method==='adaptive_RK4_step_doubling'}));
 const base={assessment,schema:'worldlaw.release-resolution/v1',original,refined,allowance,maxTotalEvaluations:240000,interpretation:'Two tolerance declarations applied to the same finite-amplitude releases. Agreement is not convergence or a numerical error bound.'};
 if(original.status!=='completed'||refined.status!=='completed')return {...base,status:'incomplete'};
 let maximumDifference=0,witness=null;
 for(let j=0;j<original.results.length;j++)for(let i=0;i<original.results[j].samples.length;i++)for(const side of ['positive','negative']){
 const a=original.results[j].samples[i],b=refined.results[j].samples[i],difference=Math.abs(a[side]-b[side]);
 if(difference>maximumDifference){maximumDifference=difference;witness={index:j,time:a.time,side,original:a[side],refined:b[side]};}}
 return {...base,status:maximumDifference>allowance?'numerically-sensitive':assessment.every(r=>r.toleranceRefinement)?'within-declared-difference':assessment.some(r=>r.toleranceRefinement)?'partially-assessed':'not-assessed',maximumDifference,witness};
}

