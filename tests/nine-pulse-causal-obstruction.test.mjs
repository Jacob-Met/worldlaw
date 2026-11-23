import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyFixedTapeOptimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const source = 'examples/active-position-drift-nine-pulse-upper.json';
const packet = 'examples/nine-pulse-causal-obstruction.json';
const script = 'scripts/verify-nine-pulse-causal-obstruction.py';

test('the fixed lower bound meets the nine-pulse causal upper at its closed boundary', () => {
  const request = JSON.parse(readFileSync(source, 'utf8'));
  const fixed = certifyFixedTapeOptimum(request);
  assert.equal(fixed.radius, '1/12');
  const below = structuredClone(request);
  below.catalog.noiseBound = '999999999999999999/12000000000000000000';
  assert.equal(certifyFixedTapeOptimum(below).atRequestedNoise, 'policy-separates');
  assert.equal(certifyFixedTapeOptimum({...request, pulseBudget: '10'}).atRequestedNoise, 'policy-separates');
});

test('all literal words retain a causal observation and two source-persistent witnesses', () => {
  const run = spawnSync('python3', [script, source, packet], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    upper: '1/12', ordinaryCategoryWords: 508, criticalWords: 331776,
    totalWords: 134217728, physicalPanels: 4049, conditionalRoots: 216,
    analyticLeaves: 1952, distinctWorldPairs: 27628,
  });
});

test('changed action prefixes, proof corruption, and the earlier terminal-only counterexample', () => {
  const program = `import json, runpy, sys
from fractions import Fraction as F
from copy import deepcopy
ns=runpy.run_path(sys.argv[1]); source=json.load(open(sys.argv[2]))
with open(sys.argv[3],encoding='utf8') as f: packet=json.load(f)
r=ns['Receiver'](source,packet)
panel=['ref']*4+['x1','x0','y0','z0','y1']
center=['x1','x0','y0','z0','y1']+['ref']*4
ordinary=['ref','group','x0']*3
for w,kind in [(panel,'shared-prefix panel'),(center,'conditional center'),(ordinary,'balanced midpoint')]:
    full=r.receive(w); assert full['branch']==kind
    assert [x['law'] for x in full['worlds']]==['A','B']
    for i in range(10):
        assert r.receive(w[:i])['readings']==full['readings'][:i+1]
        if i<9:
            for c in r.names:
                assert r.receive(w[:i]+[c])['readings'][:-1]==full['readings'][:i+1]
def rejects(call):
    try:call()
    except ValueError:return
    raise AssertionError('altered proof accepted')
head=tuple(r.names.index(x) for x in center[:4])
tr=deepcopy(r.centers[head]); tr[0]='500'
rejects(lambda:r.inspect_tree(head,tr,{'leafCount':0,'maximum':F(0)}))
tr=deepcopy(r.centers[head]); leaf=tr
while len(leaf[1])==8:leaf=leaf[1][0]
leaf[1][8]='1000'
rejects(lambda:r.inspect_tree(head,tr,{'leafCount':0,'maximum':F(0)}))
pa,t=r.selected(tuple(r.names.index(c) for c in panel));blocks,shifts,ids=pa
rejects(lambda:r.verify_panel((blocks,[F(10)]+shifts[1:],ids)))
bad=dict(source,catalog=dict(source['catalog'],noiseBound='1/11'))
rejects(lambda:ns['Receiver'](bad,packet))
# Achievability and lower bound 3/34 when the initial mean readings are retained.
w=[r.names.index(c) for c in panel]
ys=[F(x) for x in ('0','0','0','0','0','1/4','1/2','7/12','1/2','41/68')]
for law,weights,p,v in [(0,['9/34','2/17','5/34'],'3/34','-3/68'),(1,['37/51','7/102','0'],'-3/34','3/68')]:
    m=list(map(F,weights));m.append(1-sum(m));rates=r.rates(law,m);p,v=F(p),F(v)
    clean=[p]
    for c in w:clean.append(clean[-1]+v+rates[c])
    assert max(abs(x-y) for x,y in zip(clean,ys))==F(3,34)
    for vertex in r.v[law]:
        assert sum(vertex[c] for c in w)==(1 if law==0 else vertex[w[4]])
assert 5+9+4+4+4+4+4==34
assert 5-9+4==0 and -9*4+4*9==0
assert -4+4+4-4==0 and 4*4+4*5-4*9==0
assert F(4,34)-F(4,34)*ys[5]==F(3,34)
`;
  const run = spawnSync('python3', ['-c', program, script, source, packet], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
});
