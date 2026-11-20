import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {designActiveLinearFamily,designActiveInterventionFamily,evaluateActiveLinearReadings}
  from '../src/science/active-linear-family.mjs';

const latePulse=()=>({
  schema:'worldlaw.active-linear-family/v1',
  source:'Hypothetical late velocity pulse; arbitrary initial position and hidden velocity',
  hypotheses:[1,2].map(k=>({id:'gain_'+k,A:[[1,k],[0,1]],B:[[0],[1]],C:[1,0]})),
  controls:[[0],[0],[1],[0]],offeredTicks:[0,1,2,3,4],maxReadings:5,noiseBound:'1/8'
});
const supplied=(values=[0,0,1])=>({schema:'worldlaw.active-linear-readings/v1',
  source:'Independent synthetic position trace; no physical acquisition',acquisition:'synthetic',
  readings:[0,3,4].map((tick,i)=>({tick,value:values[i]}))});

test('full-menu exact margin uses a circuit missed by the canonical basis',()=>{
  const result=designActiveLinearFamily(latePulse());
  assert.equal(result.potential[0].marginLowerBound,'3/8');
  assert.equal(result.potential[0].noiseMarginExact,true);
  assert.equal(result.potential[0].robustCertified,true);
  assert.deepEqual(result.selection.map(x=>x.tick),[0,3,4]);
  // Independent primal witness: fit the forcing difference [0,0,0,0,1]
  // with -3/8+t/4. Every residual has magnitude <=3/8. The reported dual
  // achieves 3/8, so neither side can improve that value.
  const residual=[0,0,0,0,1].map((value,t)=>value-(-3/8+t/4));
  assert.equal(Math.max(...residual.map(Math.abs)),3/8);
  const boundary=latePulse();boundary.noiseBound='3/16';
  const blocked=designActiveLinearFamily(boundary);
  assert.equal(blocked.status,'noise_separation_not_certified');
  assert.equal(blocked.noiseOverlapProven,true);
  assert.equal(blocked.selection,null);
});

test('sealed readouts preserve the generating law, reject alternatives and refuse a forced winner',()=>{
  const source=latePulse(),plan=designActiveLinearFamily(source);
  const correct=evaluateActiveLinearReadings(source,plan,supplied());
  assert.deepEqual(correct.consistentHypothesisIds,['gain_1']);
  assert.equal(correct.checks[0].minimumNoiseRequired,'0');
  assert.equal(correct.status,'one_hypothesis_consistent');
  assert.equal(correct.physicalProvenanceVerified,false);
  const absent=evaluateActiveLinearReadings(source,plan,supplied([0,0,10]));
  assert.equal(absent.status,'all_hypotheses_falsified');
  assert.deepEqual(absent.consistentHypothesisIds,[]);
  const partial=supplied();partial.readings=partial.readings.slice(0,1);
  const ambiguous=evaluateActiveLinearReadings(source,plan,partial);
  assert.equal(ambiguous.status,'multiple_hypotheses_consistent');
  assert.deepEqual(ambiguous.missingTicks,[3,4]);
});

test('readout closed error boundary is compatible, while a strict excess falsifies',()=>{
  const source=latePulse(),plan=designActiveLinearFamily(source);
  const on=evaluateActiveLinearReadings(source,plan,supplied(['-1/8','1/8','7/8']));
  assert.equal(on.checks[0].minimumNoiseRequired,'1/8');
  assert.equal(on.checks[0].status,'consistent');
  const outside=evaluateActiveLinearReadings(source,plan,supplied(['-1/8','1/8','3/4']));
  assert.equal(outside.checks[0].status,'falsified');
});

test('wrong, duplicate and nonselected ticks cannot silently change the experiment',()=>{
  const source=latePulse(),plan=designActiveLinearFamily(source);
  for(const mutate of [
    r=>{r.readings[0].tick=1;},r=>{r.readings[1].tick=0;},
    r=>{r.interventionId='unperformed';},r=>{r.readings[0].value='0.1';},
    r=>{r.acquisition='calibrated';},r=>{r.readings=[];}
  ]){
    const bad=supplied();mutate(bad);
    assert.throws(()=>evaluateActiveLinearReadings(source,plan,bad),/Active linear family:/);
  }
  const changed=structuredClone(source);changed.controls[2][0]=2;
  assert.throws(()=>evaluateActiveLinearReadings(changed,plan,supplied()),/replay refused/);
  const forged=structuredClone(plan);forged.proof[0].marginLowerBound='999';
  assert.throws(()=>evaluateActiveLinearReadings(source,forged,supplied()),/replay refused/);
});

test('the readout belongs to the chosen intervention and does not choose it from outcomes',()=>{
  const source=latePulse();source.schema='worldlaw.active-linear-interventions/v1';
  source.interventions=[{id:'idle',actionCost:0,controls:[[0],[0],[0],[0]]},
    {id:'pulse',actionCost:2,controls:source.controls}];delete source.controls;
  const plan=designActiveInterventionFamily(source),readout=supplied();
  assert.equal(plan.chosenIntervention,'pulse');
  assert.throws(()=>evaluateActiveLinearReadings(source,plan,readout),/chosen intervention/);
  readout.interventionId='idle';
  assert.throws(()=>evaluateActiveLinearReadings(source,plan,readout),/chosen intervention/);
  readout.interventionId='pulse';
  assert.deepEqual(evaluateActiveLinearReadings(source,plan,readout).consistentHypothesisIds,['gain_1']);
});

test('circuit enumeration is charged to the hard work budget',()=>{
  const source=latePulse();source.controls=Array.from({length:10},(_,i)=>[i===8?1:0]);
  source.offeredTicks=Array.from({length:11},(_,i)=>i);source.maxReadings=8;source.workLimit=100;
  const result=designActiveLinearFamily(source);
  assert.equal(result.status,'search_inconclusive');
  assert.equal(result.exhausted,true);
  assert.equal(result.nodes,100);
  assert.equal(result.potential[0].noiseMarginExact,false);
  assert.equal(result.selection,null);
});

test('cold CLI binds source, prospective plan and readout bytes across restart and replay',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'worldlaw-noise-'));
  const script=resolve('scripts/active-linear-family.mjs');
  const input=join(dir,'source.json'),planPath=join(dir,'plan.json');
  const valuesPath=join(dir,'readings.json'),resultPath=join(dir,'result.json');
  const run=args=>spawnSync(process.execPath,[script,'--input',input,...args],{encoding:'utf8'});
  try{
    await writeFile(input,JSON.stringify(latePulse()));
    const first=run(['--output',planPath]);assert.equal(first.status,0,first.stderr);
    const plan=JSON.parse(await readFile(planPath,'utf8'));
    const values={...supplied(),sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256};
    await writeFile(valuesPath,JSON.stringify(values));
    assert.notEqual(run(['--readings',valuesPath]).status,0);
    const args=['--replay',planPath,'--readings',valuesPath];
    const received=run([...args,'--output',resultPath]);assert.equal(received.status,0,received.stderr);
    const result=JSON.parse(await readFile(resultPath,'utf8'));
    assert.equal(result.status,'one_hypothesis_consistent');
    assert.equal(run([...args,'--replay-readings',resultPath]).status,0);
    assert.notEqual(run([...args,'--output',resultPath]).status,0,'existing receipt must not be overwritten');
    const forged={...result,consistentHypothesisIds:['gain_2']};
    await writeFile(join(dir,'forged.json'),JSON.stringify(forged));
    assert.notEqual(run([...args,'--replay-readings',join(dir,'forged.json')]).status,0);
    values.readings[2].value=10;await writeFile(valuesPath,JSON.stringify(values));
    assert.notEqual(run([...args,'--replay-readings',resultPath]).status,0);
    values.planSHA256='0'.repeat(64);await writeFile(valuesPath,JSON.stringify(values));
    assert.notEqual(run(args).status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
