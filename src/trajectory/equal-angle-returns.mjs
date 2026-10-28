import {inspectCycleWorkHalves} from './cycle-work.mjs';
import {fitAngularWindow} from '../science/angular-kinematics.mjs';
export const EQUAL_ANGLE_RETURN_SCHEMA='worldlaw.equal-angle-returns/v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const insist=(ok,message)=>{if(!ok)throw Error(message);};
const finite=Number.isFinite;
function groups(samples,first,last){
 const map=new Map();
 for(let i=first;i<=last;i++){const q=samples[i].position;if(!map.has(q))map.set(q,[]);map.get(q).push(i);}
 return map;
}
function offersFor(record,samples){
 const offers=[];
 for(const cycle of record.cycles){
  const base={runId:record.runId,cycleIndex:cycle.cycleIndex,originalFirst:cycle.first,originalMinimum:cycle.minimum??null,originalLast:cycle.last};
  if(cycle.halfStatus!=='compared'){offers.push({...base,status:'refused',reason:cycle.halfReason??'Original half-cycle support unavailable.'});continue;}
  const descending=groups(samples,cycle.first+1,cycle.minimum-1),ascending=groups(samples,cycle.minimum+1,cycle.last-1);
  const levels=[...descending.keys()].filter(q=>ascending.has(q)).sort((a,b)=>a-b);
  if(!levels.length){offers.push({...base,status:'refused',reason:'No exactly equal reported coordinate in both original half interiors.'});continue;}
  for(const position of levels){
   const a=descending.get(position),b=ascending.get(position),offer={...base,position,descendingIndices:a,ascendingIndices:b,status:'refused'};
   if(![a,b].every(ids=>ids.every((v,j)=>j===0||v===ids[j-1]+1)))offer.reason='Equal reported coordinate has separated plateaus on an original side.';
   else Object.assign(offer,{status:'admitted',first:a[Math.floor((a.length-1)/2)],last:b[Math.floor((b.length-1)/2)]});
   offers.push(offer);
  }
 }
 return offers;
}
/** Conditional point-estimate check, not a physical passivity certificate. */
export function inspectEqualAngleReturns(cycleWork,options={}){
 const maximumEach=options.maximumEach??32768;
 insist(Number.isInteger(maximumEach)&&maximumEach>=0&&maximumEach<=32768,'Additional work limit must be an integer from 0 to 32768.');
 const original=inspectCycleWorkHalves(cycleWork),runs=original.investigation.inputs.bundle.challengeRuns;
 const models=[{id:'restoring-only',status:'admitted',coefficients:{rate:0,coulomb:0,quadratic:0}},...original.investigation.fit.candidates];
 const windowSize=original.investigation.fit.declaration.windowSize,h=(windowSize-1)/2;
 const offers=original.records.flatMap(record=>offersFor(record,runs.find(r=>r.id===record.runId).samples));
 const eligible=offers.filter(x=>x.status==='admitted');
 const requiredIntervals=eligible.reduce((n,x)=>n+x.last-x.first,0),requiredRateWindows=runs.reduce((n,r)=>n+Math.max(0,r.samples.length-2*h),0),requiredComparisons=offers.length*models.length;
 const budgetAvailable=requiredIntervals<=maximumEach&&requiredRateWindows<=maximumEach&&requiredComparisons<=maximumEach;
 const work={maximumEach,requiredIntervals,requiredRateWindows,requiredComparisons,actualIntervals:0,actualRateWindows:0,actualComparisons:0,budgetAvailable,scope:'Complete offered population reserved before additional calculation. Original source replay and half-cycle extraction have separate existing bounds.'};
 const rows=[],caches=new Map();
 for(const offer of offers){
  const row={...copy(offer),status:'refused',comparisons:[]};
  try{
   insist(offer.status==='admitted',offer.reason);
   insist(budgetAvailable,'The complete equal-coordinate population exceeds the additional work reservation.');
   const samples=runs.find(r=>r.id===offer.runId).samples;
   if(!caches.has(offer.runId))caches.set(offer.runId,new Map());
   const cache=caches.get(offer.runId);
   const rate=i=>{
    insist(i>=h&&i+h<samples.length,'Original endpoint lacks centered rate support.');
    if(!cache.has(i)){
     insist(work.actualRateWindows<requiredRateWindows,'Reserved rate-window work exhausted.');work.actualRateWindows++;
     try{cache.set(i,{value:fitAngularWindow(samples.slice(i-h,i+h+1),samples[i],null).rate});}
     catch(error){cache.set(i,{reason:error.message});}
    }
    const value=cache.get(i);insist(!value.reason,value.reason);return value.value;
   };
   const first=offer.first,last=offer.last;
   insist(samples[first].position===samples[last].position,'Original endpoint coordinates no longer match exactly.');
   const firstRate=rate(first),lastRate=rate(last),kineticLoss=(firstRate**2-lastRate**2)/2;
   insist(finite(kineticLoss),'Endpoint kinetic loss exceeded finite numerical range.');
   let viscous=0,quadraticWork=0,distance=0,workReason=null;
   for(let i=first+1;i<=last;i++){
    insist(work.actualIntervals<requiredIntervals,'Reserved interval work exhausted.');work.actualIntervals++;
    distance+=Math.abs(samples[i].position-samples[i-1].position);
    if(workReason)continue;
    try{const a=rate(i-1),b=rate(i),dt=samples[i].time-samples[i-1].time;viscous+=(a*a+b*b)*dt/2;quadraticWork+=(Math.abs(a)**3+Math.abs(b)**3)*dt/2;}
    catch(error){workReason=error.message;viscous=quadraticWork=NaN;}
   }
   insist(finite(distance),'Original distance work exceeded finite range.');
   Object.assign(row,{status:'compared',start:samples[first].time,end:samples[last].time,firstRate,lastRate,kineticLoss,potentialLossUnderAssumption:0,conditionalSign:kineticLoss<0?'negative-estimated-loss':'nonnegative-estimated-loss',features:{distance,viscous:finite(viscous)?viscous:null,quadraticWork:finite(quadraticWork)?quadraticWork:null},...(workReason?{workReason}:{})});
  }catch(error){row.reason=error.message;}
  for(const model of models){
   const comparison={candidateId:model.id,status:'refused'};
   try{
    insist(model.status==='admitted','Training candidate refused: '+model.reason);
    insist(row.status==='compared',row.reason);
    insist(work.actualComparisons<requiredComparisons,'Reserved comparison work exhausted.');work.actualComparisons++;
    const c=model.coefficients,f=row.features,needsQuadratic=model.id==='quadratic'||model.id==='viscous-quadratic';
    insist(!(c.rate>0)||f.viscous!==null,'Viscous work unavailable for this dependent law.');
    insist(!needsQuadratic||f.quadraticWork!==null,'Quadratic work unavailable for this dependent law.');
    const predictedLoss=(c.rate>0?c.rate*f.viscous:0)+c.coulomb*f.distance+((c.quadratic??0)>0?c.quadratic*f.quadraticWork:0),residual=row.kineticLoss-predictedLoss;
    insist([predictedLoss,residual].every(finite),'Predicted work or residual exceeded finite range.');
    Object.assign(comparison,{status:'compared',predictedLoss,residual});
   }catch(error){comparison.reason=error.message;}
   row.comparisons.push(comparison);
  }
  rows.push(row);
 }
 return {schema:'worldlaw.equal-angle-return-report/v1',original,windowSize,rows,work,
  inputs:{schema:EQUAL_ANGLE_RETURN_SCHEMA,cycleWork:copy(original.investigation.inputs),options:{maximumEach}},
  interpretation:'Equal reported coordinates are not certified equal physical states. Under an autonomous single-valued conservative potential and the same normalized kinetic convention, potential change cancels at identical coordinates; negative estimated kinetic loss is inconsistent with nonnegative loss under those assumptions. Rates are local estimates, not calibrated states. Overlapping return intervals are not independent replicates. No restoring shape, energy source, hidden mechanism, winner or confidence threshold is identified. Every original cycle, matching level and refusal is retained; receiving values never refit a law.'};
}
export function replayEqualAngleReturns(inputs){insist(inputs?.schema===EQUAL_ANGLE_RETURN_SCHEMA,'Expected equal-coordinate raw source notebook.');return inspectEqualAngleReturns(inputs.cycleWork,inputs.options);}
