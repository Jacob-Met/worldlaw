import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commandResponseMoments,commandAtSegment,prepareCommandTimeline,normalizeCommandTiming} from '../src/trajectory/command-timeline.mjs';
import {commandTimingExample} from '../src/trajectory/command-timing-example.mjs';
import {commandResponseExample} from '../src/trajectory/command-response-example.mjs';
import {compareCommandTiming,exportCommandTimingInputs,restoreCommandTimingInputs,COMMAND_TIMING_SCHEMA,COMMAND_RESPONSE_SCHEMA} from '../src/trajectory/command-timing-study.mjs';
import {discoverIntegral} from '../src/trajectory/integral-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';

const near=(got,want,absolute=1e-11)=>assert.ok(Math.abs(got-want)<=absolute,`${got} differs from ${want}`);
const selected=r=>r.candidates.find(c=>c.delaySeconds===r.selectedResponse.delaySeconds&&c.responseTimeSeconds===r.selectedResponse.responseTimeSeconds);

test('response moments retain small onset and long decay against 90-digit independent controls',()=>{
  const oracle=JSON.parse(readFileSync(new URL('./fixtures/command-response-moments.json',import.meta.url),'utf8'));
  for(const c of oracle.cases){const got=commandResponseMoments(c.start,c.target,c.duration,c.responseTime);for(const k of ['end','first','second'])near(got[k],c.expected[k],Math.max(1e-300,Math.abs(c.expected[k])*3e-12));}
  assert.deepEqual(commandResponseMoments(.2,1,0,.3),{end:.2,first:0,second:0});
  for(const responseTimeSeconds of [-1,NaN,Infinity,31])assert.throws(()=>normalizeCommandTiming({responseTimeSeconds,beforeStart:0}));
  assert.throws(()=>normalizeCommandTiming({responseTimeSeconds:.2}));
  const {bundle,options}=commandResponseExample();
  const fit=discoverIntegral(bundle.trainingRuns,{...options,commandTiming:{delaySeconds:.04,responseTimeSeconds:.18,beforeStart:2}});
  assert.equal(fit.selected.domain.command.max,2);assert.equal(fit.selected.domain.recordedCommand.max,1);
  assert.equal(fit.selected.domain.command.source,'declared_timing_applied_command');
});

test('filtered held-step superposition agrees at original observations and every RK4 stage',()=>{
  const times=[0,.2,.55,1.1,1.8,2.5],commands=[1,-.4,.8,-.1,.5,9],before=.2,delay=.137,tau=.18;
  const events=times.slice(0,-1).map((t,i)=>({at:t+delay,jump:commands[i]-(i?commands[i-1]:before)}));
  const applied=t=>before+events.reduce((s,e)=>s+(t>e.at?e.jump*(1-Math.exp(-(t-e.at)/tau)):0),0);
  const integral=t=>before*t*t/2+events.reduce((s,e)=>{const h=Math.max(0,t-e.at);return s+e.jump*(h*h/2-tau*h+tau*tau*(1-Math.exp(-h/tau)));},0);
  const run={id:'independent-step',label:'Independent filtered forcing',kind:'synthetic',source:{label:'Authored analytic step superposition'},units:{...RUN_UNITS},inertia:.84,initialRate:.05,
    samples:times.map((time,i)=>({time,command:commands[i],position:.3+.05*time+integral(time)/.84}))};
  const timing={delaySeconds:delay,responseTimeSeconds:tau,beforeStart:before},timeline=prepareCommandTimeline(run.samples,timing);
  timeline.doubleIntegrals.forEach((x,i)=>near(x,integral(times[i]),2e-14));
  for(const segments of timeline.intervals)for(const s of segments)for(const fraction of [0,.25,.5,.75,1])near(commandAtSegment(s,s.duration*fraction),applied(s.start+s.duration*fraction),3e-14);
  const model={schema:'worldlaw.torque-model/v1',id:'command-only',terms:[{id:'command',coefficient:1}]};
  const result=rollout(model,run,{commandTiming:timing,maxStep:.002,maxSteps:10000});
  assert.deepEqual(result.rows.map(x=>x.time),times);assert.equal(result.rows.length,run.samples.length);
  assert.ok(result.metrics.positionRMSE<1e-10);
  assert.equal(result.diagnostics.commandStageEvaluation,'exact_exponential_at_every_RK4_stage');
  assert.throws(()=>rollout(model,run,{commandTiming:timing,maxStep:.1}),e=>e.code==='response_resolution');
});

test('zero response time preserves the maintained delayed fitting and rollout numbers',()=>{
  const {bundle,options}=commandTimingExample(),timing={delaySeconds:.137,beforeStart:options.beforeStart};
  const base=discoverIntegral(bundle.trainingRuns,{...options,commandTiming:timing});
  const next=discoverIntegral(bundle.trainingRuns,{...options,commandTiming:{...timing,responseTimeSeconds:0}});
  assert.deepEqual(next.selected,base.selected);
  const a=rollout(base.selected,bundle.challengeRuns[0],{commandTiming:timing}),b=rollout(base.selected,bundle.challengeRuns[0],{commandTiming:{...timing,responseTimeSeconds:0}});
  assert.deepEqual(b.rows,a.rows);assert.deepEqual(b.metrics,a.metrics);
  assert.deepEqual(prepareCommandTimeline(bundle.trainingRuns[0].samples,{...timing,responseTimeSeconds:0}).doubleIntegrals,prepareCommandTimeline(bundle.trainingRuns[0].samples,timing).doubleIntegrals);
});

test('independent gradual oscillator separates a compensating pure delay from the offered response family',()=>{
  const {bundle,options}=commandResponseExample(),raw=JSON.stringify(bundle);
  const pure=compareCommandTiming(bundle,{...options,responseTimes:undefined}),joint=compareCommandTiming(bundle,options);
  assert.equal(pure.selectedDelay,.2);
  assert.deepEqual(joint.selectedResponse,{delaySeconds:.04,responseTimeSeconds:.18});
  assert.deepEqual(joint.competitiveResponses,[joint.selectedResponse]);assert.equal(joint.candidates.length,20);
  assert.ok(selected(joint).challengeRMSE<.00015);
  assert.ok(pure.candidates.find(c=>c.delaySeconds===pure.selectedDelay).challengeRMSE>50*selected(joint).challengeRMSE);
  near(selected(joint).model.terms.find(t=>t.id==='command').coefficient,1.6,.002);
  assert.equal(JSON.stringify(bundle),raw);assert.equal(joint.bundle.challengeRuns[0].samples.length,241);
});

test('later response observations cannot alter fitted models or the selected delay/response pair',()=>{
  const {bundle,options}=commandResponseExample();const a=compareCommandTiming(bundle,options),changed=structuredClone(bundle);
  changed.challengeRuns[0].samples.forEach((s,i)=>{if(i)s.position+=.1*(i/240)**2;});
  const b=compareCommandTiming(changed,options),frozen=r=>r.candidates.map(c=>({delay:c.delaySeconds,response:c.responseTimeSeconds,score:c.score,model:c.model}));
  assert.deepEqual(frozen(b),frozen(a));assert.deepEqual(b.selectedResponse,a.selectedResponse);
  assert.notEqual(selected(b).challengeRMSE,selected(a).challengeRMSE);
});

test('the full family reserves resolved and genuinely finer command courses before fitting',()=>{
  const {bundle,options}=commandResponseExample();
  const r=compareCommandTiming(bundle,{...options,delays:[0,.04],responseTimes:[0,.004]});
  for(const c of r.candidates.filter(c=>c.responseTimeSeconds>0)){
    assert.equal(c.solverMaxStep,.001);
    for(const received of c.receiving){assert.equal(received.status,'executed');assert.equal(received.resolution.status,'compared');assert.equal(received.resolution.coarseMaxStep,.001);assert.equal(received.resolution.refinedMaxStep,.0005);assert.ok(received.resolution.stepsRefined>received.resolution.stepsCoarse);}
  }
  assert.equal(r.work.completedSteps,r.work.reservedSteps);assert.ok(r.work.completedSteps<=r.work.maxTotalSteps);
  assert.throws(()=>compareCommandTiming(bundle,{...options,responseTimes:[0,.00001]}),e=>e.code==='study_work_limit');
  assert.throws(()=>compareCommandTiming(bundle,{...options,maxTotalSteps:1}),e=>e.code==='study_work_limit');
  assert.throws(()=>compareCommandTiming(bundle,{...options,delays:Array.from({length:17},(_,i)=>i/10),responseTimes:[0,.1,.2,.3]}),/2–64/);
});

test('gradual notebooks cannot silently downgrade and saved answers are recomputed',()=>{
  const {bundle,options}=commandResponseExample(),r=compareCommandTiming(bundle,options),raw=JSON.parse(exportCommandTimingInputs(r));
  assert.equal(raw.schema,COMMAND_RESPONSE_SCHEMA);assert.deepEqual(Object.keys(raw),['schema','bundle','options']);
  const reopened=restoreCommandTimingInputs(JSON.stringify({...raw,selectedResponse:{delaySeconds:30,responseTimeSeconds:30},candidates:[{challengeRMSE:0}]}));
  assert.deepEqual(reopened.selectedResponse,r.selectedResponse);near(selected(reopened).challengeRMSE,selected(r).challengeRMSE,0);
  assert.throws(()=>restoreCommandTimingInputs(JSON.stringify({...raw,schema:COMMAND_TIMING_SCHEMA})),/Gradual response declarations/);
  assert.throws(()=>restoreCommandTimingInputs(JSON.stringify({...raw,options:{...options,responseTimes:undefined}})),/Gradual response declarations/);
  const pure=commandTimingExample();assert.equal(JSON.parse(exportCommandTimingInputs(compareCommandTiming(pure.bundle,pure.options))).schema,COMMAND_TIMING_SCHEMA);
});

test('constant command leaves the joint timing family unexcited and ambiguous',()=>{
  const {bundle,options}=commandResponseExample();for(const run of [...bundle.trainingRuns,...bundle.challengeRuns])run.samples.forEach(s=>{s.command=options.beforeStart;});
  const r=compareCommandTiming(bundle,{...options,noiseSigma:.001});
  assert.equal(r.competitiveResponses.length,r.candidates.length);
  assert.ok(r.qualifications.some(q=>q.includes('Absent command excitation')));
});
