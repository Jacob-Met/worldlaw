import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverAffineOscillator} from '../src/science/affine-transition-identification.mjs';

function physical([a,b,c,g],q,v,u,t){
  const drive=c+g*u;
  if(a===0){
    if(b===0)return [q+t*v+.5*t*t*drive,v+t*drive];
    const terminal=-drive/b;
    return [q+terminal*t+(v-terminal)*Math.expm1(b*t)/b,terminal+(v-terminal)*Math.exp(b*t)];
  }
  const equilibrium=-drive/a,y=q-equilibrium,d=b*b+4*a,p=b/2;
  if(d===0){const z=v-p*y;return [equilibrium+Math.exp(p*t)*(y+t*z),Math.exp(p*t)*(p*(y+t*z)+z)];}
  if(d<0){
    const w=Math.sqrt(-d)/2,cos=Math.cos(w*t),sin=Math.sin(w*t),z=(v-p*y)/w,value=y*cos+z*sin;
    return [equilibrium+Math.exp(p*t)*value,Math.exp(p*t)*(p*value+w*(-y*sin+z*cos))];
  }
  const l=p+Math.sqrt(d)/2,r=p-Math.sqrt(d)/2,x=(v-r*y)/(l-r),z=y-x;
  return [equilibrium+x*Math.exp(l*t)+z*Math.exp(r*t),l*x*Math.exp(l*t)+r*z*Math.exp(r*t)];
}
function courses(params,h,id){
  return [[0,0],[1,0],[-.3,1],[.5,-.8]].map(([q,v],j)=>{
    const values=[[q,v]],intervalCommands=Array.from({length:7},(_,k)=>Math.sin(.83*(k+1)+j)-.2);
    for(const u of intervalCommands)values.push(physical(params,...values.at(-1),u,h));
    return {id:id+'-'+j,step:h,values,intervalCommands,get change(){throw Error('derivative read');}};
  });
}
const gate={positionTolerance:1e-10,velocityTolerance:1e-10};
test('coarse state samples recover physical drag instead of the trapezoidal rate',()=>{
  const params=[0,-2,.2,1.3],fit=recoverAffineOscillator(courses(params,1,'drag'),gate);
  assert.equal(fit.status,'candidate');
  fit.model.terms.forEach((t,j)=>assert.ok(Math.abs(t.weight-params[j])<1e-12));
  const trapezoidalRate=2*Math.tanh(-1);
  assert.ok(Math.abs(Math.exp(trapezoidalRate)-Math.exp(-2))>.08);
});
test('a common period refuses identification and an informative second cadence restores it',()=>{
  const params=[-((2*Math.PI)**2),0,.1,.9],indistinguishable=[-((4*Math.PI)**2),0,-.3,.2];
  const coarse=courses(params,1,'period'),other=courses(indistinguishable,1,'other');
  for(let j=0;j<coarse.length;j++)for(let i=0;i<coarse[j].values.length;i++)
    assert.ok(coarse[j].values[i].every((v,k)=>Math.abs(v-other[j].values[i][k])<1e-11));
  assert.equal(recoverAffineOscillator(coarse,gate).status,'unidentified');
  const changed=recoverAffineOscillator([...coarse,...courses(params,.25,'quarter')],gate);
  assert.equal(changed.status,'candidate');assert.equal(changed.selectedCadence,.25);
  changed.model.terms.forEach((t,j)=>assert.ok(Math.abs(t.weight-params[j])<1e-10));
});
test('signed oscillation, repeated roots and unequal cadences replay every measured transition',()=>{
  for(const [i,params] of [[-2,-.6,-.2,.7],[-4,-4,.3,.8],[-3,-4,.6,-.4],[.4,-.1,-.5,.9],[0,0,1,-.7]].entries()){
    const runs=[...courses(params,.23,'a'+i),...courses(params,.57,'b'+i)];
    const result=recoverAffineOscillator(runs,gate);
    assert.equal(result.status,'candidate');
    result.model.terms.forEach((t,j)=>assert.ok(Math.abs(t.weight-params[j])<1e-10));
    const changed=runs.map(r=>({id:r.id,step:r.step,intervalCommands:r.intervalCommands,values:r.values.map(v=>[...v])}));
    changed.at(-1).values.at(-1)[0]+=.01;
    assert.equal(recoverAffineOscillator(changed,gate).reason,'transition_mismatch');
  }
});
test('unmeasured interval actuation and an unexcited command column do not identify a gain',()=>{
  const runs=courses([0,-.5,0,1],.25,'u');
  assert.throws(()=>recoverAffineOscillator(runs.map(r=>({id:r.id,step:r.step,values:r.values,commands:r.intervalCommands})),gate),/held command/);
  const constant=runs.map(r=>({id:r.id,step:r.step,values:r.values,intervalCommands:r.intervalCommands.map(()=>1)}));
  const result=recoverAffineOscillator(constant,gate);
  assert.equal(result.status,'unidentified');assert.equal(result.diagnostics[0].reason,'rank_deficient_transition');
});

test('identical state-only drag acquisitions expose the exact trapezoidal bias at unit cadence',()=>{
  const runs=[];
  for(const q of [-3,1.7])for(const v of [-.6,1.4])for(const u of [-.2,.7])
    runs.push({id:'drag-'+runs.length,step:1,intervalCommands:Array(19).fill(u),
      values:Array.from({length:20},(_,i)=>[q-v*Math.expm1(-2*i)/2,v*Math.exp(-2*i)])});
  let xy=0,xx=0;
  for(const run of runs)for(let i=1;i<run.values.length;i++){
    const before=run.values[i-1][1],after=run.values[i][1],x=(before+after)/2;
    xy+=x*(after-before);xx+=x*x;
  }
  const approximate=xy/xx,fit=recoverAffineOscillator(runs,gate);
  assert.ok(Math.abs(approximate-2*Math.tanh(-1))<1e-14);
  assert.equal(fit.status,'candidate');
  assert.ok(Math.abs(fit.model.terms[1].weight+2)<1e-12);
  assert.ok(Math.abs(Math.exp(approximate)-Math.exp(-2))>.08);
});
test('a nonphysical transition with a positive determinant still fails full state replay',()=>{
  const runs=courses([-.6,-1,.2,1],.3,'wrong');
  for(const r of runs)for(let i=0;i<r.intervalCommands.length;i++){
    const [q,v]=r.values[i],u=r.intervalCommands[i];
    r.values[i+1]=[1.07*q+.31*v+.2*u+.03,-.06*q+1.08*v+.1*u-.02];
  }
  const result=recoverAffineOscillator(runs,gate);
  assert.equal(result.reason,'transition_mismatch');assert.equal(result.model,null);
});
