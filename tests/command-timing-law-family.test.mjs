import test from 'node:test';
import assert from 'node:assert/strict';
import {commandTimingExample} from '../src/trajectory/command-timing-example.mjs';
import {compareCommandTiming} from '../src/trajectory/command-timing-study.mjs';
import {prepareCommandTimeline} from '../src/trajectory/command-timeline.mjs';
import {prepareTimingLawForecasts,executeTimingLawForecasts,timingLawComparison} from '../src/trajectory/command-timing-law-family.mjs';
const clone=x=>structuredClone(x);
function actual(joint=false){const e=commandTimingExample();return compareCommandTiming(e.bundle,{...e.options,delays:joint?[0]:[0,.1],...(joint?{responseTimes:[0,.02]}:{}),noiseSigma:.01,ambiguityDelta:6});}
// These controls modify derived reports only to probe the INTERNAL helper contract.
// They do not represent fitted observations or a supported notebook import format.
function controlled({joint=false}={}){
 const r=actual(joint);
 r.options.ambiguityDelta=6;r.options.maxTotalSteps=1000000;r.work.maxTotalSteps=1000000;
 r.candidates=r.candidates.map((c,i)=>{
  const model=clone(c.model);model.metrics.score=i?5:0;
  const alternative=clone(model);alternative.id='control-alternative';alternative.metrics.score=i?10:6;
  const out={...c,score:model.metrics.score,model,discovery:{...c.discovery,selected:model,candidates:[model,alternative],competitive:[model,alternative]}};
  return out;
 });
 return r;
}
const ids=p=>p.members.map(m=>[m.delaySeconds,m.responseTimeSeconds??0,m.modelId,m.score]);
function frozen(x){if(x&&typeof x==='object'){assert(Object.isFrozen(x));for(const v of Object.values(x))frozen(v);}}
test('global training threshold excludes locally competitive stacking; exact boundary retained',()=>{
 const r=controlled(),p=prepareTimingLawForecasts(r);
 assert.equal(p.globalBestScore,0);assert.equal(p.ambiguityDelta,6);
 assert.equal(p.members.length,3);assert(p.members.some(m=>m.score===6));assert(!p.members.some(m=>m.score===10));
 r.candidates[0].discovery.candidates[1].metrics.score=6+Number.EPSILON*4;
 const q=prepareTimingLawForecasts(r);assert.equal(q.members.length,2);
 const changed=controlled();for(const c of changed.candidates){c.challengeRMSE=1e9;for(const row of c.receiving)if(row.rollout)row.rollout.metrics.positionRMSE=1e9;}
 assert.deepEqual(ids(prepareTimingLawForecasts(changed)),ids(p),'Challenge error must not select family');
});
test('exact response pairs preserve same-delay identities',()=>{
 const r=controlled({joint:true});r.candidates[1].discovery.candidates[1].metrics.score=6;
 const p=prepareTimingLawForecasts(r);
 assert.equal(p.work.additionalReservedSteps,independentAdditional(r,p));
 assert.equal(p.members.length,4);assert.equal(new Set(p.members.map(m=>m.key)).size,4);
 // The positive response has tau/4=.005, smaller than requested .01.
 const responsive=p.members.find(m=>m.responseTimeSeconds===.02&&!m.isTimingRepresentative);assert(responsive);
 assert(independentAdditional(r,{members:[responsive]})>r.bundle.challengeRuns.reduce((n,run)=>n+run.samples.slice(1).reduce((v,s,i)=>v+Math.ceil((s.time-run.samples[i].time)/.01)+Math.ceil((s.time-run.samples[i].time)/.005),0),0));
 assert(p.members.some(m=>m.responseTimeSeconds===0));assert(p.members.some(m=>m.responseTimeSeconds===.02));
});
function independentAdditional(r,p){
 let total=0;
 for(const m of p.members.filter(m=>!m.isTimingRepresentative))for(const run of r.bundle.challengeRuns){
  const response=m.responseTimeSeconds??0,h=response>0?Math.min(r.options.maxStep,response/4):r.options.maxStep;
  const timeline=prepareCommandTimeline(run.samples,{delaySeconds:m.delaySeconds,responseTimeSeconds:response,beforeStart:r.options.beforeStart});
  const segments=m.delaySeconds>0||response>0?timeline.intervals:run.samples.slice(1).map((s,i)=>[{duration:s.time-run.samples[i].time}]);
  for(const interval of segments)for(const segment of interval)total+=Math.max(1,Math.ceil(segment.duration/h))+Math.max(1,Math.ceil(segment.duration/(h/2)));
 }
 return total;
}
test('whole-family reservation includes original full work and exact coarse/refined increments',()=>{
 const r=controlled(),p=prepareTimingLawForecasts(r);
 assert.equal(p.work.originalReservedSteps,r.work.reservedSteps);
 assert.equal(p.work.additionalReservedSteps,independentAdditional(r,p));
 assert.equal(p.work.totalReservedSteps,p.work.originalReservedSteps+p.work.additionalReservedSteps);
 r.options.maxTotalSteps=p.work.totalReservedSteps;r.work.maxTotalSteps=r.options.maxTotalSteps;
 const exact=prepareTimingLawForecasts(r);assert.equal(exact.status,'ready');
 r.options.maxTotalSteps=p.work.totalReservedSteps-1;r.work.maxTotalSteps=r.options.maxTotalSteps;r.work.completedSteps=0;
 const refused=prepareTimingLawForecasts(r);assert.equal(refused.status,'budget_exceeded');
 assert.throws(()=>executeTimingLawForecasts(refused));
 assert.equal(prepareTimingLawForecasts({...r,options:{...r.options,maxTotalSteps:1000000},work:{...r.work,maxTotalSteps:1000000}}).work.totalReservedSteps,p.work.totalReservedSteps);
});
test('snapshot is immutable, execution cached, and original source/report stay unchanged',()=>{
 const report=actual(),before=JSON.stringify(report),plan=prepareTimingLawForecasts(report);frozen(plan);
 const result=executeTimingLawForecasts(plan);frozen(result);
 assert.equal(executeTimingLawForecasts(plan),result);assert.equal(JSON.stringify(report),before);
 const mutated=clone(report),captured=prepareTimingLawForecasts(mutated);
 mutated.bundle.challengeRuns[0].samples[0].position+=100;
 mutated.bundle.challengeRuns[0].initialRate+=100;mutated.options.beforeStart+=10;
 for(const c of mutated.candidates){c.model.terms[0].coefficient+=100;for(const rec of c.receiving)if(rec.rollout)rec.rollout.rows[0].predicted+=100;}
 assert.deepEqual(executeTimingLawForecasts(captured),result);
 assert.throws(()=>{plan.members.push({});});assert.throws(()=>executeTimingLawForecasts({...plan}));
});
function singleReused(){const r=actual();for(const c of r.candidates.slice(1)){c.status='fit_failed';c.error={message:'Controlled omitted fit'};delete c.discovery;}const c=r.candidates[0];c.discovery.candidates=[c.model];c.discovery.competitive=[c.model];return r;}
test('reused whole-grid failure excludes complete member; refinement failure stays explicit',()=>{
 for(const damage of ['missing','shift','nonfinite','failed']){
  const r=singleReused(),rec=r.candidates[0].receiving[0];
  if(damage==='missing')rec.rollout.rows.pop();
  if(damage==='shift')rec.rollout.rows[1].time+=.0001;
  if(damage==='nonfinite')rec.rollout.rows[1].predicted=NaN;
  if(damage==='failed'){rec.status='failed';rec.error={code:'control_failure',message:'Retained deliberate failure'};}
  const result=executeTimingLawForecasts(prepareTimingLawForecasts(r)),summary=timingLawComparison(result,r.bundle.challengeRuns[0].id);
  assert.equal(summary.candidateCount,1);assert.equal(summary.availableCount,0);assert.equal(summary.unavailable.length,1);assert.deepEqual(summary.rows,[]);
 }
 const r=singleReused(),rec=r.candidates[0].receiving[0];rec.resolution={...rec.resolution,status:'unavailable',reason:'refinement_execution_refused',stepsRefined:null,failure:{code:'numerical_failure',message:'Controlled refinement failure'}};
 const result=executeTimingLawForecasts(prepareTimingLawForecasts(r)),summary=timingLawComparison(result,r.bundle.challengeRuns[0].id);
 assert.equal(result.work.originalRefinementFailuresNotMeasured,true);
 assert.equal(summary.availableCount,1);assert.equal(summary.refinementComparedCount,0);assert.equal(summary.refinementUnavailable.length,1);
 assert.deepEqual(summary.rows.map(row=>row.time),r.bundle.challengeRuns[0].samples.map(row=>row.time));
});
test('empty fitted family produces no invented prediction',()=>{
 const r=actual();for(const c of r.candidates){c.status='fit_failed';c.error={message:'Controlled failed fit'};delete c.discovery;}
 const p=prepareTimingLawForecasts(r);assert.equal(p.status,'empty');assert.equal(p.members.length,0);
 const s=timingLawComparison(executeTimingLawForecasts(p),r.bundle.challengeRuns[0].id);assert.equal(s.candidateCount,0);assert.deepEqual(s.rows,[]);
});
test('independent constant-command oscillator retains gain-versus-bias alternatives',()=>{
 const e=commandTimingExample(),I=1.1,c=.6,k=2.8,g=1.4,b=.07,u=.2;
 const alpha=c/(2*I),omega=Math.sqrt(k/I-alpha*alpha),equilibrium=(g*u+b)/k;
 const A=.35-equilibrium,B=(-.15+alpha*A)/omega;
 const run=clone(e.bundle.trainingRuns[0]);run.inertia=I;run.initialRate=-.15;
 run.samples=Array.from({length:241},(_,i)=>{const time=i*.025;return {time,command:u,position:equilibrium+Math.exp(-alpha*time)*(A*Math.cos(omega*time)+B*Math.sin(omega*time))+(i?.0004*Math.sin(i*1.713):0)};});
 run.source={label:'Independent closed-form constant-command oscillator; deterministic perturbation'};
 const challenge=clone(run);challenge.id='analytic-separate-course';challenge.label='Analytic separate-course execution regression, not blind validation';
 challenge.initialRate=.3;
 const challengeA=-.25-equilibrium,challengeB=(.3+alpha*challengeA)/omega;
 challenge.samples=Array.from({length:241},(_,i)=>{const time=i*.025;return {time,command:u,position:equilibrium+Math.exp(-alpha*time)*(challengeA*Math.cos(omega*time)+challengeB*Math.sin(omega*time))+(i?.0004*Math.sin(i*1.713+.7):0)};});
 const bundle={...e.bundle,trainingRuns:[run],challengeRuns:[challenge]};
 const report=compareCommandTiming(bundle,{...e.options,delays:[0,.04,.08,.12,.16,.2],beforeStart:.2,noiseSigma:.001,ambiguityDelta:6});
 const plan=prepareTimingLawForecasts(report);assert.equal(plan.members.length,12);
 assert.equal(plan.work.reusedMemberCount,6);assert.equal(plan.work.additionalMemberCount,6);
 assert.equal(plan.excludedFitCounts.rankDeficientCandidates,24);
 for(const delay of report.options.delays)assert.deepEqual(plan.members.filter(m=>m.delaySeconds===delay).map(m=>m.modelId).sort(),['command+rate+spring','rate+spring+bias'].sort());
 const before=JSON.stringify(report),result=executeTimingLawForecasts(plan),summary=timingLawComparison(result,challenge.id);
 assert.equal(summary.availableCount,12);assert.equal(summary.refinementComparedCount,12);
 assert.equal(JSON.stringify(report),before);assert.equal(result.work.completedAdditionalSteps,plan.work.additionalReservedSteps);
});
test('actual additional solver refusal is retained without narrowing membership or reclaiming work',()=>{
 const r=controlled(),alternative=r.candidates[0].discovery.candidates[1];
 alternative.id='runaway-control';alternative.terms=[{id:'spring',coefficient:1e18}];
 // Synthetic internal derived-model control: NOT a fitted scientific conclusion.
 const plan=prepareTimingLawForecasts(r),result=executeTimingLawForecasts(plan);
 const member=result.members.find(m=>m.modelId==='runaway-control');assert(member);
 assert(member.receiving.every(receipt=>receipt.origin==='additional'&&receipt.status==='failed'));
 assert.equal(result.work.additionalFailedRunStepsNotMeasured,true);
 assert.equal(result.work.totalReservedSteps,plan.work.totalReservedSteps);
 const summary=timingLawComparison(result,r.bundle.challengeRuns[0].id);
 assert.equal(summary.candidateCount,3);assert.equal(summary.availableCount,2);assert.equal(summary.unavailable.length,1);assert.equal(summary.complete,false);
});
