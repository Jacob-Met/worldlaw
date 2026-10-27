import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnvironmentOracle,assertEnvironmentOracleNumerics,analyticBundle,analyticChallenge} from '../experiments/shared-environment-oracle-03ae912a3e15.mjs';
import {compareSharedEnvironments,evaluateSharedEnvironments,exportEnvironmentSources,readEnvironmentSources,ENVIRONMENT_PROTOCOL} from '../src/trajectory/shared-environments.mjs';
import {reserveEnvironmentComparison,compareAngularEnvironments} from '../src/trajectory/shared-environment-fit.mjs';

test('independent analytic recovery, wrong-sharing forecast, rank ledger and source separation',()=>{
  const receipt=assertEnvironmentOracleNumerics(runEnvironmentOracle());
  assert.equal(receipt.numericalAcceptance,'passed');
});
test('challenge observations can change forecast errors without changing any training-selected model',()=>{
  const comparison=compareSharedEnvironments(analyticBundle()),before=JSON.stringify(comparison);
  const challenge=analyticChallenge(),a=evaluateSharedEnvironments(comparison,challenge);
  for(const env of challenge.environments)for(const run of env.challengeRuns)
    for(let i=1;i<run.samples.length;i++)run.samples[i].position+=0.02*Math.sin(i*0.071);
  const b=evaluateSharedEnvironments(comparison,challenge);
  assert.equal(JSON.stringify(comparison),before);
  assert.notEqual(a.runs[0].forecasts[0].rollout.metrics.positionRMSE,b.runs[0].forecasts[0].rollout.metrics.positionRMSE);
  assert.deepEqual(a.runs[0].forecasts[0].rollout.rows.map(r=>r.predicted),b.runs[0].forecasts[0].rollout.rows.map(r=>r.predicted));
});
test('source-only notebooks reject changed protocol and do not export fitted answers',()=>{
  const comparison=compareSharedEnvironments(analyticBundle());
  const raw=JSON.parse(exportEnvironmentSources(comparison));
  assert(!('candidates' in raw));assert(!('models' in raw));assert(!('comparison' in raw));
  raw.protocol.maxTerms=5;
  assert.throws(()=>readEnvironmentSources(JSON.stringify(raw)),e=>e.code==='unsupported_protocol');
  assert.throws(()=>{ENVIRONMENT_PROTOCOL.terms[0]='command';},TypeError);
});
test('four-condition expansion reserves complete work and permits sixteen actual parameters',()=>{
  const reservation=reserveEnvironmentComparison(4,64);
  assert.equal(reservation.plans.length,171);
  assert.equal(Math.max(...reservation.plans.map(p=>p.k)),16);
  assert.throws(()=>reserveEnvironmentComparison(4,2049),e=>e.code==='resource_limit');
  assert.throws(()=>reserveEnvironmentComparison(4,64,1),e=>e.code==='resource_limit');
});
test('full raw and prepared bounds refuse before calling the executable-model factory',()=>{
  let calls=0;
  const envs=['a','b'].map(id=>({id,trainingRunIds:[id+'1',id+'2'],rows:Array.from({length:1025},(_,i)=>({runId:id+(i%2+1),target:0,columns:[0,0,0,0,0,1]}))}));
  assert.throws(()=>compareAngularEnvironments(envs,{makeAngularModel:()=>{calls++;}}),e=>e.code==='resource_limit');
  assert.equal(calls,0);
  const raw=analyticBundle();raw.environments[0].trainingRuns[0].samples=Array(9000);
  assert.throws(()=>compareSharedEnvironments(raw),e=>e.code==='invalid_environment_source');
});
