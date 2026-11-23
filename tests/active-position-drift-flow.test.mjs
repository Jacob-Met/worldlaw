import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook,sealActivePlan,sealActiveReadout}
  from '../src/science/active-experiment-record.mjs';
import {ACTIVE_DRIFT_CHECKPOINTS,ACTIVE_DRIFT_TRACE} from '../src/science/active-position-drift-readout.mjs';
import {openAllHorizonPositionDrift,planAllHorizonPositionDrift}
  from '../src/science/persistent-position-drift-all-horizon.mjs';
const source=kind=>readFile('examples/active-position-drift-'+kind+'.json','utf8');
const bound=p=>({sourceSHA256:p.sourceSHA256,planSHA256:p.planSHA256});
test('portable checkpoints call the original receiver and preserve prefix, exact bytes and large tick identifiers',async()=>{
  for(const huge of [false,true]){
    let text=await source('schedule');
    if(huge){
      const s=JSON.parse(text);s.laws=[{id:'A',rates:[0,0]},{id:'B',rates:[0,'1/'+String(10n**80n+1n)]}];
      text=JSON.stringify(s)+'\n';
    }
    const book=await createActiveNotebook(text),p=book.plan,core=planAllHorizonPositionDrift(JSON.parse(text));
    assert.deepEqual(p.readAt,core.readAt);
    const values=huge?['0','0','0']:['0','25','35'];
    const raw={schema:ACTIVE_DRIFT_CHECKPOINTS,...bound(p),source:'Independent synthetic trajectory',acquisition:'synthetic',
      readings:p.readAt.map((tick,i)=>({tick,value:values[i]}))};
    const input=JSON.stringify(raw,null,2)+'\n';
    const received=await receiveActiveNotebook(book,input),result=received.readouts[0].result;
    assert.equal(received.readouts[0].readingsText,input);
    assert.deepEqual(result.checked,openAllHorizonPositionDrift(JSON.parse(text),core).observe(values));
    assert.equal(result.status,'one_hypothesis_consistent');
    assert.deepEqual(await replayActiveNotebook(JSON.stringify(received)),received);
    const partial=await receiveActiveNotebook(book,JSON.stringify({...raw,readings:raw.readings.slice(0,1)}));
    assert.equal(partial.readouts[0].result.checked.nextTick,p.readAt[1]);
    assert.equal(partial.readouts[0].result.status,'multiple_hypotheses_consistent');
    const outside=await receiveActiveNotebook(book,JSON.stringify({...raw,readings:raw.readings.map((r,i)=>i===2?{...r,value:'999999'}:r)}));
    assert.equal(outside.readouts[0].result.status,'all_hypotheses_falsified');
    for(const change of [r=>{r.plan.schedule[0].repeats='2';},r=>{r.sourceText+=' ';},
      r=>{r.readouts[0].result.checked.surviving[0].initialWitness[0]='9';},r=>{r.readouts[0].readingsText+=' ';}]){
      const bad=structuredClone(received);change(bad);
      await assert.rejects(()=>replayActiveNotebook(bad));
    }
    for(const incorrect of [{...raw,readings:[raw.readings[1]]},{...raw,readings:[{tick:0,value:'0'}]},
      {...raw,sourceSHA256:'x'},{...raw,planSHA256:'x'}])
      await assert.rejects(()=>receiveActiveNotebook(book,JSON.stringify(incorrect)));
  }
});
test('gauge trace is reproducible from the original law pair, word and initial state',async()=>{
  const text=await source('gauge'),book=await createActiveNotebook(text);
  const p=book.plan,core=planAllHorizonPositionDrift(JSON.parse(text));
  const raw={schema:ACTIVE_DRIFT_TRACE,...bound(p),laws:['B','A'],origin:['1/7','-2/9'],
    runs:[{command:'slow',repeats:'1000000000000000000000001'},{command:'fast',repeats:'2'}]};
  const input=JSON.stringify(raw)+'\n',received=await receiveActiveNotebook(book,input),report=received.readouts[0].result;
  assert.equal(report.status,'equal_gauge_trajectories');assert.equal(report.acquisition,'synthetic');
  assert.deepEqual(report.trace,openAllHorizonPositionDrift(JSON.parse(text),core).trace(...raw.laws,raw.runs,raw.origin));
  assert.deepEqual(report.trace.readings[0],report.trace.readings[1]);
  assert.deepEqual(await replayActiveNotebook(received),received);
  const bad=structuredClone(received);bad.readouts[0].result.trace.starts[1][1]='5';
  await assert.rejects(()=>replayActiveNotebook(bad));
  await assert.rejects(()=>receiveActiveNotebook(book,JSON.stringify({...raw,acquisition:'supplied'})));
  assert.deepEqual((await sealActiveReadout(text,await sealActivePlan(text),input)).trace,report.trace);
});
test('public CLI freezes the same source, receives independent inputs, exports and reopens',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'worldlaw-drift-flow-'));
  const cli=(...args)=>{
    const p=spawnSync(process.execPath,[resolve('scripts/active-linear-family.mjs'),...args],{encoding:'utf8'});
    assert.equal(p.status,0,p.stderr);return p.stdout;
  };
  try{
    for(const kind of ['schedule','gauge']){
      const src=resolve('examples/active-position-drift-'+kind+'.json'), initial=join(dir,kind+'.book'), input=join(dir,kind+'.input'), result=join(dir,kind+'.out');
      cli('--input',src,'--create-notebook','--output',initial);
      const book=JSON.parse(await readFile(initial,'utf8')),p=book.plan;
      const raw=kind==='schedule'?{schema:ACTIVE_DRIFT_CHECKPOINTS,...bound(p),source:'Declared simulation in CLI test',acquisition:'synthetic',
        readings:p.readAt.map((tick,i)=>({tick,value:['0','25','35'][i]}))}:
        {schema:ACTIVE_DRIFT_TRACE,...bound(p),origin:['1','-1'],laws:['A','B'],runs:[{command:'slow',repeats:'27'}]};
      await writeFile(input,JSON.stringify(raw)+'\n');
      cli('--notebook',initial,'--readings',input,'--output',result);
      assert.deepEqual(JSON.parse(cli('--notebook',result)),JSON.parse(await readFile(result,'utf8')));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('public byte paths reject rounded decimal and exponent tokens before exact physical replay',async()=>{
  const sourceText=await source('schedule');
  const wrongSource=sourceText.replace('"noiseBound": 1','"noiseBound": 1.00000000000000001');
  await assert.rejects(()=>createActiveNotebook(wrongSource),/safe integer token/);
  const book=await createActiveNotebook(sourceText),p=book.plan;
  const raw=JSON.stringify({schema:ACTIVE_DRIFT_CHECKPOINTS,...bound(p),source:'Trial 1.00000000000000001 in a description',
    acquisition:'synthetic',readings:[{tick:'0',value:1}]});
  assert.equal((await receiveActiveNotebook(book,raw)).readouts[0].result.checked.readings[0],'1');
  for(const numeral of ['1.00000000000000001','1e-1000','9007199254740993','1e0']){
    await assert.rejects(()=>receiveActiveNotebook(book,raw.replace('"value":1','"value":'+numeral)),/safe integer token/);
  }
  const serialized=JSON.stringify(book).replace('"block":0','"block":1e-1000');
  await assert.rejects(()=>replayActiveNotebook(serialized),/safe integer token/);
  const alias=await createActiveNotebook(await source('gauge'));
  const gauge=JSON.stringify({schema:ACTIVE_DRIFT_TRACE,...bound(alias.plan),laws:['A','B'],origin:[1,0],runs:[{command:'slow',repeats:1}]});
  for(const input of [gauge.replace('"origin":[1','"origin":[1.00000000000000001'),gauge.replace('"repeats":1','"repeats":1.00000000000000001')])
    await assert.rejects(()=>receiveActiveNotebook(alias,input),/safe integer token/);
  const dir=await mkdtemp(join(tmpdir(),'worldlaw-exact-original-'));
  try{
    const file=join(dir,'book.json'),input=join(dir,'input.json');
    await writeFile(file,JSON.stringify(book));
    await writeFile(input,raw.replace('"value":1','"value":1.00000000000000001'));
    const cli=spawnSync(process.execPath,[resolve('scripts/active-linear-family.mjs'),'--notebook',file,'--readings',input],{encoding:'utf8'});
    assert.notEqual(cli.status,0);assert.match(cli.stderr,/safe integer token/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
