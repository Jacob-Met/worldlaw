import {compareReleasePerturbations} from './release-perturbations.mjs';
import {outputIntervalCount} from './output-grid.mjs';

/** Execute the complete requested sequence of grids. Similar maxima on these
 * finite grids do not certify a continuous-time maximum or convergence. */
export function investigateReleasePeaks(discovery,initial,displacement,settings,scales,{levels=3,allowance=.01}={}){
 if(!Number.isInteger(levels)||levels<2||levels>4||!Number.isFinite(allowance)||allowance<0)throw Error('Declare 2–4 grids and a nonnegative amplification difference allowance');
 if(!Array.isArray(discovery?.competitive)||!discovery.competitive.length)throw Error('Retain the complete original competitive-law set');
 const dt=settings?.dt??.01,duration=settings?.duration??4;
 if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(duration)||duration<=0)throw Error('Declare finite positive duration and interval');
 const declarations=Array.from({length:levels},(_,level)=>{
  const factor=4**level,step=dt/factor;if(!(step>0&&step*factor===dt))throw Error('The requested dyadic grid is not representable');
  const declaration={...settings,dt:step,duration};
  for(const [key,fallback]of [['relativeTolerance',1e-8],['positionTolerance',1e-10],['rateTolerance',1e-10]])declaration[key]=Math.max(1e-14,(settings?.[key]??fallback)/(100**level));
  return declaration;
 });
 const sampleCounts=declarations.map(s=>outputIntervalCount(duration,s.dt)+1);
 const requestedSamples=sampleCounts.reduce((a,b)=>a+b,0)*3*discovery.competitive.length;
 const base={schema:'worldlaw.release-peak-resolution/v1',levels,allowance,declarations,requestedSamples,maxTotalSamples:20000,maxTotalEvaluations:240000,
  interpretation:'Complete bounded grid refinement of finite-release amplification. Shared-time discrepancies and newly sampled peaks are separate. No continuous-time maximum, convergence, global numerical error, stability or physical validity is established.'};
 if(sampleCounts.some(n=>!Number.isSafeInteger(n)||n<2||n>10001)||requestedSamples>20000)return {...base,status:'work-limit',courses:[],transitions:[]};
 const budget=Math.floor(240000/levels);
 const courses=declarations.map(s=>compareReleasePerturbations(discovery,initial,displacement,s,{...scales,maxTotalEvaluations:budget}));
 if(courses.some(c=>c.status!=='completed'))return {...base,status:'incomplete',courses,transitions:[]};
 let sharedMaximum=0,peakMaximum=0;
 const transitions=courses.slice(1).map((fine,index)=>{
  const coarse=courses[index];
  const laws=coarse.results.map((law,j)=>{
   const byTime=new Map(fine.results[j].samples.map(r=>[r.time,r]));let sharedDifference=0,sharedWitness=null;
   for(const row of law.samples){const other=byTime.get(row.time);if(!other)throw Error('Requested fine grid lost an exact earlier reporting time');for(const side of ['positive','negative']){const difference=Math.abs(row[side]-other[side]);if(difference>sharedDifference){sharedDifference=difference;sharedWitness={time:row.time,side,coarse:row[side],fine:other[side]};}}}
   const next=fine.results[j],peakDifference=Math.abs(next.maximumAmplification-law.maximumAmplification);
   sharedMaximum=Math.max(sharedMaximum,sharedDifference);peakMaximum=Math.max(peakMaximum,peakDifference);
   return {index:j,id:law.id,sharedDifference,sharedWitness,peakDifference,
    coarsePeak:{value:law.maximumAmplification,time:law.maximumTime,side:law.maximumSide},finePeak:{value:next.maximumAmplification,time:next.maximumTime,side:next.maximumSide}};
  });return {fromLevel:index,toLevel:index+1,laws};
 });
 return {...base,status:peakMaximum>allowance?'sampled-peak-sensitive':sharedMaximum>allowance?'shared-time-sensitive':'within-declared-differences',courses,transitions,maximumSharedDifference:sharedMaximum,maximumPeakDifference:peakMaximum};
}
