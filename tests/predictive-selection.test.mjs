import test from 'node:test';import assert from 'node:assert/strict';
import {selectPredictiveStructure} from '../src/predictive-selection/select.mjs';
import {createPredictiveChallenge,exportPredictiveChallenge,importPredictiveChallenge} from '../src/predictive-selection/session.mjs';
function oscillator(id,x,v,{frequency=2,damping=.2,duration=8}={}){
 const w=Math.sqrt(frequency**2-damping**2/4),b=(v+damping*x/2)/w;
 return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:v,source:{label:'Independent analytic damped oscillator',recordingId:id},samples:Array.from({length:Math.round(duration/.05)+1},(_,i)=>{const time=i*.05;return {time,position:Math.exp(-damping*time/2)*(x*Math.cos(w*time)+b*Math.sin(w*time))};})};
}
const training=()=>[oscillator('fit-a',1,.2),oscillator('fit-b',-.6,.1)];
const options={terms:['rate','spring','gravity'],maxTerms:2};
const bundle=()=>({schema:'worldlaw.angular-bundle/v1',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:training(),challengeRuns:[oscillator('challenge',1.4,-.1)]});
test('complete fixed structure set predicts each excluded training recording with independent analytic motion',()=>{
 const input=training(),before=JSON.stringify(input),r=selectPredictiveStructure(input,options);
 assert.equal(r.offeredStructureCount,7);assert.equal(r.selectedId,'rate+spring');assert.equal(r.status,'selected');assert.equal(JSON.stringify(input),before);
 const winner=r.results.find(x=>x.id===r.selectedId);assert.ok(winner.validationRMSE<.001);assert.ok(winner.folds.every(f=>f.status==='complete'));
 assert.ok(Math.abs(r.selectedModel.terms.find(t=>t.id==='spring').coefficient+4)<.01);
 assert.ok(winner.folds.every(f=>f.model.id===r.selectedId));assert.equal(r.originalSelectedModel.id,'rate+spring');
});
test('separate challenge values cannot alter selection, fitted coefficients or free predictions',()=>{
 const b=bundle(),original=createPredictiveChallenge(b,options),changed=structuredClone(b);changed.challengeRuns[0].samples[30].position+=3;
 const other=createPredictiveChallenge(changed,options);assert.deepEqual(original.selection,other.selection);
 assert.deepEqual(original.results.map(r=>r.rollout?.rows.map(x=>x.predicted)),other.results.map(r=>r.rollout?.rows.map(x=>x.predicted)));
 assert.notEqual(original.results[0].rollout.metrics.positionRMSE,other.results[0].rollout.metrics.positionRMSE);
 assert.deepEqual(importPredictiveChallenge(exportPredictiveChallenge(original)),original);
});
test('full experiment reservation refuses before offering a partial ranking',()=>{
 assert.throws(()=>selectPredictiveStructure(training(),{...options,maxTotalSteps:1}),/reservation/);
 assert.throws(()=>selectPredictiveStructure(training(),{...options,maxPredictionRows:1}),/reservation/);
 assert.throws(()=>selectPredictiveStructure(training().slice(0,1),options),/2–4/);
});
test('shared recordings and copied raw evidence cannot masquerade as independent folds',()=>{
 const a=training();a[1].source.recordingId=a[0].source.recordingId;assert.throws(()=>selectPredictiveStructure(a,options),/recording/);
 const b=training();b[1].samples=structuredClone(b[0].samples);assert.throws(()=>selectPredictiveStructure(b,options),/repeats|copied/);
});
test('sparse fit and strict numeric-screen failures stay retained without silently promoting survivors across folds',()=>{
 const short=[oscillator('short-a',1,.2,{duration:1.5}),oscillator('short-b',-.6,.1,{duration:8})];
 const r=selectPredictiveStructure(short,options);assert.equal(r.status,'no_complete_candidate');assert.equal(r.selectedModel,null);assert.ok(r.results.every(m=>m.folds.some(f=>f.status==='unavailable')));
 const screened=selectPredictiveStructure(training(),{terms:['spring'],maxTerms:1,maxNumericalDifference:0});
 const spring=screened.results.find(m=>m.id==='spring');assert.equal(spring.status,'incomplete');assert.ok(spring.folds.some(f=>f.status==='numerically_unresolved'));assert.equal(screened.selectedId,null);assert.equal(screened.status,'no_complete_candidate');
});
