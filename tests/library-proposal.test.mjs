import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeScalarLibrary} from '../src/science/library-proposal.mjs';
import {evaluate,DEFAULT_TERMS} from '../src/science/torque-discovery.mjs';
import {createSession,refitSession,exportSession,restoreSession,undoSession,appendMeasurements} from '../src/session.mjs';

function course(n,phase,law) {
  return Array.from({length:n},(_,i)=>{
    const position=1.8*Math.sin((i+phase)*2.17),rate=1.3*Math.cos((i+phase)*1.43),command=Math.sin((i+phase)*.77);
    return {position,rate,command,jointTorque:.8*command-.3*rate-1.2*position+law(position,rate,command)};
  });
}
test('unfamiliar cubic course proposes an executable revision without naming the omitted term',()=>{
  const training=course(97,0,p=>-.65*p**3);
  const held=course(61,.731,p=>-.65*p**3);
  const result=proposeScalarLibrary(training);
  assert.equal(result.status,'proposed');
  assert.deepEqual(result.addedTerms,['cubic']);
  assert.ok(evaluate(result.expanded.selected,held).rmse<1e-10);
  assert.ok(evaluate(result.baseline.selected,held).rmse>.01);
  assert.deepEqual(training,course(97,0,p=>-.65*p**3));
  assert.deepEqual(result.baseline.options.terms,DEFAULT_TERMS);
});
test('phase and directional response revisions reuse maintained executable features',()=>{
  for(const [term,law] of [['cosine',p=>.7*Math.cos(p)],['rate_squared',(p,r)=>.6*r*r],['command_position',(p,r,u)=>.8*p*u]]) {
    const result=proposeScalarLibrary(course(103,.21,law));
    assert.equal(result.status,'proposed');assert.deepEqual(result.addedTerms,[term]);
    assert.ok(evaluate(result.expanded.selected,course(71,.713,law)).rmse<1e-10);
  }
});
test('unchanged law does not claim gain; omitted physics remains falsified',()=>{
  assert.equal(proposeScalarLibrary(course(97,.4,()=>0)).status,'no_clear_revision');
  const failure=proposeScalarLibrary(course(113,.51,(p,r,u)=>2*Math.sin(4*u)));
  assert.equal(failure.expanded.diagnostics.adequacy,'residual_mismatch');
});
test('no partial course or invalid baseline can masquerade as a proposal',()=>{
  assert.throws(()=>proposeScalarLibrary(course(4096,0,p=>p**3)),e=>e.code==='work_limit');
  assert.throws(()=>proposeScalarLibrary(course(20,0,()=>0),{terms:['unknown']}));
  assert.throws(()=>proposeScalarLibrary(course(20,0,()=>0),{loss:'unsupported'}));
  assert.throws(()=>proposeScalarLibrary(course(97,0,()=>0),{loss:'soft_l1',lossScale:.03}),e=>e.code==='work_limit');
});
test('ordinary session applies and independently replays original-source library revisions',()=>{
  const observations=course(97,.29,p=>-.65*p**3),heldOut=course(61,.731,p=>-.65*p**3);
  const state=createSession({observations,heldOut});
  const proposal=proposeScalarLibrary(state.discovery.observations,state.discovery.options);
  const revised=refitSession(state,{additionalTerms:proposal.addedTerms});
  assert.equal(revised.history.length,2);assert.ok(revised.history[1].heldOutRMSE<1e-10);
  const exported=exportSession(revised),raw=JSON.parse(exported);
  assert.equal(raw.schema,'worldlaw.session/v5');assert.equal(raw.discovery,undefined);
  assert.deepEqual(restoreSession(exported).discovery.selected,revised.discovery.selected);
  assert.deepEqual(undoSession(revised).discovery.selected,state.discovery.selected);
  assert.equal(appendMeasurements(revised,course(1,21.4,p=>-.65*p**3)).discovery.observations.length,98);
  raw.schema='worldlaw.session/v3';assert.throws(()=>restoreSession(JSON.stringify(raw)),/v5/);
  const changedHoldout=createSession({observations,heldOut:heldOut.map(row=>({...row,jointTorque:999}))});
  assert.deepEqual(proposeScalarLibrary(changedHoldout.discovery.observations,changedHoldout.discovery.options),proposal);
});
test('weighted v4 and expanded v5 histories compose without losing original ratios',()=>{
  const observations=course(97,.29,p=>-.65*p**3).map((row,i)=>({...row,torqueNoiseRatio:i%3?1:5}));
  const state=createSession({schema:'worldlaw.observations/v3',observations},{loss:'weighted_least_squares'});
  assert.equal(JSON.parse(exportSession(state)).schema,'worldlaw.session/v4');
  const proposal=proposeScalarLibrary(state.discovery.observations,state.discovery.options);
  assert.equal(proposal.expanded.options.loss,'weighted_least_squares');
  assert.deepEqual(proposal.addedTerms,['cubic']);
  const revised=refitSession(state,{additionalTerms:proposal.addedTerms});
  const raw=JSON.parse(exportSession(revised));assert.equal(raw.schema,'worldlaw.session/v5');
  const restored=restoreSession(JSON.stringify(raw));
  assert.deepEqual(restored.discovery.selected,revised.discovery.selected);
  assert.deepEqual(restored.base.observations,observations);
  raw.schema='worldlaw.session/v4';assert.throws(()=>restoreSession(JSON.stringify(raw)),/v5/);
  const old=JSON.parse(exportSession(state));old.schema='worldlaw.session/v3';assert.throws(()=>restoreSession(JSON.stringify(old)),/v4/);
});
