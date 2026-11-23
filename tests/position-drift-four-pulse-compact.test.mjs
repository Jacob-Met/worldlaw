import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {compressFourPulseMenu,verifyCompactFourPulseMenu,receiveCompactFourPulseMenu} from '../src/science/position-drift-four-pulse-compact.mjs';
import {certifyFourPulseLeafMinimum,verifyFourPulseLeafMinimum} from '../src/science/position-drift-four-pulse-leaf-minimum.mjs';
const example=n=>JSON.parse(readFileSync(new URL('../examples/'+n,import.meta.url),'utf8'));
const full=()=>example('active-position-drift-full-group-menu.json'),group=()=>example('active-position-drift-two-feedback-groups.json');

test('a 64-leaf menu becomes four leaves at exactly the original radius and still guides both decisions',()=>{
  const req=full(),c=compressFourPulseMenu(req);assert.equal(c.status,'menu-compressed');assert.equal(c.boundary.worlds.length,64);
  assert.deepEqual(c.kept,[19,20,46,47]);assert.equal(c.radius,'1/40');assert.equal(c.lower.length,8);assert.ok(verifyCompactFourPulseMenu(req,c));
  for(const [ys,next] of [[[0,0,0],'x0'],[[0,0,1],'x1'],[[0,0,0,0],'y0'],[[0,0,0,1],'z0'],[[0,0,1,1],'y1'],[[0,0,1,2],'z1']]){
    assert.equal(receiveCompactFourPulseMenu(req,c,ys).nextCommand,next);
  }
  for(const change of [t=>{t.kept.pop();},t=>{t.kept[1]=21;},t=>{t.lower[0].weight='99';},t=>{t.boundary.worlds[0][0].positions[3]='500';}]){
    const bad=structuredClone(c);change(bad);assert.throws(()=>verifyCompactFourPulseMenu(req,bad));
  }
  const rev=full();rev.branches.reverse();rev.branches.forEach(b=>b.last.reverse());const other=compressFourPulseMenu(rev);
  assert.equal(other.radius,c.radius);assert.equal(other.kept.length,4);assert.ok(verifyCompactFourPulseMenu(rev,other));
});

test('changed hulls, point limits, zero radius and work exhaustion preserve compact ancestry',()=>{
  const req=full(),tetra=example('active-position-drift-four-pulse-tetrahedra.json');req.experiment=tetra;req.prefix=['z','y'];
  req.branches=tetra.catalog.commands.map(third=>({third,last:tetra.catalog.commands.slice()}));
  let c=compressFourPulseMenu(req);assert.equal(c.radius,'1/65');assert.equal(c.kept.length,2);assert.ok(verifyCompactFourPulseMenu(req,c));
  let seed=91901;const draw=n=>(seed=seed*48271%2147483647)%n;
  for(let i=0;i<18;i++){
    const cat=req.experiment.catalog;cat.commands=['a','b','c'];req.experiment.fourPulseControl=null;req.prefix=['a','b'];
    req.branches=cat.commands.map(third=>({third,last:cat.commands.slice()}));
    cat.laws.forEach(l=>{l.vertices=Array.from({length:1+draw(3)},()=>cat.commands.map(()=>draw(11)-5));});
    c=compressFourPulseMenu(req);assert.equal(c.status,'menu-compressed');assert.ok(c.kept.length<=4&&c.lower.length<=8);
    assert.ok(verifyCompactFourPulseMenu(req,c));
  }
  const cat=req.experiment.catalog;cat.laws[0].vertices=[[0,0,0]];cat.laws[1].vertices=[[1,1,1]];
  c=compressFourPulseMenu(req);assert.equal(c.radius,'0');assert.equal(c.kept.length,1);assert.ok(verifyCompactFourPulseMenu(req,c));
  cat.limits.designWork=0;assert.equal(compressFourPulseMenu(req).status,'design-budget-exhausted');
});

test('all asymmetric three-leaf trees fail on the four-leaf fixture and every nongrid case has original physical states',()=>{
  const req=group(),c=certifyFourPulseLeafMinimum(req);assert.equal(c.status,'four-leaves-required');
  assert.deepEqual(c.counts,{total:802816,gridRefuted:802812,complete:true});assert.equal(c.exceptions.length,4);
  assert.ok(c.exceptions.every(t=>t.proof.radius==='0'));assert.equal(c.upper.kept.length,4);assert.equal(c.singleCut.menuProof.radius,'1/40');
  assert.ok(verifyFourPulseLeafMinimum(req,c));
  for(const alter of [t=>{t.exceptions.pop();},t=>{t.exceptions[0].proof.observations[0]='17';},
    t=>{t.exceptions[0].shape[0]='ref';},t=>{t.counts.gridRefuted++;},t=>{t.upper.kept[1]=0;}]){
    const bad=structuredClone(c);alter(bad);assert.throws(()=>verifyFourPulseLeafMinimum(req,bad));
  }
});

test('a different grouped source needs exactly three leaves with genuine missing-grid fallbacks',()=>{
  const req=example('active-position-drift-three-leaf-groups.json'),c=certifyFourPulseLeafMinimum(req);
  assert.equal(c.status,'three-leaf-witness');assert.equal(c.singleCut.status,'grid-inconclusive');
  assert.deepEqual(c.cutExceptions.map(t=>t.proof.radius),['0','0']);assert.equal(c.exceptions.at(-1).proof.radius,'1/40');
  assert.equal(c.counts.complete,false);assert.ok(verifyFourPulseLeafMinimum(req,c));
  const bad=structuredClone(c);bad.cutExceptions[0].proof.worlds[0][0].start[1]='100';assert.throws(()=>verifyFourPulseLeafMinimum(req,bad));
  req.experiment.catalog.limits.designWork=0;const exhausted=certifyFourPulseLeafMinimum(req);assert.equal(exhausted.status,'design-budget-exhausted');
  assert.ok(verifyFourPulseLeafMinimum(req,exhausted));
});

test('the public CLI exports an independently checkable four-leaf lower bound and a measured compact route',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worldlaw-compact-'));
  try{
    const source='examples/active-position-drift-two-feedback-groups.json',cert=join(dir,'proof.json');
    const command=(...args)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',source,...args],{encoding:'utf8',maxBuffer:2000000});
    const build=command('--four-pulse-leaves','--output',cert);assert.equal(build.status,0,build.stderr);
    const replay=command('--four-pulse-leaves','--replay',cert);assert.equal(replay.status,0,replay.stderr);
    const independent=spawnSync('python3',['scripts/verify-four-pulse-leaf-minimum.py',source,cert],{encoding:'utf8'});
    assert.equal(independent.status,0,independent.stderr);assert.equal(JSON.parse(independent.stdout).asymmetricMenus,802816);
    const compact=join(dir,'compact.json'),obs=join(dir,'positions.json');writeFileSync(obs,'[17,20,24,27,31]');
    assert.equal(command('--four-pulse-compact','--output',compact).status,0);
    const receive=command('--four-pulse-compact','--replay',compact,'--readings',obs);assert.equal(receive.status,0,receive.stderr);
    assert.deepEqual(JSON.parse(receive.stdout).surviving.map(w=>w.law),['A']);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
