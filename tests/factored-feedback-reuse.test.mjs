import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('cached physical extrema match all changed raw tubes at closed rational boundaries',()=>{
  const code=String.raw`
import importlib.util
from fractions import Fraction as F
from itertools import product
spec=importlib.util.spec_from_file_location('factored','scripts/design-factored-feedback.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def independent_feasible(lows,highs,key,r):
    # Enumerate strip-boundary intersections in origin/drift space.
    y=(0,0)+key
    faces=[(t,y[t]-c+sign*r) for t in range(len(y))
           for c,sign in ((lows[t],-1),(highs[t],1))]
    for j,(t,a) in enumerate(faces):
        for u,b in faces[:j]:
            if t==u:continue
            slope=F(a-b,t-u)
            off=a-t*slope
            if all(abs(v+off+k*slope-y[k])<=r for k in range(len(y)) for v in (lows[k],highs[k])):
                return True
    return False

zero=((F(0),)*4,(F(0),)*4,F(0))
assert m.gauge_witness(zero,(F(0),F(1)),F(1,3)) is not None
assert m.gauge_witness(zero,(F(0),F(1)),F(1,3)-F(1,10**40)) is None

words=[(0,1,0,0),(0,1,0,1)]
vertices=[[[0,1],[2,0]],[[1,0],[0,3]]]
outer={('y',(0,1)):1,'e':0}
coords,_,_=m.position_rows(words,vertices)
priv={i:j for j,i in enumerate(i for key,i in coords.items() if key=='e' or key not in outer)}
x=[F(0)]*len(priv)
def put(key,value): x[priv[coords[key]]]=F(value)
for n,w in enumerate(words):
    put(('y',w[:3]),F(1,2));put(('y',w),F(1-n,3))
    for law in range(2):
        put((w,law,'p'),F(law,5));put((w,law,'v'),F(n-law,7));put((w,law,0),F(n+law+1,4))
bands=m.primal_bands(words,vertices,outer,coords,priv,x)
states=[]
for n,w in enumerate(words):
    for law,vs in enumerate(vertices):
        t=F(n+law+1,4)
        positions=[F(law,5)]
        for c in w:positions.append(positions[-1]+F(n-law,7)+t*vs[0][c]+(1-t)*vs[1][c])
        states.append((w,n,positions))
assert bands[0]==tuple(min(p[t] for _,_,p in states) for t in range(3))
assert bands[1]==tuple(max(p[t] for _,_,p in states) for t in range(3))
assert bands[2]==max(abs(p[t]-(F(1,2) if t==3 else F(1-n,3))) for _,n,p in states for t in (3,4))
for y,r in product([F(i,3) for i in range(-4,7)],[F(i,3) for i in range(16)]):
    witness=m.gauge_witness(bands,(y,),r)
    assert (witness is not None)==(r>=bands[2] and independent_feasible(*bands[:2],(y,),r))
    if witness is None:continue
    a,b=witness
    for w,n,p in states:
        readings=[0,0,y,F(1,2)+a+3*b,F(1-n,3)+a+4*b]
        assert all(abs(z+a+t*b-readings[t])<=r for t,z in enumerate(p))
assert m.zero_vertices([(0,1)],[[[0,1]],[[0,0]]]) is None
assert m.zero_vertices([(0,1)],[[[0,1],[2,2]],[[4,4]]])==[[1,0]]
# A stored all-flat block can be exported directly at a changed upper master point.
import json
path='scripts/verify-factored-feedback.py'
rs=importlib.util.spec_from_file_location('receiver',path)
receiver=importlib.util.module_from_spec(rs);rs.loader.exec_module(receiver)
catalog={'commands':['a','b'],'laws':[{'id':'A','vertices':[[0,0]]},{'id':'B','vertices':[[2,2]]}]}
source={'catalog':catalog};plan={'prefix':[0,0],'horizon':4,'split':3,'words':None}
data=([(0,0,0),(0,0,1)],{'e':0,('y',(0,0)):1},(F(1,4),[0,F(1)]),[(({0:-1},0,None,{}),F(1))])
summary={'status':'bounded','lower':'0','upper':'1/4'}
stream=(json.dumps(item) for item in m.proof_lines(['a','b'],['A','B'],[[[0,0]],[[2,2]]],plan,data,summary))
result=receiver.verify(source,stream,True,['a','a'],4)
assert (result['lower'],result['upper'],result['physicalWorlds'])==('0','1/4',8)
assert summary['export']['solves']==0 and summary['export']['zeroWorldBlocks']==2
assert m.reconstruct_primal([float(F(1,1000003))],[{0:-1}],[F(-1,1000003)],{0:F(1)})==[F(1,1000003)]
try:m.reconstruct_primal([0.0],[{0:-1}],[F(-1,1000003)],{0:F(1)})
except ArithmeticError:pass
else:raise AssertionError('accepted an uncertified point')
`;
  const r=spawnSync('python3',['-c',code],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});
