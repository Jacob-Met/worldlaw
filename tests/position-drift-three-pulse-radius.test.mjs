import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {planThreePulseHulls} from '../src/science/position-drift-three-pulse-hulls.mjs';
import {certifyThreePulseNoiseRadius,verifyThreePulseNoiseRadius} from '../src/science/position-drift-three-pulse-radius.mjs';

const {sub,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const source=name=>JSON.parse(readFileSync(new URL('../examples/'+name,import.meta.url),'utf8'));
const line=()=>source('active-position-drift-adaptive-hulls.json');
const triangle=()=>source('active-position-drift-triangle-radius.json');
const gap=q('1/10000000000000000000000000000000000000007');

test('both parametric certificates meet at physical closed boundaries for every prefix',()=>{
  const known=['0','1/20','0','0','1/24','0','1/32','1/32','0','1/30','0','1/38','0','1/30','1/38','0'];
  for(const [req,radius,s,decision] of [[line(),'1/20','1/2','separates-within-three'],[triangle(),'1/26','5/13','common-history-refutation']]){
    const cert=certifyThreePulseNoiseRadius(req);assert.equal(cert.status,'radius-certified');
    assert.equal(cert.radius,radius);assert.equal(cert.atRequestedNoise,decision);assert.deepEqual(cert.bestPrefix,['ref','x']);
    assert.equal(verifyThreePulseNoiseRadius(req,cert),true);
    if(radius==='1/20')assert.deepEqual(cert.trials.map(t=>t.radius),known);
    assert.deepEqual(cert.trials[1].boundary.prefixReadings,['0','0',s]);
    for(const trial of cert.trials){assert.equal(trial.boundary.branches.length,4);assert.ok(trial.lower.length<=4);}
    for(const [epsilon,expected] of [[radius,'three-refuted'],[fmt(sub(q(radius),gap)),'three-certified']]){
      req.catalog.noiseBound=epsilon;const incumbent=planThreePulseHulls(req);assert.equal(incumbent.status,expected);
      assert.equal(incumbent.fixedMinimum,'4');
    }
  }
});

test('the product of the two noise marginals would falsely reject the published feedback policy',()=>{
  const req=line(),plan=planThreePulseHulls(req);
  assert.deepEqual(plan.unsafe.slice(2),[['7/12','7/6'],['-1/6','5/12']]);
  // At s=1/2 these A and B clean points could share the indicated (s,w)
  // under independent +/-4epsilon and +/-6epsilon errors. All numbers have
  // denominator 12. For ref and x the clean trajectories already agree.
  const sp=6;for(const [wp,A,B] of [[9,[6,12],[8,8]],[3,[6,6],[6,0]]]){
    for(const [s,w] of [A,B]){assert.ok(Math.abs(sp-s)<=2);assert.ok(Math.abs(wp-w)<=3);}
  }
  assert.equal(plan.trials.filter(t=>!t.trap).length,1);assert.deepEqual(plan.prefix,['ref','x']);
  assert.equal(certifyThreePulseNoiseRadius(req).radius,'1/20');
});

test('an independent point-noise planner agrees at and immediately below each changed-catalog threshold',()=>{
  let seed=52334;const draw=m=>(seed=seed*48271%2147483647)%m;
  let positive=0,zero=0;
  for(let i=0;i<8;i++){
    const req=line();req.fourPulseControl=null;req.catalog.commands=['u','v','w'];
    req.catalog.laws.forEach(l=>{l.vertices=Array.from({length:1+draw(3)},()=>req.catalog.commands.map(()=>draw(9)-4));});
    const cert=certifyThreePulseNoiseRadius(req);assert.ok(verifyThreePulseNoiseRadius(req,cert));
    for(const [j,trial] of cert.trials.entries()){
      const threshold=q(trial.radius);req.catalog.noiseBound=trial.radius;
      assert.ok(planThreePulseHulls(req).trials[j].trap);
      if(threshold.n){positive++;req.catalog.noiseBound=fmt(sub(threshold,gap));assert.equal(planThreePulseHulls(req).trials[j].trap,null);}
      else zero++;
    }
  }
  assert.ok(positive>0&&zero>0);
});

test('zero aliases, tiny point gaps, refusal budgets and forged witnesses retain their exact meaning',()=>{
  const req=line();req.fourPulseControl=null;req.catalog.commands=['a','b'];
  req.catalog.laws[0].vertices=[[0,0]];req.catalog.laws[1].vertices=[[3,3],[9,9]];
  const zero=certifyThreePulseNoiseRadius(req);assert.equal(zero.radius,'0');assert.ok(verifyThreePulseNoiseRadius(req,zero));
  const denom=10n**120n+7n;req.catalog.laws[1].vertices=[[0,'1/'+denom]];
  const tiny=certifyThreePulseNoiseRadius(req);assert.equal(tiny.radius,'1/'+6n*denom);assert.ok(verifyThreePulseNoiseRadius(req,tiny));
  req.catalog.limits.designWork=0;const cutoff=certifyThreePulseNoiseRadius(req);assert.equal(cutoff.status,'design-budget-exhausted');
  assert.equal(cutoff.radius,undefined);assert.ok(verifyThreePulseNoiseRadius(req,cutoff));
  const c=triangle(),cert=certifyThreePulseNoiseRadius(c);
  for(const corrupt of [
    t=>{t.trials[1].lower[0].weight='4';},t=>{t.trials[1].lower[0].command='z';},
    t=>{t.trials[1].boundary.prefixReadings[2]='0';},t=>{t.trials[1].boundary.branches[2].worlds[0].weights[0]='2';},
    t=>{t.trials[1].boundary.branches[2].worlds[1].positions[3]='100';},t=>{t.trials.pop();},t=>{t.radius='1/25';}
  ]){const bad=structuredClone(cert);corrupt(bad);assert.throws(()=>verifyThreePulseNoiseRadius(c,bad));}
  c.catalog.laws[1].vertices[0][1]='1/99';assert.throws(()=>verifyThreePulseNoiseRadius(c,cert),/source differs/);
});

test('existing CLI exports and independently checks the exact certificate against its supplied source',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worldlaw-radius-'));
  try{
    const src=join(dir,'catalog.json'),saved=join(dir,'radius.json'),req=triangle();writeFileSync(src,JSON.stringify(req));
    const run=(...flags)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',src,'--three-pulse-radius',...flags],{encoding:'utf8'});
    assert.equal(run('--output',saved).status,0);const replay=run('--replay',saved);assert.equal(replay.status,0,replay.stderr);
    assert.equal(JSON.parse(replay.stdout).radius,'1/26');
    const forged=JSON.parse(readFileSync(saved));forged.trials[1].boundary.branches[1].reading='999';
    writeFileSync(saved,JSON.stringify(forged));assert.notEqual(run('--replay',saved).status,0);
    req.catalog.limits.designWork=0;writeFileSync(src,JSON.stringify(req));assert.equal(run().status,2);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
