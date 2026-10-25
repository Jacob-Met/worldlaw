import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,refitDiscovery,evaluate,predict,simulate} from '../src/science/torque-discovery.mjs';
import {parseObservationText,observationsCSV,validateDataset} from '../src/data.mjs';
import {createSession,newVirtualSession,refitSession,appendMeasurements,sessionPlan,sessionPilotPlan,exportSession,restoreSession,undoSession} from '../src/session.mjs';
import {authoredMixedPrecision} from './fixtures/weighted-readings.mjs';
import {compareCommandDeadzones,evaluateDeadzone,exportDeadzoneInputs,restoreDeadzoneInputs} from '../src/science/command-deadzone.mjs';
const options={loss:'weighted_least_squares',noiseSigma:.01};
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('whitened QR agrees with independent weighted mean and two-parameter closed forms',()=>{
  const rows=Array.from({length:17},(_,i)=>({command:(i-8)/3,position:0,rate:0,jointTorque:1.8*(i-8)/3-.7+Math.sin(i*2.3),torqueNoiseRatio:1+i%4}));
  const sums=rows.reduce((s,r)=>{const w=1/r.torqueNoiseRatio**2;return {w:s.w+w,x:s.x+w*r.command,y:s.y+w*r.jointTorque,xx:s.xx+w*r.command**2,xy:s.xy+w*r.command*r.jointTorque};},{w:0,x:0,y:0,xx:0,xy:0});
  const d=discover(rows,{...options,terms:['command','bias'],maxTerms:2}),fit=d.candidates.find(m=>m.id==='command+bias');
  const slope=(sums.w*sums.xy-sums.x*sums.y)/(sums.w*sums.xx-sums.x**2),intercept=(sums.y-slope*sums.x)/sums.w;
  near(fit.terms[0].coefficient,slope,1e-12);near(fit.terms[1].coefficient,intercept,1e-12);
  near(d.candidates.find(m=>m.id==='bias').terms[0].coefficient,sums.y/sums.w,1e-12);
  near(fit.metrics.weighted.relativeNoiseRmse,Math.sqrt(rows.reduce((s,r)=>s+((r.jointTorque-slope*r.command-intercept)/r.torqueNoiseRatio)**2,0)/rows.length),1e-12);
});

test('unit ratios reproduce every ordinary candidate and noise-unit changes preserve ranking',()=>{
  const source=authoredMixedPrecision(),unit=source.observations.map(r=>({...r,torqueNoiseRatio:1}));
  const ordinary=discover(unit,{noiseSigma:.01}),weighted=discover(unit,options);
  assert.equal(weighted.selected.id,ordinary.selected.id);
  assert.deepEqual(weighted.candidates.map(m=>({id:m.id,terms:m.terms,rmse:m.metrics.rmse,score:m.metrics.score,condition:m.metrics.conditionEstimate})),ordinary.candidates.map(m=>({id:m.id,terms:m.terms,rmse:m.metrics.rmse,score:m.metrics.score,condition:m.metrics.conditionEstimate})));
  const base=discover(source.observations,options),scaled=discover(source.observations.map(r=>({...r,torqueNoiseRatio:r.torqueNoiseRatio*7})),{...options,noiseSigma:.01/7});
  assert.deepEqual(scaled.candidates.map(m=>m.id),base.candidates.map(m=>m.id));
  for(const m of base.candidates){const other=scaled.candidates.find(v=>v.id===m.id);m.terms.forEach((t,i)=>near(t.coefficient,other.terms[i].coefficient));near(other.metrics.score-m.metrics.score,-2*121*Math.log(7),1e-9);}
  near(scaled.diagnostics.trainingRmseInNoiseUnits,base.diagnostics.trainingRmseInNoiseUnits);
});

test('mixed-precision source improves separate predictions while keeping all raw readings and errors',()=>{
  const source=authoredMixedPrecision(),before=JSON.stringify(source);
  const ordinary=discover(source.observations,{noiseSigma:.01}),weighted=discover(source.observations,options);
  assert.equal(weighted.selected.id,'command+spring+quadratic');
  assert.ok(evaluate(ordinary.selected,source.heldOut).rmse>20*evaluate(weighted.selected,source.heldOut).rmse);
  assert.ok(evaluate(weighted.selected,source.heldOut).rmse<.02);
  assert.equal(weighted.candidates.length,ordinary.candidates.length);
  assert.ok(weighted.selected.metrics.rmse>1);
  assert.ok(weighted.selected.metrics.weighted.relativeNoiseRmse<.02);
  assert.equal(weighted.diagnostics.adequacy,'not_falsified_on_training');
  assert.equal(weighted.diagnostics.adequacyMetric,'relative_noise_rmse');
  assert.deepEqual(weighted.observations,source.observations);assert.equal(JSON.stringify(source),before);
  assert.ok(Number.isFinite(predict(weighted.selected,{command:.2,position:.7,rate:-.3})));
  assert.equal(simulate(weighted.selected,{position:.7,rate:-.3},{duration:.5,dt:.01}).at(-1).time,.5);
});

test('wrong precision declarations can worsen prediction and are not reported as verified reliability',()=>{
  const source=authoredMixedPrecision(),wrong=source.observations.map((r,i)=>({...r,torqueNoiseRatio:i<25?200:1}));
  const right=discover(source.observations,options),bad=discover(wrong,options);
  assert.ok(evaluate(bad.selected,source.heldOut).rmse>20*evaluate(right.selected,source.heldOut).rmse);
  assert.equal(bad.diagnostics.adequacy,'residual_mismatch');
  assert.ok(bad.diagnostics.limitations.some(s=>s.includes('Wrong ratios')));
  const conceal=discover(wrong.map(r=>({...r,torqueNoiseRatio:1e6})),options);
  assert.equal(conceal.diagnostics.adequacy,'not_falsified_on_training');assert.ok(conceal.selected.metrics.rmse>1,'large declarations can conceal raw mismatch; retain that failure visibly');
});

test('missing, partial, invalid and underidentified declarations do not gain a successful weighted fallback',()=>{
  const rows=authoredMixedPrecision().observations;
  assert.throws(()=>discover(rows.map(({torqueNoiseRatio,...r})=>r),options),/every original training row/);
  for(const value of [0,-1,NaN,Infinity,1e-7,1e7,'1',undefined])assert.throws(()=>discover(rows.map((r,i)=>i?{...r}:{...r,torqueNoiseRatio:value}),options),/torqueNoiseRatio/);
  const partial=structuredClone(rows);delete partial[3].torqueNoiseRatio;assert.throws(()=>discover(partial,options),/every row/);
  const staticRows=Array.from({length:12},()=>({command:0,position:0,rate:0,jointTorque:0,torqueNoiseRatio:1}));
  assert.equal(discover(staticRows,options).diagnostics.identifiability,'insufficient_excitation');
  const concentrated=Array.from({length:16},(_,i)=>({command:i<8?1:i,position:i<8?1:-i,rate:0,jointTorque:i<8?2:i,torqueNoiseRatio:i<8?1e-6:1e6}));
  const weak=discover(concentrated,{...options,terms:['command','spring'],maxTerms:2});
  assert.ok(weak.diagnostics.rankDeficientCandidates>0);assert.equal(weak.diagnostics.identifiability,'insufficient_excitation');
});

test('private fit reuse includes every ratio and cannot cross losses or accept public metric edits',()=>{
  const rows=authoredMixedPrecision().observations,ordinary=discover(rows,{noiseSigma:.01}),weighted=refitDiscovery(ordinary,options);
  assert.deepEqual(weighted,discover(rows,options));assert.deepEqual(refitDiscovery(weighted,{noiseSigma:.01}),ordinary);
  const revised={...options,noiseSigma:.02};assert.deepEqual(refitDiscovery(weighted,revised),discover(rows,revised));
  weighted.selected.fitting.loss='forged';weighted.selected.metrics.weighted.relativeNoiseRmse=0;weighted.selected.terms[0].coefficient=1e9;
  assert.deepEqual(refitDiscovery(weighted,revised),discover(rows,revised));
  weighted.observations[30].torqueNoiseRatio=.1;
  assert.deepEqual(refitDiscovery(weighted,options),discover(weighted.observations,options));
  const robust=refitDiscovery(ordinary,{loss:'soft_l1',lossScale:2,noiseSigma:.01});
  assert.deepEqual(refitDiscovery(robust,options),discover(rows,options));
});

test('CSV and v3 JSON retain declared ratios exactly and reject partial or legacy declarations',()=>{
  const source=authoredMixedPrecision(),csv=observationsCSV(source.observations),parsed=parseObservationText(csv);
  assert.equal(parsed.schema,'worldlaw.observations/v3');assert.deepEqual(parsed.observations,source.observations);
  assert.deepEqual(parseObservationText(JSON.stringify(source)).observations,source.observations);
  assert.equal(parsed.source.units.torqueNoiseRatio,'1');
  assert.throws(()=>validateDataset({...source,schema:'worldlaw.observations/v1'}),/v3/);
  assert.throws(()=>parseObservationText(csv.replace(/,200\n/,',\n')),/decimal/);
  const bad=structuredClone(source);delete bad.observations[2].torqueNoiseRatio;assert.throws(()=>validateDataset(bad),/every row/);
  assert.throws(()=>validateDataset({...source,units:{command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m',torqueNoiseRatio:'N·m'}}),/dimensionless/);
  const plain=source.observations.map(({torqueNoiseRatio,...r})=>r);assert.equal(parseObservationText(observationsCSV(plain)).schema,'worldlaw.observations/v1');
});

test('v4 input-only replay preserves ratios, every prior assumption, append, undo and forged-answer refusal',()=>{
  const source=authoredMixedPrecision(),initial=createSession(source),weighted=refitSession(initial,options),raw=JSON.parse(exportSession(weighted));
  assert.equal(raw.schema,'worldlaw.session/v4');assert.equal(raw.discovery,undefined);assert.deepEqual(raw.base.observations,source.observations);
  assert.deepEqual(restoreSession(exportSession(weighted)),weighted);assert.deepEqual(undoSession(weighted),initial);
  assert.equal(JSON.parse(exportSession(initial)).schema,'worldlaw.session/v4','ordinary fits still preserve ratio-bearing source');
  for(const schema of ['worldlaw.session/v1','worldlaw.session/v2','worldlaw.session/v3'])assert.throws(()=>restoreSession(JSON.stringify({...raw,schema})),/v4/);
  raw.discovery={selected:{id:'forged'} };assert.deepEqual(restoreSession(JSON.stringify(raw)),weighted);
  const row={command:.2,position:.3,rate:.4,jointTorque:.32-.21-.23*.16,torqueNoiseRatio:2};
  const added=appendMeasurements(weighted,[row]);assert.equal(added.discovery.observations.length,122);assert.deepEqual(restoreSession(exportSession(added)),added);assert.deepEqual(undoSession(added),weighted);
  assert.throws(()=>appendMeasurements(weighted,[{command:.2,position:.3,rate:.4,jointTorque:0}]),/every row/);
  const again=refitSession(weighted,{loss:'least_squares'});assert.deepEqual(restoreSession(exportSession(again)),again);
  assert.throws(()=>refitSession(newVirtualSession(),options),/torqueNoiseRatio/);
});

test('held-out ratios and outcomes cannot change fitting, ranking, planner or source assumptions',()=>{
  const source=authoredMixedPrecision(),a=createSession(source,options),b=createSession({...source,heldOut:source.heldOut.map(r=>({...r,jointTorque:r.jointTorque+1000,torqueNoiseRatio:.0001}))},options);
  assert.deepEqual(a.discovery,b.discovery);assert.deepEqual(sessionPlan(a),sessionPlan(b));
  assert.notEqual(a.history[0].heldOutRMSE,b.history[0].heldOutRMSE);
  assert.equal(evaluate(a.discovery.selected,a.base.heldOut).relativeNoiseRmse,undefined);
  assert.ok(evaluate(b.discovery.selected,b.base.heldOut).relativeNoiseRmse>1e6);
});

test('weighted v3 sources preserve explicit offered-input v2 semantics through v4 notebooks',()=>{
  const original=authoredMixedPrecision();
  for(const offeredInputs of [[],[{command:2.123,position:1.234,rate:-.456}]]) {
    const source=validateDataset({...original,offeredInputs}),state=createSession(source,options);
    assert.equal(source.schema,'worldlaw.observations/v3');
    assert.deepEqual(state.base.offeredInputs,offeredInputs);
    const restored=restoreSession(exportSession(state));
    assert.deepEqual(restored,state);assert.deepEqual(restored.base.offeredInputs,offeredInputs);
    assert.deepEqual(sessionPlan(restored),sessionPlan(state));
    assert.deepEqual(sessionPilotPlan(restored),sessionPilotPlan(state));
    if(!offeredInputs.length)assert.equal(sessionPlan(state).status,'no_unobserved_inputs');
    else assert.deepEqual(sessionPlan(state).selected.input,offeredInputs[0]);
    assert.throws(()=>validateDataset({...source,schema:'worldlaw.observations/v2'}),/v3/);
  }
  const plain=original.observations.map(({torqueNoiseRatio,...r})=>r);
  const legacy=validateDataset({schema:'worldlaw.observations/v2',observations:plain,offeredInputs:[]});
  assert.equal(legacy.schema,'worldlaw.observations/v2');assert.deepEqual(legacy.offeredInputs,[]);
  assert.throws(()=>validateDataset({schema:'worldlaw.observations/v2',observations:plain}),/offeredInputs/);
});

test('maintained command-map comparison retains the same ratio-bearing source and estimator at every width',()=>{
  const source=authoredMixedPrecision(),state=createSession(source,options),report=compareCommandDeadzones(state.discovery.observations,[0,.2,.4],state.discovery.options);
  assert.deepEqual(report.training,source.observations);
  assert.equal(report.options.loss,'weighted_least_squares');
  assert.deepEqual(report.candidates[0].model,state.discovery.selected);
  assert.ok(report.candidates.every(c=>c.model.fitting.loss==='weighted_least_squares'));
  const received=restoreDeadzoneInputs(exportDeadzoneInputs(state,[0,.2,.4]));
  assert.deepEqual(received.session,state);assert.deepEqual(received.widths,[0,.2,.4]);
  assert.equal(evaluateDeadzone(report.candidates[0],source.heldOut).rmse,evaluate(state.discovery.selected,source.heldOut).rmse);
});
