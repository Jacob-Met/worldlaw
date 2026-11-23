import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {planMinimaxHorizon,openMinimaxHorizon} from '../src/science/position-drift-minimax-horizon.mjs';
import {planRatePolytopes} from '../src/science/position-drift-rate-polytopes.mjs';
const {Q,Z,add,sub,mul,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-minimax-simplex.json',import.meta.url),'utf8'));
const abs=x=>x.n<0n?Q(-x.n,x.d):x;
const check=(ok)=>assert.ok(ok);

test('the simplex adaptive minimum is 49, with a strict closed-noise certificate',()=>{
  const req=fixture(),p=planMinimaxHorizon(req),r=openMinimaxHorizon(req,p);
  assert.equal(planRatePolytopes(req.catalog).pulseUpperBound,'68');
  assert.equal(p.status,'minimum-certified');assert.equal(p.adaptiveLower,'49');assert.equal(p.pulseUpperBound,'49');
  assert.equal(p.equilibrium.gap,'1/3');assert.equal(p.previousDistance,'2');assert.equal(p.margin,'4/49');
  assert.deepEqual(p.runs.map(r=>r.repeats),['25','8','8','8']);
  assert.deepEqual(p.chordIntervals,[['-2','2'],['-298/49','-102/49']]);
  assert.deepEqual(r.observe([0,0,'8/3','16/3','8']).surviving.map(w=>w.law),['B']);
  // Every complete checkpoint error corner is admitted by its generating state and mixture.
  for(let family=0;family<2;family++)for(let mask=0;mask<32;mask++){
    const clean=family?[0,0,0,8,8]:[0,0,0,0,0],ys=clean.map((z,i)=>z+((mask&(1<<i))?1:-1));
    assert.deepEqual(r.observe(ys).surviving.map(w=>w.law),[req.catalog.laws[family].id]);
  }
});

test('the midpoint replies are causal and one physical hardest pair fits a changed 48-pulse course',()=>{
  const req=fixture(),p=planMinimaxHorizon(req),r=openMinimaxHorizon(req,p),cat=req.catalog;
  for(let seed=0;seed<30;seed++){
    const a=r.midpointAdversary();let latest=q(a.initialReading);
    for(let i=0;i<48;i++){
      const choice=Number((latest.n+BigInt(3*i+seed))%4n);
      latest=q(a.pulse(cat.commands[choice]));
    }
    assert.throws(()=>a.pulse('a'),/exceeds/);
    const z=a.collision();
    for(let law=0;law<2;law++){
      const [start,drift]=z.starts[law].map(q),rates=p.equilibrium.hardestRates[law].map(q);
      let position=start;
      for(let t=0;t<z.readings.length;t++){
        if(t)position=add(position,add(drift,rates[cat.commands.indexOf(z.runs[t-1].command)]));
        const err=abs(sub(position,q(z.readings[t])));check(err.n<=err.d);
      }
    }
  }
});

test('integer block restrictions, aliases and work exhaustion have different outcomes',()=>{
  const req=fixture();req.catalog.noiseBound=0;
  const bound=planMinimaxHorizon(req);assert.equal(bound.status,'horizon-bounded');
  assert.deepEqual([bound.adaptiveLower,bound.pulseUpperBound],['2','4']);
  req.catalog.commands.shift();req.catalog.laws.forEach(l=>l.vertices.forEach(row=>row.shift()));
  const p=planMinimaxHorizon(req);assert.equal(p.status,'indistinguishable');assert.equal(p.equilibrium.gap,'0');
  const r=openMinimaxHorizon(req,p),z=r.trace('A','B',[{command:'b',repeats:'1331'}]);
  assert.deepEqual(z.parameters,[['1'],['1/3','1/3','1/3']]);assert.deepEqual(z.readings[0],z.readings[1]);
  req.catalog.limits.designWork=0;assert.equal(planMinimaxHorizon(req).status,'design-budget-exhausted');
  const large=fixture();large.catalog.noiseBound=String(10n**70n);
  const h=planMinimaxHorizon(large);
  assert.equal(h.equilibrium.gap,'1/3');assert.equal(h.pulseUpperBound,String(48n*10n**70n+1n));
  assert.equal(h.status,'minimum-certified');assert.equal(h.runs.length,4);
});

// Independent three-command geometry. In quotient coordinates the oscillation is
// max(0,x,y)−min(0,x,y), linear in the six cones cut by x=0, y=0, x=y.
// A positive minimum over the difference polygon occurs on its boundary.
function planarGap(A,B){
  const v=A.flatMap(a=>B.map(b=>[1,2].map(i=>(a[i]-a[0])-(b[i]-b[0])))),cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  for(let k=2;k<v.length;k++)for(let j=1;j<k;j++)for(let i=0;i<j;i++){
    const signs=[cross(v[i],v[j]),cross(v[j],v[k]),cross(v[k],v[i])];
    if(signs.some(x=>x!==0)&&(signs.every(x=>x>=0)||signs.every(x=>x<=0)))return '0';
  }
  let best;
  function candidate(x,y,d){
    if(d<0){x=-x;y=-y;d=-d;}
    const gap=Q(BigInt(Math.max(0,x,y)-Math.min(0,x,y)),BigInt(d));
    if(!best||gap.n*best.d<best.n*gap.d)best=gap;
  }
  for(const [x,y] of v)candidate(x,y,1);
  for(let j=1;j<v.length;j++)for(let i=0;i<j;i++){
    const [a,b]=[v[i],v[j]];
    for(const form of [p=>p[0],p=>p[1],p=>p[0]-p[1]]){
      const u=form(a),w=form(b);if(u*w>0||u===w)continue;
      candidate(u*b[0]-w*a[0],u*b[1]-w*a[1],u-w);
    }
  }
  return fmt(best);
}

test('exact saddle gaps agree with independent polygon and norm-cone intersections',()=>{
  let seed=50237;const draw=n=>{seed=seed*48271%2147483647;return seed%n;};
  const kinds=new Set();
  for(let trial=0;trial<80;trial++){
    const req=fixture(),s=req.catalog;s.commands=['a','b','c'];s.noiseBound=1+draw(3);
    s.laws.forEach(l=>{l.vertices=Array.from({length:1+draw(3)},()=>s.commands.map(()=>draw(9)-4));});
    const p=planMinimaxHorizon(req);assert.equal(p.equilibrium.gap,planarGap(...s.laws.map(l=>l.vertices)));
    kinds.add(p.status);
    if(p.status==='indistinguishable')continue;
    const r=openMinimaxHorizon(req,p);
    for(const law of s.laws){
      const rates=s.commands.map((_,i)=>Q(BigInt(law.vertices.reduce((t,v)=>t+v[i],0)),BigInt(law.vertices.length)));
      let pos=q('1/5');const ys=[fmt(pos)];
      for(const run of p.runs){pos=add(pos,mul(q(run.repeats),add(q('-2/7'),rates[s.commands.indexOf(run.command)])));ys.push(fmt(pos));}
      assert.deepEqual(r.observe(ys).surviving.map(w=>w.law),[law.id]);
    }
  }
  assert.deepEqual([...kinds].sort(),['horizon-bounded','indistinguishable','minimum-certified']);
});
