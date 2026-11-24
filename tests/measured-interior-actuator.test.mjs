import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {developmentTrainingInstrument} from '../experiments/continuous-law-course.mjs';
import {frozenForecasts,scoreMeasured,runCourse} from '../experiments/measure-interior-actuator.mjs';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';

const dir=new URL('../docs/receipts/paired-actuator-acquisitions/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,dir)));
const pre=frozenForecasts(),seal=read('forecast-seal.json'),receipt=read('scores.json');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('both original training measurements select the cubic rival before refit at equal acquisition cost',()=>{
  assert.equal(hash(pre),seal.forecastsSHA256);
  assert.equal(receipt.forecastsSHA256,seal.forecastsSHA256);
  assert.equal(receipt.preregistration,194490);
  assert.equal(Number.parseInt(createHash('sha256').update(receipt.seedMaterial).digest('hex').slice(0,8),16),receipt.noiseSeed);
  for(const [i,p] of pre.entries()){
    const row=receipt.results[i],raw=read(p.arm+'.run.json');
    assert.equal(row.arm,p.arm);assert.deepEqual(row.usage,{acquired:1,chargedSamples:201,requests:[p.request]});
    assert.equal(raw.samples.length,201);assert.equal(hash(raw),row.measurementSHA256);
    assert.equal(raw.source.physicalHardware,false);assert.equal(raw.source.truthParametersExposed,false);
    const score=scoreMeasured(p,raw);
    assert.equal(score.selected,'command_cubic+rate+spring+cubic');
    for(let j=0;j<2;j++)assert.ok(Math.abs(score.scores[j].rms-row.beforeRefit.scores[j].rms)<1e-10);
    assert.equal(row.weakRefit.id,score.selected);
  }
  assert.throws(()=>scoreMeasured(pre[0],read('existing_active.run.json')));
});
test('supplemental acquisition factory refuses a world outside the registered development set',()=>{
  assert.throws(()=>developmentTrainingInstrument(-1,1,'negative-control'),/registered development/);
  assert.throws(()=>runCourse(receipt.trainingIds.map(id=>({id})),''),/Training recordings differ/);
});
test('matched secondary weak refits on original three training runs and each single recorded response',
  {skip:process.env.WORLDLAW_POSITION_OUTPUT_ARCHIVE?false:'Set WORLDLAW_POSITION_OUTPUT_ARCHIVE for authentic source replay'},()=>{
  const script=`
import hashlib,io,json,sys,tarfile,zipfile
with open(sys.argv[1],'rb') as f: data=f.read()
if hashlib.sha256(data).hexdigest()!='e8bac61ac3f0eb639ca039d27952e8f0a65ffd6f6118c980ca32860c47d09128': raise ValueError('original source digest differs')
with zipfile.ZipFile(io.BytesIO(data)) as z: pack=z.read('frozen/continuous-law-development.tgz')
with tarfile.open(fileobj=io.BytesIO(pack)) as t:
    print(json.dumps([json.load(t.extractfile('evidence/development/world-1006/active/'+n+'.run.json')) for n in ['source-0','source-1','round-2']]))
`;
  const runs=JSON.parse(execFileSync('python3',['-c',script,process.env.WORLDLAW_POSITION_OUTPUT_ARCHIVE],{encoding:'utf8',maxBuffer:600000}));
  const options=read('../position-output-development/interior-actuator-excitation.json').fitOptions;
  for(const r of receipt.results){
    const model=discoverWeak([...runs,read(r.arm+'.run.json')],options).selected;
    assert.equal(model.id,r.weakRefit.id);
    model.terms.forEach((t,j)=>assert.ok(Math.abs(t.coefficient-r.weakRefit.terms[j].coefficient)<1e-12));
  }
});
