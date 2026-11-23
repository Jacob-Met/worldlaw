import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {certifyFixedTapeOptimum as plan,verifyFixedTapeOptimum as verify,receiveFixedTapeOptimum as receive} from '../src/science/position-drift-fixed-tape-optimum.mjs';
import {certifyPhysicalFeedbackTree} from '../src/science/position-drift-physical-feedback.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as A} from '../src/science/active-linear-family.mjs';

const stem='examples/active-position-drift-fixed-tape-optimum';
const read=f=>JSON.parse(readFileSync(f,'utf8'));
const source=h=>({...read(stem+'.json'),pulseBudget:String(h)});
const {Q,fmt}=A;

test('expanded physical controls verify fixed schedules, closed boundaries, ties and missing coordinates',()=>{
  for(const [h,r] of [[7,'1/28'],[8,'1/16'],[10,'1/10'],[11,'5/44'],[12,'1/8']]){
    const s=source(h),p=plan(s);assert.equal(p.radius,r);
    const word=p.runs.flatMap(run=>Array(Number(run.repeats)).fill(run.command));
    const direct=w=>certifyPhysicalFeedbackTree({schema:'worldlaw.position-drift-physical-feedback-tree/v1',catalog:s.catalog,
      horizon:h,program:{commands:w}}).tree.radius;
    assert.equal(direct(word),r);
    word[word.length-1]='group';assert.equal(direct(word),'0');
  }
  const tie=plan(source(18));assert.deepEqual(tie.optimalDwells,['1','2']);assert.equal(tie.radius,'1/6');
  for(let h=0;h<=6;h++){
    const s=source(h),p=plan(s);assert.equal(p.radius,'0');assert.deepEqual(p.optimalDwells,[]);
    assert.deepEqual(receive(s,p,h?['-599','1000']:['-599']).surviving,['A','B']);
  }
});

test('three exact positions retain both closed endpoints, reject inconsistent histories and preserve affine shifts',()=>{
  const s=source(11),p=read(stem+'-proof.json');assert.equal(verify(s,p),true);
  assert.deepEqual(receive(s,p,['7']).nextRuns,[{command:'ref',repeats:'5'}]);
  assert.equal(receive(s,p,['7','-3']).nextRuns.length,6);
  // Add the same 7−2t drift to both clean three-reading histories.
  assert.deepEqual(receive(s,p,['7','-3','-14']).surviving,['A']);
  assert.deepEqual(receive(s,p,['7','-3','-15']).surviving,['B']);
  assert.deepEqual(receive(s,p,['0','0','99']).surviving,[]);
  const ten=source(10),tenPlan=plan(ten);
  assert.deepEqual(receive(ten,tenPlan,['0','0','1/2']).surviving,['A','B']);
  s.catalog.limits.receiverWork=0;assert.equal(receive(s,plan(s),['7']).status,'receiver-budget-exhausted');
  s.catalog.limits.designWork=0;assert.equal(plan(s).status,'design-budget-exhausted');
});

test('literal vertex pair witnesses remain valid after coordinate, anchor, and family permutations',()=>{
  const s=source(11),perm=[6,2,0,7,4,5,1,3];s.catalog.commands=perm.map(i=>s.catalog.commands[i]);
  for(const law of s.catalog.laws)law.vertices=law.vertices.map(v=>perm.map(i=>v[i])).reverse();
  s.catalog.laws.reverse();
  const p=plan(s);assert.equal(p.radius,'5/44');
  const laws=p.roles.map(id=>s.catalog.laws.find(l=>l.id===id));
  for(const {command,a,b} of p.singleCoordinatePairs){
    for(const [j,c] of s.catalog.commands.entries())assert.equal(laws[0].vertices[a][j]-laws[1].vertices[b][j],Number(c===command));
  }
  const bad=structuredClone(p);bad.singleCoordinatePairs.pop();assert.throws(()=>verify(s,bad),/differs/);
  s.catalog.commands.push('extra');for(const l of s.catalog.laws)for(const v of l.vertices)v.push(0);
  assert.throws(()=>plan(s),/eight registered commands/);
});

test('huge budgets keep constant-size command lists and the portable CLI replays the registered optimum',()=>{
  const h=10n**500n+7n,s=source(h),p=plan(s),k=BigInt(p.dwell),m=h-6n*k;
  assert.equal(p.runs.length,7);assert.equal(p.readAt.length,3);assert.ok(p.optimalDwells.length<=2);
  assert.equal(p.radius,fmt(Q(k*m,4n*h)));assert.deepEqual(receive(s,p,['0','0',String(k)]).surviving,['A']);
  const dir=mkdtempSync(join(tmpdir(),'fixed-optimum-'));
  try{
    const saved=join(dir,'plan.json'),obs=join(dir,'obs.json');
    const cli=(...args)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--fixed-tape-optimum','--input',stem+'.json',...args],{encoding:'utf8'});
    const made=cli('--output',saved);assert.equal(made.status,0,made.stderr);
    writeFileSync(obs,JSON.stringify(['0','0','1']));const replay=cli('--replay',saved,'--readings',obs);
    assert.equal(replay.status,0,replay.stderr);assert.deepEqual(JSON.parse(replay.stdout).surviving,['A']);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
