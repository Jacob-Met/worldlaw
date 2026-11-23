"""Verify the ten-pulse causal adversary, or receive its next exact reading on a supplied tape."""
import argparse
from fractions import Fraction as F
from itertools import combinations_with_replacement, product
import json
from math import lcm
from pathlib import Path

EPS=F(1,10)
BASE=('ref','group')
SUFFIX=('x0','y0','z0','x1','y1','z1')


def require(ok,why):
    if not ok:
        raise ValueError(why)


def exact(value):
    require(type(value) in (str,int),'expected exact rational text or integer')
    return F(value)


def balanced_affine(bits):
    # The two clean paths have difference f(t)/6 before their relative start/drift adjustment.
    f=[F(0)]
    for bit in bits:
        f.append(f[-1]+F(bit,6))
    if len(f)==1:
        return F(0),F(0)
    lower=max((f[j]-f[i]-4*EPS)/(j-i) for j in range(1,len(f)) for i in range(j))
    upper=min((f[j]-f[i]+4*EPS)/(j-i) for j in range(1,len(f)) for i in range(j))
    if lower>upper:
        return None
    origin=max(y-t*lower-2*EPS for t,y in enumerate(f))
    require(all(abs(y-origin-t*lower)<=2*EPS for t,y in enumerate(f)),'affine tube reconstruction failed')
    return origin,lower


class Receiver:
    def __init__(self,source,packet):
        cat=source['catalog']
        require(packet['schema']=='worldlaw.ten-pulse-terminal-adversary/v1' and
                packet['catalog']==cat and exact(cat['noiseBound'])==EPS,'catalog or course differs')
        self.names=cat['commands']
        require(len(self.names)==8 and set(self.names)==set(BASE+SUFFIX),'incorrect command vocabulary')
        self.base=tuple(self.names.index(c) for c in BASE)
        self.suffix=tuple(self.names.index(c) for c in SUFFIX)
        require([law['id'] for law in cat['laws']]==['A','B'],'incorrect family order')
        self.vertices=[[[exact(x) for x in row] for row in law['vertices']] for law in cat['laws']]
        require(all(len(v)==4 and all(len(row)==8 for row in v) for v in self.vertices),'unexpected vertex dimensions')
        self.balanced=[[F(k,6) for k in w] for w in ((1,2,1,2),(2,1,2,1))]
        rates=[self.rates(law,self.balanced[law]) for law in range(2)]
        require(all(rates[0][i]-rates[1][i]==(F(1,6) if i in self.suffix else 0) for i in range(8)),
                'balanced contrast differs on a source coordinate')
        self.mu=[(a+b)/2 for a,b in zip(*rates)]
        self.rows=packet['worldPairs']
        self.scaled=[]
        for row in self.rows:
            require(len(row)==10,'world-pair width differs')
            raw=list(map(exact,row));parameters=[]
            for law in range(2):
                weights=raw[3*law:3*law+3];weights=weights+[1-sum(weights)]
                require(min(weights)>=0,'physical mixture left simplex')
                origin,drift=raw[6+2*law:8+2*law]
                inc=[drift+r-u for r,u in zip(self.rates(law,weights),self.mu)]
                parameters.append([origin,*inc])
            den=lcm(10,*(v.denominator for values in parameters for v in values))
            self.scaled.append((den,*[tuple(int(v*den) for v in values) for values in parameters]))
        self.roots={}
        indices=iter(packet['roots'])
        for first,second in ((self.base,self.suffix),(self.suffix,self.base)):
            for a in combinations_with_replacement(first,5):
                for b in combinations_with_replacement(second,4):
                    for last in second:
                        i=next(indices,None)
                        require(type(i) is int and 0<=i<len(self.rows),'missing or invalid critical root')
                        self.roots[(tuple(sorted(a)),tuple(sorted(b)),last)]=i
        require(next(indices,None) is None and set(self.roots.values())==set(range(len(self.rows))),
                'unused roots or world pairs')

    def rates(self,law,weights):
        return [sum(w*value for w,value in zip(weights,column)) for column in zip(*self.vertices[law])]

    def critical(self,word):
        key=(tuple(sorted(word[:5])),tuple(sorted(word[5:9])),word[9])
        require(key in self.roots,'tape is outside the two critical categories')
        idx=self.roots[key]
        den,a,b=self.scaled[idx]
        x,y=a[0],b[0];radius=den//10
        require(abs(x)<=radius and abs(y)<=radius,'initial midpoint tube failed')
        for action in word[:9]:
            x+=a[action+1];y+=b[action+1]
            require(abs(x)<=radius and abs(y)<=radius,'shared midpoint tube failed')
        x+=a[word[9]+1];y+=b[word[9]+1]
        require(abs(x-y)<=2*radius,'terminal positions have no common reading')
        return idx,x+y,2*den

    def receive(self,commands):
        require(len(commands)<=10 and all(c in self.names for c in commands),'invalid tape')
        word=tuple(self.names.index(c) for c in commands)
        bits=tuple(int(c in self.suffix) for c in word)
        readings=[F(0)]
        for c in word:
            readings.append(readings[-1]+self.mu[c])
        line=balanced_affine(bits)
        if line is not None:
            a,b=line
            worlds=[dict(law=law,weights=list(map(str,self.balanced[i])),origin=str(sign*a/2),drift=str(sign*b/2))
                    for i,(law,sign) in enumerate((('A',-1),('B',1)))]
            branch='balanced-midpoint'
        else:
            require(len(word)==10,'unexpected earlier midpoint refusal')
            idx,num,den=self.critical(word);readings[-1]+=F(num,den)
            r=list(map(exact,self.rows[idx]));worlds=[]
            for i,law in enumerate(('A','B')):
                w=r[3*i:3*i+3];w=w+[1-sum(w)]
                worlds.append(dict(law=law,weights=list(map(str,w)),origin=str(r[6+2*i]),drift=str(r[7+2*i])))
            branch='terminal-adjustment'
        # Independently replay both returned worlds on the actual named tape.
        for i,world in enumerate(worlds):
            rate=self.rates(i,list(map(F,world['weights'])));position=F(world['origin']);drift=F(world['drift'])
            require(abs(position-readings[0])<=EPS,'initial replay failed')
            for t,c in enumerate(word,1):
                position+=drift+rate[c]
                require(abs(position-readings[t])<=EPS,'persistent physical replay failed')
        return dict(branch=branch,commands=commands,readings=list(map(str,readings)),worlds=worlds)

    def check_all(self):
        exceptional=[]
        for bits in product((0,1),repeat=10):
            if balanced_affine(bits) is None:exceptional.append(bits)
        require(set(exceptional)=={(0,)*5+(1,)*5,(1,)*5+(0,)*5},'binary exceptional classes differ')
        count=0
        # Deliberately enumerate literal orders instead of reusing the constructor's subset constraints.
        for first,second in ((self.base,self.suffix),(self.suffix,self.base)):
            for a in product(first,repeat=5):
                for b in product(second,repeat=5):
                    self.critical(a+b)
                    count+=1
        require(count==497664,'critical word coverage differs')
        return dict(noiseBound=str(EPS),binaryPatterns=1024,ordinaryBinaryPatterns=1022,
                    criticalWords=count,physicalWorldTicks=22*count,multisetRoots=len(self.roots),
                    distinctWorldPairs=len(self.rows),coveredTenPulseWords=8**10)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('packet',type=Path)
    parser.add_argument('--commands',nargs='*',help='receive the next reading on this exact named prefix')
    args=parser.parse_args();receiver=Receiver(json.loads(args.source.read_text()),json.loads(args.packet.read_text()))
    result=receiver.check_all() if args.commands is None else receiver.receive(args.commands)
    print(json.dumps(result))
