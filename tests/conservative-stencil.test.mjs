import test from 'node:test';
import assert from 'node:assert/strict';
import {predictEvolution, assessEvolution, synthesizeEvolution} from '../src/science/operator-synthesis.mjs';
import {fitLinearColumns} from '../src/science/linear-fit.mjs';
import {verifyEvolutionRollout} from '../src/science/operator-rollout.mjs';

const gradient=(f,r)=>(f(r.right)-f(r.left))/(2*r.spacing);
const laplacian=(f,r)=>(f(r.left)-2*f(r.field)+f(r.right))/r.spacing**2;
const identity=x=>x, square=x=>x*x;
const laws=[
  ['gradient-square',r=>.2*gradient(square,r)],
  ['gradient-tanh',r=>.25*gradient(Math.tanh,r)],
  ['laplacian-sine',r=>.07*laplacian(Math.sin,r)],
  ['laplacian-absolute',r=>.04*laplacian(Math.abs,r)],
  ['linear-diffusion',r=>.08*laplacian(identity,r)],
  ['actuated-flux',r=>.12*gradient(square,r)+.4*r.command]
];
const oldMenu=['mul','sin','tanh','abs'];
const grammar={kind:'periodic',maxNodes:4,maxCandidates:1300,maxTerms:2,beam:8,tolerance:1e-9};
function ring(n,phase) {
  return Array.from({length:n},(_,i)=>.63*Math.cos(2*Math.PI*i/n+phase)+.39*Math.sin(6*Math.PI*i/n-.2*phase)+.1*Math.cos(8*Math.PI*i/n+2*phase));
}
function row(state,i,spacing,command) {
  return {field:state[i],left:state[(i+state.length-1)%state.length],right:state[(i+1)%state.length],spacing,command};
}
function measured(law,grids) {
  return grids.flatMap(([n,phase,h])=>{
    const state=ring(n,phase);
    return state.map((_,i)=>{
      const r=row(state,i,h,.3*Math.cos(phase+4*Math.PI*i/n));return {...r,change:law(r)};
    });
  });
}
// This receiver evaluates the declared physical differences directly and uses
// 32 midpoint steps per saved interval, independently of the model-tree RK4.
function reference(law,course) {
  const {forcing,spacing,steps,step}=course, out=[[...course.initial]];
  let x=[...course.initial];
  const derivative=(x,t)=>x.map((_,j)=>law(row(x,j,spacing,forcing.offset+
    forcing.amplitude*Math.cos(2*Math.PI*forcing.spatialMode*j/x.length)*Math.sin(2*Math.PI*forcing.startFrequency*t))));
  const h=step/32;
  for(let i=0;i<steps;i++) {
    for(let k=0;k<32;k++) {
      const t=(i+k/32)*step, d=derivative(x,t), mid=x.map((v,j)=>v+h*d[j]/2);
      const dm=derivative(mid,t+h/2);x=x.map((v,j)=>v+h*dm[j]);
    }
    out.push(x);
  }
  return out;
}
// Quadratic SINDy control on the same center coordinates and training labels.
// Fit all terms, threshold at 0.01 in source units and refit to convergence.
function fitQuadratic(rows) {
  function features(r) {
    const x=[r.field, gradient(identity,r), laplacian(identity,r), r.command];
    return [1,...x,...x.flatMap((a,i)=>x.slice(i).map(b=>a*b))];
  }
  const xs=rows.map(features), y=rows.map(r=>r.change);
  let support=xs[0].map((_,i)=>i);
  while(true) {
    const fit=fitLinearColumns(support.map(j=>xs.map(r=>r[j])),y);
    assert.ok(fit,'quadratic source design must have full column rank');
    const active=support.filter((_,j)=>Math.abs(fit.coefficients[j])>=.01);
    if(active.length===support.length) return r=>{
      const x=features(r);return support.reduce((a,j,k)=>a+x[j]*fit.coefficients[k],0);
    };
    support=active;
  }
}
const train=[[9,.1,.5],[11,.8,.75],[13,-.6,1]], held=[[10,.39,.4],[15,-1.12,.85]];
test('a cross-spacing collision proves a lower bound for every old-terminal expression',()=>{
  const rows=[{left:0,field:0,right:2,spacing:1,command:0,change:2},
    {left:-.25,field:0,right:.75,spacing:.5,command:0,change:.5}];
  const result=synthesizeEvolution([...rows,...rows],{...grammar,operators:oldMenu,tolerance:.74});
  assert.equal(result.status,'abstained');
  assert.ok(result.training.maxError>=.75);
  const law={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{tree:['gradient',['mul','field','field']],weight:1}]};
  assert.deepEqual(rows.map(r=>predictEvolution(law,r)),[2,.5]);
});
test('six source laws transfer to changed grids and independent trajectory observations',()=>{
  const outcomes=[];
  for(const [name,law] of laws) {
    const rows=measured(law,train),validation=measured(law,held);
    const old=synthesizeEvolution(rows,{...grammar,operators:oldMenu});
    const next=synthesizeEvolution(rows,{...grammar,operators:[...oldMenu,'gradient','laplacian']});
    const sindy=fitQuadratic(rows);
    const sindyMax=Math.max(...validation.map(r=>Math.abs(r.change-sindy(r))));
    const checked=assessEvolution(next.model,validation,1e-9);
    assert.equal(next.status,'candidate',name);
    assert.equal(checked.accepted,true,name);
    const initial=ring(14,-.33),course={id:name,initial,spacing:.63,steps:12,step:.006,
      forcing:{offset:-.09,amplitude:.41,startFrequency:1.25,endFrequency:1.25,spatialMode:2}};
    const gate=verifyEvolutionRollout(next.model,course,reference(law,course),{maxError:1e-6,resolutionTolerance:1e-6});
    assert.equal(gate.reason,'within_tolerance',name);
    outcomes.push([name,sindyMax,old.status,assessEvolution(old.model,validation,1e-9).maxError,checked.maxError,gate.held?.maxError??gate.maxError]);
  }
  assert.equal(outcomes.filter(r=>r[1]<=1e-9).length,1);
  assert.equal(outcomes.filter(r=>r[2]==='candidate').length,1);
  console.log(JSON.stringify(outcomes));
});
test('the first ring cannot identify a second-ring response, and unsupported input is refused',()=>{
  const same={field:.5,left:-.3,right:.8,spacing:1,command:0};
  const r2=(a,b)=>a-4*same.left+6*same.field-4*same.right+b;
  const rows=[r2(-1,0),r2(1,0)].map(change=>({...same,change}));
  const out=synthesizeEvolution([...rows,...rows],{...grammar,operators:[...oldMenu,'gradient','laplacian'],tolerance:.99});
  assert.equal(out.status,'abstained');assert.ok(out.training.maxError>=1);
  for(const tree of [['gradient','command'],['laplacian',['gradient','field']]]) {
    const model={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{tree,weight:1}]};
    assert.throws(()=>predictEvolution(model,same),/Spatial potential/);
  }
});
