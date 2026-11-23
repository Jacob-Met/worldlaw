import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {certifyReferenceCalibration as plan, verifyReferenceCalibration as verify,
  receiveReferenceCalibration as receive} from '../src/science/position-drift-reference-calibration.mjs';
import {certifyPhysicalFeedbackTree} from '../src/science/position-drift-physical-feedback.mjs';

const stem='examples/active-position-drift-dwell-calibration';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const request=h=>({...read(stem+'.json'),pulseBudget:String(h)});

test('small expanded physical trees recover the closed 12- and 13-pulse thresholds',()=>{
  for(const [h,m,radius] of [[12,4,'1/10'],[13,5,'1/9']]){
    const s=request(h),p=plan(s);
    assert.equal(p.dwell,'2');assert.equal(p.references,String(m));assert.equal(p.radius,radius);
    const expanded={schema:'worldlaw.position-drift-physical-feedback-tree/v1',catalog:s.catalog,horizon:h,
      program:{commands:[...Array(m).fill('ref'),'group','group'],
        alternatives:[['y0','x0','z0'],['z1','x1','y1']].map(t=>({commands:t.flatMap(c=>[c,c])}))}};
    assert.equal(certifyPhysicalFeedbackTree(expanded).tree.radius,p.radius);
    assert.equal(p.atRequestedNoise,h===12?'closed-collision':'policy-separates');
    const explicit={schema:s.schema,catalog:s.catalog,references:String(m),dwell:'2'};
    assert.deepEqual(plan(explicit).boundary,p.boundary);
    explicit.catalog.noiseBound=p.radius;
    assert.equal(plan(explicit).leastReferencesAtNoise,String(m+1));
    assert.throws(()=>receive(explicit,plan(explicit),['0']),/no guaranteed separation/);
    explicit.catalog.noiseBound='1/5';assert.equal(plan(explicit).leastReferencesAtNoise,null);
  }
  const old='examples/active-position-drift-reference-calibration';
  assert.equal(JSON.stringify(plan(read(old+'.json')),null,2)+'\n',readFileSync(old+'-proof.json','utf8'));
});

test('budget selection preserves ties and validates frozen certificates',()=>{
  for(const [h,ks,r] of [[6,['1'],'1/20'],[24,['3','4'],'1/5'],[31,['5'],'11/42']]){
    const s=request(h),p=plan(s);assert.deepEqual(p.selector.optimalDwells,ks);assert.equal(p.radius,r);
    assert.equal(p.dwell,ks[0]);assert.ok(p.selector.checkedDwells.length<=2);
    assert.equal(verify(s,p),true);
    p.selector.optimalDwells=[];assert.throws(()=>verify(s,p),/differ/);
  }
  assert.throws(()=>plan(request(5)),/at least six/);
  const s=request(13);delete s.pulseBudget;
  assert.throws(()=>plan({...s,references:'3',dwell:'2'}),/twice/);
});

test('the online rule selects its suffix from the three shared measurements',()=>{
  const s=request(13),p=read(stem+'-proof.json');assert.equal(verify(s,p),true);
  assert.deepEqual(receive(s,p,['0']).nextRun,{command:'ref',repeats:'5'});
  assert.deepEqual(receive(s,p,['0','0']).nextRun,{command:'group',repeats:'2'});
  const tie=receive(s,p,['0','0','47/50']);
  assert.equal(tie.score,'47/10');assert.equal(tie.cutoff,'47/10');assert.equal(tie.nextRun.command,'z1');
  for(const [ys,tail,law] of [[['0','0','0','2','2','2'],'y0','A'],[['0','0','2','0','2','2'],'z1','B']]){
    assert.deepEqual(receive(s,p,ys.slice(0,3)).nextRun,{command:tail,repeats:'2'});
    assert.deepEqual(receive(s,p,ys).surviving.map(w=>w.law),[law]);
  }
});

test('portable independent checker covers whole constant-command runs without expanding the tape',()=>{
  const dir=mkdtempSync(join(tmpdir(),'equal-dwell-'));
  try{
    const source=join(dir,'s.json'),proof=join(dir,'p.json'),obs=join(dir,'o.json');
    for(const h of [12n,13n,24n,10n**500n+7n]){
      const s=request(h);writeFileSync(source,JSON.stringify(s));
      rmSync(proof,{force:true});
      const cli=(...args)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--reference-calibration','--input',source,...args],{encoding:'utf8'});
      const result=cli('--output',proof);assert.equal(result.status,0,result.stderr);
      const p=read(proof),m=BigInt(p.references),k=BigInt(p.dwell);
      assert.equal(p.readAt.length,6);assert.ok(p.selector.checkedDwells.length<=2);
      const ticks=h<25n?Array.from({length:Number(h+1n)},(_,i)=>BigInt(i)):[m/2n,m+k/2n,m+3n*k/2n,m+5n*k/2n,m+7n*k/2n,h];
      for(const t of ticks){
        const c=spawnSync('python3',['scripts/verify-reference-calibration.py',source,proof,'--pulse-tick',String(t)],{encoding:'utf8'});
        assert.equal(c.status,0,c.stderr);const out=JSON.parse(c.stdout);
        assert.equal(out.coveredPulseTicks,String(h+1n));assert.equal(out.sample.length,4);
      }
      if(h===13n){
        writeFileSync(obs,JSON.stringify(['0','0','47/50']));
        const measured=cli('--replay',proof,'--readings',obs);assert.equal(measured.status,0,measured.stderr);
        assert.equal(JSON.parse(measured.stdout).nextRun.command,'z1');
      }
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
