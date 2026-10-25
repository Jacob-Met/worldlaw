import test from 'node:test';
import assert from 'node:assert/strict';
import {weakWindows} from '../src/trajectory/weak-operator.mjs';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

test('interaction integrates held commands without smearing their jumps',()=>{
 const samples=Array.from({length:21},(_,i)=>({time:i/20,position:1+i/20,command:i<10?2:-3}));
 const [row]=weakWindows({samples},{terms:['command_position'],windowDuration:1,windowStride:1},null,(v,m)=>assert.ok(v,m));
 // Independent midpoint quadrature of the continuous, piecewise-held input.
 let expected=0;const n=100000;
 for(let i=0;i<n;i++){const t=(i+.5)/n;expected+=(t<.5?2:-3)*(1+t)*t*t*(1-t)*(1-t)/n;}
 assert.ok(Math.abs(row.columns[0]*row.targetNoiseGain-expected)<1e-10);
 samples.at(-1).command=999;
 const [changed]=weakWindows({samples},{terms:['command_position'],windowDuration:1,windowStride:1},null,(v,m)=>assert.ok(v,m));
 assert.equal(changed.columns[0],row.columns[0]);
});

// Exact piecewise analytic oscillator, independent of maintained RK4.
function run(id,initial,phase=0){
 let position=initial,rate=.13; const dt=.005,samples=[];
 for(let i=0;i<=2400;i++){
  const command=Math.floor((i+phase)/100)%2?.7:-.4;
  samples.push({time:i*dt,position,command});
  const w=Math.sqrt(2-.8*command),c=Math.cos(w*dt),s=Math.sin(w*dt);
  [position,rate]=[position*c+rate*s/w,rate*c-position*w*s];
 }
 return {id,label:id,kind:'synthetic',units:RUN_UNITS,source:{label:'independent analytic oscillator'},inertia:1,initialRate:.13,samples};
}
test('weak interaction law improves a separate analytic trajectory and retains additive failure',()=>{
 const training=run('train',.8),challenge=run('challenge',-.6,51);
 const options={terms:['spring','command_position'],maxTerms:2,noiseSigma:1e-7,windowDuration:.4,windowStride:.2};
 const fit=discoverWeak([training],options);
 assert.equal(fit.selected.terms.length,2);
 assert.ok(Math.abs(fit.selected.terms.find(t=>t.id==='command_position').coefficient-.8)<.001);
 const prediction=rollout(fit.selected,challenge,{maxStep:.0025});
 const additive=discoverWeak([training],{...options,terms:['spring','command'],maxTerms:2});
 const baseline=rollout(additive.selected,challenge,{maxStep:.0025});
 assert.ok(prediction.metrics.positionRMSE<.001);
 assert.ok(baseline.metrics.positionRMSE>prediction.metrics.positionRMSE*100);
 const changed=structuredClone(challenge);changed.samples[100].position+=1;
 assert.deepEqual(rollout(fit.selected,changed,{maxStep:.0025}).rows.map(r=>r.predicted),prediction.rows.map(r=>r.predicted));
});

import {createChallenge,exportChallenge,restoreChallenge} from '../src/trajectory/session.mjs';
test('consumer imports, executes and replays the opt-in family',()=>{
 const bundle={schema:'worldlaw.trajectory-bundle/v1',units:RUN_UNITS,trainingRuns:[run('fit',.8)],challengeRuns:[run('receive',-.6,51)]};
 const options={method:'weak',commandPositionInteraction:true,maxTerms:2,noiseSigma:1e-7,windowDuration:.4,windowStride:.2,maxStep:.005,modelLimit:1};
 const state=createChallenge(bundle,options);
 assert.ok(state.discovery.selected.terms.some(t=>t.id==='command_position'));
 assert.ok(state.summary.selectedPositionRMSE<.001);
 assert.deepEqual(restoreChallenge(exportChallenge(state)),state);
 const saved=JSON.parse(exportChallenge(state));assert.equal(saved.schema,'worldlaw.trajectory-notebook/v2');
 saved.schema='worldlaw.trajectory-notebook/v1';assert.throws(()=>restoreChallenge(JSON.stringify(saved)),/version 2/);
 assert.throws(()=>createChallenge(bundle,{...options,method:'integral'}),/known-inertia weak/);
});

test('constant command cannot identify interaction separately from stiffness',()=>{
 const training=run('constant',.8);
 training.samples.forEach(row=>row.command=2);
 const fit=discoverWeak([training],{terms:['spring','command_position'],maxTerms:2,noiseSigma:1e-7,windowDuration:.4,windowStride:.2});
 assert.equal(fit.diagnostics.fullLibraryRank,1);
 assert.equal(fit.diagnostics.identifiability,'insufficient_excitation');
 assert.ok(fit.diagnostics.rankDeficientCandidates>0);
});

import {readFileSync} from 'node:fs';
import {createExperimentSession,planNextExperiment,exportExperimentSession,restoreExperimentSession} from '../src/trajectory/experiment-session.mjs';
test('v2 preserves a compatible virtual experiment plan and its source-only replay',()=>{
 const bundle=JSON.parse(readFileSync(new URL('../examples/trajectory-ambiguous-92be.json',import.meta.url)));
 const session=planNextExperiment(createExperimentSession(createChallenge(bundle,{method:'weak',commandPositionInteraction:true})));
 const saved=exportExperimentSession(session);assert.equal(JSON.parse(saved).schema,'worldlaw.trajectory-notebook/v2');
 assert.deepEqual(JSON.parse(exportExperimentSession(restoreExperimentSession(saved))),JSON.parse(saved));
 const missing=JSON.parse(saved);delete missing.options.commandPositionInteraction;
 assert.throws(()=>restoreExperimentSession(JSON.stringify(missing)),/explicit command-position/);
});
