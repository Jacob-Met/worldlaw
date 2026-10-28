import test from 'node:test';
import assert from 'node:assert/strict';
import {executeStudioDynamics} from '../src/science/studio-dynamics.mjs';
import {compareStudioDynamics} from '../src/science/studio-dynamics-comparison.mjs';
const model = terms => ({schema:'worldlaw.torque-model/v1',terms});
const smooth=model([{id:'bias',coefficient:1}]);
const fixed=model([{id:'bias',coefficient:1},{id:'coulomb',coefficient:-.1}]);
for(const [duration,dt] of [[.07,.01],[.14,.01],[.28,.02],[.3,.1],[.071,.01],[.125,.03125]]) {
 test('complete strictly advancing shared grid '+duration+'/'+dt,()=>{
  const r=compareStudioDynamics({competitive:[smooth,fixed]},{position:0,rate:1},{duration,dt});
  assert.equal(r.status,'completed',JSON.stringify(r.error??r.results));
  for(const row of r.results){
   const t=row.trajectory;
   assert.equal(t.at(-1).time,duration);
   assert.equal(t.filter(x=>x.time===duration).length,1);
   assert.ok(t.every((x,i)=>i===0||x.time>t[i-1].time));
   assert.deepEqual(t.map(x=>x.time),r.results[0].trajectory.map(x=>x.time));
   const acceleration=row.index===0?1:.9;
   assert.ok(Math.abs(t.at(-1).position-(duration+acceleration*duration**2/2))<1e-12);
  }
 });
}
test('real final partial interval retained',()=>{
 const duration=.07000000000000002;
 const t=executeStudioDynamics(smooth,{position:0,rate:1},{duration,dt:.01}).trajectory;
 assert.equal(t.at(-2).time,.07);assert.equal(t.at(-1).time,duration);
});

