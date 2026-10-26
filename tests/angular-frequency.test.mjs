import test from 'node:test';import assert from 'node:assert/strict';
import {discoverAngularFrequency as discover,evaluateAngularFrequency as evaluate,predictAngularFrequency as predict,simulateAngularFrequency as simulate,exportAngularFrequencyInputs,restoreAngularFrequencyInputs} from '../src/science/angular-frequency.mjs';
import {discover as incumbent,evaluate as oldEvaluate,TERMS} from '../src/science/torque-discovery.mjs';
import {createSession} from '../src/session.mjs';
export function course(k=2.371,phase=.41,n=73,shift=0){return Array.from({length:n},(_,i)=>{const command=Math.sin(i*1.31+shift),rate=Math.cos(i*.71+shift),position=-3.1+6.2*(i+.21+shift)/(n+shift);return {command,rate,position,jointTorque:.31+.83*command-.17*rate-1.7*Math.sin(k*position+phase)};});}
test('unfamiliar periods improve independent angles without manually supplied formula',()=>{
  for(const k of [1.713,2.371,3.427]){
    const training=course(k),receiving=course(k,.41,83,.43),fit=discover(training,{noiseSigma:.002});
    const old=incumbent(training,{terms:TERMS.map(t=>t.id),maxTerms:4,noiseSigma:.002});
    const revised=evaluate(fit.selected,receiving).rmse,baseline=oldEvaluate(old.selected,receiving).rmse;
    assert.ok(revised<.006,JSON.stringify({k,revised,chosen:fit.selected.frequency}));assert.ok(revised<baseline/50);
    console.log(JSON.stringify({k,chosen:fit.selected.frequency,baseline,revised,work:fit.work.reserved}));
  }
});
test('absent periodic signal retains nonperiodic baseline; omitted and outside-range laws fail',()=>{
  const rows=course().map(r=>({...r,jointTorque:.31+.83*r.command-.17*r.rate}));
  assert.equal(discover(rows).status,'nonperiodic_preferred');
  assert.equal(discover(course(9.73),{noiseSigma:.001}).status,'residual_mismatch');
  const wrong=course().map(r=>({...r,jointTorque:r.position**4+Math.sin(r.position*7)}));
  assert.equal(discover(wrong,{noiseSigma:.001}).status,'residual_mismatch');
});
test('profile preserves aliases, rank refusals and all original rows',()=>{
  const rows=Array.from({length:61},(_,i)=>({position:(i-30)*Math.PI,rate:0,command:0,jointTorque:Math.sin(.3*(i-30)*Math.PI)}));
  const fit=discover(rows,{min:.1,max:4.1,points:81,noiseSigma:.0001,nuisance:[]});
  assert.ok(fit.competitiveFrequencies.some(k=>Math.abs(k-.3)<1e-8));assert.ok(fit.competitiveFrequencies.some(k=>Math.abs(k-2.3)<1e-8));
  const fixed=discover(course().map(r=>({...r,position:0})));assert.ok(fixed.profile.every(p=>p.selected===null));assert.equal(fixed.training.length,73);
});
test('challenge values never select frequency; source-only replay and work refusal',()=>{
  const training=course(),first=discover(training),copy=JSON.stringify(first);evaluate(first.selected,course().map(r=>({...r,jointTorque:999})));assert.equal(JSON.stringify(first),copy);
  const session=createSession({observations:training,heldOut:course(2.371,.41,83,.43),source:{label:'authored frequency control',kind:'synthetic'}});
  const text=exportAngularFrequencyInputs(session,first.settings),restored=restoreAngularFrequencyInputs(text);assert.deepEqual(discover(restored.session.discovery.observations,restored.settings),first);
  assert.throws(()=>discover(training,{}, {maxWork:1}),/work limit/);
  assert.throws(()=>discover(training.map(r=>({...r,torqueNoiseRatio:2}))),/ratios/);
  assert.throws(()=>restoreAngularFrequencyInputs(JSON.stringify({...JSON.parse(text),selected:first.selected})),/source-only/);
});
test('conjugated maintained solver returns original coordinate dynamics',()=>{
  const model={schema:'worldlaw.angular-frequency-model/v1',frequency:2.3,terms:[{id:'rate',coefficient:-.4}],sine:-1.2,cosine:0};
  const result=simulate(model,{position:.7,rate:.2},{duration:.6,dt:.01,inertia:1.7});
  assert.equal(result.diagnostics.positionToleranceRad,1e-10);assert.equal(result.diagnostics.rateToleranceRadPerSecond,1e-10);assert.equal(result.trajectory[0].position,.7);assert.equal(result.trajectory[0].rate,.2);
  for(const row of result.trajectory)assert.ok(Math.abs(row.jointTorque-predict(model,{command:0,...row}))<1e-12);
  // Independent velocity-Verlet-like midpoint quadrature with very small steps.
  let q=.7,v=.2;const h=.00001;for(let i=0;i<60000;i++){const a=(-.4*v-1.2*Math.sin(2.3*q))/1.7;const vm=v+h*a/2,qm=q+h*v/2;v+=h*(-.4*vm-1.2*Math.sin(2.3*qm))/1.7;q+=h*vm;}
  assert.ok(Math.abs(result.trajectory.at(-1).position-q)<1e-8);assert.ok(Math.abs(result.trajectory.at(-1).rate-v)<1e-8);
  assert.throws(()=>simulate(model,{position:.7,rate:.2},{maxTrials:1}),/budget/);
});
