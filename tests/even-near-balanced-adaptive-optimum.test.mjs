import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyFixedTapeOptimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const script='scripts/near-balanced-even-obstruction.py';
const source='examples/active-position-drift-even-near-balance.json';
test('H14 and both infinite residue classes meet the maintained fixed optimizer',()=>{
  const req=JSON.parse(readFileSync(source,'utf8'));
  for(const h of [10n,14n,22n,26n,12n*10n**120n+2n,12n*10n**120n-2n]){
    const n=h/2n,p=certifyFixedTapeOptimum({...req,pulseBudget:String(h)});
    const [a,b='1']=p.radius.split('/').map(BigInt);
    assert.equal(a*48n*n,(n*n-1n)*BigInt(b));
  }
  const r=spawnSync('python3',[script,source],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).radius,'1/7');
});
test('ordinary categories, signed transfers, all original ticks and large integer counts',()=>{
  const py=`import itertools,json,runpy,sys
from fractions import Fraction as F
E=runpy.run_path(sys.argv[1])['Experiment'];src=json.load(open(sys.argv[2]));names=src['catalog']['commands']
# A proper or noncentral split cannot violate the bound. Check all middle splits
# on every complete H=14 binary word independently using the integer counts.
n=7;found=[]
for bits in itertools.product((0,1),repeat=14):
    total=sum(bits);v=0;worst=0
    for j,b in enumerate(bits[:-1],1):
        v+=b;worst=max(worst,abs(14*v-j*total))
    if worst>n*n-1:found.append(bits)
assert set(found)=={(0,)*7+(1,)*7,(1,)*7+(0,)*7}
roles=set()
def runs(seq):
    result=[]
    for c in seq:
        if result and result[-1]['command']==c:result[-1]['repeats']=str(1+int(result[-1]['repeats']))
        else:result.append({'command':c,'repeats':'1'})
    return result
def raw_check(exp,seq,out):
    m={int(x['tick']):F(x['reading']) for x in out['measurements']};mu=out['nominalRates']
    nominal=F(0);ys=[F(0)]
    for i,c in enumerate(seq,1):
        nominal+=F(mu[c]);ys.append(m.get(i,nominal))
    if out['branch']=='terminal midpoint':assert ys[-1]!=nominal
    for world in out['worlds']:
        w=list(map(F,world['weights']));assert min(w)>=0 and sum(w)==1
        law=next(l for l in src['catalog']['laws'] if l['id']==world['law']);p=F(world['origin'])
        assert abs(p-ys[0])<=exp.e
        for j,c in enumerate(seq,1):
            i=src['catalog']['commands'].index(c)
            p+=F(world['drift'])+sum(w[k]*v[i] for k,v in enumerate(law['vertices']))
            assert abs(p-ys[j])<=exp.e
for n in (5,7,11,13):
    src['pulseBudget']=str(2*n);exp=E(src)
    for ordered in [('x0','y0','z0','x1','y1','z1'),('x0','y0','x1','y1','z0','z1'),('z0','x0','y0','z1','x1','y1')]:
        suff=[ordered[j%6] for j in range(n)]
        for flip in (False,True):
            b=['ref' if j%2 else 'group' for j in range(n)]
            seq=suff+b if flip else b+suff
            full=exp.receive(runs(seq));roles.add((full['transfer']['law'],flip))
            raw_check(exp,seq,full)
            pre=exp.receive(runs(seq[:-1]))
            assert pre['branch']=='balanced midpoint'
            assert F(pre['measurements'][-1]['reading'])==sum(F(exp.mu[c]) for c in seq[:-1])
    # Interior all-suffix run with two separate baseline pieces exercises slope intersection.
    seq=['ref']+['x0']*n+['ref']*(n-1)
    ordinary=exp.receive(runs(seq));assert ordinary['branch']=='balanced midpoint';raw_check(exp,seq,ordinary)
assert roles=={(law,flip) for law in ('A','B') for flip in (False,True)}
# Reorder both laws and vertices; source-world weights must still index the supplied vertices.
src['catalog']['laws'].reverse()
for law in src['catalog']['laws']:law['vertices'].reverse()
exp=E(src);seq=['ref']*13+['x1']*13;raw_check(exp,seq,exp.receive(runs(seq)))
q=10**150;n=6*q+1;src['pulseBudget']=str(2*n);exp=E(src)
huge=[{'command':'ref','repeats':str(n)}]+[{'command':c,'repeats':str(q+(i==0))} for i,c in enumerate(names[2:])]
out=exp.receive(huge);assert len(out['measurements'])==9 and abs(int(out['transfer']['difference']))==1
assert out['measurements'][-1]['tick']==str(2*n)
assert exp.receive([])['measurements']==[{'tick':'0','reading':'0'}]
src['pulseBudget']='12'
try:E(src)
except ValueError:pass
else:raise AssertionError('unsupported residue accepted')`;
  const r=spawnSync('python3',['-c',py,script,source],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});
