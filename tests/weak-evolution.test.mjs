import assert from 'node:assert/strict';
import test from 'node:test';
import {predictEvolution,synthesizeWeakEvolution} from '../src/science/operator-synthesis.mjs';

test('weak state-only fits never span acquisition boundaries or read change labels',()=>{
  const step=.05,rate=-.375,ratio=(1+rate*step/2)/(1-rate*step/2);
  const runs=[1,-2].map(begin=>({
    values:Array.from({length:65},(_,i)=>[Math.sin(.37*i),begin*ratio**i]),
    commands:Array(65).fill(0),
    get change(){throw Error('derivative oracle was queried');}
  }));
  const options={kind:'oscillator',step,width:12,stride:4,operators:['mul'],maxNodes:1,
    maxCandidates:10,maxTerms:1,beam:4,tolerance:1e-12};
  const fit=synthesizeWeakEvolution(runs,options);
  assert.equal(fit.weak.windows,28);assert.equal(fit.status,'candidate');
  assert.equal(fit.model.terms[0].tree,'rate');assert.ok(Math.abs(fit.model.terms[0].weight-rate)<1e-12);
  assert.throws(()=>synthesizeWeakEvolution([{values:runs[0].values,commands:[]}],options),/trajectory/);
});

test('state-only mixed Fourier trajectories recover an executable second-ring law',()=>{
  const n=13,spacing=2*Math.PI/n,step=.025,beta=.24;
  const modes=[1,2,3,4].map(k=>({k,
    phase:2*Math.atan(step*beta*(Math.sin(2*k*spacing)-2*Math.sin(k*spacing))/(2*spacing**3))}));
  const values=Array.from({length:49},(_,t)=>Array.from({length:n},(_,j)=>
    modes.reduce((s,{k,phase})=>s+Math.cos(k*j*spacing+phase*t+.19*k)/k,0)));
  const fit=synthesizeWeakEvolution([{values,commands:values.map(y=>y.map(()=>0))}],{
    kind:'periodic',step,spacing,width:12,stride:4,operators:['thirdDerivative','biharmonic'],
    maxNodes:2,maxCandidates:16,maxTerms:1,beam:8,tolerance:1e-10});
  assert.equal(fit.weak.windows,130);assert.equal(fit.status,'candidate');
  assert.deepEqual(fit.model.terms[0].tree,['thirdDerivative','field']);
  assert.ok(Math.abs(fit.model.terms[0].weight-beta)<1e-10);
  const probe={field:0,command:0,left:-1,right:2,left2:.4,right2:-1,spacing};
  assert.ok(Math.abs(predictEvolution(fit.model,probe)-beta*(-1-4-2-.4)/(2*spacing**3))<1e-10);
});
