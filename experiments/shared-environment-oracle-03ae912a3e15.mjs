/** Independent analytic oracle, designed by the retained independent reviewer.
 * Closed-form damped oscillators; no fitted or generated observations from WORLDLAW.
 */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {compareSharedEnvironments,makeEnvironmentAngularModel,evaluateSharedEnvironments,exportEnvironmentSources,readEnvironmentSources} from '../src/trajectory/shared-environments.mjs';
import {compareAngularEnvironments} from '../src/trajectory/shared-environment-fit.mjs';
import {rolloutAngular} from '../src/trajectory/angular-discovery.mjs';
const MODES=['pooled','shared-restoring','independent'];
const TERMS=['rate','coulomb','spring','gravity','quadratic','bias'];
const units={time:'s',position:'rad',initialRate:'rad/s'};
function run(spec,amplitude,phase,dt,id){
  const omega=Math.sqrt(spec.k-spec.gamma**2);
  const position=t=>amplitude*Math.exp(-spec.gamma*t)*Math.cos(omega*t+phase);
  return {id,label:id,kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,
    initialRate:amplitude*(-spec.gamma*Math.cos(phase)-omega*Math.sin(phase)),
    source:{label:'Independent analytic damped oscillator',recordingId:id+'-recording'},
    samples:Array.from({length:Math.round(10/dt)+1},(_,i)=>({time:i*dt,position:position(i*dt)}))};
}
function definitions(wrong){return [{id:'env-a',k:4,gamma:0.12},{id:'env-b',k:wrong?6.25:4,gamma:0.45}];}
export function analyticBundle(dt=0.02,wrong=false){
  return {schema:'worldlaw.environment-bundle/v1',label:'Independent analytic oscillator',units,
    environments:definitions(wrong).map(spec=>({id:spec.id,label:spec.id,trainingRuns:[
      run(spec,0.7,0.2,dt,spec.id+'-training-1'),run(spec,1.1,-0.55,dt,spec.id+'-training-2')
    ]}))};
}
export function analyticChallenge(wrong=false){
  return {schema:'worldlaw.environment-challenge/v1',label:'Independent analytic evaluation',units,
    environments:definitions(wrong).map(spec=>({id:spec.id,label:spec.id,challengeRuns:[run(spec,0.9,0.65,0.02,spec.id+'-evaluation')]}))};
}
const popcount=m=>{let n=0;for(;m;m>>>=1)n+=m&1;return n;};
function ledger(result){
  assert.equal(result.candidateCount,171);assert.equal(result.candidates.length,171);
  const map=new Map(result.candidates.map(c=>[c.id,c]));assert.equal(map.size,171);
  for(const mode of MODES)for(let mask=0;mask<64;mask++){
    if(popcount(mask)>4)continue;
    const c=map.get(mode+':'+mask);assert(c);assert.equal(c.mode,mode);
    const r=popcount(mask&44),d=popcount(mask&19);
    assert.equal(c.freeParameterCount,mode==='pooled'?r+d:mode==='shared-restoring'?r+2*d:2*(r+d));
    if(c.status==='fitted'){
      assert(Number.isFinite(c.score)&&Number.isFinite(c.weakRMSE));
      assert.equal(c.parameterValues.length,c.freeParameterCount);
      for(const p of c.parameterValues)assert(TERMS.includes(p.term)&&Number.isFinite(p.coefficient));
    }else assert(c.failureReason);
  }
  assert.equal(new Set(result.rankedCandidateIds).size,result.rankedCandidateIds.length);
  assert.equal(result.selectedCandidateId,result.rankedCandidateIds[0]);
  return map;
}
function parameter(candidate,term,environmentId){
  const found=candidate.parameterValues.filter(p=>p.term===term&&p.environmentId===environmentId);
  assert.equal(found.length,1);return found[0].coefficient;
}
function fixedReceipt(result,wrong){
  const byId=ledger(result),fixed={};
  for(const mode of MODES){
    const c=byId.get(mode+':5');assert.equal(c.status,'fitted');
    assert.equal(c.freeParameterCount,{pooled:2,'shared-restoring':3,independent:4}[mode]);
    const expected=c.observationCount*Math.log(Math.max(c.weakRMSE**2,0.0001))+c.freeParameterCount*Math.log(c.observationCount);
    assert(Math.abs(c.score-expected)<=1e-10);
    fixed[mode]={rss:c.observationCount*c.weakRMSE**2,weakRMSE:c.weakRMSE,score:c.score,n:c.observationCount,
      conditionEstimate:c.conditionEstimate,parameters:c.parameterValues};
  }
  const targetSSE=result.preparation.completeRows.reduce((s,e)=>s+e.rows.reduce((n,r)=>n+r.target*r.target,0),0);
  const eps=256*Number.EPSILON*Math.max(1,targetSSE);
  assert(fixed.independent.rss<=fixed['shared-restoring'].rss+eps);
  assert(fixed['shared-restoring'].rss<=fixed.pooled.rss+eps);
  return {selectedCandidateId:result.selectedCandidateId,fixed,
    coefficientErrors:definitions(wrong).map(spec=>({
      environmentId:spec.id,
      independentSpring:parameter(byId.get('independent:5'),'spring',spec.id)+spec.k,
      independentRate:parameter(byId.get('independent:5'),'rate',spec.id)+2*spec.gamma,
      sharedSpring:parameter(byId.get('shared-restoring:5'),'spring',null)+spec.k,
      sharedRate:parameter(byId.get('shared-restoring:5'),'rate',spec.id)+2*spec.gamma
    }))};
}
function forecasts(result,wrong){
  const receipt=[];
  for(const mode of ['shared-restoring','independent'])for(const spec of definitions(wrong)){
    const candidate=result.candidates.find(c=>c.id===mode+':5');
    const model=candidate.environmentModels.find(e=>e.environmentId===spec.id).model;
    const evidence=run(spec,0.9,0.65,0.02,spec.id+'-unseen-analytic-trace');
    const original=JSON.stringify(evidence),summaries=[],predictions=[];
    for(const maxStep of [0.01,0.005]){
      const execution=rolloutAngular(model,evidence,{maxStep,maxSteps:200000});
      assert.equal(execution.rows.length,evidence.samples.length);
      let sse=0,max=0;
      for(let i=0;i<evidence.samples.length;i++){
        const row=execution.rows[i],observed=evidence.samples[i];
        assert.equal(row.time,observed.time);assert.equal(row.observed,observed.position);
        assert(Number.isFinite(row.predicted)&&Number.isFinite(row.rate));
        const error=row.predicted-observed.position;sse+=error**2;max=Math.max(max,Math.abs(error));
      }
      assert.equal(execution.metrics.count,evidence.samples.length-1);
      const futureSSE=execution.rows.slice(1).reduce((s,row,i)=>s+(row.predicted-evidence.samples[i+1].position)**2,0);
      const expectedMetric=Math.sqrt(futureSSE/(evidence.samples.length-1));
      assert(Math.abs(execution.metrics.positionRMSE-expectedMetric)<=64*Number.EPSILON*Math.max(1,expectedMetric));
      assert(Math.abs(execution.metrics.maxAbsError-max)<=1e-12);
      assert.equal(execution.rows[0].predicted,evidence.samples[0].position);
      assert.equal(execution.rows[0].rate,evidence.initialRate);
      summaries.push({maxStep,independentRMSE:Math.sqrt(sse/evidence.samples.length),independentMaxAbsError:max,reportedMetrics:execution.metrics});
      predictions.push(execution.rows.map(r=>r.predicted));
    }
    assert.equal(JSON.stringify(evidence),original);
    const diff=predictions[0].map((v,i)=>v-predictions[1][i]);
    receipt.push({mode,environmentId:spec.id,forecasts:summaries,
      integrationRMSDifference:Math.hypot(...diff)/Math.sqrt(diff.length)});
  }
  return receipt;
}
function rows(kind){
  return ['env-a','env-b'].map(id=>{
    const trainingRunIds=[id+'-1',id+'-2'];
    return {id,trainingRunIds,rows:trainingRunIds.flatMap(runId=>Array.from({length:8},(_,i)=>{
      const x=i-3.5;return {runId,target:kind==='zero'?0:-2*x,
        columns:kind==='zero'?[0,0,0,0,0,1]:[x,Math.sign(x),x,Math.sin(x),x*Math.abs(x),1],
        firstIndex:i*10,lastIndex:i*10+10,startTime:i*.5,endTime:i*.5+1,sampleCount:11,targetNoiseGain:1};
    }))};
  });
}
export function runEnvironmentOracle(){
  const receipts=[];
  for(const wrong of [false,true])for(const dt of [0.02,0.01]){
    const bundle=analyticBundle(dt,wrong),before=JSON.stringify(bundle),result=compareSharedEnvironments(bundle);
    assert.equal(JSON.stringify(bundle),before);
    assert.equal(result.preparation.completeRows.reduce((s,e)=>s+e.rows.length,0),result.observationCount);
    receipts.push({wrongSharing:wrong,dt,...fixedReceipt(result,wrong),forecasts:forecasts(result,wrong)});
  }
  const degeneracy=[];
  for(const kind of ['zero','duplicate']){
    const result=compareAngularEnvironments(rows(kind),{makeAngularModel:makeEnvironmentAngularModel});const map=ledger(result);
    for(const mode of MODES){
      assert.equal(map.get(mode+':5').status,'rank-failure');
      assert.equal(map.get(mode+':0').status,'fitted');assert.equal(map.get(mode+':0').freeParameterCount,0);
    }
    degeneracy.push({kind,rankFailures:result.candidates.filter(c=>c.status==='rank-failure').length});
  }
  assert.throws(()=>compareAngularEnvironments(rows('duplicate'),{makeAngularModel:makeEnvironmentAngularModel,maxReservedWork:1}),e=>e.code==='resource_limit');
  const sparse=rows('duplicate');sparse[0].rows[0].columns=Array(6);
  assert.throws(()=>compareAngularEnvironments(sparse,{makeAngularModel:makeEnvironmentAngularModel}),e=>e.code==='invalid_environment_rows');
  const trained=compareSharedEnvironments(analyticBundle()),before=JSON.stringify(trained),challenge=analyticChallenge();
  const received=evaluateSharedEnvironments(trained,challenge);
  assert.equal(JSON.stringify(trained),before);
  const reordered=structuredClone(challenge);reordered.environments.reverse();
  assert.deepEqual(evaluateSharedEnvironments(trained,reordered),received);
  const duplicated=structuredClone(challenge);
  duplicated.environments[1].challengeRuns[0]={...structuredClone(duplicated.environments[0].challengeRuns[0]),id:'copied-challenge'};
  assert.throws(()=>evaluateSharedEnvironments(trained,duplicated),e=>e.code==='shared_evidence');
  const missing=structuredClone(challenge);missing.environments[1].id='unknown';
  assert.throws(()=>evaluateSharedEnvironments(trained,missing),e=>e.code==='environment_mismatch');
  const input=readEnvironmentSources(exportEnvironmentSources(trained,challenge));
  const reopened=compareSharedEnvironments(input.trainingSource);
  assert.deepEqual(reopened.candidates,trained.candidates);
  assert.deepEqual(evaluateSharedEnvironments(reopened,input.challengeSource),received);
  assert.throws(()=>evaluateSharedEnvironments(JSON.parse(JSON.stringify(trained)),challenge),e=>e.code==='untrusted_comparison');
  return {schema:'worldlaw.independent-environment-oracle/v1',structuralAssertionsPassed:true,numericalAcceptance:'awaiting-independent-error-review',
    receipts,degeneracy,sourceRoundtripPassed:true,challengeSeparationPassed:true,budgetRefusalPassed:true,sparseRowsRefused:true};
}

export function assertEnvironmentOracleNumerics(receipt){
  const bounds={coarseCoefficient:1e-6,fineCoefficient:6e-8,refinementRatio:0.075,coarseForecast:1.25e-7,fineForecast:1e-8,integrationRMS:3e-9,wrongSharingForecastMinimum:0.1};
  for(const item of receipt.receipts){
    const correctlySpecified=item.wrongSharing?['independent']:['independent','shared'];
    for(const mode of correctlySpecified){
      const errors=item.coefficientErrors.flatMap(e=>[Math.abs(e[mode+'Spring']),Math.abs(e[mode+'Rate'])]);
      assert(Math.max(...errors)<=(item.dt===0.02?bounds.coarseCoefficient:bounds.fineCoefficient));
    }
    for(const c of Object.values(item.fixed))assert(c.conditionEstimate<2);
    if(!item.wrongSharing)assert(Math.abs((item.fixed.independent.score-item.fixed['shared-restoring'].score)-Math.log(item.fixed.independent.n))<=1e-10);
    for(const f of item.forecasts){
      assert(f.integrationRMSDifference<=bounds.integrationRMS);
      if(!item.wrongSharing||f.mode==='independent')assert(f.forecasts[1].independentRMSE<=(item.dt===0.02?bounds.coarseForecast:bounds.fineForecast));
      else if(item.dt===0.01)assert(f.forecasts[1].independentRMSE>=bounds.wrongSharingForecastMinimum);
    }
  }
  for(const wrong of [false,true]){
    const coarse=receipt.receipts.find(r=>r.wrongSharing===wrong&&r.dt===0.02),fine=receipt.receipts.find(r=>r.wrongSharing===wrong&&r.dt===0.01);
    for(const mode of wrong?['independent']:['independent','shared']){
      const max=r=>Math.max(...r.coefficientErrors.flatMap(e=>[Math.abs(e[mode+'Spring']),Math.abs(e[mode+'Rate'])]));
      assert(max(fine)<=bounds.refinementRatio*max(coarse)+1e-11);
    }
  }
  return {...receipt,numericalAcceptance:'passed',regressionTolerances:bounds,
    toleranceProvenance:'Calibrated after first analytic refinement receipt, before reserved measured recordings; not preregistered thresholds or general solver guarantees.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const receipt=assertEnvironmentOracleNumerics(runEnvironmentOracle());
  if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
}
