import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTorqueObservations,splitTrajectoryEvidence} from '../src/science/trajectory-observations.mjs';
import {discover,evaluate} from '../src/science/torque-discovery.mjs';
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} vs ${b}`);

test('irregular cubic telemetry recovers exact analytic derivatives',()=>{
  const telemetry=Array.from({length:61},(_,i)=>{
    const time=i*.03+(i%3)*.004;
    return {time,position:.3+.2*time-.7*time*time+.11*time**3,command:.1};
  });
  const result=deriveTorqueObservations(telemetry,{inertia:2,positionSigma:.001});
  assert.equal(result.observations.length,55);
  for(const row of result.estimates) {
    near(row.observation.rate,.2-1.4*row.time+.33*row.time**2);
    near(row.acceleration,-1.4+.66*row.time);
    near(row.observation.jointTorque,2*(-1.4+.66*row.time));
    assert.ok(row.jointTorqueSigma>0);
  }
});

test('trajectory consumer recovers restoring law and evaluates a disjoint time block',()=>{
  const telemetry=Array.from({length:401},(_,i)=>{
    const time=i*.025;
    return {time,position:.7*Math.cos(1.3*time),command:0};
  });
  const derived=deriveTorqueObservations(telemetry,{inertia:.8,positionSigma:1e-5});
  const split=splitTrajectoryEvidence(derived,{trainingFraction:.6});
  assert.ok(split.split.trainingRawIndices[1]<split.split.heldOutRawIndices[0]);
  assert.equal(split.split.excludedCrossingWindows,6);
  const discovery=discover(split.observations,{noiseSigma:.0005});
  assert.equal(discovery.selected.id,'spring');
  near(discovery.selected.terms[0].coefficient,-.8*1.3**2,.002);
  assert.ok(evaluate(discovery.selected,split.heldOut).rmse<1e-10);
  // A perfect numerical regression is not proof derivatives were exact.
  assert.ok(Math.abs(discovery.selected.terms[0].coefficient+.8*1.3**2)>1e-5);
});

test('declared position noise propagates linearly and doubles with inertia',()=>{
  const source=Array.from({length:21},(_,i)=>({time:i*.02,position:Math.sin(i*.02),command:0}));
  const a=deriveTorqueObservations(source,{inertia:1,positionSigma:.001});
  const b=deriveTorqueObservations(source,{inertia:2,positionSigma:.002});
  for(let i=0;i<a.estimates.length;i++) near(b.estimates[i].jointTorqueSigma,4*a.estimates[i].jointTorqueSigma,1e-10);
  assert.equal(a.diagnostics.uncertaintySource,'caller_position_sigma');
  const proxy=deriveTorqueObservations(source,{inertia:1});
  assert.equal(proxy.diagnostics.uncertaintySource,'local_polynomial_residual_proxy');
});

test('wrapped-looking angles are flagged and never silently unwrapped',()=>{
  const source=Array.from({length:11},(_,i)=>({time:i*.1,position:i<5?3.1:-3.1,command:0}));
  const result=deriveTorqueObservations(source,{inertia:1});
  assert.equal(result.diagnostics.possibleWraps,1);
  assert.ok(result.diagnostics.warnings.includes('possible_angle_wrap_no_unwrapping_applied'));
  assert.equal(result.source[5].position,-3.1);
});

test('invalid times, inertia, undersized data and even windows fail without rewriting evidence',()=>{
  const source=Array.from({length:11},(_,i)=>({time:i*.1,position:i*.01,command:0}));
  const snapshot=JSON.stringify(source);
  assert.throws(()=>deriveTorqueObservations(source,{inertia:0}));
  assert.throws(()=>deriveTorqueObservations(source,{inertia:1,windowSize:6}));
  assert.throws(()=>deriveTorqueObservations(source.slice(0,4),{inertia:1}));
  assert.throws(()=>deriveTorqueObservations(source.map((row,i)=>({...row,time:i===3?.2:row.time})),{inertia:1}));
  assert.throws(()=>deriveTorqueObservations(source,{inertia:1,positionSigma:-1}));
  assert.equal(JSON.stringify(source),snapshot);
});
