import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {certifyReferenceCalibration as plan, verifyReferenceCalibration as verify,
  receiveReferenceCalibration as receive} from '../src/science/position-drift-reference-calibration.mjs';
import {certifyPhysicalFeedbackTree} from '../src/science/position-drift-physical-feedback.mjs';
const stem='examples/active-position-drift-all-dwell-calibration';
const load=file=>JSON.parse(readFileSync(file,'utf8'));
const base=()=>load(stem+'.json');
const explicit=(m,k)=>({schema:base().schema,catalog:base().catalog,references:String(m),dwell:String(k)});

test('both reference regimes match independently expanded physical trees',()=>{
  for(const [m,k,r] of [[1,1,'1/32'],[1,2,'1/28'],[3,2,'1/12'],[2,3,'3/44'],[4,2,'1/10']]){
    const s=explicit(m,k),p=plan(s);assert.equal(p.radius,r);
    const physical={schema:'worldlaw.position-drift-physical-feedback-tree/v1',catalog:s.catalog,horizon:m+4*k,
      program:{commands:[...Array(m).fill('ref'),...Array(k).fill('group')],
        alternatives:[['y0','x0','z0'],['z1','x1','y1']].map(t=>({commands:t.flatMap(c=>Array(k).fill(c))}))}};
    assert.equal(certifyPhysicalFeedbackTree(physical).tree.radius,r);
    s.catalog.noiseBound=r;
    assert.equal(plan(s).leastReferencesAtNoise,String(m+1));assert.equal(plan(s).atRequestedNoise,'closed-collision');
  }
  for(const [noise,n] of [['0','1'],['1/10','5'],['1/5',null]]){
    const s=explicit(3,2);s.catalog.noiseBound=noise;assert.equal(plan(s).leastReferencesAtNoise,n);
  }
});

test('all budget optima through the analytic reduction agree with exhaustive integer comparisons',()=>{
  const exceptional=[];
  for(let h=5;h<=51;h++){
    const s=base();s.pulseBudget=String(h);const p=plan(s),opts=[];
    let n=0,d=1;
    for(let k=1;4*k<h;k++){
      const m=h-4*k,num=m*k,den=m>=2*k?10*(m+2*k):8*(m+3*k);
      if(num*d>n*den){opts.length=0;n=num;d=den;}
      if(num*d===n*den)opts.push(k);
    }
    assert.deepEqual(p.selector.optimalDwells,opts.map(String));
    assert.ok(p.selector.checkedDwells.length<=(h>=50?2:3));
    if(opts.some(k=>h-4*k<2*k))exceptional.push(h);
  }
  assert.deepEqual(exceptional,[5,11]);
  const old=load('examples/active-position-drift-dwell-calibration.json');
  old.pulseBudget='11';assert.equal(plan(old).radius,'7/90');
  assert.throws(()=>plan({...base(),pulseBudget:'4'}),/at least five/);
  assert.throws(()=>plan(explicit(0,2)),/positive integer/);
});

test('causal replay, cutoff tie, persistence and changed budget survive export',()=>{
  const s=base(),p=load(stem+'-proof.json');assert.equal(verify(s,p),true);
  assert.equal(receive(s,p,['0','0','67/75']).nextRun.command,'z1');
  for(const [ys,l] of [[['0','0','0','2','2','2'],'A'],[['0','0','2','0','2','2'],'B']]){
    assert.deepEqual(receive(s,p,ys).surviving.map(w=>w.law),[l]);
  }
  const dir=mkdtempSync(join(tmpdir(),'all-dwell-'));
  try{
    const source=join(dir,'source.json'),proof=join(dir,'proof.json');
    for(const h of [5n,11n,24n,10n**500n+7n]){
      const req={...s,pulseBudget:String(h)};writeFileSync(source,JSON.stringify(req));rmSync(proof,{force:true});
      const cli=spawnSync(process.execPath,['scripts/active-linear-family.mjs','--reference-calibration','--input',source,'--output',proof],{encoding:'utf8'});
      assert.equal(cli.status,0,cli.stderr);
      const cp=load(proof),m=BigInt(cp.references),k=BigInt(cp.dwell);
      const times=h<25n?Array.from({length:Number(h+1n)},(_,i)=>BigInt(i)):[m/2n,m+k/2n,m+3n*k/2n,m+5n*k/2n,m+7n*k/2n,h];
      for(const t of times){
        const result=spawnSync('python3',['scripts/verify-reference-calibration.py',source,proof,'--pulse-tick',String(t)],{encoding:'utf8'});
        assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).sample.length,4);
      }
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
