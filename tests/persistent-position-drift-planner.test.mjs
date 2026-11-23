import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {CATALOG_SCHEMA,planPositionDriftCatalog as plan,replayPositionDriftPolicy,
  projectedDriftOverlap as projected,observePositionDriftCatalog as observe,
  replayPositionDriftCatalog as replay} from '../src/science/persistent-position-drift-planner.mjs';

const {Q,add,sub,mul,div,fmt} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q = x => {const [n,d='1']=String(x).split('/');return Q(BigInt(n),BigInt(d));};
const cmp = (a,b) => a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const le = (a,b) => cmp(a,b)<=0;
const inside = (r,s) => le(r[0],s)&&le(s,r[1]);
const midpoint = (x,y) => div(add(x,y),q(2));
const source = (table,noiseBound=1) => ({schema:CATALOG_SCHEMA,noiseBound,
  commands:table[0].map((_,i)=>'u'+i),laws:table.map((rates,i)=>({id:'L'+i,rates}))});
const special=source([[0,0,0,0],[0,16,0,0],[0,16,16,0],[0,16,16,16]]);
const switching=source([[-1,-7,-4],[0,6,-7],[6,-2,-6],[-5,2,4]]);
function* tuples(options,k) {
  if(k===0){ yield [];return; }
  for(const t of tuples(options,k-1)) for(const x of options)yield [...t,x];
}
function simulate(start,commands,rates) {
  let p=q(start[0]);const v=q(start[1]),ys=[p];
  for(const u of commands){p=add(add(p,v),q(rates[u]));ys.push(p);}
  return ys;
}
function verifyStart(src,id,origin,commands,ys) {
  const rates=src.laws.find(l=>l.id===id).rates, e=q(src.noiseBound);
  simulate(origin,commands.map(c=>src.commands.indexOf(c)),rates).forEach((y,t)=>{
    const gap=sub(q(ys[t]),y);
    assert.ok(le(q(0),add(gap,e))&&le(gap,e));
  });
}

// Independent oracle for integer-valued fixtures. Project the 16 error-cube
// corners and compute the integer convex hull. Intersect polygons by testing
// contained vertices plus exact segment crossings, without using planner slabs.
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const minus=(a,b)=>[a[0]-b[0],a[1]-b[1]];
function hull(points) {
  const uniq=[...new Map(points.map(p=>[String(p),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(uniq.length<2)return uniq;
  function chain(ps){
    const h=[];
    for(const p of ps){
      while(h.length>=2&&cross(minus(h.at(-1),h.at(-2)),minus(p,h.at(-1)))<=0) h.pop();
      h.push(p);
    }
    h.pop();return h;
  }
  return [...chain(uniq),...chain([...uniq].reverse())];
}
const zeroHull=new Map();
function polygon(row,e) {
  const [a,b,c]=row;
  if(!zeroHull.has(e))zeroHull.set(e,hull([...tuples([-e,e],4)].map(([i,j,k,l])=>[k-2*j+i,l-3*j+2*i])));
  return zeroHull.get(e).map(([x,y])=>[x+b-a,y+b+c-2*a]);
}
function oracle(left,right,e) {
  const a=polygon(left,e), b=polygon(right,e), xs=[];
  if(!e)return String(a[0])===String(b[0])?[q(a[0][0]),q(a[0][0])]:null;
  const edges=ps=>ps.map((p,i)=>[p,ps[(i+1)%ps.length]]);
  const ae=edges(a),be=edges(b);
  for(const [ps,es] of [[a,be],[b,ae]])for(const p of ps)
    if(es.every(([v,w])=>cross(minus(w,v),minus(p,v))>=0))xs.push(q(p[0]));
  for(const [p,p1] of ae)for(const [v,v1] of be){
    const x=minus(p1,p), y=minus(v1,v), delta=minus(v,p), d=cross(x,y);
    if(!d)continue;
    const t=Q(BigInt(cross(delta,y)),BigInt(d)), u=Q(BigInt(cross(delta,x)),BigInt(d));
    if(inside([q(0),q(1)],t)&&inside([q(0),q(1)],u))xs.push(add(q(p[0]),mul(t,q(x[0]))));
  }
  xs.sort(cmp);
  return xs.length?[xs[0],xs.at(-1)]:null;
}
function rng(seed) {
  return n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n;};
}
test('corner/edge intersection independently verifies exact two-coordinate overlap projections',()=>{
  const random=rng(84916);
  assert.deepEqual(projected([0,0,0],[0,8,2],1),['4','4']);
  assert.equal(projected([0,0,0],[0,9,2],1),null);
  for(let k=0;k<512;k++){
    const rows=[0,1].map(()=>Array.from({length:3},()=>random(23)-11)), e=k%3;
    const expected=oracle(...rows,e);
    assert.deepEqual(projected(...rows,e),expected?.map(fmt)??null);
  }
  assert.deepEqual(projected(['1/2',0,0],[1,'1/2','1/2'],0),['-1/2','-1/2']);
});

function inputsFor(src,a,b){
  const e=src.noiseBound, keys=src.commands.map((_,i)=>i);
  const prefix=src.laws.map(l=>[q(l.rates[b]-l.rates[a]-4*e),q(l.rates[b]-l.rates[a]+4*e)]);
  const bad=keys.map(c=>{
    const overlaps=[];
    for(let j=1;j<src.laws.length;j++)for(let i=0;i<j;i++){
      const rows=[i,j].map(k=>[a,b,c].map(u=>src.laws[k].rates[u]));
      const r=oracle(...rows,e);
      if(r)overlaps.push(r);
    }
    return overlaps;
  });
  return {prefix,bad};
}
function partitionPoints(ranges) {
  const set=new Map(ranges.flat().map(x=>[fmt(x),x]));
  const ends=[...set.values()].sort(cmp);
  return [...ends,...ends.slice(1).map((x,i)=>midpoint(ends[i],x))];
}
function independentlyPossible(src,p) {
  let found=false;
  for(let a=0;a<src.commands.length;a++)for(let b=0;b<src.commands.length;b++){
    const {prefix,bad}=inputsFor(src,a,b);
    const selected=p.status==='identified'&&p.first===src.commands[a]&&p.second===src.commands[b];
    const regions=selected?p.regions.map(r=>r.range.map(q)):[];
    let works=true;
    for(const s of partitionPoints([...prefix,...bad.flat(),...regions])){
      const reached=prefix.some(r=>inside(r,s));
      const safe=bad.map(r=>!r.some(pair=>inside(pair,s)));
      if(reached&&!safe.includes(true)) works=false;
      if(selected){
        const covering=regions.flatMap((r,i)=>inside(r,s)?[p.regions[i].command]:[]);
        assert.equal(Boolean(covering.length),reached);
        assert.ok(covering.every(c=>safe[src.commands.indexOf(c)]));
      }
    }
    found ||= works;
  }
  return found;
}
function checkRefusals(src,p){
  assert.equal(p.refusals.length,src.commands.length**2);
  assert.equal(new Set(p.refusals.map(r=>JSON.stringify([r.first,r.second]))).size,p.refusals.length);
  for(const r of p.refusals){
    assert.deepEqual(r.commonReadings.slice(0,2),['0','0']);
    assert.deepEqual(r.alternatives.map(x=>x.third),src.commands);
    for(const choice of r.alternatives){
      assert.equal(new Set(choice.witnesses.map(w=>w.law)).size,2);
      for(const w of choice.witnesses)verifyStart(src,w.law,w.start,[r.first,r.second,choice.third],
        [...r.commonReadings,choice.finalReading]);
    }
  }
}
test('independent catalog decisions, negative witnesses and every closed policy cell',()=>{
  const random=rng(81234);
  const catalogs=[special,switching,source([[0,0],[8,8]]),source([[0,0],[0,4]],0),source([[3],[6]],0)];
  for(let k=0;k<32;k++) {
    const n=2+random(2), m=2+random(3);
    catalogs.push(source(Array.from({length:m},()=>Array.from({length:n},()=>random(17)-8)),k%2));
  }
  const seen=new Set();
  for(const src of catalogs){
    const p=plan(src);seen.add(p.status);
    assert.equal(p.status==='identified',independentlyPossible(src,p));
    if(p.status==='impossible')checkRefusals(src,p);
    const other={...src,commands:src.commands.map((_,i)=>'x'+i).reverse(),
      laws:[...src.laws].reverse().map(l=>({...l,rates:[...l.rates].reverse()}))};
    assert.equal(plan(other).status,p.status);
  }
  assert.equal(seen.size,2);
});
test('positive recovered from the rate table and connected closed regions can change command',()=>{
  const p=plan(special);
  assert.deepEqual([p.first,p.second,p.regions],['u0','u2',[
    {range:['-4','4'],command:'u1'},{range:['12','20'],command:'u3'}]]);
  const cover=plan(switching).regions;
  assert.ok(cover.some((r,i)=>i&&r.range[0]===cover[i-1].range[1]&&r.command!==cover[i-1].command));
  assert.equal(observe(special,p,[0,0,8]).rounds.at(-1).surviving.length,0);
  assert.throws(()=>observe(special,p,[0,0,8,10]),/impossible prefix/);
});
test('raw polynomial plant, unchanged fixed witness, and exact policy/record replay',()=>{
  const p=plan(special);
  const poly=[[0,0,0],[16,-24,8],[16,8,-8],[16,0,0]];
  for(let k=0;k<4;k++)for(const errors of tuples([-1,1],4)){
    const start=['-19/3','9/7'],rates=[0,...[0,1,2].map(x=>poly[k].reduceRight((s,c)=>s*x+c,0))];
    const us=[0,2,k<=1?1:3], clean=simulate(start,us,rates), readings=clean.map((v,i)=>fmt(add(v,q(errors[i]))));
    const record=observe(special,p,readings);
    assert.deepEqual(record.rounds.at(-1).surviving.map(r=>r.law),['L'+k]);
    assert.deepEqual(record.commands,us.map(i=>special.commands[i]));
    for(const {tick,surviving} of record.rounds)for(const s of surviving)
      verifyStart(special,s.law,s.initialWitness,record.commands.slice(0,tick),readings.slice(0,tick+1));
    assert.deepEqual(replay(special,p,JSON.parse(JSON.stringify(record))),record);
  }
  const large=10n**40n, record=observe(special,p,[large,large,large+16n,large+32n].map(String));
  const wrongPolicy=structuredClone(p);wrongPolicy.regions[0].range[0]='-3';
  assert.throws(()=>replayPositionDriftPolicy(special,wrongPolicy),/saved policy/);
  for(const change of [r=>{r.commands[2]='u0';},r=>{r.rounds[3].surviving[0].strips[2].upper='0';},
    r=>{r.readings[3]=String(large);}]){
    const changed=structuredClone(record);change(changed);
    assert.throws(()=>replay(special,p,changed),/saved transcript/);
  }
  const neg=source([[0,1],[2,3]]), refusal=plan(neg);
  assert.deepEqual(replayPositionDriftPolicy(neg,refusal),refusal);
  const forged=structuredClone(refusal);
  forged.refusals[0].alternatives[0].witnesses[0].start[0]='99';
  assert.throws(()=>replayPositionDriftPolicy(neg,forged),/saved policy/);
});

test('finite menus and law counts extend beyond the small catalog fixtures',()=>{
  const expanded=source(Array.from({length:9},(_,law)=>Array.from({length:7},(_,command)=>law+command)));
  const result=plan(expanded);
  assert.equal(result.status,'impossible');
  checkRefusals(expanded,result);
  assert.equal(result.refusals.length,49);
});
