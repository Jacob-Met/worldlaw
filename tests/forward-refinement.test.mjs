import test from 'node:test';import assert from 'node:assert/strict';
import {createPredictiveChallenge,exportPredictiveChallenge,importPredictiveChallenge} from '../src/predictive-selection/session.mjs';
import {refineForwardCoefficients} from '../src/predictive-selection/refine.mjs';
function oscillator(id,x,v,noise=0){const d=.2,w=Math.sqrt(4-d*d/4),b=(v+d*x/2)/w;return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:v,source:{label:'Independent analytic oscillator with deterministic position contamination',recordingId:id},samples:Array.from({length:161},(_,i)=>{const time=i*.05;return{time,position:Math.exp(-d*time/2)*(x*Math.cos(w*time)+b*Math.sin(w*time))+noise*Math.sin(i*1.731)*Math.sin(i*.317)};})};}
const bundle=()=>({schema:'worldlaw.angular-bundle/v1',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[oscillator('a',1,.2,.003),oscillator('b',-.6,.1,.003)],challengeRuns:[oscillator('c',1.4,-.1)]});
const options={terms:['rate','spring','bias'],maxTerms:3};
test('complete trajectory refinement improves independent analytic challenge without replacing incumbent',()=>{
 const b=bundle(),before=JSON.stringify(b),state=createPredictiveChallenge(b,options,{}),r=state.refinement;
 assert.equal(JSON.stringify(b),before);assert.equal(r.status,'training_improved');assert.deepEqual(r.originalModel,state.selection.selectedModel);
 const old=state.results.find(x=>x.modelId===state.selection.selectedId),candidate=state.results.find(x=>x.modelId.endsWith('~forward-refined'));
 assert.equal(candidate.status,'complete');assert.ok(candidate.rollout.metrics.positionRMSE<old.rollout.metrics.positionRMSE/10);
 assert.ok(r.trials.length<=r.maximumEvaluations);assert.ok(r.reservation.steps<=r.options.maxTotalSteps);
 assert.equal(r.refinedModel.physicalInertia,null);assert.equal(r.refinedModel.absoluteTorqueIdentified,false);
 assert.equal(r.refinedModel.metrics.originalWeakMetricsNotApplicable,true);
 assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(state)),state);
});
test('challenge perturbation cannot select coefficients or alter predictions',()=>{
 const a=createPredictiveChallenge(bundle(),options,{sweeps:3}),changed=bundle();changed.challengeRuns[0].samples[40].position+=10;
 const b=createPredictiveChallenge(changed,options,{sweeps:3});assert.deepEqual(a.refinement,b.refinement);
 assert.deepEqual(a.results.map(x=>x.rollout?.rows.map(r=>r.predicted)),b.results.map(x=>x.rollout?.rows.map(r=>r.predicted)));
 assert.notEqual(a.results.at(-1).rollout.metrics.positionRMSE,b.results.at(-1).rollout.metrics.positionRMSE);
});
test('whole-search budget refusal retains original predictive challenge',()=>{
 const original=createPredictiveChallenge(bundle(),options),refused=createPredictiveChallenge(bundle(),options,{maxTotalSteps:1});
 assert.equal(refused.refinement.status,'refused');assert.match(refused.refinement.error.message,/reservation/);assert.deepEqual(refused.selection,original.selection);assert.deepEqual(refused.results,original.results);
});
test('unresolved baseline produces no candidate and zero-step law cannot invent improvement',()=>{
 const state=createPredictiveChallenge(bundle(),options),model=state.selection.selectedModel;
 const r=refineForwardCoefficients(model,state.bundle.trainingRuns,{maxNumericalDifference:0,sweeps:2});assert.equal(r.status,'baseline_unresolved');assert.equal(r.refinedModel,null);assert.equal(r.trials.length,1);
 const zero={...model,id:'zero',terms:[],equation:'α = 0'},z=refineForwardCoefficients(zero,state.bundle.trainingRuns,{sweeps:1});assert.equal(z.status,'no_training_improvement');assert.equal(z.refinedModel,null);
});
test('failed solver is retained, not promoted as a supported refined law',()=>{
 const state=createPredictiveChallenge(bundle(),options),model=structuredClone(state.selection.selectedModel);model.terms=[{id:'spring',coefficient:1e18,coefficientUnit:'1/s²'}];
 const r=refineForwardCoefficients(model,state.bundle.trainingRuns,{sweeps:1});assert.equal(r.status,'baseline_unresolved');assert.equal(r.refinedModel,null);assert.ok(r.trials[0].runs.every(x=>x.status==='failed'));
});
