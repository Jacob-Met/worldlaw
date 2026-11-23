import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSindy} from '../src/trajectory/sindy-discovery.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

const opts={terms:['command','bias'],noiseSigma:.0001};
function makeRun(id, inertia, command, gain=1.7, bias=.3) {
  let x=.1, v=.22, t=0;
  const samples=[];
  for(let i=0;i<=80;i++) {
    const u=command(i);
    samples.push({time:t,position:x,command:u});
    const dt=.01+.0002*(i%3), a=(gain*u+bias)/inertia;
    x+=v*dt+.5*a*dt*dt; v+=a*dt; t+=dt;
  }
  return {id,label:id,kind:'synthetic',units:{...RUN_UNITS},initialRate:.22,inertia,
    source:{label:'constructed constant-acceleration intervals'},samples};
}
test('irregular clocks/known inertias recover physical coefficients and executable held prediction',()=>{
  const trains=[makeRun('a',.7,()=>-.9),makeRun('b',2.1,()=>.65)];
  const before=structuredClone(trains);
  const result=discoverSindy(trains,opts);
  assert.deepEqual(trains,before);
  assert.equal(result.status,'fit'); assert.deepEqual(result.support,['command','bias']);
  const [gain, bias]=result.selected.terms.map(t=>t.coefficient);
  assert.ok(Math.abs(gain-1.7)<1e-6 && Math.abs(bias-.3)<1e-6);
  const held=makeRun('unseen',1.15,i=>i<40?-.4:.85);
  assert.ok(rollout(result.selected,held).metrics.maxAbsError<1e-6);
  for(const r of trains)r.initialRate=-30;
  assert.deepEqual(discoverSindy(trains,opts).selected,result.selected);
});
test('jump-crossing exclusion is clock/command-only and rightmost endpoint does not drive a window',()=>{
  const run=makeRun('stepped',1,i=>i<40?-.6:.5);
  const r=discoverSindy([run],opts);
  assert.equal(r.status,'fit');
  assert.deepEqual(r.diagnostics.coverage,[{runId:'stepped',sourceRows:81,included:42,
    excludedCrossing:19,excludedEdges:20}]);
  run.samples.at(-1).command=90;
  assert.deepEqual(discoverSindy([run],opts).selected,r.selected);
  run.samples[1].position=NaN;
  assert.throws(()=>discoverSindy([run],opts),/finite/);
});
test('aliased features remain in augmented ridge and the data rank is reported separately',()=>{
  const r=discoverSindy([makeRun('alias',1,()=>1,4,0)],opts);
  assert.equal(r.status,'fit'); assert.deepEqual(r.support,['command','bias']);
  assert.deepEqual(r.diagnostics.aliases,[{left:'command',right:'bias',normalizedSign:1}]);
  assert.equal(r.diagnostics.unregularizedRank,1);
  for(const t of r.selected.terms)assert.ok(Math.abs(t.coefficient-2)<1e-5);
});
test('unconverged sparsity cap and absence of eligible windows both refuse',()=>{
  const runs=[makeRun('a',1,()=>-.7,1,0),makeRun('b',1,()=>.7,1,0)];
  const r=discoverSindy(runs,{...opts,maxIterations:1});
  assert.equal(r.reason,'support_iteration_cap'); assert.equal(r.selected,null);
  assert.equal(discoverSindy(runs,opts).status,'fit');
  const q=discoverSindy([makeRun('alternating',1,i=>(i%2)*2-1)],opts);
  assert.equal(q.reason,'insufficient_derivative_windows'); assert.equal(q.selected,null);
});
test('finite noisy positions and local cubic rate identify a rate-only ODE',()=>{
  const run=makeRun('exponential',1,()=>0);
  for(const [i,row] of run.samples.entries())
    row.position=.4*Math.exp(.8*row.time)+1e-7*((i%2)*2-1);
  const r=discoverSindy([run],{terms:['rate'],noiseSigma:1e-7});
  assert.equal(r.status,'fit');
  assert.ok(Math.abs(r.selected.terms[0].coefficient-.8)<.005);
});
