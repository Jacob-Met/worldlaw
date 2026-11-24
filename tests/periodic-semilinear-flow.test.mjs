import test from 'node:test';
import assert from 'node:assert/strict';
import {designEvolutionExcitation,verifyEvolutionRollout} from '../src/science/operator-rollout.mjs';
const law=(d,beta)=>({kind:'periodic',schema:'worldlaw.symbolic-evolution/v1',
  terms:[{tree:'dxx',weight:d},...(beta?[{tree:['gradient',['mul','field','field']],weight:beta}]:[]),{tree:'command',weight:1}]});
function course(n,mode,phase=0) {
  return {id:'initial-'+mode,steps:8,step:.1,spacing:.2,
    initial:Array.from({length:n},(_,j)=>.05*Math.cos(2*Math.PI*mode*j/n+phase)),
    forcing:{offset:0,amplitude:.1,startFrequency:.5,endFrequency:.5,spatialMode:1}};
}
// A separate physical-stencil midpoint integrator at 256 steps per interval.
// No operator tree, Fourier symbol, or production stepping primitive is used.
function reference(c,d,beta,substeps) {
  const n=c.initial.length,h=c.step/substeps;
  let x=[...c.initial];const states=[x];
  function rhs(x,t) {
    const f=c.forcing,cycles=f.startFrequency*t+(f.endFrequency-f.startFrequency)*t*t/(2*c.steps*c.step);
    return x.map((field,j)=>{
      const l=x[(j+n-1)%n],r=x[(j+1)%n];
      return d*(l-2*field+r)/c.spacing**2+beta*(r*r-l*l)/(2*c.spacing)+f.offset+
        f.amplitude*Math.sin(2*Math.PI*cycles)*Math.cos(2*Math.PI*f.spatialMode*j/n);
    });
  }
  for(let i=0;i<c.steps;i++){
    for(let k=0;k<substeps;k++){
      const t=(i+k/substeps)*c.step, a=rhs(x,t), b=rhs(x.map((v,j)=>v+h*a[j]/2),t+h/2);
      x=x.map((v,j)=>v+h*b[j]);
    }
    states.push(x);
  }
  return states;
}
test('an alternating orbit keeps an identically zero nonlinear flux at zero resolution',()=>{
  const a=law(.6,.1),b=law(.6,0),c=course(8,4);
  c.initial=Array.from({length:8},(_,j)=>j%2?.05:-.05);
  c.forcing.amplitude=0;c.steps=4;
  const result=designEvolutionExcitation([a,b],[c]);
  assert.deepEqual(result.groups,[[0,1]]);
  assert.equal(result.ranked[0].minimumSeparation,0);
  const physical=Array.from({length:5},(_,i)=>c.initial.map(v=>v*Math.exp(-4*.6*i*c.step/c.spacing**2)));
  assert.equal(verifyEvolutionRollout(a,c,physical,{maxError:1e-13,resolutionTolerance:1e-13}).accepted,true);
  const malformed={...a,terms:[{tree:['gradient',['mul','field','field']],weight:NaN}]};
  assert.throws(()=>designEvolutionExcitation([malformed,b],[c]),/coefficient/);
  const singular={...a,terms:[{tree:'dxx',weight:.6},{tree:['gradient',['div','one','field']],weight:1}]};
  const zero={...c,initial:Array(8).fill(0)};
  assert.equal(designEvolutionExcitation([singular,b],[zero]).excluded[0].reason,'undefined_operator');
});
test('forced nonlinear laws retain the measured resolution and separate at a finer attainable threshold',()=>{
  const a=law(.6,.1),b=law(.6,0),menu=[course(8,4),course(8,1)];
  const wide=designEvolutionExcitation([a,b],menu,{resolution:1e-4});
  assert.deepEqual(wide.excluded,[]);assert.equal(wide.status,'indistinguishable_on_menu');
  const fine=designEvolutionExcitation([a,b],menu,{resolution:1e-6});
  assert.equal(fine.selected,'initial-1');
  for(const c of menu){
    const x=reference(c,.6,.1,256),y=reference(c,.6,0,256);
    const gap=Math.hypot(...x.flatMap((v,i)=>v.map((q,j)=>q-y[i][j])))/Math.sqrt(x.length*x[0].length);
    assert.ok(Math.abs(fine.ranked.find(z=>z.id===c.id).minimumSeparation-gap)<2e-10);
    assert.equal(fine.ranked.find(z=>z.id===c.id).separatedClassPairs,gap>1e-6?1:0);
  }
});
test('changed nonlinear transport, chirps and input domains use independent physical observations',()=>{
  for(const n of [7,9,12])for(const d of [.27,.51])for(const beta of [-.13,.21]){
    const c=course(n,1,.41);c.initial=c.initial.map((v,j)=>v+.017*Math.sin(4*Math.PI*j/n));
    c.spacing=.22;c.forcing.endFrequency=1.2;c.forcing.offset=-.012;
    const observations=reference(c,d,beta,256);
    const gate=verifyEvolutionRollout(law(d,beta),c,observations,{maxError:2e-7,resolutionTolerance:2e-7});
    assert.equal(gate.reason,'within_tolerance');
    const changed=observations.map(r=>[...r]);changed.at(-1)[0]+=.002;
    assert.equal(verifyEvolutionRollout(law(d,beta),c,changed,{maxError:2e-7,resolutionTolerance:2e-7}).reason,'trajectory_mismatch');
  }
  const dense=course(8,1);dense.spacing=.02;
  const small=course(8,1);small.id='small';
  const design=designEvolutionExcitation([law(.6,.1),law(.6,0)],[dense,small]);
  assert.deepEqual(design.excluded,[{id:dense.id,reason:'semilinear_mixing_budget'}]);
});
