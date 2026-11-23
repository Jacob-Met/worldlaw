import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyPairedSuffix} from '../src/science/position-drift-paired-suffix.mjs';

const script='scripts/verify-seven-pulse-causal-obstruction.py';
const source='examples/active-position-drift-seven-pulse-upper.json';
const packet='examples/seven-pulse-causal-obstruction.json';

test('seven-pulse causal upper meets the strict paired-suffix radius',()=>{
  const req=JSON.parse(readFileSync(source,'utf8'));
  const lower={schema:'worldlaw.position-drift-paired-suffix/v1',catalog:req.catalog,references:'3'};
  assert.equal(certifyPairedSuffix(lower).radius,'1/16');
  assert.equal(certifyPairedSuffix(lower).atRequestedNoise,'closed-collision');
  lower.catalog.noiseBound='999999999999999999/16000000000000000000';
  assert.equal(certifyPairedSuffix(lower).atRequestedNoise,'policy-separates');
  const result=spawnSync('python3',[script,source,packet],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{upper:'1/16',ordinaryCategoryWords:124,criticalWords:27648,
    totalWords:2097152,physicalPanels:1568,conditionalRoots:0,analyticLeaves:0,distinctWorldPairs:1548});
});

test('independent literal-order source replay checks every exceptional world at every tick',()=>{
  const program=`import json,sys,itertools,math
from fractions import Fraction as F
cat=json.load(open(sys.argv[1]))['catalog'];p=json.load(open(sys.argv[2]))
names=cat['commands'];base=[names.index(c) for c in ('ref','group')];suffix=[i for i in range(8) if i not in base]
vertices=[law['vertices'] for law in cat['laws']]
mu=[F(x,12) for x in [0,6,3,1,-1,3,1,-1]]
panels={(tuple(u),tuple(v)):ids[0] for u,v,shifts,ids in p['panels'] if len(u)+len(v)==7 and not shifts and len(ids)==1}
worlds=[]
for row in p['worldPairs']:
    q=list(map(F,row));physical=[]
    for l in range(2):
        weights=q[3*l:3*l+3];weights=weights+[1-sum(weights)];assert min(weights)>=0
        start,v=q[6+2*l:8+2*l]
        rates=[v+sum(weights[j]*vertices[l][j][i] for j in range(4)) for i in range(8)]
        physical.append([start]+[z-m for z,m in zip(rates,mu)])
    D=math.lcm(16,*(v.denominator for world in physical for v in world))
    worlds.append((D,[[int(x*D) for x in world] for world in physical]))
total=0;tubes=0
for m in (3,4):
    for a,b in ((base,suffix),(suffix,base)):
        for u in itertools.product(a,repeat=m):
            for v in itertools.product(b,repeat=7-m):
                den,pair=worlds[panels[tuple(sorted(u)),tuple(sorted(v))]];pos=[s[0] for s in pair]
                for c in u+v:
                    assert all(abs(x)*16<=den for x in pos)
                    tubes+=2
                    pos=[p+s[1+c] for p,s in zip(pos,pair)]
                assert 8*abs(pos[0]-pos[1])<=den
                tubes+=2;total+=1
assert (total,tubes)==(27648,442368)`;
  const result=spawnSync('python3',['-c',program,source,packet],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('free terminal midpoint leaves all earlier measurements intact',()=>{
  for(const word of [['ref','ref','ref','x1','x0','y0','y1'],['x0','y0','z0','x1','group','ref','group']]){
    const read=w=>{const r=spawnSync('python3',[script,source,packet,'--commands',...w],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
    assert.deepEqual(read(word).readings.slice(0,7),read(word.slice(0,6)).readings);
    assert.equal(read(word).branch,'shared-prefix panel');
  }
});
