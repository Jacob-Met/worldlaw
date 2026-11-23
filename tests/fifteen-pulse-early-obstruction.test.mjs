import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyFixedTapeOptimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const script='scripts/verify-fifteen-pulse-early-obstruction.py';
const source='examples/active-position-drift-fifteen-pulse-upper.json';
const packet='examples/fifteen-pulse-early-obstruction.json';
test('all fifteen-pulse conditional, analytic and histogram certificates replay from source',()=>{
  const z=spawnSync('python3',[script,source,packet],{encoding:'utf8'});
  assert.equal(z.status,0,z.stderr);
  assert.deepEqual(JSON.parse(z.stdout),{horizon:'15',adaptiveRadius:'3/20',fixedRadius:'3/20',literalWords:'35184372088832',
    referenceHistogramPanels:6864,analyticLeaves:36,singleDifferencePanels:188,orderedPanels:42,distributedHistogramOrders:4134});
  const src=JSON.parse(readFileSync(source));
  assert.equal(certifyFixedTapeOptimum(src).radius,'3/20');
  src.catalog.noiseBound='149999999999999999/1000000000000000000';
  assert.equal(certifyFixedTapeOptimum(src).atRequestedNoise,'policy-separates');
  assert.equal(certifyFixedTapeOptimum({...src,pulseBudget:'16'}).radius,'5/32');
});
test('conditional measurements are causal under source permutations and both original worlds remain physical',()=>{
  const code=`import json,runpy,sys,random
from fractions import Fraction as F
ns=runpy.run_path(sys.argv[1]);src=json.load(open(sys.argv[2]));packet=json.load(open(sys.argv[3]))
cat=src['catalog'];idx=[7,0,4,5,1,6,3,2];old=cat['commands'];cat['commands']=[old[i] for i in idx];cat['laws'].reverse()
for law in cat['laws']:law['vertices']=[[v[i] for i in idx] for v in reversed(law['vertices'])]
recv=ns['Receiver'](src,packet);x=['x0','x1'];names=cat['commands'];rng=random.Random(1508)
def physical(word,out):
    ys=list(map(F,out['readings']));assert len(ys)==len(word)+1
    for w in out['worlds']:
        q=list(map(F,w['weights']));assert sum(q)==1 and min(q)>=0
        raw=next(l['vertices'] for l in cat['laws'] if l['id']==w['law']);p=F(w['origin']);v=F(w['drift'])
        assert abs(p-ys[0])<=F(3,20)
        for j,c in enumerate(word,1):
            k=names.index(c);p+=v+sum(a*r[k] for a,r in zip(q,raw));assert abs(p-ys[j])<=F(3,20)
def check(word):
    out=recv.receive(word);physical(word,out)
    for t in (0,6,7,8,9,14):
        early=recv.receive(word[:t]);physical(word[:t],early)
        assert early['readings']==out['readings'][:t+1]
    return out
for g in (0,1):
    pre=['ref']*7+[x[g]]
    root=recv.receive(pre);jump=[F(-1,140),F(-1,105)][g]
    assert F(root['readings'][8])==F(1,4)+jump
    for _ in range(12):assert check(pre+rng.choices(names,k=7))['branch']=='reference'
    hard=[ns['NAMES'][c] for c in recv.hard[g]]
    seventh=hard.copy();seventh.remove(x[g]);seventh.remove(x[g]);rng.shuffle(seventh);seventh=[x[g]]+seventh
    past=recv.receive(seventh)['readings']
    for c in names:
        z=check(seventh+[c]+rng.choices(names,k=7));assert z['branch']=='seventh' and z['readings'][:8]==past
    last='y'+str(g);s=hard.copy();s.remove(last);rng.shuffle(s);s.append(last)
    # Choose an eighth-only prefix. If the seventh rule fires, rearrange the first action.
    if s[0]==x[g]:j=next(j for j,c in enumerate(s[:-1]) if c!=x[g]);s[0],s[j]=s[j],s[0]
    assert check(s+rng.choices(names,k=7))['branch']=='eighth'
assert check(['ref','group']+['x0','y1','z0','ref']*3+['ref'])['branch']=='balanced midpoint'
assert check(['group']*8+['x0']*7)['branch']=='distributed transfer'
bad=packet['seventh'][0]['children'][0].copy();bad[8]='1000'
try:ns['check_leaf']([[2],[3,4,4,5,6,7],[0]],bad,F(packet['seventh'][0]['adjustment']),recv.mu)
except ValueError:pass
else:raise AssertionError('forged future rate accepted')`;
  const z=spawnSync('python3',['-c',code,script,source,packet],{encoding:'utf8'});
  assert.equal(z.status,0,z.stderr);
});
