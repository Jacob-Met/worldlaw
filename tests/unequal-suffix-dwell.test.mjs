import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {certifyReferenceCalibration as plan,receiveReferenceCalibration as receive} from '../src/science/position-drift-reference-calibration.mjs';

const src='examples/active-position-drift-dwell-calibration.json';
const cert='examples/twelve-pulse-unequal-suffix-obstruction.json';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const replay=(source,packet)=>spawnSync('python3',['scripts/verify-unequal-suffix-dwell.py',source,packet],{encoding:'utf8'});

test('all suffix orders and independent positive dwell allocations share a physical collision at each prefix',()=>{
  const result=replay(src,cert);assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{radius:'1/10',prefixes:36,continuations:3960,distinctWorldPairs:2693,originalWorldTicks:102960});
  const x=read(src);x.pulseBudget='12';const at=plan(x);
  assert.equal(at.radius,'1/10');assert.equal(at.atRequestedNoise,'closed-collision');
  x.catalog.noiseBound='999999999999/10000000000000';
  assert.equal(plan(x).atRequestedNoise,'policy-separates');
  const s=read(src),p=plan(s);assert.equal(p.radius,'1/9');
  assert.deepEqual(receive(s,p,['0','0','2','0','2','2']).surviving.map(w=>w.law),['B']);
});

test('missing choices, false common histories, negative masses and changed source are rejected',()=>{
  const dir=mkdtempSync(join(tmpdir(),'unequal-dwell-'));
  try{
    const bad=join(dir,'packet.json');
    for(const edit of [p=>p.prefixes[0][3].pop(),p=>{p.prefixes[0][2]='100';},p=>{p.worldPairs[0][1]='-1/10';}]){
      const p=read(cert);edit(p);writeFileSync(bad,JSON.stringify(p));assert.notEqual(replay(src,bad).status,0);
    }
    const altered=read(src);altered.catalog.laws[0].vertices[0][0]=1;writeFileSync(bad,JSON.stringify(altered));
    assert.notEqual(replay(bad,cert).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
