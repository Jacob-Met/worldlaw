import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {certifyPhysicalFeedbackTree,verifyPhysicalFeedbackTree,receivePhysicalFeedbackTree}
  from '../src/science/position-drift-physical-feedback.mjs';

const source='examples/active-position-drift-six-pulse-tree.json';
const proof='examples/factored-feedback-six-ref-ref.jsonl';
const sparse='examples/active-position-drift-six-ref-ref.json';

test('raw replay of the full ref/ref menu extracts the published two-word policy',()=>{
  const code=`
import importlib.util, json, sys
s=importlib.util.spec_from_file_location('receiver','scripts/verify-factored-feedback.py')
m=importlib.util.module_from_spec(s)
s.loader.exec_module(m)
with open(sys.argv[2]) as f:
    result=m.verify(json.load(open(sys.argv[1])),f,True,['ref','ref'],6,True)
assert result.pop('policy')==json.load(open(sys.argv[3]))
print(json.dumps(result))
`;
  const run=spawnSync('python3',['-c',code,source,proof,sparse],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout),{status:'exact',lower:'1/20',upper:'1/20',blocks:512,
    terminalPairs:4096,physicalWorlds:8192,retainedWords:2});
});

test('both measured branches separate near 1/20, including exact equality refusal',()=>{
  const input=JSON.parse(readFileSync(sparse,'utf8'));
  const d=10n**80n;
  input.catalog.noiseBound=String(d/20n-1n)+'/'+String(d);
  const saved=certifyPhysicalFeedbackTree(input);
  assert.equal(saved.tree.radius,'1/20');
  assert.equal(verifyPhysicalFeedbackTree(input,saved),true);
  const branches=new Set();
  for(const law of input.catalog.laws)for(const vertex of law.vertices){
    let position=10n**40n+7n;
    const readings=[];
    for(let t=0;t<=6;t++){
      const e=(t%2?-1n:1n)*(d/20n-1n);
      readings.push(String(d*position+e)+'/'+String(d));
      const state=receivePhysicalFeedbackTree(input,saved,readings);
      if(t===6){
        assert.deepEqual(state.surviving.map(row=>row.law),[law.id]);
        branches.add(state.commands.slice(3).join(','));
      }else{
        const action=input.catalog.commands.indexOf(state.nextCommand);
        assert.ok(action>=0);position+=BigInt(vertex[action])-5n;
      }
    }
  }
  assert.deepEqual([...branches].sort(),['y0,x0,z0','z1,x1,y1']);
  input.catalog.noiseBound='1/20';
  const boundary=certifyPhysicalFeedbackTree(input);
  assert.equal(verifyPhysicalFeedbackTree(input,boundary),true);
  assert.notEqual(boundary.atRequestedNoise,'policy-separates');
  assert.throws(()=>receivePhysicalFeedbackTree(input,boundary,['0']),/no guaranteed separation/);
  // All values below are twentieths. The two worlds on each word use one start
  // and one constant mixture. Both counterfactual words share the first four readings.
  for(const [i,observed] of [[0,[0,0,-2,6,8,10,8]],[1,[0,0,-2,6,3,8,8]]]){
    for(const world of boundary.tree.worlds[i]){
      world.positions.forEach((q,t)=>{
        const [a,b='1']=q.split('/');
        const delta=20n*BigInt(a)-BigInt(observed[t])*BigInt(b);
        assert.ok(delta>=-BigInt(b)&&delta<=BigInt(b));
      });
    }
  }
});

test('lift rejects a missing branch and changed rational mixtures give persistent physical worlds',()=>{
  const code=`
from fractions import Fraction as Q
from itertools import product
from pathlib import Path
import importlib.util,json

def load(path):
    spec=importlib.util.spec_from_file_location('module',path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

s=load('scripts/design-factored-feedback.py')
v=load('scripts/verify-factored-feedback.py')
src=json.loads(Path('examples/active-position-drift-six-pulse-tree.json').read_text())
seed=s.read_seed(src,Path('examples/factored-feedback-six.jsonl'),v)
vs=[law['vertices'] for law in src['catalog']['laws']]
ps=sorted({w[:5] for w in seed})
words=lambda p:[p+(i,) for i in range(8)]
anc=sorted({p[:t] for p in ps for t in range(2,5)})
outer={('y',w):i+1 for i,w in enumerate(anc)}
outer['e']=0
assert len(s.lift_seed(seed,words,ps,5,vs,outer))==2
try:
    s.lift_seed(seed,words,ps[:1],5,vs,outer)
except ValueError:
    pass
else:
    raise AssertionError('accepted a seed outside the target')
vs=[[[1,4,-1],[2,0,3]],[[-1,4,2],[3,2,-1]]]
for n in (3,4,5):
    upper,rates,masses=s.fixed_mixture_bound(vs,[['2/3','1/3'],['1/5','4/5']],n)
    for w in product(range(3),repeat=n):
        for l,(x,v,*mu) in enumerate(s.midpoint_worlds(w,rates,masses)):
            assert list(map(Q,mu))==masses[l][:-1]
            x,v=Q(x),Q(v)
            for t in range(n+1):
                y=s.midpoint_reading(w[:t],rates) if t else Q(0)
                assert abs(x-y)<=upper
                if t<n: x+=v+rates[l][w[t]]
`;
  const run=spawnSync('python3',['-c',code],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});
