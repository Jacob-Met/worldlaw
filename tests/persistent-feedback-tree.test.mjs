import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC as A} from '../src/science/active-linear-family.mjs';
import {transportFeedbackDual} from '../src/science/feedback-dual-transport.mjs';
import {certifyPhysicalFeedbackTree,verifyPhysicalFeedbackTree,receivePhysicalFeedbackTree} from '../src/science/position-drift-physical-feedback.mjs';

const path='examples/active-position-drift-six-pulse-tree.json';
const example=()=>JSON.parse(readFileSync(path,'utf8'));
function words(size,length){
  let out=[[]];
  for(let j=0;j<length;j++)out=out.flatMap(p=>Array.from({length:size},(_,c)=>[...p,c]));
  return out;
}
test('transport prunes dense tight certificates, with binary support necessary on the signed tree',()=>{
  const {Q,add,mul,div,neg}=A,one=Q(1n),zero=Q(0n);
  for(const [fan,depth] of [[3,2],[3,3],[4,3],[4,5]]){
    const all=words(fan,depth),nodes=new Map(),weights=[],rows=[];
    all.forEach((word,i)=>{
      let weight=one;const terms=[];
      word.forEach((c,j)=>{
        const key=word.slice(0,j).join(',');
        if(!nodes.has(key))nodes.set(key,nodes.size);
        const positive=c!==fan-1;
        terms.push([nodes.get(key),positive?one:neg(one)]);
        weight=div(weight,Q(BigInt(positive?2*(fan-1):2)));
      });
      weights.push([i,weight]);rows.push({terms,h:neg(one),r:one});
    });
    const order=[...nodes].sort((a,b)=>b[0].length-a[0].length).map(([,id])=>id);
    const proof=transportFeedbackDual(rows,weights,order,one,i=>i,()=>{});
    assert.equal(proof.leaves.length,2**depth);
    const amounts=Array(nodes.size).fill(zero);let total=zero;
    for(const [i,s] of proof.lower){
      const [n,d='1']=s.split('/'),w=Q(BigInt(n),BigInt(d));
      assert.ok(w.n>0n);total=add(total,w);
      for(const [k,c] of rows[i].terms)amounts[k]=add(amounts[k],mul(c,w));
    }
    assert.equal(A.fmt(total),'1');assert.ok(amounts.every(q=>q.n===0n));
  }
  // Removing any binary leaf lets every remaining leaf have value -1.
  const binary=words(2,3);
  for(const missing of binary){
    const payoff=word=>word.join()===missing.join()?7:-1;
    const mean=p=>{const leaves=binary.filter(w=>p.every((v,i)=>w[i]===v));return leaves.reduce((s,w)=>s+payoff(w),0)/leaves.length;};
    for(const w of binary){
      let value=0;
      for(let i=0;i<3;i++){const p=w.slice(0,i);value+=(w[i]?-1:1)*(mean([...p,0])-mean([...p,1]))/2;}
      assert.equal(value,payoff(w));
    }
  }
});
test('six-pulse exhibit separates at 1/29 and retains the complete physical collision at 3/76',()=>{
  const src=example(),p=certifyPhysicalFeedbackTree(src);
  assert.equal(p.atRequestedNoise,'policy-separates');assert.equal(p.tree.radius,'3/76');
  assert.equal(p.tree.worlds.flat().length,8);assert.equal(p.tree.lower.length,31);
  assert.deepEqual(p.compact.kept,[0,1,2,3]);assert.equal(verifyPhysicalFeedbackTree(src,p),true);
  const y=['17','20','23','26','30','33','37'];
  const received=receivePhysicalFeedbackTree(src,p,y);
  assert.deepEqual(received.commands,['ref','ref','ref','group','x1','y1']);
  assert.deepEqual(received.surviving.map(s=>s.law),['A']);
  const v=structuredClone(p);v.compact.proof.worlds[0][0].start[0]='850';
  assert.throws(()=>verifyPhysicalFeedbackTree(src,v));
  const boundary=example();boundary.catalog.noiseBound='3/76';const b=certifyPhysicalFeedbackTree(boundary);
  assert.equal(b.atRequestedNoise,'tree-refuted');assert.throws(()=>receivePhysicalFeedbackTree(boundary,b,[0]),/no guaranteed/);
  const low=example();low.catalog.limits.designWork=0;const exhausted=certifyPhysicalFeedbackTree(low);
  assert.equal(exhausted.status,'design-budget-exhausted');assert.equal(verifyPhysicalFeedbackTree(low,exhausted),true);
});
test('changed two-point schedules match the rational binary formula through horizon ten',()=>{
  for(let n=2;n<=10;n++){
    const s=example();s.horizon=n;s.catalog.commands=['a','b'];
    s.catalog.laws=[{id:'A',vertices:[[0,0]]},{id:'B',vertices:[[0,'1/7']]}];
    s.catalog.noiseBound=0;const k=Math.floor(n/2);
    s.program={commands:[...Array(k).fill('a'),...Array(n-k).fill('b')]};
    const p=certifyPhysicalFeedbackTree(s);
    assert.equal(p.tree.radius,A.fmt(A.Q(BigInt(k*(n-k)),BigInt(28*n))));
    assert.deepEqual(p.compact.kept,[0]);assert.equal(verifyPhysicalFeedbackTree(s,p),true);
  }
});
test('the CLI rebuilds the shared source and continues the compact policy from observed positions',()=>{
  const dir=mkdtempSync(join(tmpdir(),'physical-feedback-'));
  try{
    const plan=join(dir,'plan.json'),readings=join(dir,'readings.json');
    const cli=(...extra)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',path,'--physical-feedback-tree',...extra],{encoding:'utf8'});
    const build=cli('--output',plan);assert.equal(build.status,0,build.stderr);
    writeFileSync(readings,JSON.stringify(['17','20','23','26','30']));
    const next=cli('--replay',plan,'--readings',readings);assert.equal(next.status,0,next.stderr);
    assert.equal(JSON.parse(next.stdout).nextCommand,'x1');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('a physical feedback menu reduces to a single executable tape at the same exact radius',()=>{
  const s=example();s.horizon=4;s.catalog.commands=['a','b'];
  s.catalog.laws=[{id:'A',vertices:[[0,0]]},{id:'B',vertices:[[0,1]]}];s.catalog.noiseBound='1/5';
  s.program={commands:['a','a'],alternatives:['a','b'].map(c=>({commands:[c],
    alternatives:['a','b'].map(d=>({commands:[d]}))}))};
  const plan=certifyPhysicalFeedbackTree(s);
  assert.equal(plan.tree.worlds.length,4);assert.equal(plan.tree.radius,'1/4');
  assert.deepEqual(plan.compact.kept,[3]);assert.equal(plan.compact.proof.radius,'1/4');
  assert.equal(verifyPhysicalFeedbackTree(s,plan),true);
  const out=receivePhysicalFeedbackTree(s,plan,['0','0','0','1','2']);
  assert.deepEqual(out.commands,['a','a','b','b']);assert.deepEqual(out.surviving.map(x=>x.law),['B']);
  const forged=structuredClone(plan);forged.compact.kept=[0];
  assert.throws(()=>verifyPhysicalFeedbackTree(s,forged));
});
