import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSession,exportSession,MAX_SESSION_FILE_BYTES} from '../src/session.mjs';

const cli = fileURLToPath(new URL('../scripts/balance-candidates.mjs',import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const invoke = args => {
  const child = spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  assert.equal(child.error,undefined,child.error?.message);
  assert.equal(child.signal,null);
  return child;
};
const settings = ['--command','0','--minimum','-2','--maximum','2','--cells','128','--refinements','64'];
function authoredNotebook() {
  const observations = [];
  for (const command of [-1,0,1])
    for (const position of [-1.5,-1,-0.5,0.25,0.75,1.5])
      for (const rate of [-0.8,-0.2,0.3,0.9])
        observations.push({command,position,rate,jointTorque:command+position-position**3-0.8*rate});
  return exportSession(createSession({
    schema:'worldlaw.observations/v1',
    source:{label:'Authored cubic balance CLI qualification',kind:'synthetic'},
    observations,heldOut:[],
  },{noiseSigma:1e-5,maxTerms:4,ambiguityDelta:6,additionalTerms:['cubic']}));
}

test('actual exported notebook reopens through the CLI and command changes its numerical candidates',async()=>{
  const dir = await mkdtemp(join(tmpdir(),'worldlaw-balance-'));
  try {
    const path = join(dir,'original-notebook.json');
    const source = authoredNotebook();
    await writeFile(path,source,{flag:'wx'});
    const first = invoke(['--notebook',path,...settings]);
    assert.equal(first.status,0,first.stderr);
    const report = JSON.parse(first.stdout);
    assert.equal(report.notebook.sha256,sha(Buffer.from(source)));
    assert.equal(report.notebook.bytes,Buffer.byteLength(source));
    assert.equal(report.notebook.observations,72);
    assert.equal(report.notebook.explicitlySelected,false);
    assert.equal(report.source.rate,0);
    assert.equal(report.candidates.length,3);
    for (const [i,expected] of [-1,0,1].entries()) assert.ok(Math.abs(report.candidates[i].position-expected)<1e-10);
    assert.equal(report.coverage.exhaustive,false);
    const nextSettings = [...settings]; nextSettings[1]='0.4';
    const next = invoke(['--notebook',path,...nextSettings,'--model',report.notebook.candidateId]);
    assert.equal(next.status,0,next.stderr);
    const changed = JSON.parse(next.stdout);
    assert.equal(changed.candidates.length,1);
    assert.equal(changed.notebook.explicitlySelected,true);
    assert.equal(changed.notebook.sha256,report.notebook.sha256);
    assert.deepEqual(changed.source.model,report.source.model);
    assert.equal(await readFile(path,'utf8'),source);
    console.log(JSON.stringify({course:'actual-exported-notebook-balance-cli',
      notebookSha256:report.notebook.sha256,model:report.notebook.candidateId,
      atCommand0:report.candidates.map(row=>({position:row.position,residual:row.residual})),
      atCommand04:changed.candidates.map(row=>({position:row.position,residual:row.residual})),
      originalUnchanged:true}));
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('derived cached results cannot replace notebook replay or invent a candidate',async()=>{
  const dir = await mkdtemp(join(tmpdir(),'worldlaw-balance-source-'));
  try {
    const path = join(dir,'with-untrusted-cache.json');
    const raw = JSON.parse(authoredNotebook());
    raw.discovery = {selected:{id:'forged',terms:[{id:'bias',coefficient:999}]}};
    raw.balanceCandidates = {candidates:[{position:999}]};
    const source = JSON.stringify(raw);
    await writeFile(path,source,{flag:'wx'});
    const child = invoke(['--notebook',path,...settings]);
    assert.equal(child.status,0,child.stderr);
    const result = JSON.parse(child.stdout);
    assert.notEqual(result.notebook.candidateId,'forged');
    assert.equal(result.candidates.length,3);
    assert.ok(result.candidates.every(row=>Math.abs(row.position)<=2));
    assert.equal(result.notebook.sha256,sha(Buffer.from(source)));
    const forged = invoke(['--notebook',path,...settings,'--model','forged']);
    assert.equal(forged.status,1);
    assert.equal(forged.stdout,'');
    assert.match(forged.stderr,/not a candidate recomputed/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('native CLI rejects unsupported inputs and bounded files without producing a partial report',async()=>{
  const dir = await mkdtemp(join(tmpdir(),'worldlaw-balance-refusal-'));
  try {
    const valid = join(dir,'valid.json');
    const malformed = join(dir,'malformed.json');
    const invalidUtf8 = join(dir,'invalid-utf8.json');
    const oversized = join(dir,'oversized.json');
    await writeFile(valid,authoredNotebook(),{flag:'wx'});
    await writeFile(malformed,'{"schema":"cached-result"}',{flag:'wx'});
    await writeFile(invalidUtf8,Buffer.from([0xc3,0x28]),{flag:'wx'});
    await writeFile(oversized,Buffer.alloc(MAX_SESSION_FILE_BYTES+1,32),{flag:'wx'});
    for (const path of [malformed,invalidUtf8,oversized,dir]) {
      const child = invoke(['--notebook',path,...settings]);
      assert.equal(child.status,1);
      assert.equal(child.stdout,'');
      assert.match(child.stderr,/Balance inspection unavailable/);
    }
    for (const extra of [
      ['--cells','4097'], ['--refinements','65'],
      ['--unknown','1'], ['--command','0'], ['--minimum'],
    ]) {
      const child = invoke(['--notebook',valid,...settings,...extra]);
      assert.equal(child.status,1);
      assert.equal(child.stdout,'');
    }
    for (const command of ['Infinity','0x10','1e-999','']) {
      const options = [...settings]; options[1]=command;
      const child = invoke(['--notebook',valid,...options]);
      assert.equal(child.status,1);
      assert.equal(child.stdout,'');
    }
    const help = invoke(['--help']);
    assert.equal(help.status,0);
    assert.match(help.stdout,/tangent roots/);
    assert.equal(help.stderr,'');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
