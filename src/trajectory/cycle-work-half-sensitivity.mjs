import {inspectCycleWorkHalves} from './cycle-work.mjs';
import {fitAngularWindow} from '../science/angular-kinematics.mjs';

export const HALF_SENSITIVITY_SCHEMA='worldlaw.cycle-work-half-sensitivity/v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const insist=(ok,message)=>{if(!ok)throw Error(message);};
const finite=Number.isFinite;

/** Additional diagnostic only: the original inspector owns admission and fit. */
export function inspectHalfCycleSensitivity(cycleWork,options={}){
 const windows=options.windows??[5,9,17,31],maximumEach=options.maximumEach??32768;
 insist(Array.isArray(windows)&&windows.length>0&&windows.length<=6,'Offer one to six explicit rate windows.');
 insist(windows.every(x=>Number.isInteger(x)&&x>=1&&x<=101)&&new Set(windows).size===windows.length,'Offered windows must be distinct integer sample counts from 1 to 101.');
 insist(Number.isInteger(maximumEach)&&maximumEach>=0&&maximumEach<=32768,'Additional work limit must be an integer from 0 to 32768.');
 const original=inspectCycleWorkHalves(cycleWork),models=[{id:'restoring-only',status:'admitted',coefficients:{rate:0,coulomb:0,quadratic:0}},...original.investigation.fit.candidates];
 const work={maximumEach,reservedRateWindows:0,reservedIntervals:0,actualRateWindows:0,actualIntervals:0,scope:'Additional sensitivity only; original bounded replay and half-cycle extraction are separate.'},variants=[];
 const offered=original.records.flatMap(record=>record.cycles.map(cycle=>({record,cycle})));
 for(const windowSize of windows){
  let refusal=null;
  if(windowSize<5||windowSize>31||windowSize%2!==1)refusal='The maintained centered estimator supports odd windows of 5–31 samples.';
  const eligible=offered.filter(({cycle})=>cycle.halfStatus==='compared');
  // Conservative reservation counts shared endpoints twice. It never assumes a
  // successful fit or a surviving subset, and caps both expensive operations.
  const reserveIntervals=eligible.reduce((sum,{cycle})=>sum+cycle.halves.reduce((n,h)=>n+h.last-h.first,0),0);
  const reserveRates=eligible.reduce((sum,{cycle})=>sum+cycle.halves.reduce((n,h)=>n+h.last-h.first+1,0),0);
  if(!refusal&&(work.reservedIntervals+reserveIntervals>maximumEach||work.reservedRateWindows+reserveRates>maximumEach))refusal='Offered window exceeds the additional whole-population work reservation.';
  if(!refusal){work.reservedIntervals+=reserveIntervals;work.reservedRateWindows+=reserveRates;}
  const rows=[],cycles=[],runCaches=new Map(),halfWidth=(windowSize-1)/2;
  for(const {record,cycle} of offered){
   const entry={runId:record.runId,cycleIndex:cycle.cycleIndex,first:cycle.first,minimum:cycle.minimum??null,last:cycle.last,status:'refused',halves:[]};
   try{
    insist(!refusal,refusal);
    insist(cycle.halfStatus==='compared',cycle.halfReason??'Original half-cycle unavailable.');
    const run=original.investigation.inputs.bundle.challengeRuns.find(x=>x.id===record.runId),s=run.samples;
    if(!runCaches.has(run.id))runCaches.set(run.id,new Map());
    const cache=runCaches.get(run.id);
    const rate=i=>{
     insist(i>=halfWidth&&i+halfWidth<s.length,'Original endpoint lacks complete centered rate support.');
     if(!cache.has(i)){
      insist(work.actualRateWindows<work.reservedRateWindows,'Additional rate-window reservation exhausted.');
      work.actualRateWindows++;
      try{cache.set(i,{value:fitAngularWindow(s.slice(i-halfWidth,i+halfWidth+1),s[i],null).rate});}
      catch(error){cache.set(i,{reason:error.message});}
     }
     const result=cache.get(i);insist(!result.reason,result.reason);return result.value;
    };
    for(const half of cycle.halves){
     insist(half.last-half.first>=windowSize,'Original half-cycle is too short for this offered rate window.');
     let viscous=0,quadraticWork=0,workReason=null;
     for(let i=half.first+1;i<=half.last;i++){
      insist(work.actualIntervals<work.reservedIntervals,'Additional interval reservation exhausted.');
      work.actualIntervals++;
      try{
       const dt=s[i].time-s[i-1].time,a=rate(i-1),b=rate(i);
       viscous+=(a*a+b*b)*dt/2;
       quadraticWork+=(Math.abs(a)**3+Math.abs(b)**3)*dt/2;
      }catch(error){workReason=error.message;viscous=quadraticWork=NaN;break;}
     }
     const kineticCorrection=(rate(half.first)**2-rate(half.last)**2)/2,observedLoss=half.potentialLoss+kineticCorrection;
     insist([kineticCorrection,observedLoss].every(finite),'Original energy features exceeded finite range.');
     entry.halves.push({...half,kineticCorrection,observedLoss,viscous:finite(viscous)?viscous:null,quadraticWork:finite(quadraticWork)?quadraticWork:null,...(workReason?{workReason}:{})});
    }
    entry.status='compared';
   }catch(error){entry.reason=error.message;entry.halves=[];}
   cycles.push(entry);
   for(const model of models){
    const row={runId:record.runId,cycleIndex:cycle.cycleIndex,candidateId:model.id,status:'refused',halves:[]};
    try{
     insist(model.status==='admitted','Training candidate refused: '+model.reason);
     insist(entry.status==='compared',entry.reason);
     const c=model.coefficients,needsQuadratic=model.id==='quadratic'||model.id==='viscous-quadratic';
     insist(!(c.rate>0)||entry.halves.every(h=>h.viscous!==null),'Viscous work unavailable; this dependent family is refused.');
     insist(!needsQuadratic||entry.halves.every(h=>h.quadraticWork!==null),'Quadratic work unavailable; this dependent family is refused.');
     row.halves=entry.halves.map(h=>{
      const predictedLoss=(c.rate>0?c.rate*h.viscous:0)+c.coulomb*h.distance+((c.quadratic??0)>0?c.quadratic*h.quadraticWork:0),residual=h.observedLoss-predictedLoss;
      insist([predictedLoss,residual].every(finite),'Predicted loss or residual exceeded finite range.');
      return {direction:h.direction,start:h.start,end:h.end,observedLoss:h.observedLoss,predictedLoss,residual};
     });
     row.residualSum=row.halves.reduce((sum,h)=>sum+h.residual,0);
     insist(finite(row.residualSum),'Residual sum exceeded finite range.');
     row.opposedSigns=(row.halves[0].residual<0&&row.halves[1].residual>0)||(row.halves[0].residual>0&&row.halves[1].residual<0);row.status='compared';
    }catch(error){row.reason=error.message;row.halves=[];delete row.residualSum;}
    rows.push(row);
   }
  }
  variants.push({windowSize,status:refusal?'refused':'evaluated',...(refusal?{reason:refusal}:{}),cycles,comparisons:rows});
 }
 return {schema:'worldlaw.cycle-work-half-sensitivity-report/v1',original,variants,work,
  inputs:{schema:HALF_SENSITIVITY_SCHEMA,cycleWork:copy(original.investigation.inputs),options:{windows:[...windows],maximumEach}},
  interpretation:'Original observed samples, cycle/minimum endpoints, potential changes and trained coefficients remain fixed. Only centered local-rate windows and their dependent kinetic/work estimates vary. This finite offered set is numerical sensitivity, not calibrated uncertainty, independent observations, a winning law or an identified physical cause. Unsupported original cycles and offered windows remain visible. No receiving observation refits a law.'};
}
export function replayHalfCycleSensitivity(inputs){
 insist(inputs?.schema===HALF_SENSITIVITY_SCHEMA,'Expected raw-source half-cycle sensitivity notebook.');
 return inspectHalfCycleSensitivity(inputs.cycleWork,inputs.options);
}
