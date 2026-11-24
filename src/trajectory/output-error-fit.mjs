import {fitLinearColumns} from '../science/linear-fit.mjs';
import {rollout,TrajectoryRolloutError} from './forward.mjs';

function requireInput(ok,message){if(!ok)throw new RangeError(message);}

function measure(model,runs,maxStep){
  const residuals=[],perRun=[];
  let steps=0;
  for(const run of runs){
    const result=rollout(model,run,{maxStep});
    steps+=result.diagnostics.steps;
    const errors=result.rows.slice(1).map(row=>row.residual);
    residuals.push(...errors);
    perRun.push({id:run.id,count:errors.length,rms:Math.hypot(...errors)/Math.sqrt(errors.length),
      maxAbs:Math.max(...errors.map(Math.abs))});
  }
  const norm=Math.hypot(...residuals);
  return {residuals,norm,steps,summary:{rms:norm/Math.sqrt(residuals.length),perRun}};
}

function modelAt(source,coefficients){
  return {schema:source.schema,id:source.id,terms:source.terms.map((t,i)=>({id:t.id,coefficient:coefficients[i]})),
    ...(source.units?{units:{...source.units}}:{}),...(source.domain?{domain:structuredClone(source.domain)}:{}),
    method:'fixed_support_position_output_fit'};
}

/** Fit coefficients on a fixed torque-library support. Every residual is a
 * free-running position forecast from that acquisition's imposed initial state. */
export function refineTrajectoryOutput(source,runs,{maxStep=.01}={}){
  requireInput(Array.isArray(runs)&&runs.length>=1&&runs.length<=32,'Require 1–32 acquired trajectories');
  requireInput(new Set(runs.map(r=>r.id)).size===runs.length,'Acquisition IDs must be distinct');
  requireInput(runs.every(r=>Array.isArray(r.samples))&&runs.reduce((s,r)=>s+r.samples.length,0)<=8192,'Position observation budget exceeded');
  requireInput(Array.isArray(source?.terms)&&source.terms.length<=12,'Require a bounded fixed torque-model support');
  requireInput(Number.isFinite(maxStep)&&maxStep>0,'Require a positive integration step');
  // Rollout checks each recording. Enforce the shared limit before the first fit.
  let requiredSteps=0;
  for(const {samples} of runs){
    for(let i=1;i<samples.length;i++){
      const interval=samples[i].time-samples[i-1].time;
      requireInput(Number.isFinite(interval)&&interval>0,'Sample times must be finite and strictly increasing');
      requiredSteps+=Math.max(1,Math.ceil(interval/maxStep));
    }
  }
  requireInput(requiredSteps<=5000000,'Combined trajectory integration budget exceeded');
  let coefficients=source.terms.map(t=>t.coefficient);
  const initial=measure(modelAt(source,coefficients),runs,maxStep);
  // The ordinary held-command timeline and maximum step are fixed across
  // coefficient trials, so every complete trajectory evaluation has this cost.
  const maxEvaluations=Math.max(1,Math.floor(5000000/initial.steps));
  let current=initial,reason='iteration_limit',acceptedSteps=0,evaluations=1;
  function trial(theta){
    if(evaluations>=maxEvaluations||!theta.every(Number.isFinite))return null;
    ++evaluations;
    try{return measure(modelAt(source,theta),runs,maxStep);}
    catch(err){if(!(err instanceof TrajectoryRolloutError))throw err;return null;}
  }
  for(let iteration=0;iteration<8;iteration++){
    const columns=[];
    for(let k=0;k<coefficients.length;k++){
      const h=1e-5*Math.max(1,Math.abs(coefficients[k]));
      const plus=[...coefficients],minus=[...coefficients];plus[k]+=h;minus[k]-=h;
      const upper=trial(plus),lower=trial(minus);
      if(!upper||!lower)break;
      // Residual is observation minus prediction, so reverse the difference
      // to obtain the sensitivity of the predicted positions.
      const col=lower.residuals.map((v,i)=>(v-upper.residuals[i])/(2*h));
      const norm=Math.hypot(...col);
      if(!(norm>0&&Number.isFinite(norm)))break;
      for(let j=0;j<coefficients.length;j++)col.push(j===k?1e-4*norm:0);
      columns.push(col);
    }
    if(!columns.length||columns.length!==coefficients.length){reason='unresolved_sensitivity';break;}
    const direction=fitLinearColumns(columns,[...current.residuals,...coefficients.map(()=>0)]);
    if(!direction){reason='unresolved_sensitivity';break;}
    let accepted=false;
    for(let power=0;power<8;power++){
      const next=coefficients.map((v,k)=>v+direction.coefficients[k]*2**(-power));
      const measured=trial(next);
      if(measured&&measured.norm<current.norm){
        current=measured;coefficients=next;++acceptedSteps;accepted=true;break;
      }
    }
    if(!accepted){reason='no_decreasing_step';break;}
  }
  if(evaluations>=maxEvaluations)reason='fit_work_budget';
  return {model:modelAt(source,coefficients),before:initial.summary,after:current.summary,
    acceptedSteps,evaluations,reason};
}
