import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {intersectFeedbackHalfspaces} from '../src/science/exact-feedback-feasibility.mjs';
import {primitiveRateInequality} from '../src/science/position-drift-rate-polytopes.mjs';
import {planThreePulseHulls,receiveThreePulseHulls,replayThreePulseHulls} from '../src/science/position-drift-three-pulse-hulls.mjs';
const {Q,Z,add,sub,mul,neg,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n),fixture=()=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-adaptive-hulls.json',import.meta.url),'utf8'));
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;

test('a measured third pulse beats every fixed triple for two nonpoint families',()=>{
  const req=fixture(),p=planThreePulseHulls(req);assert.equal(p.status,'three-certified');
  assert.equal(p.minimumPulses,'3');assert.equal(p.fixedMinimum,'4');assert.deepEqual(p.prefix,['ref','x']);
  assert.deepEqual(p.unsafe,[['-1/6','7/6'],['-1/6','7/6'],['7/12','7/6'],['-1/6','5/12']]);
  assert.ok(p.trials.every(t=>t.unsafe.every(Boolean)));assert.equal(p.trials.filter(t=>!t.trap).length,1);
  assert.equal(p.fixedControl.status,'separates');
  for(const [s,last] of [['5/12','y'],['7/12','z'],['1/2','y']])assert.equal(receiveThreePulseHulls(p,[0,0,s]).nextCommand,last);
  for(const noise of ['0','1/10000000','499999999999/10000000000000']){
    req.catalog.noiseBound=noise;const a=planThreePulseHulls(req);assert.equal(a.minimumPulses,'3');assert.equal(a.fixedMinimum,'4');
  }
});

test('every closed-threshold refusal replays shared ancestors and separate physical final observations',()=>{
  const req=fixture();req.catalog.noiseBound='1/20';const p=planThreePulseHulls(req),s=req.catalog;
  assert.equal(p.status,'three-refuted');assert.equal(p.minimumPulses,'4');assert.equal(p.fixedMinimum,'4');assert.equal(p.trials.length,16);
  const trial=p.trials.find(t=>t.prefix.join(',')==='ref,x');assert.deepEqual(trial.trap,['1/2','1/2']);
  assert.ok(new Set(trial.collision.branches.map(b=>b.reading)).size>1);
  let checked=0;
  for(const t of p.trials){
    const shared=t.collision.prefixReadings;assert.deepEqual(shared.slice(0,2),['0','0']);
    assert.deepEqual(t.collision.branches.map(b=>b.command),s.commands);
    for(const b of t.collision.branches)for(const w of b.worlds){
      const law=s.laws.find(l=>l.id===w.law),weights=w.weights.map(q);
      assert.equal(fmt(weights.reduce(add,Z())),'1');assert.ok(weights.every(x=>x.n>=0n));
      const [start,drift]=w.start.map(q),positions=[start];
      for(const u of [...t.prefix,b.command]){
        const i=s.commands.indexOf(u),rate=weights.reduce((a,x,j)=>add(a,mul(x,q(law.vertices[j][i]))),Z());
        positions.push(add(positions.at(-1),add(drift,rate)));
      }
      assert.deepEqual(positions.map(fmt),w.positions);[...shared,b.reading].forEach((y,i)=>{
        const e=sub(positions[i],q(y));assert.ok(cmp(e,q('1/20'))<=0&&cmp(e,q('-1/20'))>=0);
      });checked++;
    }
  }
  assert.equal(checked,128);const forged=structuredClone(p);forged.trials[0].collision.branches[0].worlds[0].start[0]='999';
  assert.throws(()=>replayThreePulseHulls(req,forged),/differs/);
  req.catalog.noiseBound='1/16';const wider=planThreePulseHulls(req);assert.equal(wider.status,'three-refuted');
  assert.equal(wider.fixedControl.status,'collision');assert.equal(wider.minimumPulses,null);
});

test('all error corners and changed mixtures use only retained readings for the last command',()=>{
  const req=fixture(),p=planThreePulseHulls(req),s=req.catalog,eps=q(s.noiseBound);
  for(const law of s.laws)for(const theta of ['0','1/3','1/2','1'])for(let mask=0;mask<16;mask++){
    const t=q(theta),rates=law.vertices[0].map((v,i)=>add(q(v),mul(t,sub(q(law.vertices[1][i]),q(v)))));
    const move=(pos,u)=>add(pos,add(q('-13/17'),rates[s.commands.indexOf(u)]));
    const noisy=(pos,k)=>fmt(add(pos,(mask>>k)&1?eps:neg(eps)));
    let pos=q('10000000000000000000000001/7');const ys=[noisy(pos,0)];
    for(const u of p.prefix){pos=move(pos,u);ys.push(noisy(pos,ys.length));}
    const prefix=receiveThreePulseHulls(p,ys);assert.ok(prefix.nextCommand);
    pos=move(pos,prefix.nextCommand);ys.push(noisy(pos,3));const result=receiveThreePulseHulls(p,ys);
    const member=result.surviving[0];assert.equal(result.surviving.length,1);assert.equal(member.law,law.id);
    assert.equal(result.commands[2],prefix.nextCommand);assert.ok(member.jointRegion.inequalities.length);
  }
  req.catalog.limits.designWork=0;assert.equal(planThreePulseHulls(req).status,'design-budget-exhausted');
  req.catalog.limits.designWork=1000000;req.catalog.limits.receiverWork=0;
  const limited=planThreePulseHulls(req);assert.equal(receiveThreePulseHulls(limited,[0]).status,'receiver-budget-exhausted');
  req.catalog.limits.receiverWork=1000;req.catalog.laws[0].vertices=[[0,0,0,0]];req.catalog.laws[1].vertices=[[0,3,3,3]];
  assert.equal(planThreePulseHulls(req).status,'two-certified');
});

// Independent raw model: for a fixed observed third position, each world's
// separate initial position, drift, and persistent line parameter are unknown.
// The fourth reading is one shared variable; the other three readings are pinned.
function rawOverlap(s,commands,z){
  const width=7,rows=[],eps=q(s.noiseBound),zeros=()=>Array.from({length:width},Z);
  for(let law=0;law<2;law++){
    const base=3*law,lower=zeros(),upper=zeros();lower[base]=neg(one);upper[base]=one;
    rows.push(primitiveRateInequality(lower,Z()),primitiveRateInequality(upper,one));
    let force=Z(),slope=Z();
    for(let t=0;t<=3;t++){
      if(t){const j=s.commands.indexOf(commands[t-1]),v=s.laws[law].vertices;
        force=add(force,q(v[0][j]));slope=add(slope,sub(q(v[1][j]),q(v[0][j])));}
      const a=zeros();a[base]=slope;a[base+1]=one;a[base+2]=Q(BigInt(t));if(t===3)a[6]=neg(one);
      const value=t===2?z:Z(),b=sub(value,force);
      rows.push(primitiveRateInequality(a,add(b,eps)),primitiveRateInequality(a.map(neg),sub(eps,b)));
    }
  }
  return !!intersectFeedbackHalfspaces(rows,width,()=>{}).point;
}
test('projected unsafe bands match independent physical feasibility on changed catalogs and boundary contacts',()=>{
  let seed=88217;const draw=n=>{seed=seed*48271%2147483647;return seed%n;};
  for(let trial=0;trial<16;trial++){
    const req=fixture(),s=req.catalog;s.commands=['u','v','w'];s.noiseBound=['0','1/4','1/7'][trial%3];req.fourPulseControl=null;
    s.laws.forEach(l=>{l.vertices=Array.from({length:2},()=>s.commands.map(()=>draw(9)-4));});
    const plan=planThreePulseHulls(req),t=plan.trials[(trial*5)%9];
    for(let b=0;b<3;b++){
      const interval=t.unsafe[b]?.map(q),word=[...t.prefix,s.commands[b]];
      const probes=interval?[interval[0],interval[1],sub(interval[0],q('1/100')),add(interval[1],q('1/100'))]:[q('-1/3'),q('0'),q('4/3')];
      for(const z of probes){const predicted=!!interval&&cmp(interval[0],z)<=0&&cmp(z,interval[1])<=0;
        assert.equal(rawOverlap(s,word,z),predicted);}
    }
  }
});
