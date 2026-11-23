import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {certifyFixedTapeOptimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const script='scripts/near-balanced-even-obstruction.py';
const source='examples/active-position-drift-sixteen-pulse-upper.json';
const duals='examples/sixteen-pulse-nominal-prefix-limits.json';
test('H16 source bounds, literal sharpness and six exceptional category patterns',()=>{
  const src=JSON.parse(readFileSync(source));
  assert.equal(certifyFixedTapeOptimum(src).radius,'5/32');
  const py=`import json,itertools,sys,runpy
from fractions import Fraction as F
src=json.load(open(sys.argv[2]));E=runpy.run_path(sys.argv[1])['Experiment'];names=src['catalog']['commands']
model=E(src,terminal_bound=True);assert set(model.critical)=={7,8,9}
assert model.describe()['adaptiveUpper']=='5/31'
for e,status in [('5/32','unresolved'),('1/7','policy-separates'),('5/31','closed-collision')]:
    src['catalog']['noiseBound']=e;assert E(src,terminal_bound=True).describe()['atRequestedNoise']==status
bad=set()
for bits in itertools.product((0,1),repeat=16):
    s=sum(bits);v=0
    for j,c in enumerate(bits[:-1],1):
        v+=c
        if abs(16*v-j*s)*31>1920:bad.add(bits);break
assert bad=={tuple([z]*b+[1-z]*(16-b)) for b in (7,8,9) for z in (0,1)}
for d in json.load(open(sys.argv[3])):
    w=d['commands'];lhs=[F(0)]*13;rhs=F(0)
    for (t,l,sg),weight in d['terms']:
        a=[F(0)]*13;r=0;wt=F(weight);assert wt>0 and sg in (-1,1)
        if t=='sum':
            for j in range(4):a[4*l+j]=sg
            r=sg
        else:
            v=[[sum(vertex[names.index(c)] for c in w[:t]) for vertex in law['vertices']] for law in src['catalog']['laws']]
            if l==2:
                assert t==16
                a[:8]=[sg*z for z in v[0]]+[-sg*z for z in v[1]];a[8:]=[sg,t*sg,-sg,-t*sg,-2]
            else:
                assert 0<=t<16
                a[4*l:4*l+4]=[sg*z for z in v[l]];a[8+2*l:10+2*l]=[sg,t*sg];a[-1]=-1
                r=sg*sum(model.mu[c] for c in w[:t])
        lhs=[z+wt*m for z,m in zip(lhs,a)];rhs+=wt*r
    assert lhs==[0]*12+[-1] and -rhs==F(d['lower'])
assert max(F(d['lower']) for d in json.load(open(sys.argv[3])))==model.e`;
  const x=spawnSync('python3',['-c',py,script,source,duals],{encoding:'utf8'});assert.equal(x.status,0,x.stderr);
});
test('closed original positions and both causal block orders survive source permutation',()=>{
  const py=`import json,sys,runpy
from fractions import Fraction as F
src=json.load(open(sys.argv[2]));src['catalog']['laws'].reverse()
for l in src['catalog']['laws']:l['vertices'].reverse()
exp=runpy.run_path(sys.argv[1])['Experiment'](src,terminal_bound=True);modes=set()
def received(w):
    z=exp.receive([dict(command=c,repeats=1) for c in w]);ys=list(map(lambda r:F(r['reading']),z['measurements']))
    for st in z['worlds']:
        law=next(l for l in src['catalog']['laws'] if l['id']==st['law']);q=list(map(F,st['weights']));assert min(q)>=0 and sum(q)==1
        p=F(st['origin']);v=F(st['drift']);assert abs(p-ys[0])<=exp.e
        for y,c in zip(ys[1:],w):
            j=src['catalog']['commands'].index(c);p+=v+sum(x*a[j] for x,a in zip(q,law['vertices']));assert abs(p-y)<=exp.e
    return z,ys
for s in (7,8,9):
    for f in (0,1):
        for h in (['x0']*s,['x0','y0','z0']*(s//3)+['x0']*(s%3),['x0','y0','z0']+['x1','y1','z1']*2 if s==9 else ['z0']*s):
            for group in (0,1):
                b=['ref']*(16-s);b[0]='group' if group else 'ref';w=h+b if f else b+h
                z,ys=received(w);modes.add(z['transfer'].get('mode','within'));assert z['branch']=='terminal midpoint'
                _,pre=received(w[:-1]);assert ys[:-1]==pre
assert modes=={'within','cross-group suffix','neutral baseline'}`;
  const x=spawnSync('python3',['-c',py,script,source],{encoding:'utf8'});assert.equal(x.status,0,x.stderr);
});
test('all 3432 tails of a terminal-only feedback menu admit the same measured prefix at 5/32',()=>{
  const py=`import json,sys,itertools,math
from fractions import Fraction as F
cat=json.load(open(sys.argv[1]))['catalog'];n=cat['commands'];x=n.index('x0');ref=n.index('ref')
gens=((1,8),(-9,-16),(8,0),(0,8))
def dot(p,q):return p[0]*q[0]+p[1]*q[1]
def band(law,tail):
    # Coordinates are 32 times each contrast; reading errors become ±5.
    points=[(256*(v[x]-v[ref]),256*(v[x]+sum(v[j] for j in tail)-8*v[ref])) for v in law['vertices']]
    dirs=list(gens)+[(x1-x0,y1-y0) for (x1,y1),(x0,y0) in itertools.combinations(points,2)]
    normals=set()
    for a,b in dirs:
        g=math.gcd(a,b)
        if g:normals.update(((b//g,-a//g),(-b//g,a//g)))
    lo=hi=None
    for a,b in normals:
        rhs=max(dot((a,b),p) for p in points)+5*sum(abs(dot((a,b),g)) for g in gens)
        if not b:assert rhs>=0;continue
        y=F(rhs,b)
        if b<0:lo=y if lo is None else max(lo,y)
        else:hi=y if hi is None else min(hi,y)
    return lo,hi
count=0
for tail in itertools.combinations_with_replacement(range(8),7):
    bounds=[band(law,tail) for law in cat['laws']]
    assert max(x[0] for x in bounds)<=min(x[1] for x in bounds)
    count+=1
assert count==3432`;
  const out=spawnSync('python3',['-c',py,source],{encoding:'utf8'});assert.equal(out.status,0,out.stderr);
});
