import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPointCuts,verifyPointCuts,openPointCuts} from '../src/science/position-drift-point-cuts.mjs';
import {SUPPORT_SOURCE,planPointSupport} from '../src/science/position-drift-point-support.mjs';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {parseAllHorizonRational as q} from '../src/science/persistent-position-drift-all-horizon.mjs';
const {Q,Z,add,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const sample=()=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-disagreement-cuts.json',import.meta.url),'utf8'));
function skewed(n){
  const req=sample(),s=req.catalog;s.commands=Array.from({length:n},(_,i)=>i?'u'+i:'ref');
  s.laws[0].vertices=[s.commands.map(()=>0)];
  s.laws[1].vertices=s.commands.slice(1).map((_,j)=>s.commands.map((_,i)=>i===j+1?i:0));return req;
}

test('two physical candidate checks close the skewed simplex at 12, 15 and 24 commands',()=>{
  for(const n of [12,15,24]){
    const req=skewed(n),p=planPointCuts(req);assert.equal(p.minimumPulses,String(n));assert.equal(p.candidatesTested,2);
    assert.deepEqual(p.history.map(h=>h.result),['affine-alias','affine-separator']);
    assert.equal(p.cuts.length,n);assert.equal(p.lowerProof.packing.length,n);assert.equal(verifyPointCuts(req,p),true);
    const cut=p.cuts.find(x=>x.disagreements.length===1&&x.disagreements[0]===0);
    const harmonic=Array.from({length:n-1},(_,j)=>Q(1n,BigInt(j+1))).reduce(add,Z());
    assert.deepEqual(cut.alias.parameters[1],Array.from({length:n-1},(_,j)=>fmt(div(Q(1n,BigInt(j+1)),harmonic))));
    const r=openPointCuts(req,p);const zero=r.observe(Array(n+1).fill(0));
    assert.deepEqual(zero.surviving.map(w=>w.law),['A']);assert.ok(zero.work<2000);
    const competitor=r.observe([0,0,...Array(n-1).fill(1)]);assert.deepEqual(competitor.surviving.map(w=>w.law),['B']);
    assert.equal(competitor.surviving[0].jointRegion.weightCoordinates,n-2);
    const adv=r.referenceAdversary(['7/9','-2/11']);
    req.catalog.commands.slice(1).reverse().forEach(cmd=>adv.pulse(cmd));
    adv.pulse('u1',String(10n**68n));const z=adv.collision();assert.deepEqual(z.readings[0],z.readings[1]);
    assert.deepEqual(z.parameters[1],cut.alias.parameters[1]);assert.throws(()=>adv.pulse('ref'),/distinct-command/);
  }
});

test('convex fallback handles affine-dependent separation and a nonnegative alternative to a negative particular mixture',()=>{
  const req=sample(),s=req.catalog;s.commands=['ref','b'];s.laws=[{id:'A',vertices:[[0,0]]},{id:'B',vertices:[[0,1],[0,2]]}];
  const p=planPointCuts(req);assert.equal(p.minimumPulses,'2');assert.equal(p.history[0].result,'convex-separator');
  assert.equal(verifyPointCuts(req,p),true);
  s.laws[1].vertices.push([0,-1]);const alias=planPointCuts(req);assert.equal(alias.status,'indistinguishable');
  const r=openPointCuts(req,alias);const z=r.trace('A','B',[{command:'b',repeats:'5'}]);assert.deepEqual(z.readings[0],z.readings[1]);
  s.laws[0].vertices=[[0,-3]];const selected=planPointCuts(req);
  const out=openPointCuts(req,selected).observe([0,0,2]);
  // The first nonnegative-only solution for this extreme observation puts all mass on vertex two.
  assert.deepEqual(out.surviving.map(w=>w.law),['B']);assert.deepEqual(out.surviving[0].weightWitness,['0','1','0']);
});

test('integer branching covers a nonpacking lower bound and refuses altered branch and physical witnesses',()=>{
  const req=sample();req.catalog.commands=['ref','x','y','z'];req.catalog.laws=[
    {id:'A',vertices:[[0,0,0,0]]},{id:'B',vertices:[[0,1,1,0],[0,0,1,1],[0,1,0,1],[0,1,1,1]]}];
  const p=planPointCuts(req);assert.equal(p.minimumPulses,'3');assert.ok(p.lowerProof.children);assert.equal(verifyPointCuts(req,p),true);
  for(const edit of [x=>x.lowerProof.children.pop(),x=>{x.lowerProof={packing:[0,0,0]};},x=>{x.cuts[0].disagreements=[];},
      x=>{x.cuts[0].alias.driftShift='19';},x=>{x.separator.weights[0]='900';}]){
    const altered=structuredClone(p);edit(altered);assert.throws(()=>verifyPointCuts(req,altered));
  }
});

test('candidate, hitting, linear and physical limits remain distinguishable',()=>{
  for(const [where,reason] of [['candidateLimit','candidates'],['hittingWork','hitting-work'],['designWork','linear-work']]){
    const req=sample();if(where==='designWork')req.catalog.limits.designWork=0;else req[where]=where==='candidateLimit'?1:0;
    const p=planPointCuts(req);assert.equal(p.status,'design-budget-exhausted');assert.equal(p.reason,reason);
    if(where==='candidateLimit'){assert.equal(p.provedLower,'14');assert.equal(p.history[0].result,'affine-alias');}
    assert.throws(()=>openPointCuts(req,p),/without a minimum/);
  }
  const req=sample();req.catalog.limits.receiverWork=0;const p=planPointCuts(req);
  const z=openPointCuts(req,p).observe([0]);assert.equal(z.status,'receiver-budget-exhausted');assert.equal(z.surviving,null);
});

test('changed small catalogs match the historical complete subset solver',()=>{
  let seed=77257;const draw=n=>{seed=seed*48271%2147483647;return seed%n;};let finite=0,aliases=0;
  for(let n=0;n<96;n++){
    const req=sample(),s=req.catalog;s.commands=Array.from({length:2+draw(4)},(_,i)=>'c'+i);
    const a=s.commands.map(()=>draw(7)-3);s.laws[0].vertices=[a,a.map(v=>v+3)];
    s.laws[1].vertices=Array.from({length:1+draw(4)},()=>s.commands.map(()=>draw(7)-3));
    if(n%9===0)s.laws[1].vertices[0]=a.map(v=>v+2);
    const p=planPointCuts(req),old=planPointSupport({schema:SUPPORT_SOURCE,catalog:s,subsetLimit:64});
    assert.equal(p.status,old.status);
    if(p.status==='indistinguishable'){aliases++;continue;}
    assert.equal(p.minimumPulses,old.minimumPulses);assert.equal(verifyPointCuts(req,p),true);finite++;
  }
  assert.ok(finite&&aliases);
});
