import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {planRatePolytopes,openRatePolytopes} from '../src/science/position-drift-rate-polytopes.mjs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {GUIDED_INPUT,pendingDriftSteps} from '../src/science/active-guided-drift.mjs';
const {add,sub,mul,Z,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-rate-simplex.json',import.meta.url),'utf8'));
const restrict=(s,ids)=>({...s,commands:ids.map(i=>s.commands[i]),laws:s.laws.map(l=>({...l,vertices:l.vertices.map(row=>ids.map(i=>row[i]))}))});

test('every three-command menu aliases; the fourth command separates the complete triangle',()=>{
  const s=fixture();
  for(let omitted=0;omitted<4;omitted++){
    const sub=restrict(s,[0,1,2,3].filter(i=>i!==omitted)),p=planRatePolytopes(sub);
    assert.equal(p.status,'indistinguishable');
    const b=p.aliases[0].parameters[1];if(!omitted)assert.deepEqual(b,['1/3','1/3','1/3']);
    const r=openRatePolytopes(sub,p),runs=sub.commands.map(command=>({command,repeats:'91'}));
    const trace=r.trace('B','A',runs,['-7/9','5/4']);assert.deepEqual(trace.readings[0],trace.readings[1]);
    assert.deepEqual(r.replay(trace),trace);
  }
  const p=planRatePolytopes(s);assert.deepEqual(p.readAt,['0','17','34','51','68']);
  assert.equal(p.certificates[0].unitGap,'1');assert.equal(p.certificates[0].noiseRadius,'8');
  // At n=16 midpoint errors are all ≤1 using A=(-2,1/4), B=(0,0) with uniform weights.
  const common=['-1','1','17/3','31/3','15'].map(q);
  for(let i=0;i<=4;i++){
    const a=add(q(-2),mul(q(16*i),q('1/4'))),b=mul(q(Math.max(0,i-1)*16),q('1/3'));
    for(const x of [a,b]){const e=sub(x,common[i]);assert.ok(e.n>=-e.d&&e.n<=e.d);}
  }
  const full=openRatePolytopes(s,p).observe([0,0,'17/3','34/3',17]);assert.deepEqual(full.surviving.map(x=>x.law),['B']);
});

test('rational Farkas multipliers recover the correct interior barycentric alias',()=>{
  const s=restrict(fixture(),[0,1,2]);
  s.laws[1].vertices=[[0,'1/2',0],[0,0,'1/3'],[0,'-1/5','-1/7']];
  const p=planRatePolytopes(s);assert.deepEqual(p.aliases[0].parameters,[['1'],['7/32','15/64','35/64']]);
  const r=openRatePolytopes(s,p),trace=r.trace('A','B',[{command:'b',repeats:String(10n**103n)}]);
  trace.parameters[1][0]='1';assert.throws(()=>r.replay(trace),/differs/);
  assert.deepEqual(r.trace('A','B',[]).parameters,p.aliases[0].parameters);
});

test('the preserved joint region enforces a single mixture and start through every reading',()=>{
  const s=fixture();s.noiseBound=0;const p=planRatePolytopes(s),r=openRatePolytopes(s,p);
  const partial=r.observe([0,0,'1/3']),family=partial.surviving.find(w=>w.law==='B');
  const allows=(region,point)=>region.inequalities.every(row=>{
    const val=row.coefficients.reduce((a,c,i)=>add(a,mul(q(c),q(point[i]))),Z());return sub(val,q(row.upper)).n<=0n;
  });
  // Coordinate order is weight0, weight1, position, drift; weight2 is one minus the weight sum.
  assert.ok(allows(family.jointRegion,['1/3','0',0,0]));
  assert.ok(allows(family.jointRegion,['1/3','2/3',0,0]));
  assert.ok(!allows(family.jointRegion,['1/3','3/4',0,0]));
  assert.ok(!allows(family.jointRegion,['1/3','1/3',0,1]));
  const record=r.observe([0,0,'1/3','2/3',1]);assert.deepEqual(record.surviving[0].weightWitness,['1/3','1/3','1/3']);
  assert.deepEqual(r.observe([0,0,1,2,3]).surviving,[]);
  const altered=structuredClone(record);altered.surviving[0].jointRegion.inequalities.pop();assert.throws(()=>r.replay(altered),/differs/);
});

test('independent polygon axes agree on changed, singular and duplicate input vertices',()=>{
  let seed=11293;const draw=n=>{seed=seed*48271%2147483647;return seed%n;};
  let touching=0,separate=0;
  for(let n=0;n<180;n++){
    const s=restrict(fixture(),[0,1,2]),v=s.laws.map(()=>Array.from({length:1+draw(5)},()=>[draw(9)-4,draw(9)-4]));
    s.laws.forEach((l,i)=>{l.vertices=v[i].map(([x,y])=>[0,x,y]);});
    // All hull edge normals occur among these pair normals. x and y also handle collinear segments and points.
    const directions=[[1,0],[0,1]];
    for(const points of v)for(let j=1;j<points.length;j++)for(let i=0;i<j;i++)
      directions.push([points[j][1]-points[i][1],points[i][0]-points[j][0]]);
    const disjoint=directions.some(([a,b])=>{
      const [l,r]=v.map(points=>points.map(([x,y])=>a*x+b*y));
      return Math.max(...l)<Math.min(...r)||Math.max(...r)<Math.min(...l);
    });
    const p=planRatePolytopes(s);assert.equal(p.status,disjoint?'finite-schedule':'indistinguishable');
    if(disjoint)separate++;else touching++;
  }
  assert.ok(touching&&separate);
});

test('budget outcomes preserve the distinction between unmeasured and physically empty',async()=>{
  const s=fixture(),full=planRatePolytopes(s);s.limits.designWork=full.work-1;
  const cut=planRatePolytopes(s);assert.equal(cut.status,'design-budget-exhausted');assert.equal(cut.work,full.work-1);
  assert.throws(()=>openRatePolytopes(s,cut),/without a complete/);
  s.limits.designWork=full.work;s.limits.receiverWork=0;
  let book=await createActiveNotebook(JSON.stringify(s));
  const input={schema:GUIDED_INPUT,sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    previousReadingsSHA256:null,source:'Synthetic exhausted receiving budget',acquisition:'synthetic',
    readings:[{tick:'0',command:null,value:'0'}]};
  book=await receiveActiveNotebook(book,JSON.stringify(input));const result=book.readouts[0].result;
  assert.equal(result.status,'receiver_budget_exhausted');assert.equal(result.consistentHypothesisIds,null);
  assert.equal(result.checked.surviving,null);assert.deepEqual(result.checked.values,['0']);
  assert.deepEqual(pendingDriftSteps(book.plan,result),[]);assert.deepEqual(await replayActiveNotebook(JSON.stringify(book)),book);
});
