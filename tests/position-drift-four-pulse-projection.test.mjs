import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {compressFourPulseMenu,compressFourPulseMenuWithSimplex,verifyCompactFourPulseMenu,receiveCompactFourPulseMenu} from '../src/science/position-drift-four-pulse-compact.mjs';

const full=()=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-full-group-menu.json',import.meta.url),'utf8'));
function changed(){
  const r=full();r.experiment.catalog=JSON.parse(readFileSync(new URL('../examples/active-position-drift-four-pulse-tetrahedra.json',import.meta.url),'utf8')).catalog;
  r.prefix=['z','y'];r.branches=r.experiment.catalog.commands.map(third=>({third,last:r.experiment.catalog.commands.slice()}));return r;
}
test('the projected route closes the previous 100,000-unit exhaustion while its original receipt still replays',()=>{
  const source=full();source.experiment.catalog.limits.designWork=100000;
  const old=compressFourPulseMenuWithSimplex(source),now=compressFourPulseMenu(source);
  assert.equal(old.status,'design-budget-exhausted');assert.equal(old.work,100000);
  assert.equal(now.status,'menu-compressed');assert.equal(now.radius,'1/40');assert.deepEqual(now.jumps.map(j=>j.radius),['1/40']);
  assert.deepEqual(now.kept,[19,20,46,47]);assert.equal(now.boundary.worlds.length,64);
  assert.ok(verifyCompactFourPulseMenu(source,old));assert.ok(verifyCompactFourPulseMenu(source,now));
  assert.deepEqual(receiveCompactFourPulseMenu(source,now,[17,20,24,27,31]).surviving.map(x=>x.law),['A']);
  source.experiment.catalog.limits.designWork=0;const refused=compressFourPulseMenu(source);
  assert.equal(refused.status,'design-budget-exhausted');assert.ok(verifyCompactFourPulseMenu(source,refused));
});
test('every intermediate jump is a source certificate and equality is a common physical history',()=>{
  const src=changed(),original=compressFourPulseMenuWithSimplex(src),c=compressFourPulseMenu(src);
  assert.equal(c.radius,original.radius);assert.equal(c.radius,'1/65');
  assert.deepEqual(c.jumps.map(j=>j.radius),['5/376','1/68','1/65']);assert.ok(verifyCompactFourPulseMenu(src,c));
  assert.ok(verifyCompactFourPulseMenu(src,original));assert.ok(c.work>original.work);
  for(const mutate of [s=>{s.jumps[0].radius='1/66';},s=>{s.jumps[0].lower[0].weight='99';},
    s=>{s.jumps.reverse();},s=>{s.jumps.pop();},s=>{s.boundary.observations[1]='999';}]){
    const bad=structuredClone(c);mutate(bad);assert.throws(()=>verifyCompactFourPulseMenu(src,bad));
  }
});
test('affine aliases on used commands, zero/point hulls and repeated atomic supports retain their semantics',()=>{
  const r=changed(),c=r.experiment.catalog;c.commands=['a','b','c','unused'];
  c.laws[0].vertices=[[0,0,0,100],[2,2,2,500]];c.laws[1].vertices=[[3,3,3,-91]];
  r.experiment.fourPulseControl=null;r.prefix=['a','a'];r.branches=['a','b','c'].map(third=>({third,last:['b','c']}));
  const alias=compressFourPulseMenu(r);assert.equal(alias.radius,'0');assert.equal(alias.kept.length,1);
  assert.deepEqual(alias.jumps,[]);assert.ok(verifyCompactFourPulseMenu(r,alias));
  c.commands=['0','1','2'];c.laws[0].vertices=[[1,-2,4]];c.laws[1].vertices=[[5,-2,-5],[-2,-2,-4],[-4,1,2]];
  r.prefix=['0','0'];r.branches=c.commands.map(third=>({third,last:c.commands.slice()}));
  const grouped=compressFourPulseMenu(r);assert.deepEqual(grouped.kept,[7]);assert.equal(grouped.radius,'23/28');
  assert.equal(grouped.lower.length,5);assert.ok(verifyCompactFourPulseMenu(r,grouped));
  // Exact eight-term (nonbasic) proofs are legal even when all terms come from one leaf.
  const old=compressFourPulseMenuWithSimplex(r),same=structuredClone(old);
  const w=same.lower[0],[num,den='1']=w.weight.split('/'),repeats=9-same.lower.length;
  const weight=num+'/'+(BigInt(den)*BigInt(repeats));same.lower=same.lower.slice(1);
  for(let i=0;i<repeats;i++)same.lower.push({...w,weight});
  assert.equal(same.lower.length,8);assert.ok(verifyCompactFourPulseMenu(r,same));
  same.lower.push({...w,weight});assert.throws(()=>verifyCompactFourPulseMenu(r,same));
});
test('frozen changed-input cost course checks both exact methods, including work regressions',()=>{
  let seed=110389;const draw=m=>(seed=seed*48271%2147483647)%m;
  let wins=0,legacyWork=0,projectedWork=0,maximumRatio=0;
  for(let i=0;i<48;i++){
    const m=3+i%3,r=changed(),cat=r.experiment.catalog;cat.commands=Array.from({length:m},(_,j)=>String(j));
    cat.laws.forEach(l=>{l.vertices=Array.from({length:1+draw(4)},()=>cat.commands.map(()=>draw(11)-5));});r.experiment.fourPulseControl=null;
    r.prefix=[String(draw(m)),String(draw(m))];r.branches=cat.commands.map(third=>({third,last:cat.commands.slice()}));
    const old=compressFourPulseMenuWithSimplex(r),current=compressFourPulseMenu(r);
    assert.equal(current.radius,old.radius);assert.ok(verifyCompactFourPulseMenu(r,current));assert.ok(verifyCompactFourPulseMenu(r,old));
    if(current.work<old.work)wins++;
    legacyWork+=old.work;projectedWork+=current.work;maximumRatio=Math.max(maximumRatio,current.work/old.work);
  }
  assert.ok(wins>24&&wins<48);assert.ok(projectedWork<legacyWork);assert.ok(maximumRatio>1);
  console.log(JSON.stringify({courses:48,wins,legacyWork,projectedWork,maximumRatio}));
});
test('the original and projected public CLI routes observe one declared budget each',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worldlaw-projection-'));
  try{
    const source=full(),p=join(dir,'source.json'),old=join(dir,'v1.json'),current=join(dir,'v2.json');
    source.experiment.catalog.limits.designWork=100000;writeFileSync(p,JSON.stringify(source));
    const run=(...opts)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',p,...opts],{encoding:'utf8'});
    assert.equal(run('--four-pulse-compact-simplex','--output',old).status,2);
    assert.equal(run('--four-pulse-compact','--replay',old).status,2);
    assert.equal(run('--four-pulse-compact','--output',current).status,0);
    assert.equal(run('--four-pulse-compact','--replay',current).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
