import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createActiveNotebook,replayActiveNotebook,receiveActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {BINARY_PLAN,MULTICLASS_PLAN,GUIDED_INPUT,pendingDriftSteps} from '../src/science/active-guided-drift.mjs';
const example=k=>readFile('examples/active-position-drift-'+k+'.json','utf8');
function packet(book,values){
  const p=book.plan,last=book.readouts.at(-1)?.result,steps=pendingDriftSteps(p,last);
  return {schema:GUIDED_INPUT,sourceSHA256:p.sourceSHA256,planSHA256:p.planSHA256,
    previousReadingsSHA256:last?.readingsSHA256??null,acquisition:'synthetic',source:'One independent synthetic trajectory',
    readings:values.map((value,i)=>({tick:steps[i].tick,command:steps[i].command,value}))};
}
const append=(b,doc)=>receiveActiveNotebook(b,JSON.stringify(doc,null,2)+'\n');
const cli=args=>{const r=spawnSync(process.execPath,['scripts/active-linear-family.mjs',...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};

test('direct CLI planner flags create replayable notebooks with the original rate source',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'drift-guided-'));
  try{
    for(const [kind,method,flag,values] of [
      ['binary',BINARY_PLAN,'--binary-minimum',['0','4','25']],
      ['schedule',MULTICLASS_PLAN,'--multiclass-minimum',['0','8','33']]]){
      const input='examples/active-position-drift-'+kind+'.json',out=join(dir,kind+'.json');
      const limits=kind==='schedule'?['--enumerate-through','7','--word-budget','23']:[];
      cli(['--input',input,flag,...limits,'--create-notebook','--output',out]);
      const b=JSON.parse(await readFile(out,'utf8')),standalone=JSON.parse(cli(['--input',input,flag,...limits]));
      assert.equal(b.plan.schema,method);assert.equal(b.sourceText,await example(kind));
      for(const [k,v] of Object.entries(standalone))assert.deepEqual(b.plan[k],v);
      const orig=packet(b,values.slice(0,1)),one=await append(b,orig);
      const last=packet(one,values.slice(1)),doc=join(dir,'in'+kind+'.json'),saved=join(dir,'mid'+kind+'.json');
      await writeFile(doc,JSON.stringify(last));await writeFile(saved,JSON.stringify(one));
      const received=JSON.parse(cli(['--notebook',saved,'--readings',doc]));
      assert.deepEqual(received.readouts.at(-1).result.consistentHypothesisIds,['A']);
      assert.deepEqual(await replayActiveNotebook(JSON.stringify(received)),received);
      await assert.rejects(append(one,orig),/continue this frozen/);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('feedback requires a retained five-pulse prefix before revealing the sixth command',async()=>{
  const source=await example('feedback'),initial=await createActiveNotebook(source);
  const origin=10n**60n+1n,shift=x=>String(origin+13n*BigInt(x))+'/13';
  for(const [values,cmd,ids,final] of [[[-1,-2,-3,-4,2,8],'u2',['L0','L1'],13],[[1,-2,-3,-4,2,10],'u1',['L0','L2'],15]]){
    const before=packet(initial,values.map(shift));
    const tooEarly=structuredClone(before);tooEarly.readings.push({tick:'6',value:shift(final),command:cmd});
    await assert.rejects(append(initial,tooEarly),/receive the five-pulse prefix/);
    const one=await append(initial,before),result=one.readouts[0].result;
    assert.equal(result.checked.nextCommand,cmd);assert.deepEqual(result.consistentHypothesisIds,ids);
    const restored=await replayActiveNotebook(JSON.stringify(one)),doc=packet(restored,[shift(final)]);
    await assert.rejects(append(restored,{...doc,readings:[{...doc.readings[0],command:'u0'}]}),/pending tick/);
    await assert.rejects(append(restored,{...doc,acquisition:'supplied'}),/same declared run/);
    const received=await append(restored,doc);
    assert.deepEqual(received.readouts.at(-1).result.consistentHypothesisIds,['L0']);
    assert.deepEqual(received.readouts.at(-1).result.checked.values,[...values,final].map(shift));
    assert.deepEqual(await replayActiveNotebook(JSON.stringify(received)),received);
    const tampered=structuredClone(received);tampered.readouts[0].result.checked.nextCommand='u0';
    await assert.rejects(replayActiveNotebook(JSON.stringify(tampered)),/changed/);
    const rounded=JSON.stringify(before).replace(JSON.stringify(before.readings[0].value),'1.00000000000000001');
    await assert.rejects(receiveActiveNotebook(initial,rounded),/safe integer token/);
    const reversed=structuredClone(received);reversed.readouts.reverse();
    await assert.rejects(replayActiveNotebook(JSON.stringify(reversed)),/continue this frozen/);
  }
});

test('minimum planners retain physical permanent aliases and symbolic huge fixed schedules',async()=>{
  const request=JSON.parse(await example('binary'));
  request.laws=[{id:'A',rates:['0','2']},{id:'B',rates:['1','3']}];
  for(const method of [BINARY_PLAN,MULTICLASS_PLAN]){
    const book=await createActiveNotebook(JSON.stringify(request),{design:{method}});
    const p=book.plan;assert.equal(p.status,'indistinguishable');
    const raw={schema:'worldlaw.active-position-drift-gauge-input/v1',sourceSHA256:p.sourceSHA256,
      planSHA256:p.planSHA256,laws:['A','B'],origin:['1/13','2/7'],runs:[{command:'slow',repeats:'123456789012345678901'}]};
    const received=await append(book,raw);
    assert.equal(received.readouts[0].result.acquisition,'synthetic');
    assert.deepEqual(await replayActiveNotebook(JSON.stringify(received)),received);
  }
  const d=10n**65n+1n;request.laws=[{id:'A',rates:['0','0']},{id:'B',rates:['0','1/'+d]}];
  for(const method of [BINARY_PLAN,MULTICLASS_PLAN]){
    const b=await createActiveNotebook(JSON.stringify(request),{design:{method}});
    const steps=pendingDriftSteps(b.plan);assert.equal(steps.length,3);assert.equal(steps[2].tick,String(16n*d+1n));
    const run=await append(b,packet(b,['2/13','2/13','2/13']));
    assert.deepEqual(run.readouts[0].result.consistentHypothesisIds,['A']);
  }
});
