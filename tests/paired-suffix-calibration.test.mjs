import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {certifyPairedSuffix as plan,verifyPairedSuffix as verify,receivePairedSuffix as receive} from '../src/science/position-drift-paired-suffix.mjs';

const source=JSON.parse(readFileSync('examples/active-position-drift-paired-suffix.json','utf8'));
test('the measured sixth-tick cutoff selects both branches and uses a persistent fit',()=>{
  const p=plan(source);
  assert.equal(p.radius,'1/14');
  assert.deepEqual(p.readAt,['0','4','5','6','7','8']);
  assert.equal(receive(source,p,['0','0','0']).nextRun.command,'x0');
  const prefix=(y)=>['0','0','1/4',y];
  assert.equal(receive(source,p,prefix('499999999999999999/1000000000000000000')).nextRun.command,'y0');
  const tie=receive(source,p,prefix('1/2'));
  assert.equal(tie.score,'2');
  assert.equal(tie.nextRun.command,'z1');
  for(const [values,id] of [[['0','0','0','0','1','1'],'A'],[['0','0','0','1','1','0'],'B']]){
    assert.deepEqual(receive(source,p,values).surviving.map(x=>x.law),[id]);
  }
  const impossible=receive(source,p,['0','0','100']);
  assert.deepEqual(impossible.surviving,[]);assert.equal(impossible.nextRun,null);
});
test('source roles, rational boundaries, budget outcomes and compact large counts',()=>{
  for(const [m,radius] of [['1','1/32'],['2','1/20'],['3','1/16'],['4','1/14'],['5','5/64']]){
    const req=structuredClone(source);req.references=m;req.catalog.noiseBound=radius;
    const p=plan(req);assert.equal(p.radius,radius);assert.equal(p.atRequestedNoise,'closed-collision');
    assert.deepEqual(p.boundary.branches[0].readings.slice(0,4),p.boundary.branches[1].readings.slice(0,4));
    assert.throws(()=>receive(req,p,['0']),/strict policy/);
  }
  const req=structuredClone(source);req.references=(10n**120n+3n).toString();
  req.catalog.laws.reverse();for(const law of req.catalog.laws)law.vertices.reverse();
  const p=plan(req);assert.equal(p.horizon,String(BigInt(req.references)+4n));
  assert.deepEqual(p.boundary.worlds.map(w=>w.law),['A','B']);
  assert.equal(p.boundary.reference.through,req.references);
  assert.equal(p.boundary.branches[0].readings.length,6);
  const bad=structuredClone(p);bad.boundary.worlds[0].drift='0';assert.throws(()=>verify(req,bad),/differ/);
  const transformed=structuredClone(source);transformed.catalog.laws[0].vertices.push([0,0,0,0,1,0,0,0]);
  assert.throws(()=>plan(transformed),/paired-suffix rate identity/);
  const tiny=structuredClone(source);tiny.catalog.limits.designWork=1;
  assert.equal(plan(tiny).status,'design-budget-exhausted');
});
