import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {rollout} from '../src/trajectory/forward.mjs';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
import {refineTrajectoryOutput} from '../src/trajectory/output-error-fit.mjs';

const receipt=JSON.parse(readFileSync(new URL('../docs/receipts/position-output-development/six-training-worlds.json',import.meta.url)));
const extractor=`
import hashlib,io,json,sys,tarfile,zipfile
with open(sys.argv[1],'rb') as f:
    data=f.read()
if hashlib.sha256(data).hexdigest()!=sys.argv[2]:
    raise ValueError('The source development artifact differs')
with zipfile.ZipFile(io.BytesIO(data)) as z:
    nested=z.read('frozen/continuous-law-development.tgz')
result={}
with tarfile.open(fileobj=io.BytesIO(nested)) as source:
    for world in range(1001,1007):
        prefix=f'evidence/development/world-{world}/active/'
        def read(name):
            return json.load(source.extractfile(prefix+name))
        result[world]=dict(warm=read('round-2-receive.stdout.json')['selected'],
            runs=[read(key+'.run.json') for key in ['source-0','source-1','round-1','round-2']])
print(json.dumps(result))
`;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`expected ${b}, saw ${a}`);

test('published comparison keeps every same-acquisition result and both refinement levels',()=>{
  assert.equal(receipt.preregistration,194147);
  assert.deepEqual(receipt.worlds.map(r=>r.world),['1001','1002','1003','1004','1005','1006']);
  let substantial=0,improved=0;
  for(const w of receipt.worlds){
    assert.deepEqual(w.original.map(t=>t.id),w.coefficients.map(t=>t.id));
    assert.equal(w.before.perRun.length,4);
    close(w.before.rms,Math.hypot(...w.before.perRun.map(r=>r.rms))/2);
    close(w.after.rms,Math.hypot(...w.after.perRun.map(r=>r.rms))/2);
    assert.ok(w.after.rms<w.before.rms);
    if(w.after.rms<=.9*w.before.rms)substantial++;
    for(let i=0;i<4;i++){
      const before=w.before.perRun[i],after=w.after.perRun[i];
      assert.equal(before.id,after.id);assert.equal(after.count,200);
      if(after.rms<before.rms)improved++;
      assert.ok(w.fineAfter.perRun[i].rms<w.fineBefore.perRun[i].rms);
    }
  }
  assert.equal(substantial,5);assert.equal(improved,24);
});

const archive=process.env.WORLDLAW_POSITION_OUTPUT_ARCHIVE;
test('original development artifact replays all four active training acquisitions per world',
  {skip:archive?false:'Set WORLDLAW_POSITION_OUTPUT_ARCHIVE to the registered development ZIP'},()=>{
    const cases=JSON.parse(execFileSync('python3',['-c',extractor,archive,receipt.artifactSha256],
      {encoding:'utf8',maxBuffer:2500000}));
    for(const w of receipt.worlds){
      const {warm,runs}=cases[w.world],fit=refineTrajectoryOutput(warm,runs);
      assert.equal(warm.id,w.support);
      assert.deepEqual(fit.model.terms.map(t=>t.id),warm.terms.map(t=>t.id));
      fit.model.terms.forEach((t,i)=>close(t.coefficient,w.coefficients[i].coefficient));
      for(const [model,coarse,fine] of [[warm,fit.before,w.fineBefore],[fit.model,fit.after,w.fineAfter]]){
        for(let j=0;j<runs.length;j++){
          const saved=model===warm?w.before:w.after;
          close(coarse.perRun[j].rms,saved.perRun[j].rms);
          close(coarse.perRun[j].maxAbs,saved.perRun[j].maxAbs);
          const d=rollout(model,runs[j],{maxStep:.005}).rows.slice(1).map(r=>r.residual);
          close(Math.hypot(...d)/Math.sqrt(d.length),fine.perRun[j].rms);
          close(Math.max(...d.map(Math.abs)),fine.perRun[j].maxAbs);
        }
      }
    }
  });

const folds=JSON.parse(readFileSync(new URL('../docs/receipts/position-output-development/within-training-folds.json',import.meta.url)));
test('three-run fits retain the omitted acquisition, including the failed actuator transfer',()=>{
  assert.equal(folds.preregistration,194243);assert.equal(folds.rows.length,24);
  let wins=0,worldWins=0;
  for(const world of receipt.worlds){
    const cases=folds.rows.filter(row=>row.world===world.world);
    assert.deepEqual(cases.map(row=>row.omitted),[0,1,2,3]);
    for(const row of cases){
      assert.equal(row.trainingIds.length,3);assert.ok(!row.trainingIds.includes(row.testId));
      if(row.metrics.output.standard.rms<row.metrics.weak.standard.rms)wins++;
    }
    const rms=id=>Math.hypot(...cases.map(row=>row.metrics[id].standard.rms))/2;
    if(rms('output')<rms('weak'))worldWins++;
    assert.ok(rms('output')<=1.05*rms('weak'));
  }
  assert.equal(wins,23);assert.equal(worldWins,5);
  const worst=folds.rows.find(x=>x.world==='1006'&&x.omitted===2);
  assert.equal(worst.support,'command+rate+spring+cubic');
  assert.ok(worst.metrics.output.standard.rms>worst.metrics.weak.standard.rms);
});

test('original training folds reselect support before the omitted acquisition',
  {skip:archive?false:'Set WORLDLAW_POSITION_OUTPUT_ARCHIVE to the registered development ZIP'},()=>{
    const cases=JSON.parse(execFileSync('python3',['-c',extractor,archive,receipt.artifactSha256],{encoding:'utf8',maxBuffer:2500000}));
    for(const row of folds.rows){
      const runs=cases[row.world].runs,omitted=runs[row.omitted],train=runs.filter((_,i)=>i!==row.omitted);
      assert.deepEqual(train.map(r=>r.id),row.trainingIds);assert.equal(omitted.id,row.testId);
      const weak=discoverWeak(train,folds.fitOptions).selected,output=refineTrajectoryOutput(weak,train).model;
      assert.equal(weak.id,row.support);
      for(const [id,model] of [['weak',weak],['output',output]]){
        model.terms.forEach((t,i)=>close(t.coefficient,row[id][i].coefficient));
        for(const [grid,maxStep] of [['standard',.01],['fine',.005]]){
          const errors=rollout(model,omitted,{maxStep}).rows.slice(1).map(z=>z.residual);
          close(Math.hypot(...errors)/Math.sqrt(errors.length),row.metrics[id][grid].rms);
          close(Math.max(...errors.map(Math.abs)),row.metrics[id][grid].maxAbs);
        }
      }
      if(row.world==='1006'&&row.omitted===2){
        assert.ok(train.every(r=>r.samples.slice(0,-1).every(s=>s.command===s.command**3)));
        assert.equal(Math.max(...omitted.samples.slice(0,-1).map(s=>Math.abs(s.command-s.command**3))),.375);
      }
    }
  });
