import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {CATALOG_SCHEMA} from '../src/science/persistent-position-drift-planner.mjs';
import {positionDriftStateRegion} from '../src/science/persistent-position-drift.mjs';
import {planAllHorizonPositionDrift as plan, replayAllHorizonPositionDriftPolicy as replayPolicy,
  openAllHorizonPositionDrift as open} from '../src/science/persistent-position-drift-all-horizon.mjs';

const {Q,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q=x=>{const [n,d='1']=String(x).split('/');return Q(BigInt(n),BigInt(d));};
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const src=(rows,noiseBound=1)=>({schema:CATALOG_SCHEMA,noiseBound,commands:rows[0].map((_,i)=>'u'+i),
  laws:rows.map((rates,i)=>({id:'L'+i,rates}))});
const historical=[
  [2,1,[[0,0],[8,8]]],
  [4,0,[[3],[6]]],
  [8,1,[[-2,-2,5],[1,-2,6],[-1,-4,0],[6,7,-3]]],
  [9,0,[[0,0],[7,-6],[8,3],[5,5]]],
  [12,1,[[-1,6,4],[-4,2,8],[-8,2,-2]]],
  [19,0,[[6,6],[-3,-3],[8,-7]]],
  [26,1,[[5,2],[-6,3],[-1,-2]]],
  [28,1,[[8,0],[8,0],[-3,8]]],
  [30,1,[[-1,1,8],[3,2,1],[8,6,-3],[8,4,3]]],
  [32,1,[[2,5],[-4,-1]]],
  [34,1,[[-3,-5],[-5,-5],[3,2],[4,5]]],
];
function word(p) {
  return p.schedule.flatMap(b=>[b.first,b.second].map(command=>({command,repeats:b.repeats})));
}
function trajectory(source,law,start,runs,expand=false) {
  const rates=source.laws.find(l=>l.id===law).rates;
  let position=q(start[0]);const v=q(start[1]),ys=[position];
  for(const r of runs){
    const n=BigInt(r.repeats),rate=q(rates[source.commands.indexOf(r.command)]);
    if(expand){
      assert.ok(n<100n);
      for(let k=0n;k<n;k++)position=add(add(position,v),rate);
    }else position=add(position,mul(Q(n),add(v,rate)));
    ys.push(position);
  }
  return ys;
}
function checkMeasurements(source,p,session,law,start,errors,expand=false) {
  const runs=word(p),ys=trajectory(source,law,start,runs,expand).map((v,i)=>fmt(add(v,q(errors[i]))));
  const record=session.observe(ys);
  assert.deepEqual(record.surviving.map(s=>s.law),[law]);
  assert.deepEqual(record.ticks,p.readAt);
  for(const survivor of record.surviving){
    const found=trajectory(source,law,survivor.initialWitness,runs,expand);
    for(let i=0;i<found.length;i++){
      const d=sub(found[i],q(ys[i])),e=q(source.noiseBound);
      assert.ok(cmp(d,e)<=0 && cmp(add(d,e),q(0))>=0);
    }
  }
  assert.deepEqual(session.replay(JSON.parse(JSON.stringify(record))),record);
  return record;
}
test('all eleven four-pulse refusals split into six permanent aliases and five finite schedules',()=>{
  const finite=[],aliased=[];
  for(const [id,error,rows] of historical){
    const source=src(rows,error),p=plan(source),session=open(source,p);
    assert.deepEqual(replayPolicy(source,p),p);
    if(p.status==='indistinguishable'){
      aliased.push(id);
      for(const w of p.witnesses){
        const commands=source.commands.map(command=>({command,repeats:'3'}));
        const [a,b]=w.laws;
        const trace=session.trace(a,b,commands,['-5/7','11/13']);
        assert.deepEqual(trace.readings[0],trajectory(source,a,trace.starts[0],commands,true).map(fmt));
        assert.deepEqual(trace.readings[1],trajectory(source,b,trace.starts[1],commands,true).map(fmt));
        assert.deepEqual(trace.readings[0],trace.readings[1]);
      }
    }else{
      finite.push([id,p.pulseUpperBound]);
      assert.equal(p.pairCertificates.length,rows.length*(rows.length-1)/2);
      const runs=word(p);
      for(const c of p.pairCertificates){
        const observed=c.laws.map(l=>trajectory(source,l,['9/11','-3/5'],runs,true));
        const i=2*c.block, centers=observed.map(y=>fmt(add(sub(y[i+2],mul(q(2),y[i+1])),y[i])));
        assert.deepEqual(centers,c.centers);
        const [[a,b],[d,e]]=c.intervals.map(r=>r.map(q));
        assert.ok(cmp(b,d)<0||cmp(e,a)<0);
        assert.equal(fmt(cmp(b,d)<0?sub(d,b):sub(a,e)),c.margin);
      }
      for(const l of source.laws){
        for(const sign of [-1,0,1]){
          const errors=p.readAt.map((_,i)=>sign*(i%2?1:-1));
          checkMeasurements(source,p,session,l.id,['19/7','-23/9'],errors,true);
        }
      }
    }
  }
  assert.deepEqual(aliased,[2,4,9,19,28,32]);
  assert.deepEqual(finite,[[8,'14'],[12,'10'],[26,'10'],[30,'12'],[34,'18']]);
});
test('gauge certificates cover every within-class pair and arbitrary command-word lengths',()=>{
  const source=src([['1/3','-1/2'],['1/2','-1/3'],['1/3','-1/2'],[0,1]]);
  const p=plan(source),session=open(source,p);
  assert.deepEqual(p.classes,[['L0','L1','L2'],['L3']]);
  assert.equal(p.witnesses.length,3);
  const runs=[{command:'u1',repeats:String(10n**150n+1n)},{command:'u0',repeats:'7'}];
  for(const [a,b] of [['L0','L1'],['L1','L0'],['L0','L2']]){
    const trace=session.trace(a,b,runs,['-333/17','41/53']);
    assert.deepEqual(trace.readings[0],trace.readings[1]);
    assert.deepEqual(trace.readings[0],trajectory(source,a,trace.starts[0],runs).map(fmt));
    assert.deepEqual(trace.readings[1],trajectory(source,b,trace.starts[1],runs).map(fmt));
    assert.deepEqual(session.replay(JSON.parse(JSON.stringify(trace))),trace);
    const forged=structuredClone(trace);forged.readings[1][1]='17';
    assert.throws(()=>session.replay(forged),/saved gauge trace/);
  }
  assert.throws(()=>session.trace('L0','L3',runs),/distinguishable/);
  assert.throws(()=>session.trace('L0','L1',[{command:'u1',repeats:'1/2'}]),/positive integers/);
  const w=structuredClone(p);w.witnesses[0].secondStart[1]='0';
  assert.throws(()=>replayPolicy(source,w),/saved policy/);
});
test('arbitrarily small rational gaps give strict separation without expanding the schedule',()=>{
  for(const exponent of [1,37,150,600]){
    const denominator=10n**BigInt(exponent)+1n;
    const source=src([[0,0],[0,'1/'+denominator]]);
    const p=plan(source),n=8n*denominator+1n,session=open(source,p);
    assert.equal(p.schedule[0].repeats,String(n));
    assert.equal(p.pulseUpperBound,String(2n*n));
    assert.deepEqual(p.readAt,['0',String(n),String(2n*n)]);
    assert.equal(p.pairCertificates[0].margin,'1/'+denominator);
    for(const l of source.laws)checkMeasurements(source,p,session,l.id,['-999/17','-31/29'],[1,-1,1]);
    // One fewer repetition gives centers 0 and 8. These two raw initial
    // states generate positions within 1 of exactly the same three readings.
    const shorter=n-1n, runs=source.commands.map(command=>({command,repeats:String(shorter)}));
    const states=[['-1','2/'+shorter],['1','-2/'+shorter]];
    for(const [i,l] of source.laws.entries()){
      const clean=trajectory(source,l.id,states[i],runs);
      const gaps=clean.map((v,k)=>sub(v,q([0,0,4][k])));
      assert.ok(gaps.every(g=>cmp(g,q(1))<=0&&cmp(g,q(-1))>=0));
    }
    assert.deepEqual(session.observe([0,0,4]).surviving.map(l=>l.law),['L0']);
    assert.throws(()=>session.observe([0,0,'4.0']),/exact integer or rational/);
  }
});
test('zero noise, true equality, timestamp correlation and corrupted records',()=>{
  const exact=src([[0,'1/11'],[0,0]],0),p=plan(exact),opened=open(exact,p);
  assert.equal(p.schedule[0].repeats,'1');
  assert.deepEqual(opened.observe([0,0,0]).surviving.map(r=>r.law),['L1']);
  assert.deepEqual(opened.observe([0,0,7]).surviving,[]);
  assert.equal(plan(src([[1],[8],[11]],0)).status,'indistinguishable');
  const ts=['0','2','4','6'];
  assert.ok(positionDriftStateRegion([0,0,4].map(q),q(1),ts.slice(0,3)));
  assert.ok(positionDriftStateRegion([0,4,8].map(q),q(1),ts.slice(1)));
  assert.equal(positionDriftStateRegion([0,0,4,8].map(q),q(1),ts),null);
  const forged=structuredClone(p);forged.schedule[0].repeats='2';
  assert.throws(()=>replayPolicy(exact,forged),/saved policy/);
  const cert=structuredClone(p);cert.pairCertificates[0].margin='0';
  assert.throws(()=>replayPolicy(exact,cert),/saved policy/);
  const r=opened.observe([0,0,0]);r.ticks[1]='999999999999999999';
  assert.throws(()=>opened.replay(r),/saved checkpoint record/);
  const bad=opened.observe([0,0,0]);bad.surviving[0].initialWitness[1]='1/10';
  assert.throws(()=>opened.replay(bad),/saved checkpoint record/);
});
