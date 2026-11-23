import test from 'node:test';
import assert from 'node:assert/strict';
import {designEvolutionExcitation,verifyEvolutionRollout,rolloutEvolution} from '../src/science/operator-rollout.mjs';

const model=(a,b,c=0,k=1)=>({schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',
  terms:[['position',a],['rate',b],['one',c],['command',k]].filter(([,weight])=>weight!==0)
    .map(([tree,weight])=>({tree,weight}))});
const course=(id,offset,initial,step,steps)=>({id,initial,step,steps,
  forcing:{offset,amplitude:0,startFrequency:0,endFrequency:0}});

test('a returning oscillator makes silence uninformative at the physical checkpoints',()=>{
  for(const frequency of [1,2,3]) {
    const k=(2*Math.PI*frequency)**2;
    const laws=[model(-k,0),model(0,0)];
    const silence=course('silence',0,[1,0],1,4), offset=course('offset',.1,[1,0],1,4);
    const d=designEvolutionExcitation(laws,[silence,offset],{resolution:.1,observedIndices:[0]});
    assert.equal(d.selected,'offset');
    assert.ok(Math.abs(d.ranked[0].minimumSeparation-Math.sqrt(.0025*(1+16+81+256)/5))<1e-10);
    assert.ok(d.ranked[1].minimumSeparation<1e-10);
    // Keep plain RK4 available for independent mesh studies. It is unstable on these steps.
    assert.ok(Math.abs(rolloutEvolution(laws[0],silence,1).at(-1)[0])>1e5);
  }
});

test('closed-form states cover six independent constant-coefficient development controls',()=>{
  const rate=1.25, w=6.5, lambda=.75, eq=.4;
  const fixtures=[
    [model(0,0,.3,0),course('ballistic',0,[2,rate],.5,14),t=>[2+rate*t+.15*t*t,rate+.3*t]],
    [model(0,-2,0,1),course('drag',2,[2,rate],.3,17),
      t=>[2+t+(rate-1)*(-Math.expm1(-2*t))/2,1+(rate-1)*Math.exp(-2*t)]],
    [model(-w*w,0),course('spring',w*w*eq,[1,0],.75,17),
      t=>[eq+(1-eq)*Math.cos(w*t),-w*(1-eq)*Math.sin(w*t)]],
    [model(-w*w-lambda*lambda,-2*lambda),course('underdamped',0,[1,-lambda],.65,11),
      t=>[Math.exp(-lambda*t)*Math.cos(w*t),Math.exp(-lambda*t)*(-lambda*Math.cos(w*t)-w*Math.sin(w*t))]],
    [model(-4,-4),course('critical',0,[1,0],.7,12),
      t=>[(1+2*t)*Math.exp(-2*t),-4*t*Math.exp(-2*t)]],
    [model(-3,-4),course('overdamped',0,[2,-4],.9,12),
      t=>[Math.exp(-t)+Math.exp(-3*t),-Math.exp(-t)-3*Math.exp(-3*t)]],
  ];
  for (const [law,experiment,truth] of fixtures) {
    const measured=Array.from({length:experiment.steps+1},(_,j)=>truth(j*experiment.step));
    const gate=verifyEvolutionRollout(law,experiment,measured,{maxError:1e-10,resolutionTolerance:1e-10});
    assert.equal(gate.reason,'within_tolerance',experiment.id);
    const changed=measured.map(row=>[...row]); changed.at(-1)[0]+=.01;
    assert.equal(verifyEvolutionRollout(law,experiment,changed,{maxError:1e-4,resolutionTolerance:1e-8}).reason,'trajectory_mismatch');
  }
});

test('a failed bounded transition excludes only its course',()=>{
  const laws=[model(-1e11,0),model(0,0)];
  const large=course('oversized',0,[1,0],1,1), small=course('small',.1,[1,0],1e-6,2);
  const plan=designEvolutionExcitation(laws,[large,small],{resolution:1e-12});
  assert.equal(plan.selected,'small');
  assert.deepEqual(plan.excluded,[{id:'oversized',reason:'affine_transition_budget'}]);
  assert.equal(verifyEvolutionRollout(laws[0],large,[[1,0],[0,0]],
    {maxError:1,resolutionTolerance:1}).reason,'affine_transition_budget');
});

test('transition uses interval-time dynamics independent of time units',()=>{
  const h=1e150;
  const law=model(-1e-300,0,0,0), experiment=course('scaled',0,[1,0],h,4);
  const observed=Array.from({length:5},(_,i)=>[Math.cos(i),-Math.sin(i)/h]);
  assert.equal(verifyEvolutionRollout(law,experiment,observed,
    {maxError:1e-12,resolutionTolerance:1e-12}).reason,'within_tolerance');
});

test('large finite trajectory differences retain a finite RMS separation',()=>{
  const plan=designEvolutionExcitation([model(100,0),model(0,0)],[course('growth',0,[1,0],4,10)],
    {observedIndices:[0]});
  const rms=Math.hypot(...Array.from({length:11},(_,i)=>Math.cosh(40*i)-1))/Math.sqrt(11);
  assert.ok(Math.abs(plan.ranked[0].minimumSeparation/rms-1)<1e-10);
});

test('equivalent symbolic affine expressions retain an exact observational alias',()=>{
  const base=model(-4,0,0,1);
  const represented={...base,terms:[
    {tree:['div',['mul','position',['add','one','one']],['add','one','one']],weight:-4},
    {tree:['mul','command','one'],weight:1},
    {tree:['sin','command'],weight:1},
    {tree:['sin','command'],weight:-1}
  ]};
  for (const offset of [0,.5,1]) {
    const result=designEvolutionExcitation([base,represented],[course('alias',offset,[1,0],.4,20)]);
    assert.deepEqual(result.unresolvedPairs,[[0,1]]);
    assert.equal(result.ranked[0].minimumSeparation,0);
  }
});
