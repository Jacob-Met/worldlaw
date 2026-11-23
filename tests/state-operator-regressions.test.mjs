import test from 'node:test';
import assert from 'node:assert/strict';
import {stateOperatorEquations} from '../src/science/trajectory-operator-equations.mjs';
import {discoverTrajectoryEvolution} from '../src/science/trajectory-operator-synthesis.mjs';
import {forecastStateTrajectory,validateStateTrajectory} from '../src/science/state-trajectory.mjs';
import {predictEvolution} from '../src/science/operator-synthesis.mjs';

const geometry={windowPoints:15,stride:5,spatialStride:2,spatialRadius:2};
const checker=j=>j%2===0?1:-1;
function periodic(id,field) {
  return {schema:'worldlaw.state-trajectory/v1',id,kind:'periodic',spacing:1,samples:Array.from({length:49},(_,i)=>({time:i,state:Array.from({length:16},(_,j)=>field(i,j)),command:Array(16).fill(0)}))};
}
function approximately(actual,expected,tolerance=1e-10) { assert.ok(Math.abs(actual-expected)<=tolerance,actual+' != '+expected); }

test('weak target and regressor share the periodic observation filter',()=>{
  const run=periodic('nyquist-ramp',(i,j)=>i*checker(j));
  const equations=stateOperatorEquations([run],['field'],geometry);
  for(const v of equations.target)approximately(v,0);
  for(const v of equations.columns[0])approximately(v,0);
});
for(const method of ['weak','derivative'])test(method+' nonlinear feature is filtered after evaluation',()=>{
  const run=periodic('nyquist-square-'+method,(_,j)=>checker(j));
  const equations=stateOperatorEquations([run],[['mul','field','field']],{...geometry,method});
  for(const v of equations.target)approximately(v,0);
  for(const v of equations.columns[0])approximately(v,1);
});
test('model selection and public forecasting use identical prefix initialization',()=>{
  const training=periodic('zero-training',()=>0),selection=periodic('ramp-selection',(i,j)=>i*checker(j));
  const discovery=discoverTrajectoryEvolution([training],[selection],{...geometry,maxTerms:1,beam:1,grammar:{degree:1,unary:[],rational:false,flux:false}});
  const zero=discovery.candidates.find(candidate=>candidate.model.terms.length===0);
  assert.ok(zero,'zero candidate must be retained');
  const replay=forecastStateTrajectory(zero.model,selection);
  assert.equal(replay.status,'forecast');
  approximately(zero.selectionRmse,replay.rmse);
});
test('uniform clocks reject backward jumps at ordinary and large epochs',()=>{
  for(const origin of [0,1e12]) {
    const run=periodic('clock-'+origin,()=>0);
    for(const sample of run.samples)sample.time+=origin;
    assert.doesNotThrow(()=>validateStateTrajectory(run));
    run.samples[20].time-=10;
    assert.throws(()=>validateStateTrajectory(run),/time|grid|increasing/i);
  }
});
test('undefined AST intermediates cannot be masked by tanh',()=>{
  const model={schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{tree:['tanh',['div','one','command']],weight:1}]};
  assert.throws(()=>predictEvolution(model,{field:1,left:1,right:1,spacing:1,command:0}));
  let forecast;
  try { forecast=forecastStateTrajectory(model,periodic('undefined-intermediate',()=>1)); }
  catch(error) { assert.match(error.message,/undefined|domain|nonfinite|finite/i); return; }
  assert.equal(forecast.status,'diverged');
  assert.equal(forecast.states,null);
});
