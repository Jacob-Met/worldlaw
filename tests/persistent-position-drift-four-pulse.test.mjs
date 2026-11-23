import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {CATALOG_SCHEMA,planPositionDriftCatalog} from '../src/science/persistent-position-drift-planner.mjs';
import {fourPulseCenter,pairFourPulseProjection,unsafeThirdBands} from '../src/science/persistent-four-pulse-geometry.mjs';
import {planFourPulsePositionDrift as plan,replayFourPulsePositionDriftPolicy as replayPolicy,
  openFourPulsePositionDrift as open} from '../src/science/persistent-position-drift-four-pulse.mjs';

const {Q,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q=x=>{const [n,d='1']=String(x).split('/');return Q(BigInt(n),BigInt(d));};
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const minus=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=([x,y,z],[a,b,c])=>[y*c-z*b,z*a-x*c,x*b-y*a];
function gcd(a,b){return b?gcd(b,a%b):Math.abs(a);}
function* words(menu,length){
  if(!length){yield [];return;}
  for(const prefix of words(menu,length-1))for(const c of menu)yield [...prefix,c];
}
const catalog=(rows,e=1)=>({schema:CATALOG_SCHEMA,commands:rows[0].map((_,i)=>'u'+i),noiseBound:e,
  laws:rows.map((rates,i)=>({id:'L'+i,rates}))});
const case16=catalog([[1,-8,5],[-4,-7,6]]);
const staircase=catalog(Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>j>0&&j<=i?16:0)));
function simulate(src,law,origin,actions){
  let x=q(origin[0]);const ys=[x],v=q(origin[1]);
  const rates=src.laws.find(l=>l.id===law).rates;
  for(const u of actions){x=add(add(x,v),q(rates[src.commands.indexOf(u)]));ys.push(x);}
  return ys;
}
function verifyWitness(src,law,origin,commands,ys) {
  const expected=simulate(src,law,origin,commands),error=q(src.noiseBound);
  for(let i=0;i<ys.length;i++){
    const r=sub(expected[i],q(ys[i]));
    assert.ok(cmp(r,error)<=0&&cmp(add(r,error),q(0))>=0);
  }
}
function play(src,session,law,origin,errors){
  const commands=[],readings=[fmt(add(q(origin[0]),q(errors[0])))];
  for(let t=0;t<4;t++){
    const u=session.observe(readings).rounds.at(-1).next;
    assert.ok(src.commands.includes(u));commands.push(u);
    const y=simulate(src,law,origin,commands).at(-1);
    readings.push(fmt(add(y,q(errors[t+1]))));
  }
  const record=session.observe(readings);
  assert.deepEqual(record.rounds.at(-1).surviving.map(r=>r.law),[law]);
  for(const {tick,surviving} of record.rounds)for(const r of surviving)
    verifyWitness(src,r.law,r.initialWitness,commands.slice(0,tick),readings.slice(0,tick+1));
  assert.deepEqual(session.replay(JSON.parse(JSON.stringify(record))),record);
  return record;
}
test('published refusal 16 recovers with exactly one additional pulse at unchanged noise',()=>{
  const previous=planPositionDriftCatalog(case16);
  assert.equal(previous.status,'impossible');assert.equal(previous.refusals.length,9);
  const fixed=['u1','u1','u0','u0'];
  const contrasts=case16.laws.map(l=>{
    const ys=simulate(case16,l.id,['-7/3','11/5'],fixed);
    return fmt(add(sub(ys[4],mul(q(2),ys[2])),ys[0]));
  });
  assert.deepEqual(contrasts,['18','6']);
  const policy=plan(case16),session=open(case16,policy);
  assert.equal(policy.status,'identified');
  for(const l of case16.laws)for(const errors of words([-1,1],5))
    play(case16,session,l.id,['-7/3','11/5'],errors);
});
test('all 625 fixed four-pulse schedules collide while both adaptive decisions can change',()=>{
  assert.equal(planPositionDriftCatalog(staircase).status,'impossible');
  let count=0;
  for(const commands of words(staircase.commands,4)){
    let laws,starts;
    if(!commands.includes('u0')){laws=['L0','L4'];starts=[[0,0],[0,-16]];}
    else{
      const missing=staircase.commands.findIndex((c,i)=>i!==0&&!commands.includes(c));
      laws=['L'+(missing-1),'L'+missing];starts=[[0,0],[0,0]];
    }
    assert.deepEqual(simulate(staircase,laws[0],starts[0],commands).map(fmt),
      simulate(staircase,laws[1],starts[1],commands).map(fmt));count++;
  }
  assert.equal(count,625);
  const p=plan(staircase),session=open(staircase,p),routes=new Set();
  assert.equal(p.status,'identified');
  for(const law of staircase.laws)for(const errors of words([-1,1],5)){
    const r=play(staircase,session,law.id,['123456789012345678901/17','-19/23'],errors);
    routes.add(r.commands.slice(2).join(','));
  }
  assert.ok(routes.has('u3,u2')&&routes.has('u3,u4'));
  assert.ok([...routes].some(x=>!x.startsWith('u3,')));
  const record=play(staircase,session,'L4',[0,0],Array(5).fill(0));
  for(const change of [r=>{r.commands[3]='u0';},r=>{r.readings[4]='0';},
    r=>{r.rounds[4].surviving[0].strips[4].upper='0';}]){
    const corrupt=structuredClone(record);change(corrupt);
    assert.throws(()=>session.replay(corrupt),/saved transcript/);
  }
  const corrupt=structuredClone(p);corrupt.fourthDecisions[0].actions[0].ambiguous=[];
  assert.throws(()=>replayPolicy(staircase,corrupt),/saved policy/);
  assert.deepEqual(session.observe([0,0,8]).rounds.at(-1).surviving,[]);
  assert.throws(()=>session.observe([0,0,8,9]),/impossible prefix/);
});
function checkNegative(src,policy){
  assert.equal(policy.status,'impossible');
  assert.equal(new Set(policy.refusals.map(p=>JSON.stringify([p.first,p.second]))).size,src.commands.length**2);
  let count=0;
  for(const r of policy.refusals){
    assert.deepEqual(r.commonReadings.slice(0,2),['0','0']);
    assert.deepEqual(r.thirds.map(t=>t.command),src.commands);
    for(const t of r.thirds){
      assert.deepEqual(t.finals.map(f=>f.command),src.commands);
      for(const f of t.finals){
        assert.equal(new Set(f.witnesses.map(w=>w.law)).size,2);
        const commands=[r.first,r.second,t.command,f.command],ys=[...r.commonReadings,t.reading,f.reading];
        for(const w of f.witnesses)verifyWitness(src,w.law,w.start,commands,ys);
        count++;
      }
    }
  }
  assert.equal(count,src.commands.length**4);
}
test('a law-specific constant offset is absorbed by drift at every horizon',()=>{
  const src=catalog([[-2,4,1],[5,11,8]]),p=plan(src);
  checkNegative(src,p);
  assert.deepEqual(replayPolicy(src,p),p);
  const corrupt=structuredClone(p);corrupt.refusals[0].thirds[0].finals[0].witnesses[0].start[1]='999';
  assert.throws(()=>replayPolicy(src,corrupt),/saved policy/);
});
test('vertical sweep retains isolated collisions, shared faces and crossing edge events',()=>{
  const poly=points=>({polygon:points.map(v=>v.map(q))});
  const a=poly([[0,0],[4,4]]), b=poly([[0,4],[4,0]]);
  assert.deepEqual(unsafeThirdBands([[a],[b]]).map(r=>r.map(fmt)),[['2','2']]);
  assert.deepEqual(unsafeThirdBands([[a],[poly([[2,2]])]]).map(r=>r.map(fmt)),[['2','2']]);
  assert.deepEqual(unsafeThirdBands([[a],[poly([[1,1],[3,3]])]]).map(r=>r.map(fmt)),[['1','3']]);
  assert.deepEqual(unsafeThirdBands([[a],[]]),[]);
});

// Independent H/V conversion: discover supporting planes from triples of
// the projected 32 raw noise corners, solve triples of active planes by
// Cramer's rule, then project their feasible vertices and take a planar hull.
const cube=[...new Map([...words([-1,1],5)].map(([i,j,k,l,m])=>{
  const v=[k-2*j+i,l-3*j+2*i,m-4*j+3*i];
  return [String(v),v];
})).values()];
function cornerFaces(){
  const found=new Map();
  for(let i=0;i<cube.length;i++)for(let j=0;j<i;j++)for(let k=0;k<j;k++){
    const raw=cross(minus(cube[j],cube[i]),minus(cube[k],cube[i]));
    const d=raw.reduce(gcd,0);if(!d)continue;
    const v=raw.map(x=>x/d),h=dot(v,cube[i]);
    const ds=cube.map(p=>dot(v,p)-h), maximum=Math.max(...ds),minimum=Math.min(...ds);
    if(maximum!==0&&minimum!==0)continue;
    const sign=maximum===0?1:-1,n=v.map(x=>x*sign);
    found.set(String(n),{n,h:sign*h});
  }
  return [...found.values()];
}
const faces=cornerFaces();
function hull(ps){
  const points=[...new Map(ps.map(p=>[p.map(fmt).join(','),p])).values()]
    .sort((a,b)=>cmp(a[0],b[0])||cmp(a[1],b[1]));
  if(points.length<=1)return points.map(p=>p.map(fmt));
  function chain(a){
    const h=[];
    for(const p of a){
      while(h.length>=2){
        const o=h.at(-2),v=h.at(-1);
        const turn=sub(mul(sub(v[0],o[0]),sub(p[1],o[1])),mul(sub(v[1],o[1]),sub(p[0],o[0])));
        if(turn.n>0n)break;
        h.pop();
      }
      h.push(p);
    }
    h.pop();return h;
  }
  return [...chain(points),...chain([...points].reverse())].map(p=>p.map(fmt));
}
function bruteProjection(c1,c2,e){
  const planes=faces.map(({n,h})=>({n,h:e*h+Math.min(dot(n,c1),dot(n,c2))})),ps=[];
  for(let i=0;i<planes.length;i++)for(let j=0;j<i;j++)for(let k=0;k<j;k++){
    const [a,b,c]=[planes[i],planes[j],planes[k]];
    const bc=cross(b.n,c.n),ca=cross(c.n,a.n),ab=cross(a.n,b.n),den=dot(a.n,bc);
    if(!den)continue;
    const numerators=bc.map((x,s)=>Math.sign(den)*(a.h*x+b.h*ca[s]+c.h*ab[s])),d=Math.abs(den);
    if(planes.every(p=>dot(p.n,numerators)<=p.h*d))
      ps.push(numerators.slice(0,2).map(n=>Q(BigInt(n),BigInt(d))));
  }
  return hull(ps);
}
test('raw 32-corner facet construction and triple-plane vertices independently verify projection',()=>{
  let state=191802;const rand=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state>>>8)%n;};
  const inputs=[[[0,0,0],[0,0,0],0],[[0,0,0],[0,0,1],0],[[0,0,0],[8,10,14],1]];
  for(let k=0;k<180;k++)inputs.push([Array.from({length:3},()=>rand(13)-6),
    Array.from({length:3},()=>rand(13)-6),k%3]);
  for(const [a,b,e] of inputs){
    const p=pairFourPulseProjection(a.map(q),b.map(q),q(e));
    assert.deepEqual(hull(p?.polygon??[]),bruteProjection(a,b,e));
  }
  assert.deepEqual(fourPulseCenter([q(2),q(5),q(7),q(3)]).map(fmt),['3','8','9']);
});
// With exact readings, normalized first-two observations give a finite
// decision game. Group laws by actual simulated reading at each choice.
function noiseFreePossible(src){
  const cmds=src.commands.map((_,k)=>k);
  function separates(groups,actions){
    if(groups.length<=1)return true;
    if(actions.length===4)return false;
    return cmds.some(c=>{
      const next=[...actions,c],buckets=new Map();
      for(const law of groups){
        const drift=-law.rates[next[0]],value=next.reduce((p,u)=>p+drift+law.rates[u],0);
        const group=buckets.get(value)??[];group.push(law);buckets.set(value,group);
      }
      return [...buckets.values()].every(g=>separates(g,next));
    });
  }
  return separates(src.laws,[]);
}
test('independent zero-noise finite decision game agrees on positive and negative catalogs',()=>{
  let v=281161;const rand=n=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return (v>>>8)%n;};
  const statuses=new Set();
  for(let k=0;k<36;k++){
    const n=2+rand(2),m=2+rand(3),src=catalog(Array.from({length:m},()=>Array.from({length:n},()=>rand(5)-2)),0);
    const policy=plan(src);statuses.add(policy.status);
    assert.equal(policy.status==='identified',noiseFreePossible(src));
    if(policy.status==='impossible')checkNegative(src,policy);
  }
  assert.equal(statuses.size,2);
});

test('replay all fourteen published three-pulse refusals at the four-pulse horizon',()=>{
  const cases=[
    [2,1,[[0,0],[8,8]]],
    [4,0,[[3],[6]]],
    [8,1,[[-2,-2,5],[1,-2,6],[-1,-4,0],[6,7,-3]]],
    [9,0,[[0,0],[7,-6],[8,3],[5,5]]],
    [12,1,[[-1,6,4],[-4,2,8],[-8,2,-2]]],
    [16,1,[[1,-8,5],[-4,-7,6]]],
    [19,0,[[6,6],[-3,-3],[8,-7]]],
    [22,1,[[8,7,-3],[-6,-8,-4],[2,-3,-8]]],
    [24,1,[[7,6,8],[3,6,2],[-5,-6,1]]],
    [26,1,[[5,2],[-6,3],[-1,-2]]],
    [28,1,[[8,0],[8,0],[-3,8]]],
    [30,1,[[-1,1,8],[3,2,1],[8,6,-3],[8,4,3]]],
    [32,1,[[2,5],[-4,-1]]],
    [34,1,[[-3,-5],[-5,-5],[3,2],[4,5]]],
  ];
  const recovered=[];
  let checkedCollisions=0;
  for(const [index,error,rows] of cases){
    const src=catalog(rows,error);
    assert.equal(planPositionDriftCatalog(src).status,'impossible');
    const p=plan(src);
    if(p.status==='identified')recovered.push(index);
    else {checkNegative(src,p);checkedCollisions+=src.commands.length**4;}
  }
  assert.deepEqual(recovered,[16,22,24]);
  assert.equal(checkedCollisions,356);
});
