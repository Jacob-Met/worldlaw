// Independent CLI receiving checks against the maintained session export and CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createSession,exportSession,MAX_SESSION_FILE_BYTES} from '../src/session.mjs';

function authoredNotebook() {
  const observations=[];
  for(const command of [-1,0,1])
    for(const position of [-1.5,-1,-0.5,0.25,0.75,1.5])
      for(const rate of [-0.8,-0.2,0.3,0.9])
        observations.push({command,position,rate,jointTorque:command-position-rate});
  return exportSession(createSession({schema:'worldlaw.observations/v1',
    source:{label:'Authored nearby-release CLI qualification',kind:'synthetic'},
    observations,heldOut:[],
  },{noiseSigma:1e-5,maxTerms:3,ambiguityDelta:6}));
}

export function registerNearbyCliTests({repoRoot, makeNotebook}) {
  test('nearby release CLI receives original notebook and preserves refusals', async t => {
    const dir=mkdtempSync(join(tmpdir(),'worldlaw-nearby-cli-'));
    try {
      const original=makeNotebook();
      assert.equal(typeof original,'string','fixture must be maintained exportSession text');
      const path=join(dir,'authored.json');
      writeFileSync(path,original);
      const base={ '--notebook':path,'--position':'0','--rate':'0',
        '--delta-position':'0.01','--delta-rate':'0.02','--command':'0',
        '--inertia':'1','--duration':'0.1','--interval':'0.01' };
      const run=(overrides={},extra=[])=>spawnSync(process.execPath,
        [join(repoRoot,'scripts/nearby-releases.mjs'),
          ...Object.entries({...base,...overrides}).flat(),...extra],
        {cwd:repoRoot,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
      const unchanged=()=>assert.equal(readFileSync(path,'utf8'),original);
      const complete=result=>{
        assert.equal(result.error,undefined); assert.equal(result.signal,null);
        assert.equal(result.status,0,result.stderr); assert.equal(result.stderr,'');
        const report=JSON.parse(result.stdout); assert.equal(report.status,'completed');
        return report;
      };
      const refuse=result=>{
        assert.equal(result.error,undefined); assert.equal(result.status,1);
        assert.equal(result.stdout,''); assert.match(result.stderr,/unavailable:/);
        unchanged();
      };
      let received;
      await t.test('valid exported notebook gives JSON and exact source hash',()=>{
        received=complete(run()); unchanged();
        assert.equal(received.notebook.sha256,createHash('sha256').update(original).digest('hex'));
        assert.equal(received.notebook.bytes,Buffer.byteLength(original));
        assert.equal(received.notebook.observations,72);
        assert.equal(received.courses.nominal.initial.position,0);
        assert.equal(received.initialPerturbations.full.requested.position,0.01);
        assert.equal(received.initialPerturbations.half.requested.rate,0.01);
        assert.equal(received.comparisons.full.rows[0].responseFactor,1);
      });
      await t.test('declared norm time scale changes no course or raw differences',()=>{
        const other=complete(run({'--time-scale':'2'}));
        assert.deepEqual(other.courses,received.courses);
        for(const name of ['full','half']) {
          const raw=r=>r.comparisons[name].rows.map(({time,positionDifference,rateDifference})=>
            ({time,positionDifference,rateDifference}));
          assert.deepEqual(raw(other),raw(received));
        }
        assert.notEqual(other.comparisons.full.initialDistance,received.comparisons.full.initialDistance);
        unchanged();
      });
      await t.test('nonzero-command authored consumer matches independent damped-release solution',()=>{
        const report=complete(run({'--command':'0.5','--position':'0.5','--rate':'0',
          '--delta-position':'0.02','--delta-rate':'0','--duration':'1','--interval':'0.05'}));
        // For q'' = 0.5 - q - q', the nominal q=0.5 is constant.
        // Independent exact perturbation solution: w=sqrt(3)/2,
        // dq=a*exp(-t/2)*(cos(wt)+sin(wt)/sqrt(3)),
        // dv=-2*a*exp(-t/2)*sin(wt)/sqrt(3).
        const close=(actual,expected,tolerance=2e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,
          `${actual} differs from independently predicted ${expected}`);
        for(const sample of report.courses.nominal.trajectory) {
          close(sample.position,0.5);close(sample.rate,0);
        }
        for(const [name,amplitude] of [['full',0.02],['half',0.01]]) {
          for(const row of report.comparisons[name].rows) {
            const phase=Math.sqrt(3)*row.time/2,decay=Math.exp(-row.time/2);
            const q=amplitude*decay*(Math.cos(phase)+Math.sin(phase)/Math.sqrt(3));
            const v=-2*amplitude*decay*Math.sin(phase)/Math.sqrt(3);
            close(row.positionDifference,q);close(row.rateDifference,v);
            close(row.responseFactor,Math.hypot(q,v)/amplitude,3e-6);
          }
        }
        assert.equal(report.settings.command,0.5);
        assert.equal(report.notebook.sha256,received.notebook.sha256);
        assert.deepEqual(report.source.model,received.source.model);unchanged();
      });
      await t.test('nonexistent recomputed model refuses',()=>refuse(run({'--model':'not-a-recomputed-model'})));
      await t.test('malformed, invalid UTF-8, oversized and nonregular files refuse',()=>{
        const fixtures=[['malformed.json','{"schema":"cached-result"}'],
          ['invalid-utf8.json',Buffer.from([0xc3,0x28])],
          ['oversized.json',Buffer.alloc(MAX_SESSION_FILE_BYTES+1,32)]];
        for(const [name,bytes] of fixtures) {
          const file=join(dir,name);writeFileSync(file,bytes);
          refuse(run({'--notebook':file}));
        }
        refuse(run({'--notebook':dir}));
      });
      await t.test('invalid flags and decimal inputs refuse',()=>{
        for(const extra of [['--unknown','1'],['--inertia','2'],['--model']]) refuse(run({},extra));
        for(const value of ['0','-1','NaN','Infinity','2kg','1e-999'])
          refuse(run({'--inertia':value}));
      });
      await t.test('rounded-away perturbation refuses before solver',()=>{
        const result=run({'--position':'1000000','--delta-position':'1e-20'});
        refuse(result); assert.match(result.stderr,/rounds away/);
      });
      await t.test('zero direction refuses',()=>refuse(run({'--delta-position':'0','--delta-rate':'0'})));
      await t.test('exhausted numerical budget retains failure as JSON exit 2',()=>{
        const result=run({'--max-trials':'1'});
        assert.equal(result.error,undefined);assert.equal(result.status,2,result.stderr);
        assert.equal(result.stderr,'');
        const report=JSON.parse(result.stdout);assert.equal(report.status,'incomplete');
        assert.ok(Object.values(report.courses).some(course=>course.status==='failed'));
        assert.equal(report.sizeComparison.status,'unavailable');
        assert.equal(report.work.failedCourseWorkUnknown,true);unchanged();
      });
      await t.test('poisoned cached discovery never replaces recomputed source',()=>{
        const poisoned=JSON.parse(original);
        poisoned.discovery={selected:{id:'POISON',terms:[{id:'bias',coefficient:999999}]},
          candidates:[],observations:[]};
        poisoned.trajectory=[{time:0,position:999999,rate:999999}];
        const poisonPath=join(dir,'poisoned.json'),poisonText=JSON.stringify(poisoned);
        writeFileSync(poisonPath,poisonText);
        const result=run({'--notebook':poisonPath});
        const report=complete(result);
        assert.deepEqual(report.source,received.source);
        assert.deepEqual(report.courses,received.courses);
        assert.equal(report.notebook.candidateId,received.notebook.candidateId);
        assert.equal(report.notebook.observations,72);
        assert.equal(report.notebook.sha256,createHash('sha256').update(poisonText).digest('hex'));
        const forged=run({'--notebook':poisonPath,'--model':'POISON'});
        refuse(forged);assert.match(forged.stderr,/not a candidate recomputed/);
        assert.equal(readFileSync(poisonPath,'utf8'),poisonText);unchanged();
      });
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
}

registerNearbyCliTests({repoRoot:fileURLToPath(new URL('..',import.meta.url)),makeNotebook:authoredNotebook});
