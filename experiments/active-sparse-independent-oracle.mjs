#!/usr/bin/env node
/**
 * Independently frozen exact enumeration receiver for generated sparse
 * excitation. The receiving oracle does NOT read the generator's rank-span
 * masks, enumeration order or chosen control. Invariant is equality of the
 * finite optimal objective, not accidental equality of tie-breaking paths.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {synthesizeSparseExcitation,ACTIVE_SPARSE_SYNTHESIS_SCHEMA}
  from '../src/science/active-control-synthesis.mjs';
import {designActiveLinearFamily,ACTIVE_LINEAR_FAMILY_SCHEMA}
  from '../src/science/active-linear-family.mjs';

const seed=0x47b32e6f;
let state=seed;
const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
const signed=()=>rand()%5-2;
const samples=48;
const outcomes=[];
function buildSource(i){
  const c0=[0,0],c1=[signed(),signed()],c2=[signed(),signed()];
  return {
    schema:ACTIVE_SPARSE_SYNTHESIS_SCHEMA,
    source:'Frozen synthetic exact independent three-law oracle case '+i+'; no measured or physical device inputs.',
    hypotheses:[c0,c1,c2].map((v,j)=>({
      id:'h'+j,A:[[0]],B:[v],C:[1]
    })),
    controlHorizon:2,inputChannels:2,
    amplitudes:['1','-1'],
    offeredTicks:[0,1,2],maxReadings:3,maxPulses:2,
    noiseBound:'1/100',pulseCost:2,
    maxCourses:500,maxCombinations:2000,maxWorkNodes:100000
  };
}
function brute(source){
  const controls=()=>Array.from({length:source.controlHorizon},
    ()=>Array(source.inputChannels).fill('0'));
  const positions=source.controlHorizon*source.inputChannels;
  const all=[],amps=source.amplitudes;
  let calls=0;
  function trial(points,values){
    const u=controls();
    points.forEach((p,i)=>{u[Math.floor(p/source.inputChannels)][p%source.inputChannels]=values[i];});
    const received=designActiveLinearFamily({
      schema:ACTIVE_LINEAR_FAMILY_SCHEMA,
      source:source.source,
      hypotheses:source.hypotheses,
      controls:u,
      offeredTicks:source.offeredTicks,
      maxReadings:source.maxReadings,
      noiseBound:source.noiseBound,
      workLimit:50000
    });
    calls++;
    assert.equal(received.exhausted,false);
    if(received.status==='optimal_certified_schedule'){
      all.push({pulseCount:points.length,numReadings:received.numReadings,
        totalDeclaredCost:received.totalCost+points.length*source.pulseCost});
    }
  }
  for(let i=0;i<positions;i++)for(const a of amps)trial([i],[a]);
  for(let i=0;i<positions;i++)for(let j=i+1;j<positions;j++)
    for(const a of amps)for(const b of amps)trial([i,j],[a,b]);
  all.sort((a,b)=>a.pulseCount-b.pulseCount||
    a.numReadings-b.numReadings||a.totalDeclaredCost-b.totalDeclaredCost);
  return {winner:all[0]??null,calls};
}
for(let i=0;i<samples;i++){
  const source=buildSource(i);
  const frozen=JSON.stringify(source);
  const compiled=synthesizeSparseExcitation(source);
  const baseline=brute(source);
  assert.equal(compiled.exhausted,false,'resource budget was not exhausted on frozen small oracle case');
  const selected=compiled.chosenControls?{
    pulseCount:compiled.pulseCount,
    numReadings:compiled.numReadings,
    totalDeclaredCost:compiled.totalDeclaredCost,
  }:null;
  assert.deepEqual(selected,baseline.winner,
    'compiled span mask/finite optimizer diverges from exhaustive independent all-input oracle on case '+i);
  assert.ok(compiled.coursesEvaluated<=baseline.calls);
  outcomes.push({
    i,sourceSHA256:createHash('sha256').update(frozen).digest('hex'),
    status:compiled.status,selected,
    baselineCalls:baseline.calls,compiledCalls:compiled.coursesEvaluated,
    rankProbes:compiled.rankSpan.elementaryUnitProbes,
    combinationsPruned:compiled.combinationsPruned,
  });
}
const total=(key)=>outcomes.reduce((s,o)=>s+o[key],0);
const report={
  schema:'worldlaw.sparse-excitation-independent-exact-receiver/v1',
  seed,samples,
  scope:'48 frozen synthetic exact three-law independent brute-source envelopes; no real physical actuation, hardware, sensor calibration, physical-law truth or statistical outcome-generalization.',
  comparedObjective:'least nonzero controls, then least readings, then lowest declared total cost; candidate has exact rational witness and no exhaustion',
  passed:samples,
  baselineExactSourceCalls:total('baselineCalls'),
  compiledSourceCalls:total('compiledCalls'),
  extraRankCompilationCalls:total('rankProbes'),
  savedExpensiveFullCourseCalls:total('baselineCalls')-total('compiledCalls'),
  cases:outcomes,
};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
