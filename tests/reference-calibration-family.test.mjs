import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {certifyReferenceCalibration as plan,verifyReferenceCalibration as verify,
  receiveReferenceCalibration as receive} from '../src/science/position-drift-reference-calibration.mjs';
import {certifyPhysicalFeedbackTree} from '../src/science/position-drift-physical-feedback.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as A} from '../src/science/active-linear-family.mjs';

const sourcePath='examples/active-position-drift-reference-calibration.json';
const example=()=>JSON.parse(readFileSync(sourcePath,'utf8'));
const {Q,fmt}=A;

test('closed form agrees with changed small two-word menus and its inverse keeps equality closed',()=>{
  const s=example();
  for(const m of [2,4]){
    s.references=String(m);
    const p=plan(s);
    const direct={schema:'worldlaw.position-drift-physical-feedback-tree/v1',catalog:s.catalog,horizon:m+4,
      program:{commands:[...Array(m).fill('ref'),'group'],alternatives:[{commands:['y0','x0','z0']},{commands:['z1','x1','y1']}]}};
    assert.equal(certifyPhysicalFeedbackTree(direct).tree.radius,p.radius);
    assert.equal(verify(s,p),true);
    const t=structuredClone(s);t.catalog.noiseBound=p.radius;
    const at=plan(t);
    assert.equal(at.atRequestedNoise,'closed-collision');
    assert.equal(at.leastReferencesAtNoise,String(m+1));
    assert.throws(()=>receive(t,at,['0']),/no guaranteed separation/);
  }
  for(const noise of ['1/10','11/100']){
    s.catalog.noiseBound=noise;assert.equal(plan(s).leastReferencesAtNoise,null);
  }
  s.references='5/2';assert.throws(()=>plan(s),/integer/);
});

test('the six-checkpoint receiver keeps one physical world and accepts reordered source vertices',()=>{
  const s=example();
  const perm=[7,3,0,2,6,1,5,4],names=s.catalog.commands;
  s.catalog.commands=perm.map(i=>names[i]);
  for(const law of s.catalog.laws){
    law.vertices=law.vertices.map(row=>perm.map(i=>row[i])).reverse();
    law.vertices.push(law.vertices[0].map((x,i)=>String(x+law.vertices[1][i])+'/2'));
  }
  s.catalog.laws.reverse();
  const p=plan(s);assert.equal(p.radius,'1/15');
  assert.equal(p.leastReferencesAtNoise,'4');
  assert.deepEqual(receive(s,p,['0']).nextRun,{command:'ref',repeats:'4'});
  for(const [ys,first,law] of [[['0','0','0','1','1','1'],'y0','A'],[['0','0','1','0','1','1'],'z1','B']]){
    assert.equal(receive(s,p,ys.slice(0,3)).nextRun.command,first);
    const out=receive(s,p,ys);assert.deepEqual(out.surviving.map(w=>w.law),[law]);assert.equal(out.nextRun,null);
    assert.equal(out.surviving[0].jointRegion.remainingCoordinates.length,2);
  }
  assert.equal(receive(s,p,['0','0','1/2']).nextRun.command,'z1');
  assert.deepEqual(receive(s,p,['0','0','100']).surviving,[]);
  const bad=structuredClone(p);bad.boundary.branches[1].worlds[0].drift='0';
  assert.throws(()=>verify(s,bad),/differs/);
  s.catalog.laws[0].vertices.at(-1)[s.catalog.commands.indexOf('ref')]='1/2';
  assert.throws(()=>plan(s),/terminal rate identity/);
});

test('huge counts keep the measured run compressed and propagate affine origin and drift',()=>{
  const s=example(),m=10n**500n+7n;
  s.references=String(m);s.catalog.noiseBound='1/20';
  const p=plan(s),origin=10n**70n+9n,drift=-3n;
  assert.equal(p.readAt.length,6);assert.equal(p.horizon,String(m+4n));
  assert.equal(p.radius,fmt(Q(m,10n*(m+2n))));
  assert.equal(p.work,plan(example()).work);
  const ticks=[0n,m,m+1n,m+2n,m+3n,m+4n];
  const deltas=[0n,0n,1n,0n,1n,1n];
  const ys=ticks.map((t,i)=>String(origin+drift*t+deltas[i]));
  const outcome=receive(s,p,ys);
  assert.deepEqual(outcome.surviving.map(w=>w.law),['B']);
  assert.equal(outcome.runs.length,5);
  assert.equal(outcome.runs[0].repeats,String(m));
  const limited=structuredClone(s);limited.catalog.limits.receiverWork=0;
  assert.equal(receive(limited,plan(limited),ys).status,'receiver-budget-exhausted');
  limited.catalog.limits.designWork=0;assert.equal(plan(limited).status,'design-budget-exhausted');
});

test('portable CLI and independent original-position receiver cover every reference tick or its affine interval',()=>{
  const dir=mkdtempSync(join(tmpdir(),'all-reference-'));
  try{
    const src=join(dir,'source.json'),cert=join(dir,'proof.json'),obs=join(dir,'observations.json');
    for(const m of [2n,4n,11n,10n**500n+7n]){
      const s=example();s.references=String(m);writeFileSync(src,JSON.stringify(s));
      const run=(...args)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--reference-calibration','--input',src,...args],{encoding:'utf8'});
      rmSync(cert,{force:true});
      const made=run('--output',cert);assert.equal(made.status,0,made.stderr);
      const at=m<=11n?Array.from({length:Number(m)+1},(_,i)=>BigInt(i)):[1n,m/2n,m-1n];
      for(const t of at){
        const check=spawnSync('python3',['scripts/verify-reference-calibration.py',src,cert,'--reference-tick',String(t)],{encoding:'utf8'});
        assert.equal(check.status,0,check.stderr);
        const result=JSON.parse(check.stdout);
        assert.equal(result.coveredReferenceTicks,String(m+1n));assert.equal(result.sample.length,4);
      }
      if(m===4n){
        writeFileSync(obs,JSON.stringify(['0','0','1/2']));
        const now=run('--replay',cert,'--readings',obs);assert.equal(now.status,0,now.stderr);
        assert.deepEqual(JSON.parse(now.stdout).nextRun,{command:'z1',repeats:'1'});
        const bad=JSON.parse(readFileSync(cert,'utf8'));bad.boundary.reference.perTick='0';
        writeFileSync(cert,JSON.stringify(bad));
        assert.notEqual(spawnSync('python3',['scripts/verify-reference-calibration.py',src,cert]).status,0);
      }
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
