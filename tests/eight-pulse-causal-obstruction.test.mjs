import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const script='scripts/verify-eight-pulse-causal-obstruction.py';
const source='examples/active-position-drift-eight-pulse-upper.json';
const packet='examples/eight-pulse-causal-obstruction.json';
test('every eight-command word has a physical causal collision at 1/14',()=>{
  const job=spawnSync('python3',[script,source,packet],{encoding:'utf8'});
  assert.equal(job.status,0,job.stderr);
  assert.deepEqual(JSON.parse(job.stdout),{upper:'1/14',ordinaryCategoryWords:250,criticalWords:179712,
    totalWords:16777216,physicalPanels:3968,conditionalRoots:220,analyticLeaves:3230,
    distinctWorldPairs:17965,orderedPanels:2});
});
test('both ordered roots retain each actual prefix under all eight possible next actions',()=>{
  const py=`import json,sys,runpy
from fractions import Fraction as F
R=runpy.run_path(sys.argv[1])['Receiver']
s=json.load(open(sys.argv[2]));p=json.load(open(sys.argv[3]));r=R(s,p)
for w,kind in [([0,0,0,2,3,2,5,7],'ordered physical panel'),([0,0,0,5,4,2,1,7],'ordered physical panel'),
        ([0,0,0,0,5,2,3,6],'shared-prefix panel'),([7,6,5,3,0,0,0,0],'conditional center'),
        ([0,1,2,0,1,2,0,1],'balanced midpoint')]:
    words=[r.names[c] for c in w]
    full=r.receive(words);assert full['branch']==kind
    if kind=='ordered physical panel':assert full['readings'][4]=='2/7'
    for i in range(9):
        pre=r.receive(words[:i]);assert pre['readings']==full['readings'][:i+1]
        if i<8:
            for c in r.names:assert r.receive(words[:i]+[c])['readings'][:-1]==pre['readings']
key=(0,0,0,2);marks,ids=r.ordered[key]
r.ordered[key]=([F(9)]+marks[1:],ids)
try:r.receive([r.names[i] for i in key])
except ValueError:pass
else:raise AssertionError('forged shared fourth measurement survived')`;
  const job=spawnSync('python3',['-c',py,script,source,packet],{encoding:'utf8'});
  assert.equal(job.status,0,job.stderr);
});
