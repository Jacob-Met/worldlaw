import {designContinuousTrajectoryExcitation} from '../src/science/trajectory-continuous-excitation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {periodicStencil,extendedStateBasis} from '../src/science/state-operator-basis.mjs';
import {spatialTestWeights,stateOperatorEquations} from '../src/science/trajectory-operator-equations.mjs';
import {compileStateTree,simulateStateModel,forecastStateTrajectory} from '../src/science/state-trajectory.mjs';
import {discoverTrajectoryEvolution} from '../src/science/trajectory-operator-synthesis.mjs';
const dot=(a,b)=>a.reduce((s,v,j)=>s+v*b[j],0);
const close=(a,b,t=2e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),JSON.stringify({a,b}));
function direct(z,j,h,order){
  const n=z.length,a=k=>z[(j+k+n)%n];
  if(!order)return a(0);
  if(order===1)return (a(1)-a(-1))/(2*h);
  if(order===2)return (a(-1)+a(1)-2*a(0))/(h*h);
  if(order===3)return (a(2)-2*a(1)+2*a(-1)-a(-2))/(2*h*h*h);
  return (a(2)-4*a(1)+6*a(0)-4*a(-1)+a(-2))/(h*h*h*h);
}
test('all five exact periodic adjoints agree on arbitrary states on both producer grids',()=>{
  for(const [n,h] of [[16,2*Math.PI/16],[32,.25]])for(let seed=1;seed<=7;seed++){
    const z=Array.from({length:n},(_,j)=>Math.sin(seed*.71+j*j*.13)+.2*Math.cos(1.7*j+seed));
    for(let order=0;order<=4;order++){
      const w=spatialTestWeights(n,seed%n,3,h,0),adjoint=spatialTestWeights(n,seed%n,3,h,order);
      const dz=z.map((_,j)=>direct(z,j,h,order));
      close(dot(w,dz),dot(adjoint,z));
      z.forEach((_,j)=>close(periodicStencil(z,j,h,order),dz[j]));
    }
  }
});
test('constant and Nyquist modes enforce the odd/even stencil signs',()=>{
  for(const [n,h] of [[16,2*Math.PI/16],[32,.25]]){
    const constant=Array(n).fill(1),nyquist=Array.from({length:n},(_,j)=>(-1)**j);
    for(let j=0;j<n;j++){
      for(let order=1;order<=4;order++)assert.equal(periodicStencil(constant,j,h,order),0);
      assert.equal(periodicStencil(nyquist,j,h,3),0);
      close(periodicStencil(nyquist,j,h,4),16*nyquist[j]/h**4);
    }
  }
});
test('higher spatial operators follow an independent exact Fourier evolution',()=>{
  for(const [n,h,mode] of [[16,2*Math.PI/16,2],[32,.25,3]]){
    const theta=2*Math.PI*mode/n,step=.01,steps=128,c3=.023,c4=-.001;
    const initialEstimate=Array.from({length:n},(_,j)=>Math.cos(theta*j));
    const model={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[
      {tree:['thirdDerivative','field'],weight:c3},{tree:['biharmonic','field'],weight:c4}]};
    const continuousInput={schema:'worldlaw.continuous-input/v1',startTime:0,profile:Array.from({length:n},(_,j)=>Math.cos(2*Math.PI*j/n)),
      waveform:{schema:'worldlaw.hann-bursts/v1',duration:step*steps,cycles:[2.7,4.1,6.3],phases:[.2,-.4,.7],energyShares:[.25,.35,.4],rms:.1,peak:.5}};
    const path=simulateStateModel(model,{initialEstimate,step,steps,spacing:h,continuousInput,substeps:2});
    assert.ok(path);
    const phase=-4*c3*Math.sin(theta)*Math.sin(theta/2)**2/h**3,decay=16*c4*Math.sin(theta/2)**4/h**4;
    for(let i=0;i<path.length;i++)for(let j=0;j<n;j++)close(path[i][j],Math.exp(decay*i*step)*Math.cos(theta*j+phase*i*step),1e-8);
  }
});
test('extended atoms compile in their declared geometries without coefficient ties',()=>{
  for(const kind of ['oscillator','kinetic','periodic']){
    const bank=extendedStateBasis(kind);assert.equal(new Set(bank.map(JSON.stringify)).size,bank.length);
    for(const tree of bank){const c=compileStateTree(tree,kind),y=kind==='periodic'?.7:[.7,-.2],u=kind==='kinetic'?[.1,.2]:.1;assert.ok(Number.isFinite(c.fn(y,u)));}
  }
});
const run=(id,x,y)=>({schema:'worldlaw.state-trajectory/v1',id,kind:'kinetic',samples:Array.from({length:129},(_,i)=>{const t=i*.025;return {time:t,state:[x*Math.exp(-.3*t),y*Math.exp(-.7*t)],command:[0,0]};})});
test('kinetic weak rows recover two independent rates and future state mutations cannot reset forecasts',()=>{
  const training=[run('fit-a',1,2),run('fit-b',2,.7)],selection=[run('selection',.8,1.4)];
  const result=discoverTrajectoryEvolution(training,selection,{estimator:'free-stlsq',windowPoints:33,stride:8,
    grammar:{degree:1,unary:[],rational:false,flux:false},thresholds:[.001,.05],ridges:[1e-8]});
  assert.equal(result.status,'predictive_candidate');assert.equal(result.diagnostics.freeSupport,true);
  assert.equal(result.structuralIdentification,false);assert.deepEqual(result.model.terms.map(t=>t.channel),[0,1]);
  close(result.model.terms[0].weight,-.3,3e-5);close(result.model.terms[1].weight,-.7,3e-5);
  const held=run('unread-test',1.3,.9),changed=structuredClone(held);
  for(const row of changed.samples.slice(17))row.state=[70,-30];
  const a=forecastStateTrajectory(result.model,held,{initialization:'prefix-shooting'});
  const b=forecastStateTrajectory(result.model,changed,{initialization:'prefix-shooting'});
  assert.deepEqual(a.states,b.states);assert.deepEqual(a.prefix,b.prefix);assert.ok(a.rmse<3e-5);
  assert.throws(()=>stateOperatorEquations([training[0]],['state0'],{windowPoints:61,stride:15}),/Insufficient/);
});

test('continuous model design supports two independent kinetic actuator channels',()=>{
  const model={schema:'worldlaw.symbolic-evolution/v1',kind:'kinetic',terms:[
    {tree:'state0',weight:-.3,channel:0},{tree:'state1',weight:-.7,channel:1},
    {tree:'command0',weight:1,channel:0},{tree:'command1',weight:1,channel:1}]};
  const rival=structuredClone(model);rival.terms[0].weight=-.5;
  const discovery={schema:'worldlaw.trajectory-operator-discovery/v1',frontier:[model,rival],selection:{noiseSigma:.01}};
  const request={initialEstimate:[1,2],step:.025,steps:128,profile:[1,0],scales:[.01,.01],
    search:{rms:.1,peak:.5,maxEvaluations:3,cycleBounds:[2,8]}};
  const result=designContinuousTrajectoryExcitation(discovery,request);
  assert.equal(result.status,'designed_in_simulation');assert.ok(result.score>0);
  assert.deepEqual(result.continuousInput.profile,[1,0]);assert.equal(result.evaluations.length,3);
  assert.throws(()=>designContinuousTrajectoryExcitation(discovery,{...request,profile:undefined}),/actuator profile/);
});
