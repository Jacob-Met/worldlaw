import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('original vertices verify stationary lower and both full-reading ambiguity endpoints',()=>{
  const py=`import json,itertools,gzip,base64,sys
from fractions import Fraction as F
from math import lcm
cat=json.load(open(sys.argv[1]))['catalog'];p=json.load(open(sys.argv[2]));assert p['schema']=='worldlaw.sixteen-pulse-feedback-boundaries/v1'
names=cat['commands'];assert names==['ref','group','x0','y0','z0','x1','y1','z1']
raw=[l['vertices'] for l in cat['laws']];d=p['stationary'];ws=d['words'];assert len(ws)==7 and all(len(w)==16 for w in ws)
columns=[F(0)]*(8+12*len(ws)+1);rhs=F(0)
for row,weight in d['positionWeights']:
    w=F(weight);assert w>0
    wi,k=divmod(row,66);t=k//4;word=ws[wi];sg=(-1,1)[k%2];off=8+12*wi
    counts=[word[:t].count(c) for c in range(8)]
    def physical(l,z):
        for j,v in enumerate(raw[l]):columns[off+4*l+j]+=z*sum(a*b for a,b in zip(v,counts))
        columns[off+8+2*l]+=z;columns[off+9+2*l]+=z*t
    if t<16:
        physical((k%4)//2,sg*w)
        for c,n in enumerate(counts):columns[c]-=sg*w*n
        columns[-1]-=w
    else:
        physical(0,sg*w);physical(1,-sg*w);columns[-1]-=2*w
for i,q in enumerate(map(F,d['massSumWeights'])):
    wi,l=divmod(i,2)
    for j in range(4):columns[8+12*wi+4*l+j]+=q
    rhs+=q
assert all(v==0 for v in columns[1:8]) and columns[-1]==-1
for wi in range(len(ws)):
    c=columns[8+12*wi:20+12*wi];assert min(c[:8])>=0 and not any(c[8:])
assert -rhs==F(d['lower'])==F(882,5611)>F(5,32)
tables=json.loads(gzip.decompress(base64.b64decode(p['physicalPairsGzipBase64'],validate=True)))
assert list(map(F,p['marks']))==[F(11,128),F(27,128)] and len(tables)==2
tails=list(itertools.combinations_with_replacement(range(8),7))
for table,mark in zip(tables,map(F,p['marks'])):
    assert len(table)==len(tails)==3432
    for tail,row in zip(tails,table):
        x=list(map(F,row));assert len(x)==10
        scale=lcm(128,*(v.denominator for v in x));x=[int(v*scale) for v in x]
        ps=[];increments=[];e=5*scale//32
        for l in (0,1):
            weights=x[3*l:3*l+3];weights.append(scale-sum(weights));assert min(weights)>=0
            origin,drift=x[6+2*l:8+2*l]
            rates=[drift+sum(a*v[c] for a,v in zip(weights,raw[l])) for c in range(8)]
            assert abs(origin)<=e and abs(origin+8*rates[0])<=e
            pos=origin+8*rates[0]+rates[2];assert abs(pos-int(mark*scale))<=e
            ps.append(pos);increments.append(rates)
        delta=[increments[0][c]-increments[1][c] for c in tail];delta.sort();lo=hi=ps[0]-ps[1]
        for a,b in zip(delta,reversed(delta)):
            lo+=a;hi+=b;assert -2*e<=lo<=hi<=2*e`;
  const z=spawnSync('python3',['-c',py,'examples/active-position-drift-sixteen-pulse-upper.json','examples/sixteen-pulse-feedback-boundaries.json'],{encoding:'utf8'});
  assert.equal(z.status,0,z.stderr);
});
