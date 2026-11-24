import test from 'node:test';
import assert from 'node:assert/strict';
import {refineTrajectoryOutput} from '../src/trajectory/output-error-fit.mjs';

function recorded(id,q,v,commands,coefficient){
  const step=.17,samples=[],initialRate=v;
  for(let i=0;i<=commands.length;i++){
    const command=commands[Math.min(i,commands.length-1)];
    samples.push({time:i*step,position:q,command,get rate(){throw Error('unobserved rate read');}});
    q+=step*v+.5*step*step*coefficient*command;
    v+=step*coefficient*command;
  }
  return {id,label:id,kind:'synthetic',source:{label:'analytic held acceleration'},inertia:1,
    initialRate,samples};
}
const model=value=>({schema:'worldlaw.torque-model/v1',id:'command',terms:[{id:'command',coefficient:value}]});
test('complete independent position recordings recover a changed gain with no measured later velocities',()=>{
  const commands=[.3,.3,-.9,-.9,.6,1,.2,-.4];
  const a=recorded('first',1,.28,commands,1.37),b=recorded('second',-.52,-.81,commands.toReversed(),1.37);
  const original=model(.8),fit=refineTrajectoryOutput(original,[a,b]);
  assert.ok(Math.abs(fit.model.terms[0].coefficient-1.37)<1e-10);
  assert.equal(original.terms[0].coefficient,.8);assert.equal(fit.before.perRun.length,2);
  assert.ok(fit.after.rms<1e-12&&fit.before.rms>.01);
  assert.deepEqual(fit.model.terms.map(t=>t.id),['command']);
});
test('unobserved parameter directions retain the original and repeated acquisition IDs are refused',()=>{
  const r=recorded('silent',.3,-.2,[0,0,0,0,0],3),source=model(.57);
  const fit=refineTrajectoryOutput(source,[r]);
  assert.equal(fit.reason,'unresolved_sensitivity');assert.equal(fit.acceptedSteps,0);
  assert.deepEqual(fit.before,fit.after);assert.equal(fit.model.terms[0].coefficient,.57);
  assert.throws(()=>refineTrajectoryOutput(source,[r,r]),/distinct/);
});
