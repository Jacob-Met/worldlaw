import test from 'node:test';
import assert from 'node:assert/strict';
import {predictEvolution} from '../src/science/operator-synthesis.mjs';
import {rolloutEvolution,verifyEvolutionRollout,designEvolutionExcitation} from '../src/science/operator-rollout.mjs';
const law=terms=>({schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms});
const course=(initial,spacing,step,steps)=>({id:'field',initial,spacing,step,steps,
  forcing:{offset:0,amplitude:0,startFrequency:0,endFrequency:0,spatialMode:0}});
const third=['thirdDerivative','field'],fourth=['biharmonic','field'];

test('full-ring rollouts supply second neighbors and preserve absent local measurements',()=>{
  const m=law([{tree:fourth,weight:-.001}]),c=course([1,0,-1,0,1,0,-1,0],.25,.05,2);
  assert.equal(predictEvolution(m,{field:1,left:0,right:0,left2:-1,right2:-1,command:0,spacing:.25}),-1.024);
  assert.throws(()=>predictEvolution(m,{field:1,left:0,right:0,command:0,spacing:.25}),/Second spatial neighbors/);
  const measured=Array.from({length:3},(_,i)=>c.initial.map(v=>v*Math.exp(-1.024*i*c.step)));
  const publicPath=rolloutEvolution(m,c,8);
  assert.ok(Math.abs(publicPath[2][0]-measured[2][0])<1e-11);
  assert.equal(verifyEvolutionRollout(m,c,measured,{maxError:1e-12,resolutionTolerance:1e-12}).reason,'within_tolerance');
});

test('dispersive signs, hyperdiffusion and Nyquist cancellation agree with literal five-point stencils',()=>{
  for(const n of [7,8,13]) for(let k=1;k<=Math.floor(n/2);k++) {
    const h=.37,phase=2*Math.PI*k/n;
    const c=course(Array.from({length:n},(_,j)=>Math.cos(phase*j+.21)),h,.2,5);
    const m=law([{tree:third,weight:.07},{tree:fourth,weight:-.002}]);
    const re=-.002*(2*Math.cos(2*phase)-8*Math.cos(phase)+6)/h**4;
    const im=.07*(Math.sin(2*phase)-2*Math.sin(phase))/h**3;
    const measured=Array.from({length:6},(_,i)=>c.initial.map((_,j)=>Math.exp(re*i*c.step)*Math.cos(phase*j+.21+im*i*c.step)));
    assert.equal(verifyEvolutionRollout(m,c,measured,{maxError:1e-11,resolutionTolerance:1e-11}).accepted,true);
    const alt=law([{tree:third,weight:-.07},{tree:fourth,weight:-.002}]);
    const result=designEvolutionExcitation([m,alt],[c],{resolution:1e-10});
    assert.equal(result.status,2*k===n?'indistinguishable_on_menu':'separating_in_simulation');
  }
});

function reference(c,beta,d,kappa,substeps) {
  const n=c.initial.length,h=c.spacing,dt=c.step/substeps,states=[[...c.initial]];
  let x=states[0];
  const rhs=(x,t)=>x.map((v,j)=>{
    const l=x[(j+n-1)%n],r=x[(j+1)%n],ll=x[(j+n-2)%n],rr=x[(j+2)%n],f=c.forcing;
    const cycles=f.startFrequency*t+(f.endFrequency-f.startFrequency)*t*t/(2*c.steps*c.step);
    return beta*(l**3-2*v**3+r**3)/h**2+d*(l-2*v+r)/h**2-kappa*(rr-4*r+6*v-4*l+ll)/h**4+
      f.offset+f.amplitude*Math.cos(2*Math.PI*f.spatialMode*j/n)*Math.sin(2*Math.PI*cycles);
  });
  for(let i=0;i<c.steps;i++){
    for(let s=0;s<substeps;s++){
      const t=(i+s/substeps)*c.step,a=rhs(x,t),b=rhs(x.map((v,j)=>v+dt*a[j]/2),t+dt/2);
      x=x.map((v,j)=>v+dt*b[j]);
    }
    states.push(x);
  }
  return states;
}
test('nonlinear fourth-order fields retain the source flux and the actual actuator phase',()=>{
  for(const n of [7,10,13]) for(const beta of [.09,.17]) for(const kappa of [.002,.006]) {
    const d=-.035,h=.33;
    const c=course(Array.from({length:n},(_,j)=>.27*Math.cos(2*Math.PI*j/n+.2)+.08*Math.sin(4*Math.PI*j/n)),h,.025,10);
    c.forcing={offset:.013,amplitude:.11,startFrequency:.4,endFrequency:1.1,spatialMode:1};
    const m=law([{tree:['laplacian',['mul','field',['mul','field','field']]],weight:beta},
      {tree:'dxx',weight:d},{tree:fourth,weight:-kappa},{tree:'command',weight:1}]);
    const measured=reference(c,beta,d,kappa,128);
    const gate=verifyEvolutionRollout(m,c,measured,{maxError:1e-7,resolutionTolerance:1e-7});
    assert.equal(gate.reason,'within_tolerance');
    const changed=measured.map(row=>[...row]);changed.at(-1)[0]+=.001;
    assert.equal(verifyEvolutionRollout(m,c,changed,{maxError:1e-7,resolutionTolerance:1e-7}).reason,'trajectory_mismatch');
  }
});
