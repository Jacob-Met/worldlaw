import test from 'node:test';
import assert from 'node:assert/strict';
import {temporalTestWeights,spatialTestWeights,trajectoryOperatorGrammar,stateOperatorEquations} from '../src/science/trajectory-operator-equations.mjs';
import {compileStateTree,prepareStateTrajectory,forecastStateTrajectory,validateStateTrajectory} from '../src/science/state-trajectory.mjs';
import {predictEvolution} from '../src/science/operator-synthesis.mjs';

const dot=(a,b)=>a.reduce((s,v,j)=>s+v*b[j],0);
test('compact temporal adjoint agrees with independent polynomial derivatives and refines',()=>{
  const errors=[];
  for(const n of [31,61,121]) {
    const dt=2/(n-1),w=temporalTestWeights(n,dt),t=Array.from({length:n},(_,j)=>1+j*dt);
    const y=t.map(x=>x**4-2*x*x),dy=t.map(x=>4*x**3-4*x);
    errors.push(Math.abs(dot(w.target,y)-dot(w.value,dy)));
    assert.ok(Math.abs(dot(w.target,t.map(()=>4)))<1e-12);
  }
  assert.ok(errors[2]<errors[1]/10&&errors[1]<errors[0]/10,JSON.stringify(errors));
});
test('periodic spatial adjoints hold for smooth and nonsmooth arrays at two grids',()=>{
  for(const n of [16,32])for(const nonsmooth of [false,true])for(const order of [1,2]) {
    const h=8/n,f=Array.from({length:n},(_,j)=>nonsmooth?(j%3===0?2:-1):Math.sin(2*Math.PI*j/n)+.3*Math.cos(6*Math.PI*j/n));
    const w=spatialTestWeights(n,3,4,h),adj=spatialTestWeights(n,3,4,h,order);
    const derivative=f.map((v,j)=>order===1?(f[(j+1)%n]-f[(j+n-1)%n])/(2*h):(f[(j+1)%n]-2*v+f[(j+n-1)%n])/(h*h));
    assert.ok(Math.abs(dot(w,derivative)-dot(adj,f))<2e-14);
  }
});
test('every grammar expression compiles and conservative nonlinear flux reaches the maintained predictor',()=>{
  for(const kind of ['oscillator','periodic'])for(const tree of trajectoryOperatorGrammar(kind))assert.doesNotThrow(()=>compileStateTree(tree,kind));
  const row={field:.6,left:-.2,right:1.1,spacing:.25,command:.3};
  const m={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{tree:['dx',['mul','field','field']],weight:-.5},{tree:['dxx','field'],weight:.13}]};
  const expected=-.5*(row.right**2-row.left**2)/(2*row.spacing)+.13*(row.left-2*row.field+row.right)/row.spacing**2;
  assert.ok(Math.abs(predictEvolution(m,row)-expected)<1e-13);
  assert.throws(()=>predictEvolution({...m,terms:[{tree:['dx','command'],weight:1}]},row),/field only/);
});
function recording(id='one',refinement=1) {
  return {schema:'worldlaw.state-trajectory/v1',id,kind:'oscillator',samples:Array.from({length:160*refinement+1},(_,j)=>{const t=j*.025/refinement;return {time:t,state:[Math.cos(t),-Math.sin(t)],command:0};})};
}
test('forecast initialization cannot read future states; supplied derivative labels refuse',()=>{
  const a=recording(),b=structuredClone(a);b.id='other';
  for(let j=11;j<b.samples.length;j++)b.samples[j].state=[70+j,80-j];
  const p=prepareStateTrajectory(a),q=prepareStateTrajectory(b);
  assert.deepEqual(p.initial,q.initial);
  const model={schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',terms:[{tree:'position',weight:-1}]};
  const f=forecastStateTrajectory(model,a),g=forecastStateTrajectory(model,b);
  assert.deepEqual(f.states,g.states);
  assert.ok(f.rmse<2e-5);
  const bad=recording();bad.samples[0].change=1;
  assert.throws(()=>validateStateTrajectory(bad),/Derivative labels/);
});
test('state-only weak equations recover the harmonic force without acceleration observations',()=>{
  const errors=[];
  for(const refinement of [1,2]) {
    const eq=stateOperatorEquations([recording('one',refinement)],['position'],{windowPoints:30*refinement+1,stride:5*refinement});
    const fitted=dot(eq.columns[0],eq.target)/dot(eq.columns[0],eq.columns[0]);
    errors.push(Math.abs(fitted+1));assert.equal(eq.coverage[0].stateValues,2*(160*refinement+1));
  }
  assert.ok(errors[1]<3e-6&&errors[1]<errors[0]/8,JSON.stringify(errors));
});

test('public forecasts preserve legacy pointwise spatial derivative models',()=>{
  const n=16,run={schema:'worldlaw.state-trajectory/v1',id:'legacy-burgers',kind:'periodic',spacing:.5,samples:Array.from({length:41},(_,i)=>({time:i*.01,state:Array.from({length:n},(_,j)=>.4+.2*Math.sin(2*Math.PI*j/n)),command:Array(n).fill(0)}))};
  const model={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{tree:['mul','field','dx'],weight:-1},{tree:'dxx',weight:.1}]};
  const forecast=forecastStateTrajectory(model,run);
  assert.equal(forecast.status,'forecast');
  for(const state of forecast.states)assert.ok(Math.abs(state.reduce((a,b)=>a+b,0)/n-.4)<1e-12);
  assert.throws(()=>stateOperatorEquations([run],[['mul','field','dx']],{windowPoints:15,stride:5,spatialRadius:2,spatialStride:2}),/conservative flux/);
});
