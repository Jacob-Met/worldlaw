import test from 'node:test';
import assert from 'node:assert/strict';
import {planContinuousExperiment, scheduledAmplitude} from '../src/trajectory/continuous-planner.mjs';

const torque=(id,terms) => ({schema:'worldlaw.torque-model/v1',id,
  terms:Object.entries(terms).map(([id,coefficient])=>({id,coefficient}))});
const rivals=()=>[torque('positive',{command:1}),torque('negative',{command:-1})];
const config=()=>({inertia:1,initialPosition:0,initialRate:0,duration:1,dt:.125,maxStep:.125,
  amplitudeBounds:[-.713,.261],segmentDurations:[.25,.25,.25,.25],positionDomain:[-10,10],
  noiseSigma:.02,minSeparation:0,starts:3,sweeps:3,maxTotalSteps:100000,maxRefinementError:1e-9});

test('reported schedules reproduce every prediction by independent left-held integration',()=>{
  const c=config(), models=rivals(), before=structuredClone({c,models});
  const p=planContinuousExperiment(models,c);
  assert.equal(p.status,'planned');
  assert.deepEqual({c,models},before);
  assert.deepEqual(planContinuousExperiment(models,c),p);
  assert.deepEqual(p.request.segments.map(s=>[s.startIndex,s.endIndex]),[[0,2],[2,4],[4,6],[6,8]]);
  const sum=[];
  for (const [i,sign] of [1,-1].entries()) {
    let x=0,v=0;
    for(let t=0;t<8;t++) {
      const a=sign*p.request.segments[Math.floor(t/2)].amplitude;
      x+=c.dt*v+.5*c.dt*c.dt*a; v+=c.dt*a;
      assert.ok(Math.abs(p.predictions[i].position[t+1]-x)<1e-13);
      if(i===0)sum.push(4*x*x);
    }
  }
  assert.ok(Math.abs(p.objective-Math.sqrt(sum.reduce((a,b)=>a+b,0)/8)/c.noiseSigma)<1e-12);
  assert.ok(p.work.chargedSteps<=p.work.reservedSteps);
  const saved=structuredClone(p);
  c.segmentDurations[0]=5; c.positionDomain[0]=42; models[0].id='changed';
  models[1].terms[0].coefficient=100;
  assert.deepEqual(p,saved);
});

test('unequal adjacent amplitudes switch on exact start indices',()=>{
  const segments=[{startIndex:0,endIndex:2,amplitude:.17},{startIndex:2,endIndex:5,amplitude:-.31}];
  assert.deepEqual([0,1,2,3,4,5].map(i=>scheduledAmplitude(segments,i)),[.17,.17,-.31,-.31,-.31,-.31]);
  assert.throws(()=>scheduledAmplitude(segments,6));
});

test('one identical pair or an invalid third dynamics cannot be dropped from the roster',()=>{
  const c=config();
  let p=planContinuousExperiment([...rivals(),torque('copy',{command:1})],c);
  assert.equal(p.reason,'no_model_separation');
  assert.equal(p.diagnostics.pairCount,3); assert.equal(p.request,null);
  p=planContinuousExperiment([...rivals(),torque('escapes',{bias:1e5})],c);
  assert.equal(p.reason,'no_full_roster_feasible_schedule');
  assert.ok(p.diagnostics.failedRollouts.some(r=>r.modelId==='escapes'&&r.code==='position_domain'));
});
test('budget preflight reserves refinement and refuses before any rollout',()=>{
  const p=planContinuousExperiment(rivals(),{...config(),maxTotalSteps:1});
  assert.equal(p.reason,'step_budget'); assert.equal(p.work.rolloutCalls,0);
  assert.ok(p.work.reservedSteps>2*p.work.coarseStepsPerModel*p.work.maxDesigns);
});
test('incommensurate segment boundary and unregistered acquisition inputs refuse',()=>{
  assert.throws(()=>planContinuousExperiment(rivals(),{...config(),segmentDurations:[.24,.26,.25,.25]}));
  assert.throws(()=>planContinuousExperiment(rivals(),{...config(),observedPositions:[1,2]}));
  assert.throws(()=>planContinuousExperiment(rivals(),{...config(),segmentDurations:[.5,.5]}));
});

test('the selected schedule is withheld when half-step trajectories disagree',()=>{
  const c={...config(),initialPosition:.4,positionDomain:[-1000,1000],maxRefinementError:1e-15};
  const p=planContinuousExperiment([torque('free',{}),torque('linear',{spring:-16})],c);
  assert.equal(p.status,'refused'); assert.equal(p.reason,'numerically_unresolved');
  assert.equal(p.request,null); assert.ok(p.diagnostics.maxRefinementErrorObserved>c.maxRefinementError);
});

test('refined all-pair separation must meet the declared noise-unit floor',()=>{
  const p=planContinuousExperiment(rivals(),config());
  assert.equal(planContinuousExperiment(rivals(),{...config(),minSeparation:p.objective}).status,'planned');
  const q=planContinuousExperiment(rivals(),{...config(),minSeparation:p.objective+1});
  assert.equal(q.reason,'insufficient_separation');
  assert.equal(q.request,null); assert.equal(q.diagnostics.fineObjective,p.objective);
  const c=config(); delete c.minSeparation;
  assert.throws(()=>planContinuousExperiment(rivals(),c),/minSeparation/);
});
