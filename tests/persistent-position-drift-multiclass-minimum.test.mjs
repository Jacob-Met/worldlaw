import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {certifyMulticlassPositionDriftMinimum as design,certifyPositionDriftTape as certify,
  replayMulticlassPositionDriftMinimum as replay} from '../src/science/persistent-position-drift-multiclass-minimum.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
const {Q,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q=x=>{const [n,d='1']=String(x).split('/');return Q(BigInt(n),BigInt(d));};
const src=(rows,noiseBound=1)=>({schema:'worldlaw.position-drift-rate-catalog/v1',noiseBound,
  commands:rows[0].map((_,i)=>'u'+i),laws:rows.map((rates,i)=>({id:'L'+i,rates}))});
const historical=[[8,[[-2,-2,5],[1,-2,6],[-1,-4,0],[6,7,-3]]],[12,[[-1,6,4],[-4,2,8],[-8,2,-2]]],[26,[[5,2],[-6,3],[-1,-2]]],[30,[[-1,1,8],[3,2,1],[8,6,-3],[8,4,3]]],[34,[[-3,-5],[-5,-5],[3,2],[4,5]]]];
const limits={enumerateThrough:7,wordBudget:2000};
const expected=[[6,7,7],[6,7,7],[9,9,9],[6,6,6],[17,17,17]];

test('historical fixed optima and adaptive intervals, recorded separately',()=>{
  for(const [[id,rows],exp] of historical.map((h,i)=>[h,expected[i]])){
    const source=src(rows),report=design(source,limits);
    assert.deepEqual([report.adaptiveLower,report.adaptiveUpper,report.fixedLower],exp.map(String),String(id));
    assert.equal(report.fixedUpper,report.adaptiveUpper);
    assert.equal(report.status,exp[0]===exp[1]?'adaptive-minimum-certified':'adaptive-minimum-bounded');
    assert.deepEqual(certify(source,report.tape.runs),report.tape);
    assert.equal(report.tape.pairs.length,rows.length*(rows.length-1)/2);
    assert.deepEqual(replay(source,report,limits),report);
    if(exp[0]!==exp[1]){
      assert.deepEqual(report.enumerations[0],{pulses:'6',wordsTested:729,allWordsRejected:true});
      assert.equal(report.enumerations[1].allWordsRejected,false);
    }else assert.equal(report.enumerations.length,0);
  }
});

// Evaluate the supplied physical starts at every tick, including ticks hidden
// inside a compressed run. Interpolate only the adversary's published readings.
function checkCollision(source,record){
  assert.equal(record.status,'fixed-tape-collision');
  const {laws,starts,readings,ticks}=record.collision;
  const eps=q(source.noiseBound);
  for(let k=0;k<2;k++){
    const law=source.laws.find(l=>l.id===laws[k]);
    let [p,v]=starts[k].map(q);
    function check(y){
      const e=sub(y,p);
      assert.ok(e.n*eps.d<=eps.n*e.d && -e.n*eps.d<=eps.n*e.d);
    }
    check(q(readings[0]));
    record.runs.forEach(({command,repeats},i)=>{
      const n=BigInt(repeats),r=q(law.rates[source.commands.indexOf(command)]);
      assert.equal(BigInt(ticks[i+1])-BigInt(ticks[i]),n);
      for(let j=1n;j<=n;j++){
        p=add(p,add(v,r));
        check(add(q(readings[i]),mul(Q(j,n),sub(q(readings[i+1]),q(readings[i])))));
      }
    });
  }
}

test('every one of the 1,458 rejected six-pulse words has a direct physical replay',()=>{
  let count=0;
  for(const [,rows] of historical.slice(0,2)){
    const source=src(rows);
    for(let ordinal=0;ordinal<729;ordinal++){
      const tape=[];let n=ordinal;
      for(let t=0;t<6;t++){
        const cmd=source.commands[n%3];n=Math.floor(n/3);
        if(tape.at(-1)?.command===cmd)tape.at(-1).repeats++;
        else tape.push({command:cmd,repeats:1});
      }
      checkCollision(source,certify(source,tape));count++;
    }
  }
  assert.equal(count,1458);
});

test('budget exhaustion, exact equality, forged records, and a permanent alias',()=>{
  const s=src(historical[0][1]);
  const partial=design(s,{enumerateThrough:7,wordBudget:728});
  assert.equal(partial.fixedLower,'6');assert.equal(partial.enumerations[0].allWordsRejected,false);
  const full=design(s,{enumerateThrough:7,wordBudget:729});
  assert.equal(full.fixedLower,'7');assert.equal(full.adaptiveLower,'6');
  assert.throws(()=>replay(s,full),/limits/);
  assert.throws(()=>replay(s,{...full,adaptiveLower:'7'},full.limits),/differ/);
  const pair=src([[2,7],[1,2]]);
  checkCollision(pair,certify(pair,[{command:'u0',repeats:2},{command:'u1',repeats:2}]));
  const separated=certify(pair,[{command:'u0',repeats:2},{command:'u1',repeats:3}]);
  assert.equal(separated.status,'separating-fixed-tape');
  assert.equal(design(src([[0,3],[1,4],[0,1]])).status,'indistinguishable');
});

test('symbolic tiny gaps, unchanged physical words under relabeling, and public CLI',()=>{
  const d=10n**601n+1n,source=src([['0','0'],['0','1/'+d],['0','2/'+d]]);
  const p=design(source);assert.equal(p.adaptiveUpper,String(16n*d+1n));assert.equal(p.adaptiveLower,p.adaptiveUpper);
  assert.equal(p.tape.runs.length,2);
  const s=src(historical[2][1]),reverse={...s,laws:[...s.laws].reverse()};
  assert.equal(design(reverse).adaptiveUpper,design(s).adaptiveUpper);
  const dir=mkdtempSync(join(tmpdir(),'worldlaw-multiclass-'));
  try{
    const file=join(dir,'catalog.json');writeFileSync(file,JSON.stringify(s));
    const txt=execFileSync(process.execPath,['scripts/active-linear-family.mjs','--input',file,'--multiclass-minimum',
      '--enumerate-through','7','--word-budget','2000'],{encoding:'utf8'});
    assert.deepEqual(JSON.parse(txt),design(s,limits));
  }finally{rmSync(dir,{recursive:true,force:true});}
});