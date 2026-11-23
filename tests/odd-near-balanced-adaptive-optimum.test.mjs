import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyFixedTapeOptimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const script='scripts/near-balanced-even-obstruction.py';
const source='examples/active-position-drift-odd-near-balance.json';
const failures='examples/fifteen-pulse-nominal-prefix-limits.json';
test('two odd residues meet the independently implemented fixed optimizer',()=>{
  const src=JSON.parse(readFileSync(source));
  for(const h of [21n,27n,33n,39n,12n*10n**150n+3n,12n*10n**150n+9n]){
    const n=h/2n,p=certifyFixedTapeOptimum({...src,pulseBudget:String(h)});
    const [a,b=1n]=p.radius.split('/').map(BigInt);
    assert.equal(a*24n*h,(n*(n+1n)-2n)*b);
  }
});
test('all four category exceptions replay with the original vertices and all permutation extrema',()=>{
  const program=`import json,sys,runpy
from collections import Counter
from fractions import Fraction as F
from random import Random
E=runpy.run_path(sys.argv[1])['Experiment'];src=json.load(open(sys.argv[2]));names=src['catalog']['commands']
rng=Random(19);roles=set()
for n in (10,13,16,19):
    src['pulseBudget']=str(2*n+1);e=E(src)
    for s in (n,n+1):
        b=2*n+1-s
        for i in range(12):
            suf=([names[2+j%6] for j in range(s)] if i==0 else [rng.choice(names[2:]) for _ in range(s)])
            if i==1:suf=[('z0','x0','y0')[j%3] for j in range(s)]
            base=[rng.choice(names[:2]) for _ in range(b)]
            for order,blocks in enumerate(((base,suf),(suf,base))):
                runs=[{'command':c,'repeats':1} for bl in blocks for c in bl];z=e.receive(runs)
                assert z['branch']=='terminal midpoint'
                roles.add((z['transfer']['law'],order,s==n))
                terminal=[]
                for w in z['worlds']:
                    row=next(l['vertices'] for l in src['catalog']['laws'] if l['id']==w['law'])
                    weights=list(map(F,w['weights']));assert sum(weights)==1 and min(weights)>=0
                    rates={c:F(w['drift'])+sum(a*v[k] for a,v in zip(weights,row))-e.mu[c] for k,c in enumerate(names)}
                    p=F(w['origin']);t=0
                    for bl in blocks:
                        d=sorted(rates[c] for c in bl);lo=hi=p
                        for a,v in zip(d,reversed(d)):
                            t+=1;lo+=a;hi+=v
                            if t<e.h:assert -e.e<=lo<=hi<=e.e
                        p+=sum(d)
                    terminal.append(p)
                assert abs(terminal[0]-terminal[1])==2*e.e
assert len(roles)==8
n=6*10**150+4;e=E(dict(src,pulseBudget=str(2*n+1)))
for s in (n,n+1):
    b=e.h-s;out=e.receive([{'command':'x0','repeats':s},{'command':'ref','repeats':b}])
    assert len(out['measurements'])==4 and out['measurements'][-1]['tick']==str(e.h)
try:E(dict(src,pulseBudget=15))
except ValueError:pass
else:raise AssertionError('uncertified horizon accepted')`;
  const x=spawnSync('python3',['-c',program,script,source],{encoding:'utf8'});
  assert.equal(x.status,0,x.stderr);
});
test('exact H15 source-row sums refute nominal proper readings on two ordered words',()=>{
  const program=`import json,sys
from fractions import Fraction as F
src=json.load(open(sys.argv[1]))['catalog'];names=src['commands'];laws=src['laws']
assert [l['id'] for l in laws]==['A','B']
balanced=((1,2,1,2),(2,1,2,1))
for packet in json.load(open(sys.argv[2])):
    commands=packet['commands'];lhs=[F(0)]*13;rhs=F(0)
    for (t,l,sign),weight in packet['terms']:
        weight=F(weight);assert weight>0 and sign in (-1,1)
        row=[F(0)]*13;bound=F(0)
        if t=='sum':
            for j in range(4):row[4*l+j]=sign
            bound=sign
        else:
            rows=[[sum(v[names.index(c)] for c in commands[:t]) for v in law['vertices']] for law in laws]
            if l==2:
                assert t==15
                row[:8]=[sign*x for x in rows[0]]+[-sign*x for x in rows[1]]
                row[8:]=[sign,t*sign,-sign,-t*sign,-2]
            else:
                assert 0<=t<15
                row[4*l:4*l+4]=[sign*x for x in rows[l]];row[8+2*l:10+2*l]=[sign,t*sign];row[-1]=-1
                bound=F(sign*sum(a*b for d,w in zip(rows,balanced) for a,b in zip(d,w)),12)
        lhs=[a+weight*b for a,b in zip(lhs,row)];rhs+=weight*bound
    assert lhs==[0]*12+[-1] and -rhs==F(packet['lower'])>F(3,20)`;
  const x=spawnSync('python3',['-c',program,source,failures],{encoding:'utf8'});
  assert.equal(x.status,0,x.stderr);
});
