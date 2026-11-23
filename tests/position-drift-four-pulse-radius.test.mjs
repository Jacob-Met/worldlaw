import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {certifyFourPulseNoiseRadius,verifyFourPulseNoiseRadius} from '../src/science/position-drift-four-pulse-radius.mjs';
import {certifyFourPulseFeedback,verifyFourPulseFeedback,receiveFourPulseFeedback} from '../src/science/position-drift-four-pulse-feedback-witness.mjs';
const {Q,add,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const fixture=name=>JSON.parse(readFileSync(new URL('../examples/'+name,import.meta.url),'utf8'));
const grouped=()=>fixture('active-position-drift-two-feedback-groups.json');
const tetra=()=>fixture('active-position-drift-four-pulse-tetrahedra.json');

test('exact four-pulse classes separate fixed, late and early decisions on changed tetrahedra',()=>{
  const req=tetra(),c=certifyFourPulseNoiseRadius(req);
  assert.deepEqual(c.classes.map(x=>[x.mode,x.radius,x.courses.length]),[
    ['fixed','1/68',256],['late','10/659',64],['early','1/65',16],['full','1/65',16]]);
  assert.deepEqual(c.classes.map(x=>x.atRequestedNoise),['common-history-refutation','common-history-refutation','separates-within-four','separates-within-four']);
  assert.ok(verifyFourPulseNoiseRadius(req,c));
  const chosen=c.classes[3].courses.find(t=>t.prefix.join(',')==='z,y');
  assert.ok(chosen.lower.length>1);assert.equal(chosen.observations.length,21);
  const early=c.classes[2].courses[0];assert.equal(early.observations.length,33);
  for(const change of [
    x=>{x.classes[3].courses[0].observations[1]='999';},
    x=>{x.classes[3].courses.find(t=>t.radius==='1/65').lower[0].weight='99';},
    x=>{x.classes[1].courses.pop();},x=>{x.classes[2].radius='1/68';}
  ]){const forged=structuredClone(c);change(forged);assert.throws(()=>verifyFourPulseNoiseRadius(req,forged));}
});

test('the line and triangle controls improve at four pulses and retain distinct adaptive scopes',()=>{
  for(const [name,radii] of [
    ['active-position-drift-adaptive-hulls.json',['1/16','1/14','1/16','1/14']],
    ['active-position-drift-triangle-radius.json',['1/22','1/18','1/21','1/18']]
  ]){
    const req=fixture(name);req.catalog.limits.designWork=12000000;
    const c=certifyFourPulseNoiseRadius(req);assert.deepEqual(c.classes.map(x=>x.radius),radii);
    assert.ok(verifyFourPulseNoiseRadius(req,c));
  }
});

test('two actual decisions separate the grouped families where every fixed single cut has a clean collision',()=>{
  const req=grouped(),c=certifyFourPulseFeedback(req);assert.equal(c.status,'one-cut-refuted');assert.equal(c.menuProof.radius,'1/40');
  assert.equal(c.menuProof.worlds.length,4);assert.deepEqual(c.menuProof.observations,['9/20','7/10','4/5','3/5','7/10','4/5','3/5']);
  assert.equal(c.early.length,64);assert.equal(c.late.length,512);
  assert.equal([...c.early,...c.late].reduce((n,r)=>n+r.worlds.length,0),8192);assert.ok(verifyFourPulseFeedback(req,c));
  for(const alter of [
    x=>{x.menuProof.observations[1]='3/100';},x=>{x.menuProof.lower[0].leaf=1;},
    x=>{x.early[0].worlds[0][0]=10000;},x=>{x.late[15].observations[1]='-300';},x=>{x.early.pop();}
  ]){const forged=structuredClone(c);alter(forged);assert.throws(()=>verifyFourPulseFeedback(req,forged));}
  req.denominator=1;const limited=certifyFourPulseFeedback(req);assert.equal(limited.status,'grid-inconclusive');
  assert.equal(limited.missing.filter(t=>t.mode==='late').length,18);assert.equal(limited.missing.filter(t=>t.mode==='early').length,2);
  assert.ok(verifyFourPulseFeedback(req,limited));
});

test('observations at both branch points guide all four leaves under translated physical trajectories',()=>{
  const req=grouped(),p=certifyFourPulseFeedback(req),s=req.experiment.catalog;
  for(const law of s.laws)for(const [i,vertex] of law.vertices.entries()){
    const offset=q('1000000000000000000000000000001/7'),drift=q('-15/19'),noise=q(s.noiseBound);
    let pos=offset;const samples=[],commands=[];
    for(let t=0;t<=4;t++){
      samples.push(fmt(add(pos,mul(noise,Q((i+t)%2?1n:-1n)))));
      const out=receiveFourPulseFeedback(req,p,samples);
      if(t===4){assert.deepEqual(out.surviving.map(w=>w.law),[law.id]);assert.equal(out.nextCommand,null);break;}
      const next=out.nextCommand;commands.push(next);pos=add(pos,add(drift,q(vertex[s.commands.indexOf(next)])));
    }
    const group=i<2?'0':'1',which=i%2?'z':'y';assert.deepEqual(commands,['ref','group','x'+group,which+group]);
  }
  req.experiment.catalog.noiseBound='1/40';const closed=certifyFourPulseFeedback(req);
  assert.throws(()=>receiveFourPulseFeedback(req,closed,[0]),/no guarantee/);
  req.experiment.catalog.limits.designWork=0;assert.equal(certifyFourPulseFeedback(req).status,'design-budget-exhausted');
});

test('point limits, aliases, tiny rational scales and explicit computational cutoffs',()=>{
  const req=tetra();req.fourPulseControl=null;req.catalog.commands=['a','b'];req.catalog.laws[0].vertices=[[0,0]];
  const den=10n**80n+1n;req.catalog.laws[1].vertices=[[0,'1/'+den]];
  const c=certifyFourPulseNoiseRadius(req);assert.deepEqual(c.classes.map(x=>x.radius),Array(4).fill('1/'+(4n*den)));
  assert.ok(verifyFourPulseNoiseRadius(req,c));
  req.catalog.laws[1].vertices=[[3,3],[4,4]];const zero=certifyFourPulseNoiseRadius(req);assert.ok(zero.classes.every(x=>x.radius==='0'));
  req.catalog.limits.designWork=0;const bound=certifyFourPulseNoiseRadius(req);
  assert.equal(bound.status,'design-budget-exhausted');assert.equal(bound.classes,undefined);assert.ok(verifyFourPulseNoiseRadius(req,bound));
});

test('public CLI exports source-bound menu evidence and reopens it against real selected readings',()=>{
  const dir=mkdtempSync(join(tmpdir(),'fourpulse-')),source='examples/active-position-drift-two-feedback-groups.json';
  try{
    const cert=join(dir,'certificate.json'),readings=join(dir,'positions.json');
    const run=(...flags)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',source,'--four-pulse-feedback',...flags],
      {encoding:'utf8',maxBuffer:2000000});
    const generated=run('--output',cert);assert.equal(generated.status,0,generated.stderr);writeFileSync(readings,'[17,20,24,27,31]');
    const measured=run('--replay',cert,'--readings',readings);assert.equal(measured.status,0,measured.stderr);
    const result=JSON.parse(measured.stdout);assert.deepEqual(result.commands,['ref','group','x1','y1']);
    assert.deepEqual(result.surviving.map(w=>w.law),['A']);
    const forged=JSON.parse(readFileSync(cert));forged.late[0].observations[1]='22';writeFileSync(cert,JSON.stringify(forged));
    assert.notEqual(run('--replay',cert).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
