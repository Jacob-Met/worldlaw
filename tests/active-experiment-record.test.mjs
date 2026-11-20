import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {sealActivePlan,sealActiveReadout,createActiveNotebook,replayActiveNotebook,
  receiveActiveNotebook,activeBytesSHA256} from '../src/science/active-experiment-record.mjs';

const text=await readFile(new URL('../examples/active-intervention-coupled-kinematics.json',import.meta.url),'utf8');
const legacy=JSON.parse(await readFile(new URL('./fixtures/active-linear-certificates-v1.json',import.meta.url),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const readings=(plan,values)=>JSON.stringify({schema:'worldlaw.active-linear-readings/v1',
  source:'Independent hand-calculated synthetic coupled position readings',acquisition:'synthetic',
  sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,interventionId:plan.chosenIntervention,
  readings:values.map((value,tick)=>({tick,value}))});

test('shared prospective record matches the frozen merged CLI source and plan digests',async()=>{
  const plan=await sealActivePlan(text);
  assert.equal(plan.sourceSHA256,'f7f996c569a07cf9b2a3230c12519bd80536cc0a2082f857b3ca671c1e4ffe19');
  assert.equal(plan.planSHA256,'cbc93f82d9aaa885d83bdf51e1b49840b5506e2d9d5f887ed64322c6240f82c5');
  assert.equal(plan.chosenIntervention,'velocity_pulse');
  assert.deepEqual(plan.chosenReadings.map(r=>r.tick),[0,1,2]);
  assert.equal(plan.outcomeValuesUsed,false);assert.equal(plan.physicalActionsPerformed,false);
  assert.equal(await activeBytesSHA256(new TextEncoder().encode(text)),sha(text));
});

test('independently derived hidden-state trajectories produce the three honest outcomes',async()=>{
  const plan=await sealActivePlan(text);
  for(const [values,status,survivors] of [
    [[3,1,0],'one_hypothesis_consistent',['unit_coupling']],
    [[3,-7,-12],'all_hypotheses_falsified',[]],
    [[3],'multiple_hypotheses_consistent',['unit_coupling','double_coupling']],
  ]){
    const raw=readings(plan,values),result=await sealActiveReadout(text,plan,raw);
    assert.equal(result.status,status);assert.deepEqual(result.consistentHypothesisIds,survivors);
    assert.equal(result.readingsSHA256,sha(raw));assert.equal(result.physicalProvenanceVerified,false);
    assert.deepEqual(result.missingTicks,[0,1,2].slice(values.length));
  }
});

test('portable replay retains independent reading sets and rejects atomic tampering',async()=>{
  let book=await createActiveNotebook(text);const first=readings(book.plan,[3]);
  book=await receiveActiveNotebook(book,first);book=await receiveActiveNotebook(book,readings(book.plan,[3,1,0]));
  assert.equal(book.readouts.length,2);assert.equal(book.readouts[0].result.status,'multiple_hypotheses_consistent');
  const saved=JSON.stringify(book);assert.deepEqual(await replayActiveNotebook(saved),book);
  await assert.rejects(()=>receiveActiveNotebook(book,first),/already recorded/);
  for(const corrupt of [
    b=>{b.sourceText+=' ';},b=>{b.plan.totalNodes++;},
    b=>{b.readouts[0].readingsText+=' ';},b=>{b.readouts[1].result.status='all_hypotheses_falsified';},
    b=>{b.readouts[1].result.consistentHypothesisIds=['double_coupling'];},
  ]){
    const copy=JSON.parse(saved);corrupt(copy);await assert.rejects(()=>replayActiveNotebook(copy));
    assert.equal(JSON.stringify(book),saved);
  }
});

test('all saved historical source-bound certificates and readouts use the shared replay unchanged',async()=>{
  for(const saved of legacy.cases){
    const plan=await sealActivePlan(saved.sourceText,{prior:saved.plan});
    for(const key of Object.keys(saved.plan))assert.deepEqual(plan[key],saved.plan[key],saved.id+' '+key);
    for(const old of saved.readouts){
      const result=await sealActiveReadout(saved.sourceText,saved.plan,old.readoutText,{prior:old.result});
      for(const key of Object.keys(old.result))assert.deepEqual(result[key],old.result[key],saved.id+' '+key);
    }
    if(saved.id==='limited')assert.equal(plan.status,'search_inconclusive');
  }
});

test('source or plan substitution, wrong intervention and unplanned readings refuse',async()=>{
  const plan=await sealActivePlan(text),raw=JSON.parse(readings(plan,[3,1,0]));
  await assert.rejects(()=>sealActivePlan(text+'\n',{prior:plan}),/source bytes changed/);
  for(const mutate of [r=>{r.planSHA256='0'.repeat(64);},r=>{r.sourceSHA256='f'.repeat(64);},
    r=>{r.interventionId='idle_velocity';},r=>{r.readings[1].tick=0;},r=>{r.readings[2].tick=4;}]){
    const bad=structuredClone(raw);mutate(bad);
    await assert.rejects(()=>sealActiveReadout(text,plan,JSON.stringify(bad)));
  }
  const changed=structuredClone(plan);changed.totalNodes++;
  const core=Object.fromEntries(Object.entries(changed).filter(([k])=>!['sourceSHA256','planSHA256','evidenceLevel'].includes(k)));
  changed.planSHA256=sha(JSON.stringify(core));
  await assert.rejects(()=>sealActivePlan(text,{prior:changed}),/replay refused/);
});

test('portable admission refuses wrong formats and bounds before replacing a valid notebook',async()=>{
  const book=await createActiveNotebook(text),saved=JSON.stringify(book);
  await assert.rejects(()=>replayActiveNotebook('{}'),/notebook v1/);
  await assert.rejects(()=>replayActiveNotebook({...book,pretendAcquired:true}),/Unexpected/);
  await assert.rejects(()=>createActiveNotebook(' '.repeat(524289)),/512 KiB/);
  await assert.rejects(()=>replayActiveNotebook({...book,readouts:Array(17).fill({})}),/at most 16/);
  assert.equal(JSON.stringify(book),saved);
});

test('a separate CLI process receives a portable notebook, preserves outputs and refuses forged evidence',async()=>{
  let book=await createActiveNotebook(text);book=await receiveActiveNotebook(book,readings(book.plan,[3,1,0]));
  const dir=await mkdtemp(join(tmpdir(),'active-notebook-'));
  try{
    const file=join(dir,'notebook.json'),output=join(dir,'verified.json');
    const run=args=>spawnSync(process.execPath,[resolve('scripts/active-linear-family.mjs'),...args],{encoding:'utf8'});
    await writeFile(file,JSON.stringify(book));
    const received=run(['--notebook',file]);assert.equal(received.status,0,received.stderr);
    assert.deepEqual(JSON.parse(received.stdout),book);
    assert.equal(run(['--notebook',file,'--output',output]).status,0);
    assert.notEqual(run(['--notebook',file,'--output',output]).status,0);
    assert.notEqual(run(['--notebook',file,'--input',file]).status,0);
    book.readouts[0].result.checks[0].minimumNoiseRequired='9';
    await writeFile(file,JSON.stringify(book));assert.notEqual(run(['--notebook',file]).status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
