import {compareReleasePerturbations} from './release-perturbations.mjs';
import {outputIntervalCount} from './output-grid.mjs';

/** Execute two declared scaled-orthogonal finite release directions.
 * Differences include numerical error; agreement does not establish a derivative. */
export function investigateReleaseDirections(discovery,initial,displacement,settings={},scales={}, {allowance=.01}={}){
 if(!Number.isFinite(allowance)||allowance<0)throw Error('Declare a nonnegative finite difference allowance');
 if(!Array.isArray(discovery?.competitive)||!discovery.competitive.length)throw Error('Retain the complete original competitive-law set');
 for(const key of ['position','rate'])if(!Number.isFinite(displacement?.[key]))throw Error('Declare finite displacement coordinates');
 for(const key of ['position','rate'])if(!Number.isFinite(initial?.[key]))throw Error('Declare finite initial coordinates');
 if(!Number.isFinite(scales.positionScale)||scales.positionScale<=0||!Number.isFinite(scales.rateScale)||scales.rateScale<=0)throw Error('Declare positive finite coordinate scales');
 const transverse={position:-(displacement.rate/scales.rateScale)*scales.positionScale,rate:(displacement.position/scales.positionScale)*scales.rateScale};
 if(!Number.isFinite(transverse.position)||!Number.isFinite(transverse.rate)||(displacement.rate!==0&&transverse.position===0)||(displacement.position!==0&&transverse.rate===0))throw Error('The scaled perpendicular release is not representable');
 const declarations=[{...displacement},transverse],dt=settings.dt??.01,duration=settings.duration??4;
 const representedDisplacements=declarations.map(d=>Object.fromEntries([['positive',1],['negative',-1]].map(([side,sign])=>{
  const delta=Object.fromEntries(['position','rate'].map(key=>{const start=initial[key]+sign*d[key];if(!Number.isFinite(start)||(d[key]!==0&&start===initial[key]))throw Error('Both release directions must be representable at the initial state');return [key,start-initial[key]];}));
  const distance=Math.hypot(delta.position/scales.positionScale,delta.rate/scales.rateScale);if(!Number.isFinite(distance)||distance===0)throw Error('Both represented release distances must be finite and nonzero');
  return [side,delta];
 })));
 if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(duration)||duration<=0)throw Error('Declare finite positive duration and interval');
 const perPath=outputIntervalCount(duration,dt)+1,requestedSamples=perPath*6*discovery.competitive.length;
 const base={schema:'worldlaw.release-directions/v1',allowance,declarations,settings:{...settings,dt,duration},requestedSamples,maxTotalSamples:20000,maxTotalEvaluations:240000,
  interpretation:'Two executed finite directions: the declared release and a quarter-turn in the declared scaled position/rate plane. The requested scaled lengths agree in exact arithmetic; represented signed starts can differ through rounding. This is not a search or bound over all directions. Scaled amplification uses each represented signed start distance. Differences can include numerical error and rounding of release direction; they do not isolate nonlinear physics. Agreement is not an infinitesimal derivative, convergence, stability or physical validation.'};
 if(!Number.isSafeInteger(perPath)||perPath<2||perPath>10001||requestedSamples>20000)return {...base,status:'work-limit',courses:[],laws:[]};
 // Both full three-path direction courses retain every original competitor and failure.
 const courses=declarations.map(d=>compareReleasePerturbations(discovery,initial,d,base.settings,{...scales,maxTotalEvaluations:120000}));
 if(courses.some(c=>c.status!=='completed'))return {...base,status:'incomplete',courses,representedDisplacements,laws:[]};
 let maximumDifference=0,witness=null;
 const laws=courses[0].results.map((row,index)=>{
  const transverseByTime=new Map(courses[1].results[index].samples.map(s=>[s.time,s]));let lawMaximum=0,lawWitness=null;
  for(const sample of row.samples){const other=transverseByTime.get(sample.time);if(!other)throw Error('Release directions lost an exact common reporting time');
   for(const side of ['positive','negative']){const difference=Math.abs(sample[side]-other[side]);if(difference>lawMaximum){lawMaximum=difference;lawWitness={index,time:sample.time,side,original:sample[side],perpendicular:other[side]};}}
  }
  if(lawMaximum>maximumDifference){maximumDifference=lawMaximum;witness=lawWitness;}
  return {index,id:row.id,maximumDifference:lawMaximum,witness:lawWitness};
 });
 return {...base,status:maximumDifference>allowance?'release-direction-sensitive':'within-declared-difference',courses,representedDisplacements,laws,maximumDifference,witness};
}
