import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {certifyPhysicalFeedbackTree,verifyPhysicalFeedbackTree,receivePhysicalFeedbackTree}
  from '../src/science/position-drift-physical-feedback.mjs';
import {parseAllHorizonRational as rational} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {parseRatePolytopeSource,receiveChosenRateTape} from '../src/science/position-drift-rate-polytopes.mjs';

const path='examples/active-position-drift-seven-pulse-calibration.json';
const packet='examples/factored-feedback-seven-calibration.jsonl';
const read=path=>JSON.parse(readFileSync(path,'utf8'));

test('all distinct paired placements of one reference into the existing six-pulse leaves',()=>{
  const old=read('examples/active-position-drift-six-ref-ref.json');
  const words=old.program.alternatives.map(child=>[...old.program.commands,...child.commands]);
  const insertions=w=>[...new Map(Array.from({length:w.length+1},(_,i)=>{
    const copy=w.slice();copy.splice(i,0,'ref');return [copy.join(),copy];
  })).values()];
  const [left,right]=words.map(insertions);
  assert.equal(left.length,5);assert.equal(right.length,5);
  const matrix=left.map(a=>right.map(b=>{
    const split=a.findIndex((c,i)=>c!==b[i]);
    const input=read(path);
    input.program={commands:a.slice(0,split),alternatives:[a,b].map(w=>({commands:w.slice(split)}))};
    const proof=certifyPhysicalFeedbackTree(input);
    assert.equal(verifyPhysicalFeedbackTree(input,proof),true);
    return proof.tree.radius;
  }));
  assert.deepEqual(matrix,[
    ['3/50','0','0','0','0'],['0','1/21','1/24','1/24','1/22'],
    ['0','1/22','1/24','1/24','1/22'],['0','1/22','1/24','1/24','1/22'],
    ['0','1/20','1/22','1/22','1/20'],
  ]);
});

test('the physical CLI runs both continuations at the unrestricted six-pulse boundary',()=>{
  const dir=mkdtempSync(join(tmpdir(),'seven-calibration-'));
  try {
    const plan=join(dir,'plan.json'),readings=join(dir,'readings.json');
    const cli=(...args)=>spawnSync(process.execPath,['scripts/active-linear-family.mjs','--input',path,
      '--physical-feedback-tree',...args],{encoding:'utf8'});
    const build=cli('--output',plan);
    assert.equal(build.status,0,build.stderr);
    const proof=read(plan);
    assert.equal(proof.tree.radius,'3/50');
    assert.deepEqual(proof.compact.kept,[0,1]);
    assert.equal(proof.atRequestedNoise,'policy-separates');
    for(const [values,first,law] of [
      [['0','0','0','0','0','1','1','1'],'y0','A'],
      [['0','0','0','0','1','0','1','1'],'z1','B'],
    ]){
      writeFileSync(readings,JSON.stringify(values.slice(0,5)));
      const next=cli('--replay',plan,'--readings',readings,'--two-word-rule');
      assert.equal(next.status,0,next.stderr);assert.equal(JSON.parse(next.stdout).nextCommand,first);
      writeFileSync(readings,JSON.stringify(values));
      const final=cli('--replay',plan,'--readings',readings,'--two-word-rule');
      assert.equal(final.status,0,final.stderr);
      assert.deepEqual(JSON.parse(final.stdout).surviving.map(r=>r.law),[law]);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('the measured rule works under affine shifts, endpoint noise and an exact threshold tie',()=>{
  const s=read(path);
  for(const [radius,den] of [['1/20',100n],['5999999999999999999/100000000000000000000',10n**20n]]){
    s.catalog.noiseBound=radius;
    const cat=parseRatePolytopeSource(s.catalog),eps=rational(radius),e=eps.n*den/eps.d;
    const proof=certifyPhysicalFeedbackTree(s);
    for(const law of s.catalog.laws)for(const vertex of law.vertices){
      let x=10n**40n*den;
      const ys=[],tape=[];
      let last=[];
      for(let t=0;t<=7;t++){
        ys.push(x+(t%2?-e:e));
        if(t===4){
          const score=ys[0]-4n*ys[3]+3n*ys[4];
          last=s.program.alternatives[2n*score<3n*den-2n*e?0:1].commands;
        }
        if(t===7) break;
        const action=t<4?s.program.commands[t]:last[t-4];
        tape.push(action);x+=den*(BigInt(vertex[s.catalog.commands.indexOf(action)])-5n);
      }
      const values=ys.map(v=>String(v)+'/'+String(den));
      const live=receivePhysicalFeedbackTree(s,proof,values,{twoWordRule:true});
      assert.deepEqual(live.commands,tape);
      const out=receiveChosenRateTape(cat,tape,values.map(rational),()=>{});
      assert.deepEqual(out.map(v=>v.law),[law.id]);
    }
  }
  s.catalog.noiseBound='1/20';
  const cat=parseRatePolytopeSource(s.catalog);
  const tieValues=['0','0','0','0','29/60','29/60','29/60','29/30'];
  const tie=tieValues.map(rational),saved=certifyPhysicalFeedbackTree(s);
  assert.equal(receivePhysicalFeedbackTree(s,saved,tieValues.slice(0,5)).nextCommand,'y0');
  assert.equal(receivePhysicalFeedbackTree(s,saved,tieValues.slice(0,5),{twoWordRule:true}).nextCommand,'z1');
  assert.deepEqual(receiveChosenRateTape(cat,[...s.program.commands,...s.program.alternatives[1].commands],
    tie,()=>{}).map(v=>v.law),['A']);
  s.catalog.noiseBound='3/50';
  const boundary=certifyPhysicalFeedbackTree(s);
  assert.equal(verifyPhysicalFeedbackTree(s,boundary),true);
  assert.equal(boundary.atRequestedNoise,'tree-refuted');
  assert.throws(()=>receivePhysicalFeedbackTree(s,boundary,['0']),/no guaranteed separation/);
});

test('the two raw lower row sums give the scalar decision and the physical collision is closed',()=>{
  const code=`
import importlib.util,json,sys
from fractions import Fraction as F

def module(path):
    spec=importlib.util.spec_from_file_location('module',path)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    return m

src=json.load(open(sys.argv[1]))
v=module('scripts/verify-factored-feedback.py')
with open(sys.argv[2]) as f:
    got=v.verify(src,f,emit_policy=True)
assert got['policy']==src and got['lower']==got['upper']=='3/50'
s=module('scripts/design-factored-feedback.py')
lines=[json.loads(z) for z in open(sys.argv[2])]
words=lines[0]['plan']['words']
vs=[law['vertices'] for law in src['catalog']['laws']]
for w,block,sgn in zip(words,lines[1:],(1,-1)):
    w=tuple(w);coords,rows,rhs=s.position_rows([w],vs)
    co=[F(0)]*len(coords);h=F(0)
    for i,q in block['lower']:
        multiplier=50*F(q);h+=multiplier*rhs[i]
        for j,x in rows[i].items():co[j]+=multiplier*x
    actual={key:co[i] for key,i in coords.items() if co[i]}
    assert actual=={'e':-26 if sgn==1 else -24,('y',w[:3]):4*sgn,('y',w[:4]):-3*sgn}
    assert h==(-3 if sgn==1 else 0)
`;
  const run=spawnSync('python3',['-c',code,path,packet],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});
