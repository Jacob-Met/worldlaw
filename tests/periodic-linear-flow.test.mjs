import test from 'node:test';
import assert from 'node:assert/strict';
import {designEvolutionExcitation,verifyEvolutionRollout} from '../src/science/operator-rollout.mjs';
import {periodicLinearPlan} from '../src/science/periodic-linear-flow.mjs';

const law=terms=>({kind:'periodic',schema:'worldlaw.symbolic-evolution/v1',
  terms:Object.entries(terms).map(([tree,weight])=>({tree,weight}))});
const drive=(n,k,f,step,steps,spacing)=>({id:'mode-'+k,initial:Array(n).fill(0),steps,step,spacing,
  forcing:{offset:0,amplitude:1,startFrequency:f,endFrequency:f,spatialMode:k}});

test('active design chooses the physically visible heat mode at the same drive and cadence',()=>{
  const laws=[law({command:1,dxx:1}),law({command:1})];
  const menu=[1,4].map(k=>drive(8,k,1,1,4,.25));
  const plan=designEvolutionExcitation(laws,menu,{resolution:.01});
  assert.equal(plan.selected,'mode-1');
  for(const c of menu) {
    const k=c.forcing.spatialMode,q=2*Math.PI*k/8,lambda=-4*Math.sin(q/2)**2/c.spacing**2,w=2*Math.PI;
    const target=Array.from({length:5},(_,t)=>Array.from({length:8},(_,j)=>
      Math.cos(q*j)*w*Math.expm1(lambda*t)/(lambda*lambda+w*w)));
    const rms=Math.hypot(...target.flat())/Math.sqrt(40);
    const s=plan.ranked.find(row=>row.id===c.id);
    assert.ok(Math.abs(s.minimumSeparation-rms)<1e-12);
    assert.equal(s.separatedClassPairs,k===1?1:0);
    const check=verifyEvolutionRollout(laws[0],c,target,{maxError:1e-11,resolutionTolerance:1e-11});
    assert.equal(check.reason,'within_tolerance');
  }
});

test('advection resonance includes the persistent phase on every step',()=>{
  const c=drive(4,1,1/(2*Math.PI),.3,15,1);
  const target=Array.from({length:16},(_,i)=>{
    const t=i*c.step;
    return Array.from({length:4},(_,j)=>.5*t*Math.sin(t)*Math.cos(Math.PI*j/2)
      +.5*(t*Math.cos(t)-Math.sin(t))*Math.sin(Math.PI*j/2));
  });
  for(const substeps of [1,2,7]){
    const actual=periodicLinearPlan(law({dx:1,command:1}),c).run(substeps);
    actual.forEach((row,i)=>row.forEach((v,j)=>assert.ok(Math.abs(v-target[i][j])<1e-12)));
  }
});

test('an odd physical grid preserves the DC and conjugate traveling modes',()=>{
  const n=7,mode=2,spacing=.8,q=2*Math.PI*mode/n;
  const c=drive(n,0,0,.45,12,spacing);
  c.forcing={...c.forcing,amplitude:0,offset:.52};
  c.initial=Array.from({length:n},(_,j)=>1.3+.8*Math.cos(q*j)+.2*Math.sin(q*j));
  const rate=-.3,drift=.7,diffusion=.2;
  const lambda=rate-4*diffusion*(Math.sin(q/2)/spacing)**2,omega=drift*Math.sin(q)/spacing;
  const target=Array.from({length:c.steps+1},(_,i)=>{
    const t=c.step*i;
    const mean=1.3*Math.exp(rate*t)+.52*Math.expm1(rate*t)/rate;
    return c.initial.map((_,j)=>mean+Math.exp(lambda*t)*(.8*Math.cos(q*j+omega*t)+.2*Math.sin(q*j+omega*t)));
  });
  assert.equal(verifyEvolutionRollout(law({field:rate,dx:drift,dxx:diffusion,command:1}),c,target,
    {maxError:1e-11,resolutionTolerance:1e-11}).reason,'within_tolerance');
});

test('only the declared linear operator and stationary-frequency drive use the spectral solver',()=>{
  const c=drive(9,1,.1,.1,1,1);
  assert.equal(periodicLinearPlan(law({dx:1}),{...c,forcing:{...c.forcing,endFrequency:.5}}),null);
  const nonlinear=law({});nonlinear.terms.push({tree:['mul','field','dx'],weight:1});
  assert.equal(periodicLinearPlan(nonlinear,c),null);
  const excessive=drive(128,1,0,.01,512,1);
  excessive.initial=Array.from({length:128},(_,i)=>Math.sin(i*2.37)+i*.01);
  const other={...drive(8,1,.1,.01,2,1),id:'small'};
  const selected=designEvolutionExcitation([law({field:1}),law({dx:1})],[excessive,other]);
  assert.equal(selected.selected,other.id);
  assert.deepEqual(selected.excluded,[{id:excessive.id,reason:'periodic_transition_budget'}]);
});

test('equivalent pointwise and conservative source syntax retains zero-resolution groups',()=>{
  const c=drive(8,1,1,.1,10,.5);
  const simple=law({dxx:.1,command:1});
  const expanded=law({});expanded.terms=[
    {tree:['laplacian',['mul','field','one']],weight:.1},
    {tree:['div',['mul','command',['add','one','one']],['add','one','one']],weight:1}
  ];
  const plan=designEvolutionExcitation([simple,expanded,law({command:1})],[c]);
  assert.deepEqual(plan.unresolvedPairs,[[0,1]]);
  const constant={...c,forcing:{...c.forcing,amplitude:0,offset:.5},initial:[1,0,0,0,0,0,0,0]};
  const coupled=law({});coupled.terms=[{tree:['mul','field','command'],weight:1}];
  assert.deepEqual(periodicLinearPlan(coupled,constant).run(1),periodicLinearPlan(law({field:.5}),constant).run(1));
});

test('the mode selector matches closed checkpoint responses across twelve changed heat systems',()=>{
  let passed=0,uniformSum=0,choices=0,visible=0;
  for(const n of [7,8,11,12])for(const diffusion of [.25,1,2]) {
    const menu=Array.from({length:Math.floor(n/2)+1},(_,k)=>drive(n,k,1,1,4,.25));
    const gaps=menu.map(c=>{
      const k=c.forcing.spatialMode,angle=2*Math.PI*k/n,w=2*Math.PI;
      const lambda=-4*diffusion*(Math.sin(angle/2)/c.spacing)**2;
      const rows=Array.from({length:5},(_,t)=>c.initial.map((_,j)=>
        Math.cos(angle*j)*w*Math.expm1(lambda*t)/(lambda**2+w**2)));
      return Math.hypot(...rows.flat())/Math.sqrt(5*n);
    });
    const plan=designEvolutionExcitation([law({dxx:diffusion,command:1}),law({command:1})],menu,{resolution:.01});
    if(Math.max(...gaps)>.01) assert.equal(plan.selected,menu[gaps.indexOf(Math.max(...gaps))].id);
    else assert.equal(plan.status,'indistinguishable_on_menu');
    for(const result of plan.ranked)
      assert.ok(Math.abs(result.minimumSeparation-gaps[menu.findIndex(c=>c.id===result.id)])<1e-12);
    const good=gaps.filter(v=>v>.01).length;
    passed+=Math.max(...gaps)>.01?1:0;uniformSum+=good/menu.length;choices+=menu.length;visible+=good;
  }

  assert.equal(passed,11);assert.equal(visible,27);assert.equal(choices,66);
  assert.ok(Math.abs(uniformSum-506/105)<1e-12);
});
