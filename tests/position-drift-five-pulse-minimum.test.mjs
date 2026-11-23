import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {certifyFivePulseMinimum,verifyFivePulseMinimum,receiveFivePulseMinimum} from '../src/science/position-drift-five-pulse-minimum.mjs';
const {Q,add,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const file='examples/active-position-drift-five-pulse-minimum.json',source=()=>JSON.parse(readFileSync(file,'utf8'));
let cached;
const certificate=()=>cached??=certifyFivePulseMinimum(source());
function pair(error='1/4'){
  const r=source();r.catalog.commands=['a','b'];r.catalog.laws[0].vertices=[[0,0]];r.catalog.laws[1].vertices=[[0,1]];
  r.catalog.noiseBound=error;r.program={commands:['a','a','b','b','b']};return r;
}
test('unrestricted four-pulse optimum meets the lower end of a certified minimum-five interval',()=>{
  const c=certificate();assert.equal(c.status,'horizons-certified');assert.equal(c.four.radius,'1/40');
  assert.equal(c.four.courses.length,64);assert.deepEqual(c.four.bestPrefix,['ref','group']);
  assert.equal(c.four.courses.filter(t=>t.radius==='1/40').length,1);assert.equal(c.four.courses.filter(t=>t.radius==='0').length,56);
  assert.equal(c.four.courses.find(t=>t.prefix.join(',')==='group,ref').radius,'1/42');
  assert.equal(c.four.courses.reduce((n,t)=>n+t.boundary.worlds.length,0),4096);
  assert.equal(c.five.radius,'1/29');assert.equal(c.five.worlds.length,4);assert.equal(c.five.lower.length,31);
  assert.equal(c.minimumPulses,'5');assert.equal(c.atRequestedNoise,'minimum-five');assert.ok(verifyFivePulseMinimum(source(),c));
});
test('changed source rows, missing universal cases, altered primal states and separate dual errors are rejected',()=>{
  const c=certificate();
  for(const change of [t=>{t.four.courses.pop();},t=>{t.four.courses[1].boundary.observations[1]='999';},
    t=>{t.four.bestPrefix=['group','ref'];},t=>{t.five.lower[0][1]='99';},t=>{t.five.observations[0]='100';},
    t=>{t.five.worlds[0][0].weights[0]='5';},t=>{t.minimumPulses=null;}]){
    const bad=structuredClone(c);change(bad);assert.throws(()=>verifyFivePulseMinimum(source(),bad));
  }
  const input=source();input.program.commands=['ref','group','ref'];assert.throws(()=>verifyFivePulseMinimum(input,c),/source differs/);
});
test('the fifth pulse is chosen only after real branch readings; original mixtures and their drift persist',()=>{
  const src=source(),c=certificate(),eps=q(src.catalog.noiseBound),huge=q('1000000000000000000000000001/7'),drift=q('-13/17');
  for(const law of src.catalog.laws)for(const [i,vertex] of law.vertices.entries()){
    const g=i<2?'0':'1',word=['ref','ref','group','x'+g,(i%2?'z':'y')+g],ys=[];
    let x=huge;
    for(let t=0;t<=5;t++){
      ys.push(fmt(add(x,mul(eps,Q((i+t)%2?1n:-1n)))));
      if(t<5)x=add(x,add(drift,q(vertex[src.catalog.commands.indexOf(word[t])])));
    }
    const result=receiveFivePulseMinimum(src,c,ys);assert.equal(result.status,'received');
    assert.deepEqual(result.commands,word);assert.deepEqual(result.surviving.map(v=>v.law),[law.id]);
  }
  for(const [ys,command] of [[[0,0,0,0],'x0'],[[0,0,0,1],'x1'],[[0,0,0,1,1],'y1'],[[0,0,0,1,2],'z1']]){
    assert.equal(receiveFivePulseMinimum(src,c,ys).nextCommand,command);
  }
});
test('closed thresholds, tiny rational gaps, input restrictions and bounded execution have separate outcomes',()=>{
  for(const [error,decision,minimum] of [['1/5','within-four',null],['1/4','minimum-five','5'],['3/10','four-refuted-exhibited-five-refuted',null]]){
    const r=pair(error),c=certifyFivePulseMinimum(r);assert.equal(c.four.radius,'1/4');assert.equal(c.five.radius,'3/10');
    assert.equal(c.atRequestedNoise,decision);assert.equal(c.minimumPulses,minimum);assert.ok(verifyFivePulseMinimum(r,c));
    if(error==='3/10')assert.throws(()=>receiveFivePulseMinimum(r,c,[0]),/no guaranteed separation/);
  }
  const tiny=pair(),den=10n**75n+11n;tiny.catalog.laws[1].vertices=[[0,'1/'+den]];tiny.catalog.noiseBound='1/'+(4n*den);
  const t=certifyFivePulseMinimum(tiny);assert.equal(t.minimumPulses,'5');assert.equal(t.five.radius,fmt(Q(3n,10n*den)));
  const limited=pair();limited.catalog.limits.receiverWork=0;const certified=certifyFivePulseMinimum(limited);
  assert.equal(receiveFivePulseMinimum(limited,certified,[0]).status,'receiver-budget-exhausted');
  limited.catalog.limits.designWork=0;const stopped=certifyFivePulseMinimum(limited);assert.equal(stopped.status,'design-budget-exhausted');
  assert.ok(verifyFivePulseMinimum(limited,stopped));
  const bad=source();bad.program.alternatives[1].commands=['x0'];assert.throws(()=>certifyFivePulseMinimum(bad),/distinct/);
});
test('public CLI reopens the grouped course and an independent Python receiver checks all 4,096 leaf pairs',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worldlaw-five-'));
  try{
    const out=join(dir,'saved.json'),obs=join(dir,'positions.json'),sm=join(dir,'pair.json');
    writeFileSync(out,JSON.stringify(certificate()));writeFileSync(obs,'[17,20,23,27,30,34]');writeFileSync(sm,JSON.stringify(pair()));
    const independent=spawnSync('python3',['scripts/verify-five-pulse-minimum.py',file,out],{encoding:'utf8'});
    assert.equal(independent.status,0,independent.stderr);
    assert.deepEqual(JSON.parse(independent.stdout),{unrestrictedFourRadius:'1/40',bestFourPrefix:['ref','group'],fourPrefixes:64,
      fourLeafPairs:4096,exhibitedFiveRadius:'1/29',fiveLeaves:4,minimumPulses:'5'});
    const run=(input,...flags)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',input,'--five-pulse-minimum',...flags],{encoding:'utf8'});
    const measured=run(file,'--replay',out,'--readings',obs);assert.equal(measured.status,0,measured.stderr);
    assert.deepEqual(JSON.parse(measured.stdout).surviving.map(v=>v.law),['A']);
    const generated=run(sm);assert.equal(generated.status,0,generated.stderr);assert.equal(JSON.parse(generated.stdout).minimumPulses,'5');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
