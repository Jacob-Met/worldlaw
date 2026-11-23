import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planPointSupport,verifyPointSupport,openPointSupport} from '../src/science/position-drift-point-support.mjs';
import {planMinimaxHorizon,MINIMAX_SOURCE} from '../src/science/position-drift-minimax-horizon.mjs';
const fixture=()=>JSON.parse(readFileSync(new URL('../examples/active-position-drift-point-support.json',import.meta.url),'utf8'));

test('the four-command simplex closes the zero-noise gap while every three-command section contains a collision',()=>{
  const req=fixture(),prior=planMinimaxHorizon({schema:MINIMAX_SOURCE,catalog:req.catalog});
  assert.deepEqual([prior.adaptiveLower,prior.pulseUpperBound],['2','4']);
  const p=planPointSupport(req);assert.equal(verifyPointSupport(req,p),true);
  assert.equal(p.minimumPulses,'4');assert.equal(p.subsetsVisited,15);
  assert.deepEqual(p.preceding.map(x=>x.alias.parameters[1]),[['0','0','1'],['0','1','0'],['1','0','0'],['1/3','1/3','1/3']]);
  const r=openPointSupport(req,p);
  assert.deepEqual(r.observe([0,0,'1/3','2/3',1]).surviving.map(s=>s.law),['B']);
  assert.deepEqual(r.observe([0,0,1,2,3]).surviving,[]);
  assert.deepEqual(r.observe([0,0,0,0,0]).surviving.map(s=>s.law),['A']);
  for(const subset of p.preceding){
    const a=r.referenceAdversary(['7/3','-1/5']);
    for(const cmd of [...subset.commands].reverse())a.pulse(cmd);
    a.pulse(subset.commands[1],String(10n**72n));const z=a.collision();
    assert.deepEqual(z.readings[0],z.readings[1]);assert.deepEqual(z.coveredBy,subset.commands);
    assert.throws(()=>a.pulse(req.catalog.commands.find(u=>!subset.commands.includes(u))),/distinct-command/);
    assert.deepEqual(a.collision(),z);
  }
});

test('boundary contact survives and the reference can be the second family with nonidentical rate rows',()=>{
  const req=fixture();req.catalog.laws[0].vertices.push([2,2,2,2]);req.catalog.laws.reverse();
  const p=planPointSupport(req),r=openPointSupport(req,p);
  assert.equal(p.referenceLaw,'A');assert.equal(verifyPointSupport(req,p),true);
  const a=r.referenceAdversary(),prefix=['a','b','c'];prefix.forEach(cmd=>a.pulse(cmd));
  assert.deepEqual(a.collision().parameters,[['1','0'],['0','0','1']]);
  // Drop the fourth command. A boundary vertex of B now matches A globally.
  req.catalog.commands.pop();req.catalog.laws.forEach(l=>l.vertices.forEach(v=>v.pop()));
  const alias=planPointSupport(req);assert.equal(alias.status,'indistinguishable');
  const z=openPointSupport(req,alias).trace('B','A',[{command:'b',repeats:'33'}]);
  assert.deepEqual(z.readings[0],z.readings[1]);
  req.catalog.noiseBound='1/10000000';assert.throws(()=>planPointSupport(req),/zero error/);
  req.catalog.noiseBound=0;req.catalog.laws[1].vertices[1][1]=5;
  assert.throws(()=>planPointSupport(req),/point after/);
});

test('subsets, linear work and physical receiver limits preserve distinct inconclusive outcomes',()=>{
  const req=fixture();
  req.subsetLimit=0;let cut=planPointSupport(req);assert.deepEqual([cut.reason,cut.knownUpper,cut.subsetsVisited],['subsets',null,0]);
  req.subsetLimit=6;cut=planPointSupport(req);
  assert.deepEqual([cut.status,cut.reason,cut.completeThrough,cut.knownUpper],['design-budget-exhausted','subsets',1,'4']);
  assert.throws(()=>openPointSupport(req,cut),/without a minimum/);
  req.subsetLimit=100;req.catalog.limits.designWork=0;cut=planPointSupport(req);
  assert.equal(cut.reason,'linear-work');assert.equal(cut.work,0);
  req.catalog.limits.designWork=80000;req.catalog.limits.receiverWork=0;
  const p=planPointSupport(req),partial=openPointSupport(req,p).observe([0]);
  assert.equal(partial.status,'receiver-budget-exhausted');assert.equal(partial.surviving,null);
});

test('arithmetic verification rejects an incomplete cover, changed persistent member, or forged separator',()=>{
  const req=fixture(),p=planPointSupport(req);
  for(const edit of [x=>x.preceding.pop(),x=>{x.preceding[0]=x.preceding[1];},
    x=>{x.preceding[3].alias.parameters[1]=['1','0','0'];},x=>{x.separator.weights[0]='0';},
    x=>{x.separator.rateBands[1][0]='0';},x=>{x.runs[0].command='c';}]){
    const forged=structuredClone(p);edit(forged);assert.throws(()=>verifyPointSupport(req,forged));
  }
});

test('all 127 nonempty three-element hitting-set instances have adaptive minimum one plus their integer hitting number',()=>{
  for(let instance=1;instance<128;instance++){
    const edges=Array.from({length:7},(_,i)=>i+1).filter(e=>instance&(1<<(e-1)));
    const req=fixture();req.catalog.commands=['ref','x','y','z'];
    req.catalog.laws[1].vertices=[...edges,7].map(e=>[0,...[0,1,2].map(i=>(e>>i)&1)]);
    let hitting=3;
    for(let mask=1;mask<8;mask++)if(edges.every(e=>e&mask)){
      const size=[0,1,2].filter(i=>mask&(1<<i)).length;hitting=Math.min(hitting,size);
    }
    const plan=planPointSupport(req);assert.equal(plan.minimumPulses,String(1+hitting));
    assert.ok(plan.separator.commands.includes('ref'));assert.equal(verifyPointSupport(req,plan),true);
  }
});
