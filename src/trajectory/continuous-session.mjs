/** Continuous-actuator loop. Own forecasts before acquisition; score before refit. */
import {discoverWeak} from './weak-discovery.mjs';
import {planContinuousExperiment} from './continuous-planner.mjs';
import {rollout} from './forward.mjs';
import {RUN_UNITS,validateRun} from './data.mjs';
import {receiveContinuousRun,commandSamples} from './controlled-instrument.mjs';
import {residualScore,assessResidual} from './residual-abstention.mjs';
const states=new WeakMap();
const clone=x=>JSON.parse(JSON.stringify(x));
const check=(ok,text)=>{if(!ok)throw new RangeError(text);};
function canonical(x){
  if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
  if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
function expose(raw){const result=clone(raw);states.set(result,raw);return result;}
function own(session){
  const raw=states.get(session);
  check(raw&&canonical(session)===canonical(raw),'Session is stale, modified or not independently restored');
  return raw;
}
export function actuatorRivals(discovery){
  const chosen=['command','command_cubic'].map(term=>discovery.candidates.find(m=>
    m.terms.some(t=>t.id===term)&&!m.terms.some(t=>t.id===(term==='command'?'command_cubic':'command'))));
  check(chosen.every(Boolean),'Source cannot identify both declared actuator alternatives');
  check(chosen[0].id!==chosen[1].id,'Actuator alternatives must remain distinct');
  return clone(chosen);
}
export function createContinuousSession({trainingRuns,fitOptions,plannerConfig,
  policy='active',policyId,worldId,seed=1,maxRounds=2,calibration=null}){
  check(['active','random'].includes(policy),'Unknown acquisition policy');
  check(typeof policyId==='string'&&policyId.length>0,'Require frozen policy identity');
  check(typeof worldId==='string'&&worldId.length>0,'Require world identity');
  check(Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff,'Require uint32 policy seed');
  check(Array.isArray(trainingRuns)&&trainingRuns.length>=1&&trainingRuns.length<=3,'Require one to three source runs');
  check(Number.isSafeInteger(maxRounds)&&maxRounds>=1&&trainingRuns.length+maxRounds<=4,'Source plus acquisitions exceed four-run fitter limit');
  const runs=trainingRuns.map(r=>validateRun(r,{role:'training'}));
  check(new Set(runs.map(r=>r.id)).size===runs.length,'Duplicate source evidence identity');
  check(plannerConfig.noiseSigma===fitOptions.noiseSigma,'Fit/planning noise disagree');
  check(runs.every(r=>r.inertia===plannerConfig.inertia),'Source/planning inertias disagree');
  const discovery=discoverWeak(runs,fitOptions);
  if(calibration)check(calibration.policyId===policyId,'Calibration belongs to another policy');
  return expose({schema:'worldlaw.continuous-discovery-session/v1',policy,policyId,worldId,seed,maxRounds,
    baseTrainingRuns:clone(runs),trainingRuns:runs,fitOptions:clone(fitOptions),
    plannerConfig:clone(plannerConfig),calibration:calibration?clone(calibration):null,
    discovery,history:[],pending:null,events:[{type:'source_fit',rows:runs.reduce((n,r)=>n+r.samples.length,0)}]});
}
function randomPlan(models,c,seed){
  let state=seed>>>0||1;
  const uniform=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return ((state>>>0)+.5)/4294967296;};
  let end=0;
  const segments=c.segmentDurations.map(duration=>{
    const startIndex=end;end+=Math.round(duration/c.dt);
    return {startIndex,endIndex:end,amplitude:c.amplitudeBounds[0]+
      (c.amplitudeBounds[1]-c.amplitudeBounds[0])*uniform()};
  });
  const request={schema:'worldlaw.continuous-command-request/v1',inertia:c.inertia,
    initialPosition:c.initialPosition,initialRate:c.initialRate,duration:c.duration,dt:c.dt,
    noiseSigma:c.noiseSigma,segments,
    commandConvention:'hold amplitude on [startIndex*dt,endIndex*dt); terminal value unused'};
  const checked=commandSamples(request,{amplitudeBounds:c.amplitudeBounds});
  const run={id:'prospective-random',label:'Prospective random command',kind:'unknown',
    source:{label:'Prediction placeholders only'},units:{...RUN_UNITS},inertia:c.inertia,
    initialRate:c.initialRate,samples:checked.samples.map(s=>({...s,position:c.initialPosition}))};
  const predictions=[],work={rolloutCalls:0,completedSteps:0};
  let maximumError=0;
  for(const m of models){
    const coarse=rollout(m,run,{maxStep:c.maxStep,positionDomain:c.positionDomain});
    const fine=rollout(m,run,{maxStep:c.maxStep/2,positionDomain:c.positionDomain});
    work.rolloutCalls+=2;work.completedSteps+=coarse.diagnostics.steps+fine.diagnostics.steps;
    for(let i=0;i<fine.rows.length;i++)maximumError=Math.max(maximumError,Math.abs(fine.rows[i].predicted-coarse.rows[i].predicted));
    if(c.rateDomain)check(fine.rows.every(r=>r.rate>=c.rateDomain[0]&&r.rate<=c.rateDomain[1]),'Random plan violates rate envelope');
    predictions.push({modelId:m.id,position:fine.rows.map(r=>r.predicted)});
  }
  check(work.completedSteps<=c.maxTotalSteps,'Random plan exceeds step budget');
  check(maximumError<=c.maxRefinementError,'Random plan fails numerical refinement');
  return {schema:'worldlaw.continuous-command-plan/v1',status:'planned',request,
    times:checked.samples.map(r=>r.time),predictions,objective:null,work,
    diagnostics:{method:'uniform independent continuous segment amplitudes',maxRefinementErrorObserved:maximumError}};
}
export function planNextContinuous(session){
  const s=own(session);
  check(!s.pending&&s.history.length<s.maxRounds,'Pending plan or exhausted acquisition budget');
  const models=actuatorRivals(s.discovery);
  const plan=s.policy==='active'?planContinuousExperiment(models,s.plannerConfig):
    randomPlan(models,s.plannerConfig,(s.seed+Math.imul(s.history.length+1,0x9e3779b9))>>>0);
  const next=clone(s);
  next.events.push({type:plan.status==='planned'?'predictions_owned_before_acquisition':'plan_refused',
    round:s.history.length+1,planStatus:plan.status,reason:plan.reason??null});
  next.pending={plan,models,sourceRows:s.trainingRuns.reduce((n,r)=>n+r.samples.length,0)};
  return expose(next);
}
export function continuousRequest(session){
  const s=own(session);check(s.pending?.plan.status==='planned','No executable prospective plan');
  return clone(s.pending.plan.request);
}
export function receiveContinuous(session,{request,run}){
  const s=own(session);check(s.pending?.plan.status==='planned','No executable prediction plan');
  check(canonical(request)===canonical(s.pending.plan.request),'Receipt changes frozen request');
  const received=receiveContinuousRun(request,run,{amplitudeBounds:s.plannerConfig.amplitudeBounds});
  check(!s.trainingRuns.some(r=>r.id===received.id||
    (r.source.recordingId&&r.source.recordingId===received.source.recordingId)),'Repeated acquisition evidence');
  const next=clone(s),round=s.history.length+1;
  const residual=residualScore(s.pending.plan.predictions.map(p=>p.position),
    received.samples.map(p=>p.position),s.plannerConfig.noiseSigma);
  const assessment=s.calibration?assessResidual(s.calibration,
    {policyId:s.policyId,worldId:s.worldId,round,score:residual.score}):
    {status:'uncalibrated_diagnostic',p:null,reason:'No disjoint-world calibration supplied'};
  next.events.push({type:'prospective_residual_scored_before_refit',round,score:residual.score,assessment});
  next.trainingRuns.push(received);
  // A revision cannot erase the failure of its preceding frozen predictions.
  next.discovery=discoverWeak(next.trainingRuns,next.fitOptions);
  next.events.push({type:'model_refit_after_receipt',round,selected:next.discovery.selected.id});
  next.history.push({round,request:clone(request),plan:clone(s.pending.plan),run:received,
    residual,assessment,selectedAfter:clone(next.discovery.selected)});
  next.pending=null;return expose(next);
}
export function exportContinuousSession(session){
  const s=own(session);
  return JSON.stringify({schema:'worldlaw.continuous-discovery-notebook/v1',
    setup:{trainingRuns:s.baseTrainingRuns,fitOptions:s.fitOptions,plannerConfig:s.plannerConfig,
      policy:s.policy,policyId:s.policyId,worldId:s.worldId,seed:s.seed,maxRounds:s.maxRounds,calibration:s.calibration},
    received:s.history.map(h=>({request:h.request,run:h.run})),pending:!!s.pending},null,2);
}
export function restoreContinuousSession(text){
  const saved=JSON.parse(text);
  check(saved.schema==='worldlaw.continuous-discovery-notebook/v1'&&Array.isArray(saved.received),'Unsupported notebook');
  let session=createContinuousSession(saved.setup);
  for(const received of saved.received){session=planNextContinuous(session);session=receiveContinuous(session,received);}
  if(saved.pending)session=planNextContinuous(session);
  return session;
}
