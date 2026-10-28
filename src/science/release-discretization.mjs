import {compareReleasePerturbations} from './release-perturbations.mjs';

/** Execute a second course, never interpolate or relabel an unchanged fixed run.
 * Power-of-two refinement preserves original binary64 i*dt reporting times. */
export function screenReleaseDiscretization(discovery,initial,displacement,settings,scales,allowance){
 if(!Number.isFinite(allowance)||allowance<0)throw Error('Declare a nonnegative numerical difference allowance');
 const originalSettings={...settings,dt:settings.dt??.01};
 const refinedSettings={...originalSettings,dt:originalSettings.dt/4};
 if(!(refinedSettings.dt>0&&refinedSettings.dt<originalSettings.dt&&refinedSettings.dt*4===originalSettings.dt))throw Error('Fourfold interval refinement is not representable');
 for(const [key,fallback]of [['relativeTolerance',1e-8],['positionTolerance',1e-10],['rateTolerance',1e-10]]){
  const value=originalSettings[key]??fallback;refinedSettings[key]=Math.max(1e-14,value/100);
 }
 const policy={...scales,maxTotalEvaluations:120000};
 const original=compareReleasePerturbations(discovery,initial,displacement,originalSettings,policy);
 const refined=compareReleasePerturbations(discovery,initial,displacement,refinedSettings,policy);
 const assessment=original.baseline.results.map(row=>({index:row.index,method:row.diagnostics?.method??null,
  stepRefinement:row.status==='completed',toleranceRefinement:row.status==='completed'&&row.diagnostics?.method==='adaptive_RK4_step_doubling'&&['relativeTolerance','positionTolerance','rateTolerance'].some(key=>refinedSettings[key]<(originalSettings[key]??({relativeTolerance:1e-8,positionTolerance:1e-10,rateTolerance:1e-10}[key])))}));
 const base={schema:'worldlaw.release-discretization/v1',original,refined,assessment,allowance,refinementFactor:4,maxTotalEvaluations:240000,
  interpretation:'Fourfold output interval refinement and tighter supported smooth-law tolerances. Fixed RK4 integration steps also shrink. Differences compare identical original times only; agreement is not convergence, a global error bound, or physical validation.'};
 if(original.status!=='completed'||refined.status!=='completed')return {...base,status:'incomplete'};
 let maximumDifference=0,witness=null;
 const matched=original.results.map((law,index)=>{
  const fineByTime=new Map(refined.results[index].samples.map(row=>[row.time,row]));
  const samples=law.samples.map(row=>{
   const fine=fineByTime.get(row.time);if(!fine)throw Error('Refined course does not contain every exact original sample time');
   for(const side of ['positive','negative']){const difference=Math.abs(row[side]-fine[side]);if(difference>maximumDifference){maximumDifference=difference;witness={index,time:row.time,side,original:row[side],refined:fine[side]};}}
   return {...fine};
  });return {index,id:law.id,samples};
 });
 return {...base,status:maximumDifference>allowance?'numerically-sensitive':'within-declared-difference',maximumDifference,witness,matchedRefined:matched};
}
