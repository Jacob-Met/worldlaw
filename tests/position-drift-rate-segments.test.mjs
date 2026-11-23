import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {planRateSegments,openRateSegments} from '../src/science/position-drift-rate-segments.mjs';
import {parseActiveOriginalJSON} from '../src/science/active-position-drift-readout.mjs';
const {Q,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const read=name=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-'+name+'.json',import.meta.url),'utf8'));
const sample=()=>read('rate-segments'),alias=()=>read('rate-segment-alias');

test('every two-command subcatalog aliases, while all three commands separate uniformly',()=>{
  const s=sample(),pairs=[[0,1],[0,2],[1,2]];
  for(const [k,indices] of pairs.entries()){
    const pick=row=>indices.map(i=>row[i]);
    const source={...s,commands:pick(s.commands),laws:s.laws.map(l=>({...l,endpoints:l.endpoints.map(pick)}))};
    const p=planRateSegments(source);
    assert.equal(p.status,'indistinguishable');assert.equal(p.aliases[0].parameters[1],['1/3','2/5','1/2'][k]);
  }
  const p=planRateSegments(s);assert.equal(p.pulseUpperBound,'123');assert.deepEqual(p.readAt,['0','41','82','123']);
  assert.equal(p.certificates[0].unitGap,'1/34');assert.equal(p.certificates[0].noiseRadius,'10/17');
  // At n=40 the closed contrast intervals touch. Replay raw trajectories:
  // A starts at -2 with drift 1/10; B starts at zero with drift zero and t=2/5.
  const midpoint=[-1,1,7,9],A=[-2,2,6,10],B=[0,0,8,8];
  assert.deepEqual(A,[0,40,80,120].map(t=>-2+t/10));
  assert.deepEqual(B,[0,0,40*(-5+3*2)/5,40*(-5+3*2)/5+40*(-10+5*2)/5]);
  for(const path of [A,B])assert.deepEqual(path.map((v,i)=>Math.abs(v-midpoint[i])),[1,1,1,1]);
  const r=openRateSegments(s,p);assert.deepEqual(r.observe([0,0,'41/5','41/5']).surviving.map(w=>w.law),['B']);
  assert.deepEqual(r.observe([0,0,0,0]).surviving.map(w=>w.law),['A']);
  const changed=structuredClone(p);changed.runs[0].repeats='40';assert.throws(()=>openRateSegments(s,changed),/differs/);
});

test('coincident interiors replay with one constant parameter; intersections need not be transitive',()=>{
  const s=alias(),p=planRateSegments(s),r=openRateSegments(s,p);assert.equal(p.status,'indistinguishable');
  assert.deepEqual(p.aliases,[{laws:['A','B'],parameters:['0','1/2'],driftShift:'-5'}]);
  const trace=r.trace('A','B',[{command:'b',repeats:String(10n**84n+1n)},{command:'c',repeats:'4'}],['2/7','-9/11']);
  assert.deepEqual(trace.readings[0],trace.readings[1]);assert.deepEqual(r.replay(trace),trace);
  const reverse=r.trace('B','A',trace.word,trace.origin);assert.deepEqual(reverse.parameters,['1/2','0']);assert.equal(reverse.driftShift,'5');
  const forged=structuredClone(trace);forged.parameters[1]='0';assert.throws(()=>r.replay(forged),/differs/);
  const line={...s,commands:['x','y'],laws:[[0,2],[1,3],[3,5]].map((e,i)=>({id:'L'+i,endpoints:e.map(y=>[0,y])}))};
  const q=planRateSegments(line);assert.deepEqual(q.aliases.map(x=>x.laws),[['L0','L1'],['L1','L2']]);
  assert.deepEqual(q.certificates.map(x=>x.laws),[['L0','L2']]);
  const tiny=sample(),D=10n**180n+13n;tiny.laws[1].endpoints=tiny.laws[1].endpoints.map(row=>row.map(v=>v+'/'+D));
  assert.equal(planRateSegments(tiny).runs[0].repeats,String(40n*D+1n));
  assert.throws(()=>parseActiveOriginalJSON(JSON.stringify(s).replace('"noiseBound":1','"noiseBound":1.00000000000000001')),/safe integer/);
});

test('crossing, parallel and collapsed segments match an independent planar intersection test',()=>{
  let seed=93491;const pick=()=>{seed=seed*48271%2147483647;return seed%5-2;};
  const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let hit=0,miss=0;
  for(let n=0;n<350;n++){
    const points=Array.from({length:4},()=>[pick(),pick()]),[a,b,c,d]=points;
    const bounds=[0,1].every(i=>Math.max(Math.min(a[i],b[i]),Math.min(c[i],d[i]))<=Math.min(Math.max(a[i],b[i]),Math.max(c[i],d[i])));
    const collision=bounds&&area(a,b,c)*area(a,b,d)<=0&&area(c,d,a)*area(c,d,b)<=0;
    const s=sample();s.laws.forEach((l,i)=>{l.endpoints=points.slice(2*i,2*i+2).map(([x,y])=>[0,x,y]);});
    const p=planRateSegments(s);assert.equal(p.status==='indistinguishable',collision);if(collision)hit++;else miss++;
  }
  assert.ok(hit&&miss);
});

// Independent raw-state polytope in (initial position, drift, persistent parameter).
// With at least two readings all three unknowns are bounded. Every nonempty
// polytope has vertices, including lower-dimensional intersections.
function directParameterBounds(law,ys,error,repeats){
  const rows=[[0n,0n,-1n,0n],[0n,0n,1n,1n]];
  let base=0n,delta=0n;
  for(let i=0;i<ys.length;i++){
    if(i){base+=repeats*BigInt(law.endpoints[0][i-1]);delta+=repeats*BigInt(law.endpoints[1][i-1]-law.endpoints[0][i-1]);}
    const normal=[1n,BigInt(i)*repeats,delta],rhs=BigInt(ys[i])-base;
    rows.push([...normal,rhs+error],[...normal.map(x=>-x),error-rhs]);
  }
  const det=([a,b,c])=>a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  const points=[];
  for(let k=2;k<rows.length;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
    const mat=[rows[i],rows[j],rows[k]];let den=det(mat);if(!den)continue;
    const num=[0,1,2].map(col=>det(mat.map(row=>row.slice(0,3).map((x,h)=>h===col?row[3]:x))));
    if(den<0n){den=-den;num.forEach((x,h)=>{num[h]=-x;});}
    if(rows.every(row=>row[0]*num[0]+row[1]*num[1]+row[2]*num[2]<=row[3]*den))points.push(Q(num[2],den));
  }
  if(!points.length)return null;
  points.sort((a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0);
  return [fmt(points[0]),fmt(points.at(-1))];
}
test('retained intervals agree with independent raw-state vertices on changed checkpoint records',()=>{
  const s=sample(),p=planRateSegments(s),r=openRateSegments(s,p);let seed=1627;
  const draw=()=>{seed=seed*48271%2147483647;return seed%11-5;};
  let nonempty=0,empty=0;
  for(let trial=0;trial<96;trial++){
    let ys=[draw(),draw(),draw(),draw()];if(trial%3===0)ys=ys.map((v,i)=>v+([0,0,41,82][i]));
    ys=ys.slice(0,2+trial%3);const out=r.observe(ys).surviving;
    for(const law of s.laws){
      const ref=directParameterBounds(law,ys,1n,41n),w=out.find(v=>v.law===law.id);
      assert.deepEqual(w?.parameterRange??null,ref);
      if(!w){empty++;continue;}nonempty++;
      const [p0,v]=w.initialWitness.map(q),t=q(w.witnessParameter);let force=Q(0n);
      const {add,sub,mul}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
      for(const [i,y] of ys.entries()){
        if(i){const a=q(law.endpoints[0][i-1]),b=q(law.endpoints[1][i-1]);force=add(force,mul(Q(41n),add(a,mul(t,sub(b,a)))));}
        const e=sub(q(y),add(force,add(p0,mul(Q(41n*BigInt(i)),v))));assert.ok(e.n>=-e.d&&e.n<=e.d);
      }
    }
  }
  assert.ok(nonempty&&empty);
});

test('one fixed interior parameter must explain all measurements',()=>{
  const s=sample();s.noiseBound=0;const p=planRateSegments(s),r=openRateSegments(s,p);
  assert.deepEqual(p.readAt,['0','1','2','3']);
  assert.deepEqual(r.observe([0,0,1]).surviving[0].parameterRange,['2/3','2/3']);
  // The last increment -2 occurs in B at parameter zero, but the preceding
  // command fixed its parameter at 2/3.
  assert.deepEqual(r.observe([0,0,1,-1]).surviving,[]);
  assert.deepEqual(r.observe([0,0,1,'7/3']).surviving[0].parameterRange,['2/3','2/3']);
});
