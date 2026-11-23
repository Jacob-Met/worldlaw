import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyFixedTapeOptimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const script='scripts/near-balanced-even-obstruction.py';
const source='examples/active-position-drift-all-large-horizons.json';
test('large-horizon formula matches the fixed design for every residue and both nearest allocations',()=>{
  const req=JSON.parse(readFileSync(source));
  for(const q of [6n,10n**200n]){
    for(let i=0n;i<12n;i++){
      const h=12n*q+i,p=certifyFixedTapeOptimum({...req,pulseBudget:String(h)});
      const k=(h+6n)/12n,[a,b=1n]=p.radius.split('/').map(BigInt);
      assert.equal(a*4n*h,b*k*(h-6n*k));
    }
  }
});
test('complete finite-cutoff arithmetic, literal neutral and cross-group physical worlds',()=>{
  const program=`import json,runpy,sys
from fractions import Fraction as F
from math import lcm
E=runpy.run_path(sys.argv[1])['Experiment'];source=json.load(open(sys.argv[2]));cat=source['catalog'];names=cat['commands']
# Change the input order before constructing the model. Original weights in each
# returned world must index these supplied vertices in their current order.
indices=[6,0,4,2,7,1,3,5];cat['commands']=[names[i] for i in indices]
cat['laws'].reverse()
for law in cat['laws']:
    law['vertices']=[[v[i] for i in indices] for v in reversed(law['vertices'])]
checked=set();modes=set()
def runs(cl):
    return [dict(command=c,repeats=n) for c,n in cl if n]
def replay(exp,blocks):
    seq=runs(blocks[0]+blocks[1]);r=exp.receive(seq);t=exp.h
    assert r['branch']=='terminal midpoint'
    tag=r['transfer'].get('mode','within group');modes.add((tag,blocks[0][0][0] in ('group','ref')))
    ends=[]
    for world in r['worlds']:
        w=list(map(F,world['weights']));assert min(w)>=0 and sum(w)==1
        verts=next(z['vertices'] for z in cat['laws'] if z['id']==world['law'])
        inc={c:F(world['drift'])+sum(a*v[i] for a,v in zip(w,verts))-exp.mu[c] for i,c in enumerate(cat['commands'])}
        p=F(world['origin']);scale=lcm(exp.e.denominator,p.denominator,*(v.denominator for v in inc.values()))
        p=int(p*scale);e=int(exp.e*scale);clock=0
        for block in blocks:
            ds=sorted(int(inc[c]*scale) for c,n in block for _ in range(n));lo=hi=p
            for mn,mx in zip(ds,reversed(ds)):
                lo+=mn;hi+=mx;clock+=1
                if clock<t:assert -e<=lo<=hi<=e
            p+=sum(ds)
        ends.append(F(p,scale))
    assert abs(ends[0]-ends[1])==2*exp.e
    nominal=sum(exp.mu[c]*n for bl in blocks for c,n in bl)
    assert F(r['measurements'][-1]['reading'])==nominal+sum(ends)/2
for h in range(67,83):
    exp=E(dict(source,pulseBudget=h));K=max(s*(h-s) for s in range(0,h+1,6))
    splits={s:s*(h-s)-K for s in range(1,h) if s*(h-s)>K}
    assert splits==exp.critical
    for s,d in splits.items():
        b=h-s;c=F(d,6*b);a=F(1,12)-2*exp.e/b;beta=F(1,12)-2*exp.e/s
        assert a>=c and (s-1)*a<=2*exp.e and 2*exp.e>=(s-1)*c and beta>=c/s and (b-1)*beta<=2*exp.e
        if s%3==0:
            for u in set((0,s//6,s//3)):
                v=s//3-u;suf=[(c,u if c[-1]=='0' else v) for c in names if c not in ('group','ref')]
                for G in (0,1,b//2,b):
                    bas=[('ref',b-G),('group',G)]
                    for blocks in ((bas,suf),(suf,bas)):replay(exp,blocks)
        sfx=[('x1',s-1),('z1',1)];bas=[('ref',b)]
        for blocks in ((bas,sfx),(sfx,bas)):replay(exp,blocks)
        checked.add((h,d))
assert {d for h,d in checked}==set(range(1,10))-{7}
assert modes=={(m,o) for m in ('neutral baseline','cross-group suffix','within group') for o in (False,True)}
# A noncritical histogram and every proper prefix retain the same nominal output.
exp=E(source)
ordinary=exp.receive(runs([('ref',38),('x0',38),('ref',2)]))
assert ordinary['branch']=='balanced midpoint'
# A 201-digit H with equal within-group counts exercises the swapped neutral
# case and its penultimate nominal check without expanding any command count.
s=6*10**200+3;src=dict(source,pulseBudget=str(2*s));exp=E(src);u=10**200;v=u+1
suf=[(c,u if c[-1]=='0' else v) for c in names if c not in ('group','ref')]
for words in ([('ref',s-1),('group',1)]+suf,suf+[('group',1),('ref',s-1)]):
    z=exp.receive(runs(words));assert z['transfer']['mode']=='neutral baseline'
    assert z['measurements'][-1]['tick']==str(2*s) and len(z['measurements'])<=10
`;
  const x=spawnSync('python3',['-c',program,script,source],{encoding:'utf8'});
  assert.equal(x.status,0,x.stderr);
});
