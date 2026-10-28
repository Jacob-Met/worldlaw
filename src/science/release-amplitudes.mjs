import {compareReleasePerturbations} from './release-perturbations.mjs';
import {outputIntervalCount} from './output-grid.mjs';

/** Execute two finite release magnitudes using identical declared numerics.
 * Differences include numerical error; agreement does not establish a derivative. */
export function investigateReleaseAmplitudes(discovery,initial,displacement,settings={},scales={}, {shrinkFactor=2,allowance=.01}={}){
 if(![2,4,8].includes(shrinkFactor)||!Number.isFinite(allowance)||allowance<0)throw Error('Declare a shrink factor of 2, 4 or 8 and a nonnegative difference allowance');
 if(!Array.isArray(discovery?.competitive)||!discovery.competitive.length)throw Error('Retain the complete original competitive-law set');
 for(const key of ['position','rate'])if(!Number.isFinite(displacement?.[key]))throw Error('Declare finite displacement coordinates');
 const smaller=Object.fromEntries(['position','rate'].map(key=>[key,displacement[key]/shrinkFactor]));
 for(const key of ['position','rate'])if(smaller[key]*shrinkFactor!==displacement[key])throw Error('The requested displacement reduction is not representable');
 const declarations=[{...displacement},smaller],dt=settings.dt??.01,duration=settings.duration??4;
 for(const key of ['position','rate'])if(!Number.isFinite(initial?.[key]))throw Error('Declare finite initial coordinates');
 if(!Number.isFinite(scales.positionScale)||scales.positionScale<=0||!Number.isFinite(scales.rateScale)||scales.rateScale<=0)throw Error('Declare positive finite coordinate scales');
 const representedDisplacements=declarations.map(d=>Object.fromEntries([['positive',1],['negative',-1]].map(([side,sign])=>{
  const delta=Object.fromEntries(['position','rate'].map(key=>{const start=initial[key]+sign*d[key];if(!Number.isFinite(start)||(d[key]!==0&&start===initial[key]))throw Error('Both release magnitudes must be representable at the initial state');return [key,start-initial[key]];}));
  const distance=Math.hypot(delta.position/scales.positionScale,delta.rate/scales.rateScale);if(!Number.isFinite(distance)||distance===0)throw Error('Both represented release distances must be finite and nonzero');
  return [side,delta];
 })));
 if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(duration)||duration<=0)throw Error('Declare finite positive duration and interval');
 const perPath=outputIntervalCount(duration,dt)+1,requestedSamples=perPath*6*discovery.competitive.length;
 const base={schema:'worldlaw.release-amplitudes/v1',shrinkFactor,allowance,declarations,settings:{...settings,dt,duration},requestedSamples,maxTotalSamples:20000,maxTotalEvaluations:240000,
  interpretation:'Two executed finite release magnitudes using the same declared integration and reporting settings. Scaled amplification uses each represented signed start distance. Differences can include numerical error and rounding of release direction; they do not isolate nonlinear physics. Agreement is not an infinitesimal derivative, convergence, stability or physical validation.'};
 if(!Number.isSafeInteger(perPath)||perPath<2||perPath>10001||requestedSamples>20000)return {...base,status:'work-limit',courses:[],laws:[]};
 // Both full three-path courses retain every original competitor and failure.
 const courses=declarations.map(d=>compareReleasePerturbations(discovery,initial,d,base.settings,{...scales,maxTotalEvaluations:120000}));
 if(courses.some(c=>c.status!=='completed'))return {...base,status:'incomplete',courses,representedDisplacements,laws:[]};
 let maximumDifference=0,witness=null;
 const laws=courses[0].results.map((row,index)=>{
  const smallerByTime=new Map(courses[1].results[index].samples.map(s=>[s.time,s]));let lawMaximum=0,lawWitness=null;
  for(const sample of row.samples){const other=smallerByTime.get(sample.time);if(!other)throw Error('Release magnitudes lost an exact common reporting time');
   for(const side of ['positive','negative']){const difference=Math.abs(sample[side]-other[side]);if(difference>lawMaximum){lawMaximum=difference;lawWitness={index,time:sample.time,side,original:sample[side],smaller:other[side]};}}
  }
  if(lawMaximum>maximumDifference){maximumDifference=lawMaximum;witness=lawWitness;}
  return {index,id:row.id,maximumDifference:lawMaximum,witness:lawWitness};
 });
 return {...base,status:maximumDifference>allowance?'release-magnitude-sensitive':'within-declared-difference',courses,representedDisplacements,laws,maximumDifference,witness};
}
