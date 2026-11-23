import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planBinaryPositionDriftMinimum as plan,openBinaryPositionDriftMinimum as open} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';

const {Q,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q=x=>{const [n,d='1']=String(x).split('/');return Q(BigInt(n),BigInt(d));};
const cmp=(a,b)=>Math.sign(Number(a.n*b.d-b.n*a.d));
const catalog=(noise='1',a=[2,7],b=[1,2])=>({schema:'worldlaw.position-drift-rate-catalog/v1',
  commands:a.map((_,i)=>'u'+i),laws:[{id:'A',rates:a},{id:'B',rates:b}],noiseBound:noise});
function checkPhysical(source,record){
  const errors=[];
  for(const [k,start] of record.starts.entries()){
    let [position,v]=start.map(q);
    for(let t=0;t<record.ticks.length;t++){
      if(t){
        const {command,repeats}=record.runs[t-1];
        const rate=q(source.laws[k].rates[source.commands.indexOf(command)]);
        position=add(position,mul(q(repeats),add(v,rate)));
      }
      const error=sub(position,q(record.readings[t]));
      const magnitude=Q(error.n<0n?-error.n:error.n,error.d);
      assert.ok(cmp(magnitude,q(source.noiseBound))<=0);
      errors.push(magnitude);
    }
  }
  assert.equal(fmt(errors.sort(cmp).at(-1)),record.maximumError);
}

test('odd and even exact minima, strict touching boundaries, and zero noise',()=>{
  for(const [noise,n,prev,current] of [['1','5','2','12/5'],['6/5','6','12/5','3'],['0','2','0','1']]){
    const s=catalog(noise),p=plan(s),session=open(s,p);
    assert.deepEqual([p.minimumPulses,p.previousDistance,p.optimalDistance],[n,prev,current]);
    const a=BigInt(n)/2n,b=BigInt(n)-a;
    assert.deepEqual(p.readAt,['0',String(a),n]);
    assert.deepEqual(session.observe(['0']).surviving.map(r=>r.law),['A','B']);
    for(const [i,law] of s.laws.entries()){
      const [slow,fast]=law.rates.map(BigInt);
      const ys=[0n,a*slow,a*slow+b*fast].map(String);
      assert.deepEqual(session.observe(ys).surviving.map(r=>r.law),[s.laws[i].id]);
    }
    const adv=session.midpointAdversary(),n0=BigInt(n)-1n,a0=n0/2n;
    if(a0)adv.pulse('u0',String(a0));
    adv.pulse('u1',String(n0-a0));
    const collision=adv.collision();
    checkPhysical(s,collision);
    assert.equal(collision.maximumError,noise);
    assert.throws(()=>adv.pulse('u0'),/exceeds/);
    assert.deepEqual(adv.collision(),collision);
    assert.throws(()=>open(s,{...p,minimumPulses:'7'}),/differs/);
    assert.throws(()=>open(catalog(noise,[4,9],[3,4]),p),/differs/);
  }
});

test('the midpoint oracle replies online, with a single physical world per law for each complete path',()=>{
  const s=catalog('3',[2,-3,5],[1,1,0]);
  for(const first of s.commands){
    const adv=open(s,plan(s)).midpointAdversary();
    let y=adv.initialReading;
    assert.equal(y,'0');checkPhysical(s,adv.collision());
    for(let t=0;t<4;t++){
      const command=t===0?first:q(y).n<0n?'u2':'u1';
      const previous=q(y),u=s.commands.indexOf(command);
      y=adv.pulse(command);
      assert.equal(y,fmt(add(previous,Q(BigInt(s.laws[0].rates[u]+s.laws[1].rates[u]),2n))));
      checkPhysical(s,adv.collision());
    }
  }
});

test('every word through seven pulses agrees with an independent primal affine fit',()=>{
  const rates=[-3,1,5],s=catalog('10',rates,[0,0,0]);
  // All candidate slopes are pairwise secant slopes of these integer points.
  // In slope space the residual width is piecewise linear between them.
  const scale=420;
  let words=0;
  for(let n=1;n<=7;n++){
    let worst=0;
    for(let word=0;word<3**n;word++){
      let tail=word;
      const sums=[0];
      for(let i=0;i<n;i++){sums.push(sums.at(-1)+rates[tail%3]);tail=Math.floor(tail/3);}
      let width=Infinity;
      for(let i=0;i<n;i++)for(let j=i+1;j<=n;j++){
        const slope=(sums[j]-sums[i])*(scale/(j-i));
        const residual=sums.map((x,t)=>scale*x-t*slope);
        width=Math.min(width,Math.max(...residual)-Math.min(...residual));
      }
      worst=Math.max(worst,width);words++;
    }
    // width/scale = twice the best uniform error.
    assert.equal(worst*n,scale*8*Math.floor(n*n/4));
    s.noiseBound=fmt(Q(BigInt(worst),BigInt(4*scale)));
    assert.equal(plan(s).minimumPulses,String(Math.max(2,n+1)));
  }
  assert.equal(words,3279);
});

test('arbitrary rational gaps keep huge runs compressed and strict',()=>{
  for(const digits of [3,70,600]){
    const d=10n**BigInt(digits)+1n,s=catalog('1',['0','0'],['0','1/'+d]),p=plan(s);
    const n=16n*d+1n;
    assert.equal(p.minimumPulses,String(n));assert.equal(p.previousDistance,'2');
    assert.equal(p.runs.length,2);assert.ok(q(p.margin).n>0n);
    const session=open(s,p),adv=session.midpointAdversary();
    adv.pulse('u0',String(8n*d));adv.pulse('u1',String(8n*d));
    checkPhysical(s,adv.collision());assert.equal(adv.collision().maximumError,'1');
    assert.deepEqual(session.observe(['0','0','0']).surviving.map(x=>x.law),['A']);
  }
});
test('permanent offsets, dependence on the catalog, and public CLI',()=>{
  const s=catalog('0',['2/3','-1/7'],['-1/3','-8/7']),p=plan(s);
  assert.equal(p.minimumPulses,null);assert.equal(p.witness.driftShift,'1');
  const adv=open(s,p).midpointAdversary();adv.pulse('u1','100000000000000000000');
  checkPhysical(s,adv.collision());
  assert.throws(()=>plan({...s,laws:[...s.laws,{id:'C',rates:['0','2']}]}),/exactly two/);
  const dir=mkdtempSync(join(tmpdir(),'worldlaw-minimum-'));
  try{
    const file=join(dir,'source.json');writeFileSync(file,JSON.stringify(catalog()));
    const out=execFileSync(process.execPath,['scripts/active-linear-family.mjs','--input',file,'--binary-minimum'],{encoding:'utf8'});
    assert.deepEqual(JSON.parse(out),plan(catalog()));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
