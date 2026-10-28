/** Cycle work identifies dissipative candidates conditional on a supplied restoring law. */
import {normalizeAngularRuns,normalizeAngularBundle,rolloutAngular,ANGULAR_COEFFICIENT_UNITS} from './angular-discovery.mjs';
import {fitAngularWindow} from '../science/angular-kinematics.mjs';
import {fitLinearColumns} from '../science/linear-fit.mjs';
import {rolloutAngularWithResolution} from './angular-resolution.mjs';
const insist=(ok,message)=>{if(!ok)throw new Error(message);};
const finite=Number.isFinite,copy=value=>JSON.parse(JSON.stringify(value));
const FAMILIES=[['viscous',[0]],['coulomb',[1]],['joint',[0,1]]];
export const CYCLE_WORK_SCHEMA='worldlaw.cycle-work-inputs/v1';
export const QUADRATIC_CYCLE_WORK_SCHEMA='worldlaw.cycle-work-inputs/v2';
export const MIXED_CYCLE_WORK_SCHEMA='worldlaw.cycle-work-inputs/v3';
const LIMITS=[
 'Normalized potential and kinetic terms are not calibrated joules; physical inertia remains unknown.',
 'Recorded maxima and local polynomial rates are approximate. Sensor noise, endpoint selection, smoothing and quadrature can bias work estimates.',
 'Adjacent cycles share endpoints and rate windows; cycle counts are not independent replication or calibrated uncertainty.',
 'A nonnegative coefficient and small residual do not identify the physical cause of dissipation.',
 'The supplied restoring law is frozen. Receiving errors never choose a family or refit a coefficient.',
 'Reusing recordings or this challenge to choose declarations is exploratory, not a fresh blind test.'
];
function declaration(options={}){
 const windowSize=options.windowSize??9,crossingAngle=options.crossingAngle??0;
 insist(Number.isInteger(windowSize)&&windowSize>=5&&windowSize<=31&&windowSize%2===1,'Declare an odd derivative window of 5–31 samples.');
 insist(finite(crossingAngle)&&Math.abs(crossingAngle)<=1e6,'Declare a finite crossing angle in radians.');
 insist(options.turningPointRule===undefined||options.turningPointRule==='middle_sample_of_contiguous_maximum_plateau_earlier_sample_for_even_width','Unsupported turning-point declaration.');
 insist(options.includeQuadratic===undefined||typeof options.includeQuadratic==='boolean','Quadratic loss admission must be boolean.');
 insist(options.includeMixedQuadratic===undefined||typeof options.includeMixedQuadratic==='boolean','Mixed loss admission must be boolean.');
 insist(!options.includeMixedQuadratic||options.includeQuadratic===true,'Mixed loss requires explicit quadratic admission.');
 return {...(options.includeMixedQuadratic?{includeMixedQuadratic:true}:{}),...(options.includeQuadratic?{includeQuadratic:true}:{}),windowSize,crossingAngle,turningPointRule:'middle_sample_of_contiguous_maximum_plateau_earlier_sample_for_even_width'};
}
function restoringLaw(model,run){
 insist(model&&Array.isArray(model.terms)&&model.terms.length>0&&model.terms.every(t=>['gravity','spring','bias','cubic'].includes(t.id)),'Supply a frozen restoring-only law (gravity, spring, bias or cubic); existing drag is not silently removed.');
 // Execute the maintained boundary at a tiny declared interval, validating the
 // complete angular model schema without integrating an arbitrary long training run.
 rolloutAngular(model,{...run,initialRate:0,samples:[{time:0,position:0},{time:1e-6,position:0}]},{maxStep:1e-6,maxSteps:2});
 const c=Object.fromEntries(model.terms.map(t=>[t.id,t.coefficient]));
 return q=>(c.gravity??0)*Math.cos(q)-(c.spring??0)*q*q/2-(c.cubic??0)*q**4/4-(c.bias??0)*q;
}
function extract(run,potential,decl){
 const s=run.samples,h=(decl.windowSize-1)/2,crossings=[],peaks=[],cycles=[];
 for(let i=1;i<s.length;i++)if(s[i-1].position<=decl.crossingAngle&&s[i].position>decl.crossingAngle)crossings.push(i);
 for(let i=1;i<crossings.length;i++){
  const start=crossings[i-1],end=crossings[i];let index=start;
  for(let j=start+1;j<end;j++)if(s[j].position>s[index].position)index=j;
  const ties=[];for(let j=start;j<end;j++)if(s[j].position===s[index].position)ties.push(j);
  const contiguous=ties.every((value,j)=>j===0||value===ties[j-1]+1);
  peaks.push({index:ties[Math.floor((ties.length-1)/2)],ambiguous:!contiguous,plateau:[ties[0],ties.at(-1)]});
 }
 const rates=new Map();const rate=i=>{if(!rates.has(i))rates.set(i,fitAngularWindow(s.slice(i-h,i+h+1),s[i],null).rate);return rates.get(i);};
 for(let k=1;k<peaks.length;k++){
  const a=peaks[k-1],b=peaks[k],first=a.index,last=b.index;
  const row={runId:run.id,cycleIndex:k-1,first,last,start:s[first].time,end:s[last].time,status:'refused'};
  try{
   insist(!a.ambiguous&&!b.ambiguous,'Separated equal maxima leave the turning-point interval unresolved.');
   row.endpointPlateaus=[a.plateau,b.plateau];
   insist(first>=h&&last+h<s.length,'A complete centered derivative window is unavailable at a cycle endpoint.');
   insist(last-first>=decl.windowSize,'Cycle is undersampled relative to the declared derivative window.');
   let viscous=0,distance=0,quadraticWork=0;
   for(let i=first+1;i<=last;i++){
    const dt=s[i].time-s[i-1].time;viscous+=(rate(i-1)**2+rate(i)**2)*dt/2;distance+=Math.abs(s[i].position-s[i-1].position);
    if(decl.includeQuadratic)quadraticWork+=(Math.abs(rate(i-1))**3+Math.abs(rate(i))**3)*dt/2;
   }
   const startRate=rate(first),endRate=rate(last),potentialLoss=potential(s[first].position)-potential(s[last].position),kineticCorrection=(startRate**2-endRate**2)/2,loss=potentialLoss+kineticCorrection;
   insist([viscous,distance,potentialLoss,kineticCorrection,loss].every(finite)&&viscous>0&&distance>0,'Cycle work is nonfinite or has no supported motion.');
   Object.assign(row,{status:'admitted',loss,potentialLoss,kineticCorrection,startRate,endRate,viscous,distance,...(decl.includeQuadratic?{quadraticWork:finite(quadraticWork)?quadraticWork:null,...(!finite(quadraticWork)?{quadraticWorkReason:'Quadratic rate-work arithmetic exceeded finite range.'}:{})}:{})});
  }catch(error){row.reason=error.message;}
  cycles.push(row);
 }
 return {runId:run.id,source:copy(run.source),sampleCount:s.length,crossingCount:crossings.length,peakCount:peaks.length,cycles,
  coverage:{firstCycleIndex:peaks[0]?.index??null,lastCycleIndex:peaks.at(-1)?.index??null,excludedPrefixSamples:peaks.length?peaks[0].index:s.length,excludedSuffixSamples:peaks.length?s.length-1-peaks.at(-1).index:0},
  limitation:'Only maxima between complete upward-crossing intervals are considered. Prefix/suffix and all refused complete-cycle pairs remain disclosed.'};
}
function fitFamilies(rows,model,includeQuadratic=false,includeMixedQuadratic=false){
 const admitted=rows.filter(r=>r.status==='admitted'),target=admitted.map(r=>r.loss),columns=[admitted.map(r=>r.viscous),admitted.map(r=>r.distance),...(includeQuadratic?[admitted.map(r=>r.quadraticWork??0)]:[])];
 return [...FAMILIES,...(includeQuadratic?[['quadratic',[2]]]:[]),...(includeMixedQuadratic?[['viscous-quadratic',[0,2]]]:[])].map(([id,indices])=>{
  const result={id,status:'refused',cycleCount:admitted.length};
  if(admitted.length<3)return {...result,reason:'At least three admitted complete cycles are required.'};
  if(indices.includes(2)&&admitted.some(r=>r.quadraticWork===null))return {...result,reason:'Quadratic work unavailable on one or more original admitted cycles; the complete family is refused without dropping cycles.'};
  const unconstrained=fitLinearColumns(indices.map(i=>columns[i]),target);
  if(!unconstrained)return {...result,reason:'Work feature columns are rank deficient.'};
  result.unconstrainedCoefficients=unconstrained.coefficients;result.normalizedQRPivotRatio=unconstrained.conditionEstimate;
  if(unconstrained.conditionEstimate>1000)return {...result,reason:'Normalized QR pivot ratio exceeds 1000; joint coefficients are unsupported.'};
  // Enumerate every feasible NNLS active set for this offered one- or two-column family.
  const choices=[{coefficients:columns.map(()=>0),active:[]}];
  for(let mask=1;mask<1<<indices.length;mask++){
   const active=indices.filter((_,j)=>mask&(1<<j)),fit=fitLinearColumns(active.map(i=>columns[i]),target);
   if(!fit||fit.coefficients.some(c=>c<0))continue;
   const coefficients=columns.map(()=>0);active.forEach((index,j)=>coefficients[index]=fit.coefficients[j]);choices.push({coefficients,active});
  }
  for(const choice of choices)choice.sse=target.reduce((sum,y,i)=>sum+(y-choice.coefficients[0]*columns[0][i]-choice.coefficients[1]*columns[1][i]-(includeQuadratic?choice.coefficients[2]*columns[2][i]:0))**2,0);
  choices.sort((a,b)=>a.sse-b.sse||a.active.length-b.active.length);const best=choices[0];
  if(!finite(best.sse))return {...result,reason:'Loss fit exceeded finite arithmetic.'};
  const coefficients={rate:best.coefficients[0],coulomb:best.coefficients[1],...(includeQuadratic?{quadratic:best.coefficients[2]}:{})},terms=copy(model.terms);
  for(const term of ['rate','coulomb',...(includeQuadratic?['quadratic']:[])])if(coefficients[term]>0)terms.push({id:term,coefficient:-coefficients[term],coefficientUnit:ANGULAR_COEFFICIENT_UNITS[term]});
  const executable={...copy(model),id:`cycle-work-${id}`,terms,method:'frozen_restoring_cycle_work_nnls',equation:terms.map(t=>`${t.coefficient} × ${t.id}`).join(' + ')};
  delete executable.metrics;
  return {...result,status:'admitted',coefficients,activeTerms:best.active.map(i=>['rate','coulomb','quadratic'][i]),boundary:best.active.length<indices.length,lossRMSE:Math.sqrt(best.sse/admitted.length),predictions:admitted.map((r,i)=>({runId:r.runId,cycleIndex:r.cycleIndex,observed:r.loss,predicted:best.coefficients[0]*columns[0][i]+best.coefficients[1]*columns[1][i]+(includeQuadratic?best.coefficients[2]*columns[2][i]:0)})),model:executable};
 });
}
export function fitCycleWork(model,trainingRuns,options={}){
 const training=normalizeAngularRuns(trainingRuns),decl=declaration(options),potential=restoringLaw(model,training[0]);
 const records=training.map(run=>extract(run,potential,decl)),rows=records.flatMap(r=>r.cycles),candidates=fitFamilies(rows,model,decl.includeQuadratic===true,decl.includeMixedQuadratic===true);
 return {schema:'worldlaw.cycle-work-fit/v1',declaration:decl,restoringModel:copy(model),trainingRuns:training,records,candidates,cycleCount:rows.length,admittedCycleCount:rows.filter(r=>r.status==='admitted').length,limitations:[...LIMITS],coefficientMeaning:{rate:'1/s, nonnegative dissipative magnitude',coulomb:'rad/s², nonnegative dissipative magnitude',...(decl.includeQuadratic?{quadratic:'1/rad, nonnegative dissipative magnitude'}:{})},lossUnits:'rad²/s² normalized by unknown inertia; not joules',selected:null};
}
export function cycleWorkInvestigation(bundle,model,options={}){
 const normalized=normalizeAngularBundle(bundle),fit=fitCycleWork(model,normalized.trainingRuns,options),maxStep=options.maxStep??.01,maxSteps=options.maxSteps??300000;
 insist(finite(maxStep)&&maxStep>=.00001&&maxStep<=.05,'Receiving maxStep must be 0.00001–0.05 seconds.');
 insist(Number.isInteger(maxSteps)&&maxSteps>=1&&maxSteps<=1000000,'Declare a combined receiving budget of 1–1000000 steps.');
 const models=[{id:'restoring-only',status:'admitted',model:fit.restoringModel},...fit.candidates];
 let required=0;for(const c of models)if(c.status==='admitted')for(const r of normalized.challengeRuns)for(let i=1;i<r.samples.length;i++){const dt=r.samples[i].time-r.samples[i-1].time;required+=Math.ceil(dt/maxStep)+Math.ceil(dt/(maxStep/2));}
 const receiving=[];
 for(const c of models)for(const run of normalized.challengeRuns){
  const row={candidateId:c.id,runId:run.id,status:'refused'};
  if(c.status!=='admitted')row.reason='Training candidate refused: '+c.reason;
  else if(required>maxSteps)row.reason=`Complete declared receiving population needs ${required} steps; budget ${maxSteps}.`;
  else try{const execution=rolloutAngularWithResolution(c.model,run,{maxStep,maxSteps});Object.assign(row,{status:execution.resolution.status==='compared'?'compared':'unresolved',...execution});}catch(error){row.reason=error.message;}
  receiving.push(row);
 }
 return {schema:'worldlaw.cycle-work-investigation/v1',fit,receiving,solver:{maxStep,maxSteps,requiredSteps:required},inputs:{schema:fit.declaration.includeMixedQuadratic?MIXED_CYCLE_WORK_SCHEMA:fit.declaration.includeQuadratic?QUADRATIC_CYCLE_WORK_SCHEMA:CYCLE_WORK_SCHEMA,bundle:normalized,restoringModel:copy(model),options:{...fit.declaration,maxStep,maxSteps}},selected:null};
}
export function replayCycleWork(inputs){insist([CYCLE_WORK_SCHEMA,QUADRATIC_CYCLE_WORK_SCHEMA,MIXED_CYCLE_WORK_SCHEMA].includes(inputs?.schema),'Expected cycle-work input notebook.');insist(inputs.schema===CYCLE_WORK_SCHEMA?inputs.options?.includeQuadratic!==true:inputs.options?.includeQuadratic===true,'Quadratic admission requires its explicit v2 or v3 notebook.');insist(inputs.schema===MIXED_CYCLE_WORK_SCHEMA?inputs.options?.includeMixedQuadratic===true:inputs.options?.includeMixedQuadratic!==true,'Mixed admission requires its explicit v3 notebook.');return cycleWorkInvestigation(inputs.bundle,inputs.restoringModel,inputs.options);}

export const HALF_CYCLE_WORK_SCHEMA='worldlaw.cycle-work-halves/v1';
export function inspectCycleWorkHalves(inputs){
 const investigation=replayCycleWork(inputs),{fit}=investigation,decl=fit.declaration;
 const models=[{id:'restoring-only',status:'admitted',coefficients:{rate:0,coulomb:0,quadratic:0}},...fit.candidates];
 const records=[],comparisons=[],work={rateWindows:0,intervals:0,maximumEach:8192,counterScope:'Diagnostic pass after bounded original extraction; replay and original extraction are not counted here.'};
 for(const run of investigation.inputs.bundle.challengeRuns){
  const potential=restoringLaw(fit.restoringModel,run),record=extract(run,potential,decl),s=run.samples,h=(decl.windowSize-1)/2,rates=new Map();
  const rate=i=>{if(!rates.has(i)){insist(work.rateWindows<work.maximumEach,'Receiving half-cycle rate-window budget exceeded.');work.rateWindows++;rates.set(i,fitAngularWindow(s.slice(i-h,i+h+1),s[i],null).rate);}return rates.get(i);};
  const cycles=[];
  for(const original of record.cycles){
   const cycle={...copy(original),halfStatus:'refused',halves:[]};
   try{
    insist(original.status==='admitted',original.reason??'Original receiving cycle is unavailable.');
    const {first,last}=original;let minimum=first;
    for(let i=first+1;i<=last;i++)if(s[i].position<s[minimum].position)minimum=i;
    const ties=[];for(let i=first;i<=last;i++)if(s[i].position===s[minimum].position)ties.push(i);
    insist(ties.every((v,j)=>j===0||v===ties[j-1]+1),'Separated equal minima leave the half-cycle boundary unresolved.');
    minimum=ties[Math.floor((ties.length-1)/2)];cycle.minimumPlateau=[ties[0],ties.at(-1)];cycle.minimum=minimum;
    insist(minimum>first&&minimum<last,'The minimum is not interior to the original cycle.');
    insist(minimum-first>=decl.windowSize&&last-minimum>=decl.windowSize,'A half-cycle is undersampled relative to the declared derivative window.');
    for(const [direction,a,b]of [['descending',first,minimum],['ascending',minimum,last]]){
     let viscous=0,distance=0,quadraticWork=0;
     for(let i=a+1;i<=b;i++){
      insist(work.intervals<work.maximumEach,'Receiving half-cycle interval budget exceeded.');work.intervals++;
      const dt=s[i].time-s[i-1].time,v0=rate(i-1),v1=rate(i);
      viscous+=(v0*v0+v1*v1)*dt/2;distance+=Math.abs(s[i].position-s[i-1].position);
      if(decl.includeQuadratic)quadraticWork+=(Math.abs(v0)**3+Math.abs(v1)**3)*dt/2;
     }
     const potentialLoss=potential(s[a].position)-potential(s[b].position),kineticCorrection=(rate(a)**2-rate(b)**2)/2,observedLoss=potentialLoss+kineticCorrection;
     insist([viscous,distance,potentialLoss,kineticCorrection,observedLoss].every(finite),'Half-cycle energy or original work features exceeded finite range.');
     cycle.halves.push({direction,first:a,last:b,start:s[a].time,end:s[b].time,potentialLoss,kineticCorrection,observedLoss,viscous,distance,...(decl.includeQuadratic?{quadraticWork:finite(quadraticWork)?quadraticWork:null}: {})});
    }
    const observedSum=cycle.halves.reduce((sum,x)=>sum+x.observedLoss,0),endpointClosure=observedSum-original.loss;insist([observedSum,endpointClosure].every(finite),'Half-cycle endpoint closure exceeded finite range.');Object.assign(cycle,{halfStatus:'compared',observedSum,endpointClosure});
   }catch(error){cycle.halfReason=error.message;}
   cycles.push(cycle);
   for(const candidate of models){
    const row={runId:run.id,cycleIndex:original.cycleIndex,candidateId:candidate.id,status:'refused',halves:[]};
    if(candidate.status!=='admitted')row.reason='Training candidate refused: '+candidate.reason;
    else if(cycle.halfStatus!=='compared')row.reason=cycle.halfReason;
    else try{
     const c=candidate.coefficients;
     const needsQuadratic=candidate.id==='quadratic'||candidate.id==='viscous-quadratic';
     insist(!needsQuadratic||cycle.halves.every(x=>x.quadraticWork!==null),'Quadratic work unavailable on an original receiving half-cycle; this dependent comparison is refused.');
     row.halves=cycle.halves.map(x=>{
      const predictedLoss=c.rate*x.viscous+c.coulomb*x.distance+((c.quadratic??0)>0?c.quadratic*x.quadraticWork:0),residual=x.observedLoss-predictedLoss;
      insist([predictedLoss,residual].every(finite),'Half-cycle prediction exceeded finite range.');
      return {direction:x.direction,start:x.start,end:x.end,observedLoss:x.observedLoss,predictedLoss,residual};
     });
     const residualSum=row.halves.reduce((sum,x)=>sum+x.residual,0);insist(finite(residualSum),'Half-cycle residual sum exceeded finite range.');row.residualSum=residualSum;row.status='compared';
    }catch(error){row.reason=error.message;row.halves=[];}
    comparisons.push(row);
   }
  }
  records.push({...record,cycles});
 }
 return {schema:'worldlaw.cycle-work-half-cycle-report/v1',investigation,records,comparisons,work,selected:null,
  inputs:{schema:HALF_CYCLE_WORK_SCHEMA,cycleWork:copy(investigation.inputs)},
  interpretation:'Separately observed receiving positions, evaluated under frozen training laws. Observed loss is E_before minus E_after; predicted loss is nonnegative dissipative work; residual is observed minus predicted loss. Max-to-min and min-to-max labels name endpoints, not guaranteed monotone motion. Adjacent halves share a measured minimum and rate windows: opposite residuals can cancel. This is normalized energy, not calibrated joules, independent replication, a significance test or identified physical cause. Derivative, endpoint, quadrature and frozen restoring-law errors remain possible. Receiving observations never refit or select a law.'};
}
export function replayHalfCycleWork(inputs){insist(inputs?.schema===HALF_CYCLE_WORK_SCHEMA,'Expected receiving half-cycle source notebook.');return inspectCycleWorkHalves(inputs.cycleWork);}
