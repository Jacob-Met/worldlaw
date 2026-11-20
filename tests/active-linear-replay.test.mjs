import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const fixtureBytes=await readFile(new URL('./fixtures/active-linear-certificates-v1.json',import.meta.url));
assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),
  'ef2a62a2d4d9ec6f630a4b0e833420bab21a572e9f2ac97f7b2b982fbff35f30');
const fixture=JSON.parse(fixtureBytes);
const script=resolve('scripts/active-linear-family.mjs');

for(const saved of fixture.cases)test('saved v1 '+saved.id+' plan and readouts reopen without rewriting claims',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'worldlaw-v1-'));
  const input=join(dir,'source.json'),planPath=join(dir,'plan.json');
  const run=args=>spawnSync(process.execPath,[script,'--input',input,...args],{encoding:'utf8'});
  try{
    await writeFile(input,saved.sourceText);await writeFile(planPath,JSON.stringify(saved.plan));
    const reopened=run(['--replay',planPath]);
    assert.equal(reopened.status,saved.planExit,reopened.stderr);
    const result=JSON.parse(reopened.stdout);
    for(const key of Object.keys(saved.plan))assert.deepEqual(result[key],saved.plan[key],key);
    if(saved.id==='limited'){
      assert.equal(result.status,'search_inconclusive');
      assert.equal(result.selection,null);
      const current=run([]);assert.equal(current.status,0,current.stderr);
      assert.equal(JSON.parse(current.stdout).status,'optimal_certified_schedule');
    }
    for(const old of saved.readouts){
      const readings=join(dir,old.id+'-readings.json'),oldResult=join(dir,old.id+'-result.json');
      await writeFile(readings,old.readoutText);await writeFile(oldResult,JSON.stringify(old.result));
      const replayed=run(['--replay',planPath,'--readings',readings,'--replay-readings',oldResult]);
      assert.equal(replayed.status,0,replayed.stderr);
      const actual=JSON.parse(replayed.stdout);
      for(const key of Object.keys(old.result))assert.deepEqual(actual[key],old.result[key],key);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('legacy replay still rejects forged counters even with a recomputed plan digest',async()=>{
  const saved=fixture.cases.find(row=>row.id==='cycle');
  const dir=await mkdtemp(join(tmpdir(),'worldlaw-v1-tamper-'));
  const input=join(dir,'source.json'),planPath=join(dir,'plan.json');
  const run=args=>spawnSync(process.execPath,[script,'--input',input,...args],{encoding:'utf8'});
  try{
    await writeFile(input,saved.sourceText);
    const plan=structuredClone(saved.plan);plan.nodes++;
    const core=Object.fromEntries(Object.entries(plan).filter(([key])=>
      !['sourceSHA256','planSHA256','sourcePath','evidenceLevel'].includes(key)));
    plan.planSHA256=createHash('sha256').update(JSON.stringify(core)).digest('hex');
    await writeFile(planPath,JSON.stringify(plan));
    assert.notEqual(run(['--replay',planPath]).status,0);
    await writeFile(planPath,JSON.stringify(saved.plan));
    const old=saved.readouts[0],readings=join(dir,'readings.json'),result=join(dir,'result.json');
    await writeFile(readings,old.readoutText);
    const forged=structuredClone(old.result);forged.nodes++;
    await writeFile(result,JSON.stringify(forged));
    assert.notEqual(run(['--replay',planPath,'--readings',readings,'--replay-readings',result]).status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
