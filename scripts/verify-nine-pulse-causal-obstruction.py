"""Exact original-position receiver for the registered nine-pulse causal obstruction."""
import argparse
from fractions import Fraction as F
from itertools import combinations,product
from math import lcm
from pathlib import Path
import json

H=9
EPS=F(1,12)
B=('ref','group')
S=('x0','y0','z0','x1','y1','z1')


def require(ok,why):
    if not ok:raise ValueError(why)


def q(value):
    require(type(value) in (str,int),'expected integer or rational text')
    return F(value)


def affine(delta):
    f=[F(0)]
    for d in delta:f.append(f[-1]+d)
    if len(f)==1:return F(0),F(0)
    lo=max((f[j]-f[i]-4*EPS)/(j-i) for j in range(1,len(f)) for i in range(j))
    hi=min((f[j]-f[i]+4*EPS)/(j-i) for j in range(1,len(f)) for i in range(j))
    if lo>hi:return None
    a=max(y-i*lo-2*EPS for i,y in enumerate(f))
    require(all(abs(y-a-i*lo)<=2*EPS for i,y in enumerate(f)),'affine intercept failed')
    return a,lo


def prefix_key(word,bases):
    if not word:return (),()
    b=word[0] in bases;i=0
    while i<len(word) and (word[i] in bases)==b:i+=1
    if any((c in bases)==b for c in word[i:]):return None
    return tuple(sorted(word[:i])),tuple(sorted(word[i:]))


def index_of(word):
    n=0
    for c in word:n=8*n+c
    return n


def digits(x,length):
    return tuple((x//8**j)%8 for j in range(length-1,-1,-1))


class Receiver:
    """Check source-backed certificates and answer an actual command prefix causally."""
    def __init__(self,source,p):
        cat=source['catalog']
        require(source.get('schema')=='worldlaw.position-drift-fixed-tape-optimum/v1' and
                cat.get('schema')=='worldlaw.position-drift-rate-polytopes/v1' and source['pulseBudget']=='9' and p['schema']=='worldlaw.nine-pulse-causal-obstruction/v1' and
                p['catalog']==cat and q(cat['noiseBound'])==EPS,'source or course differs')
        self.names=cat['commands'];require(len(self.names)==8 and set(self.names)==set(B+S),'wrong commands')
        require(all(isinstance(n,str) for n in self.names),'invalid command names')
        self.base=tuple(self.names.index(c) for c in B);self.suffix=tuple(self.names.index(c) for c in S)
        require([l['id'] for l in cat['laws']]==['A','B'],'wrong source families')
        self.v=[[[q(x) for x in row] for row in law['vertices']] for law in cat['laws']]
        require(all(len(v)==4 and all(len(row)==8 for row in v) for v in self.v),'wrong vertex widths')
        self.rows=p['worldPairs'];self.worlds=[]
        for row in self.rows:
            require(len(row)==10,'incorrect world-pair width')
            raw=list(map(q,row));pair=[]
            for law in (0,1):
                w=raw[3*law:3*law+3];w.append(1-sum(w))
                require(min(w)>=0,'negative physical mass')
                start,drift=raw[6+2*law:8+2*law];rate=self.rates(law,w)
                pair.append((w,start,drift,[drift+r for r in rate]))
            self.worlds.append(pair)
        self.cache={}
        self.weights=[[F(v,6) for v in values] for values in ((1,2,1,2),(2,1,2,1))]
        rates=[self.rates(i,w) for i,w in enumerate(self.weights)]
        self.mu=[(a+b)/2 for a,b in zip(*rates)]
        self.delta=[a-b for a,b in zip(*rates)]
        require(all(self.delta[i]==(F(1,6) if i in self.suffix else 0) for i in range(8)),
                'balanced source contrast changed')
        self.standard={}
        for u,v,shifts,ids in p['panels']:
            key=(tuple(u),tuple(v))
            require(key not in self.standard and len(u)+len(v)>=5,'duplicate or too-early group')
            require(key==prefix_key(tuple(u+v),self.base),'noncanonical grouped prefix')
            self.standard[key]=self.panel((tuple(u),tuple(v)),shifts,ids)
        self.centers={}
        self.upper=q(p['upper'])
        require(self.upper==EPS,'wrong registered upper bound')
        for head,tree in p['centers']:
            head=tuple(head)
            require(len(head)==4 and len(set(head))==4 and all(c in self.suffix for c in head)
                    and head not in self.centers,'bad conditional center root')
            self.centers[head]=tree

    def rates(self,l,w):
        return [sum(m*v for m,v in zip(w,c)) for c in zip(*self.v[l])]

    def panel(self,blocks,shifts,ids):
        t=sum(map(len,blocks));r=H-t
        require(0<=r<=5 and all(type(x) is int and 0<=x<8 for b in blocks for x in b) and
                len(ids)==8**r and len(shifts)==sum(8**i for i in range(r)) and
                all(type(ix) is int and 0<=ix<len(self.worlds) for ix in ids),'incomplete panel')
        return blocks,list(map(q,shifts)),ids

    def scaled(self,idx):
        key=idx
        if key not in self.cache:
            mu=self.mu;rows=[]
            for _,start,_,rate in self.worlds[idx]:
                rows.append([start,*[a-b for a,b in zip(rate,mu)]])
            den=lcm(12,*(x.denominator for row in rows for x in row))
            self.cache[key]=(den,*[tuple(int(x*den) for x in row) for row in rows])
        return self.cache[key]

    def verify_panel(self,pa):
        blocks,shifts,ids=pa;t=sum(map(len,blocks));r=H-t
        for ix,world in enumerate(ids):
            tail=digits(ix,r);den,a,b=self.scaled(world);radius=den//12
            pos=[]
            for state in (a,b):
                base=state[0];clock=0
                require(abs(base)<=radius,'initial physical tube failed')
                for block in blocks:
                    increments=sorted(state[c+1] for c in block)
                    lo=hi=base
                    for j,x in enumerate(increments):
                        lo+=x;hi+=increments[-j-1];clock+=1
                        if clock<t:require(lo>=-radius and hi<=radius,'prefix permutation tube failed')
                    base+=sum(increments)
                pos.append(base)
            off=0;code=0
            for j,c in enumerate(tail):
                shift=shifts[off+code];n,d=shift.numerator,shift.denominator
                require(all(abs(x*d-den*n)<=radius*d for x in pos),'shared future observation failed')
                pos[0]+=a[c+1];pos[1]+=b[c+1];off+=8**j;code=8*code+c
            require(abs(pos[0]-pos[1])<=2*radius,'terminal common reading failed')


    def upper_leaf(self,word,increments,params):
        require(len(params)==16,'incorrect center leaf width')
        weights=[list(map(q,params[:4])),list(map(q,params[4:8]))]
        future=list(map(q,params[8:]))
        largest=F(0)
        for law,w in enumerate(weights):
            require(min(w)>=0 and sum(w)==1,'invalid persistent center mixture')
            rates=self.rates(law,w)
            prefix=[rates[c]-y for c,y in zip(word,increments)]
            remaining=[r-u for r,u in zip(rates,future)]
            scale=lcm(*(x.denominator for x in prefix+remaining))
            prefix=[int(x*scale) for x in prefix];mn=int(min(remaining)*scale);mx=int(max(remaining)*scale)
            partial=[0]
            for x in prefix:partial.append(partial[-1]+x)
            n=len(word)
            # For each triple, extrema over every unfixed action are achieved by taking the
            # minimum or maximum rate deviation on the two opposite-signed intervals.
            for i,j,k in combinations(range(H+1),3):
                a=(k-j)*(partial[min(n,j)]-partial[min(n,i)])
                b=(j-i)*(partial[min(n,k)]-partial[min(n,j)])
                x=(k-j)*(max(n,j)-max(n,i))
                y=(j-i)*(max(n,k)-max(n,j))
                num=max(a-b+x*mx-y*mn,-a+b-x*mn+y*mx)
                if num*largest.denominator>largest.numerator*2*(k-i)*scale:
                    largest=F(num,2*(k-i)*scale)
        require(largest<=self.upper,'analytic center exceeds the certified upper bound: '+str(largest))
        return largest

    def inspect_tree(self,head,tree,report):
        def descend(word,prior,node):
            require(isinstance(node,list) and len(node)==2,'bad center node')
            step=q(node[0]);known=prior+[step];child=node[1]
            if len(child)==8:
                require(len(word)<H and all(isinstance(c,list) for c in child),'incomplete decision')
                for i,branch in enumerate(child):descend(word+(i,),known,branch)
            else:
                report['leafCount']+=1
                radius=self.upper_leaf(word,known,child)
                report['maximum']=max(report['maximum'],radius)
        descend(head,[self.mu[c] for c in head[:-1]],tree)

    def selected(self,word):
        for j in range(1,len(word)+1):
            key=prefix_key(word[:j],self.base)
            if key in self.standard:return self.standard[key],j
        return None,None

    def receive(self,commands):
        require(len(commands)<=H and all(c in self.names for c in commands),'invalid action prefix')
        word=tuple(self.names.index(c) for c in commands);head=word[:4]
        ys=[F(0)];worlds=[]
        if head in self.centers:
            kind='conditional center';tree=self.centers[head];num=3
            for c in word[:3]:ys.append(ys[-1]+self.mu[c])
            while True:
                if num<len(word):ys.append(ys[-1]+q(tree[0]));num+=1
                child=tree[1]
                if len(child)!=8:break
                tree=child[word[num] if num<len(word) else 0]
            params=list(map(q,child));future=params[8:]
            for c in word[num:]:ys.append(ys[-1]+future[c])
            for law in (0,1):
                w=params[4*law:4*law+4];rates=self.rates(law,w);f=[ys[0]];total=F(0)
                for c,y in zip(word,ys[1:]):total+=rates[c];f.append(y-total)
                lo=max((f[j]-f[i]-2*self.upper)/(j-i) for j in range(1,len(f)) for i in range(j))
                hi=min((f[j]-f[i]+2*self.upper)/(j-i) for j in range(1,len(f)) for i in range(j))
                require(lo<=hi,'center world has no drift')
                start=max(x-i*lo-self.upper for i,x in enumerate(f))
                worlds.append((w,start,lo))
        else:
            for c in word:ys.append(ys[-1]+self.mu[c])
            pa,t=self.selected(word)
            if pa is None:
                ab=affine([self.delta[c] for c in word]);require(ab is not None,'uncovered midpoint refusal')
                start,drift=ab;kind='balanced midpoint'
                worlds=[(w,sgn*start/2,sgn*drift/2) for w,sgn in zip(self.weights,(-1,1))]
            else:
                kind='shared-prefix panel';_,shifts,ids=pa
                tail=word[t:]+(0,)*(H-len(word));wx=ids[index_of(tail)]
                worlds=[(w,s,d) for w,s,d,_ in self.worlds[wx]];off=code=0
                for i in range(t,min(H-1,len(word))+1):
                    ys[i]+=shifts[off+code]
                    if i<len(word):off+=8**(i-t);code=8*code+word[i]
                if len(word)==H:
                    ys[-1]=sum(w[1]+sum(w[3][c] for c in word) for w in self.worlds[wx])/2
        printed=[]
        for law,(w,start,drift) in enumerate(worlds):
            rates=self.rates(law,w);y=start
            require(abs(y-ys[0])<=self.upper,'returned start failed')
            for i,c in enumerate(word,1):
                y+=drift+rates[c];require(abs(y-ys[i])<=self.upper,'returned physical world fails replay')
            printed.append(dict(law=('A','B')[law],weights=list(map(str,w)),origin=str(start),drift=str(drift)))
        return dict(branch=kind,commands=commands,readings=list(map(str,ys)),worlds=printed)

    def verify(self):
        critical=[bits for bits in product((0,1),repeat=H) if affine([F(b,6) for b in bits]) is None]
        require(set(critical)=={(a,)*n+(1-a,)*(H-n) for a in (0,1) for n in (4,5)},'binary exception set differs')
        for panel in self.standard.values():self.verify_panel(panel)
        report={'leafCount':0,'maximum':F(0)}
        for root,tree in self.centers.items():self.inspect_tree(root,tree,report)
        # Count all literal paths in exceptional categories using ordered-count states, stopping
        # when a completely verified controller state owns every subsequent command.
        count=0
        for bits in critical:
            def walk(word):
                n=len(word)
                if word[:4] in self.centers or prefix_key(word,self.base) in self.standard:
                    result=1
                    for bit in bits[n:]:result*=len(self.suffix if bit else self.base)
                    return result
                require(n<H,'uncovered literal critical word: '+str(word))
                return sum(walk(word+(c,)) for c in (self.suffix if bits[n] else self.base))
            count+=walk(())
        require(count==331776,'unexpected critical word count')
        require(report['maximum']==self.upper,'reported upper lacks a binding center')
        return dict(upper=str(self.upper),ordinaryCategoryWords=512-len(critical),criticalWords=count,
                    totalWords=8**9,physicalPanels=len(self.standard),conditionalRoots=len(self.centers),
                    analyticLeaves=report['leafCount'],distinctWorldPairs=len(self.worlds))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('packet',type=Path)
    parser.add_argument('--commands',nargs='*')
    args=parser.parse_args()
    with args.packet.open(encoding='utf8') as f:packet=json.load(f)
    receiver=Receiver(json.loads(args.source.read_text()),packet)
    print(json.dumps(receiver.verify() if args.commands is None else receiver.receive(args.commands)))
