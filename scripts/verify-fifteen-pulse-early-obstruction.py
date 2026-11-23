"""Check the fifteen-pulse causal collision at 3/20 against the registered source."""
import argparse
import base64
from collections import Counter
from fractions import Fraction as Q
from functools import lru_cache
import gzip
from itertools import combinations, combinations_with_replacement, product
import json
from pathlib import Path
from runpy import run_path

kernel=run_path(str(Path(__file__).with_name('near-balanced-even-obstruction.py')))
NAMES=kernel['NAMES']
ANCHORS=kernel['ANCHORS']
E=Q(3,20)
ZERO=Q(0)
TAILS=list(combinations_with_replacement(range(8),7))
TAIL_INDEX={v:i for i,v in enumerate(TAILS)}


def need(value,message):
    if not value:raise ValueError(message)


def histogram(g):
    return tuple(j for j in range(2,8) for _ in range((2 if (j-2)//3==g else 1)-int(j==3+3*g)))


def fit(positions,readings):
    residual=[y-p for p,y in zip(positions,readings)]
    velocity=max(((r-residual[i]-2*E)/(j-i) for j,r in enumerate(residual) for i in range(j)),default=ZERO)
    origin=max(r-i*velocity-E for i,r in enumerate(residual))
    need(all(abs(origin+i*velocity-r)<=E for i,r in enumerate(residual)),'affine state misses the actual readings')
    return origin,velocity


def canonical_weights(row):
    weights=[list(map(Q,row[:3])),list(map(Q,row[3:6]))]
    for w in weights:w.append(1-sum(w))
    return weights,list(map(Q,row[6:10]))


def unpack_leaf(params):
    p=list(map(Q,params))
    need(len(p)==17,'incorrect conditional table length')
    w=[p[:4],p[4:8]]
    need(all(min(v)>=0 and sum(v)==1 for v in w),'invalid analytic source mixture')
    return w,p[8:16],p[16]


def law_rates(l,w):
    need(len(w)==4 and min(w)>=0 and sum(w)==1,'invalid physical mixture')
    return [sum(a*v for a,v in zip(w,c)) for c in zip(*ANCHORS[l])]


class Receiver:
    def __init__(self,source,packet):
        self.base=kernel['Experiment'](source,balanced_only=True)
        need(self.base.h==15,'need the registered fifteen-pulse source')
        self.base.e=E
        self.mu=[self.base.mu[c] for c in NAMES]
        need(packet['schema']=='worldlaw.fifteen-pulse-early-obstruction/v1','wrong packet schema')
        self.reference=json.loads(gzip.decompress(base64.b64decode(packet['referenceTablesGzipBase64'],validate=True)))
        self.single={tuple(r[:-1]):r[-1] for r in packet['singleDifference']}
        self.ordered={tuple(r[:-1]):r[-1] for r in packet['orderedExceptions']}
        self.eighth=packet['eighth']
        self.seventh=packet['seventh']
        self.hard=[histogram(g) for g in range(2)]

    def trigger(self,w):
        for g in (0,1):
            x=2+3*g
            seven=list(self.hard[g]);seven.remove(x)
            if w[0]==x and sorted(w[:7])==seven:return 'seventh',g
        if w[:7]==[0]*7 and w[7] in (2,5):return 'reference',(w[7]-2)//3
        for g,hist in enumerate(self.hard):
            if tuple(sorted(w[:8]))==hist:return 'eighth',g
        return None,None

    def early(self,w,mode,g):
        display=self.mu.copy();corrections={}
        if mode=='reference':
            table=self.reference[g];eta=list(map(Q,table['adjustments']))
            corrections[7]=eta[0];cut=8
            display=[a+b for a,b in zip(display,eta[1:])]
            index=table['indices'][TAIL_INDEX[tuple(sorted(w[8:]))]]
            weights,coordinates=canonical_weights(table['bank'][index])
        elif mode=='seventh':
            tree=self.seventh[g]
            weights,display,child=unpack_leaf(tree['children'][w[7]])
            corrections={6:Q(tree['adjustment']),7:child};cut=8;coordinates=None
        else:
            first,last=w[0],w[7]
            leaf=next((l for l in self.eighth[g] if (not l['left'] or l['left']==[first]) and l['right']==[last]),None)
            need(leaf is not None,'missing eighth-reading leaf')
            weights,display,jump=unpack_leaf(leaf['params'])
            corrections[7]=jump;cut=8;coordinates=None
        increments=[(self.mu[c] if t<cut else display[c])+corrections.get(t,ZERO) for t,c in enumerate(w)]
        return weights,coordinates,increments,mode=='reference'

    def critical(self,w,b,s,order):
        suffix=w[:s] if order else w[b:]
        baseline=w[s:] if order else w[:b]
        counts=Counter(suffix);directions=[]
        for g in (0,1):
            x=2+3*g
            for l in (0,1):
                diff=counts[x]-counts[x+l+1]
                if diff:directions.append((g,l,diff))
        room=Q(1,3*b)
        weights=[v.copy() for v in self.base.balanced];totals=[ZERO,ZERO]
        if b==7 and sum(abs(d) for _,_,d in directions)==1:
            g,l,_=directions[0]
            key=(g,l+1,counts[2+3*g],baseline.count(0),order)
            if key in self.single:row=self.single[key]
            else:
                need(order==0 and suffix[0] not in (2,5),'missing earlier policy')
                row=self.ordered[g,order,suffix[0],suffix[-1]]
            weights,coordinates=canonical_weights(row)
            return weights,coordinates,'single-difference panel'
        need(directions,'unavailable mass direction')
        large=next((v for v in directions if abs(v[2])>=2),None)
        selected=([directions[0]] if b==8 else ([large] if large else directions[:2]))
        for g,l,d in selected:
            portion=room/len(selected)
            amount=(-1,1)[l]*portion/d
            weights[l][2*g+1]+=amount;weights[l][2*g]-=amount
            totals[l]-=portion
        if order:
            beta=Q(1,12)-2*E/s
            coordinates=[-E,E]+[(-1)**l*(-beta-totals[l]/s) for l in (0,1)]
        else:coordinates=[E,-E,-2*E/b,2*E/b]
        # The stored packet's order is origin A, drift A, origin B, drift B.
        return weights,[coordinates[i] for i in (0,2,1,3)],'distributed transfer'

    def receive(self,commands):
        need(isinstance(commands,list) and len(commands)<=15 and all(c in NAMES for c in commands),'invalid received prefix')
        length=len(commands);w=[NAMES.index(c) for c in commands]+[0]*(15-length)
        mode,g=self.trigger(w)
        if mode:
            weights,coords,inc,free=self.early(w,mode,g)
        else:
            bits=[v>=2 for v in w];s=sum(bits);b=15-s
            if {b,s}!={7,8} or sum(a!=z for a,z in zip(bits,bits[1:]))!=1:
                out=self.base.receive([dict(command=NAMES[c],repeats=1) for c in w])
                return dict(branch='balanced midpoint',radius=str(E),readings=[r['reading'] for r in out['measurements'][:length+1]],worlds=out['worlds'])
            weights,coords,mode=self.critical(w,b,s,int(bits[0]));inc=[self.mu[c] for c in w];free=True
        ys=[ZERO]
        for value in inc:ys.append(ys[-1]+value)
        rates=[law_rates(l,weights[l]) for l in (0,1)];raw=[]
        for r in rates:
            p=[ZERO]
            for c in w:p.append(p[-1]+r[c])
            raw.append(p)
        if coords is None:coords=sum((list(fit(p,ys)) for p in raw),[])
        values=[[p+coords[2*l]+t*coords[2*l+1] for t,p in enumerate(path)] for l,path in enumerate(raw)]
        if free:ys[-1]=sum(p[-1] for p in values)/2
        need(all(abs(y-p)<=E for v in values for p,y in zip(v,ys)),'persistent position leaves the noise tube')
        worlds=[]
        for l,(name,indices) in enumerate(self.base.bindings):
            source=[None]*4
            for j,index in enumerate(indices):source[index]=str(weights[l][j])
            worlds.append(dict(law=name,weights=source,origin=str(coords[2*l]),drift=str(coords[2*l+1])))
        return dict(branch=mode,radius=str(E),readings=list(map(str,ys[:length+1])),worlds=worlds)


def panel_bounds(weights,coords,blocks):
    """Check all permutations within each block, including every proper prefix."""
    end=[]
    for l in (0,1):
        rates=law_rates(l,weights[l]);p,v=coords[2*l:2*l+2];t=0
        need(abs(p)<=E,'bad panel origin')
        for tokens,display in blocks:
            ds=sorted(v+rates[c]-display[c] for c in tokens)
            lo=hi=p
            for a,b in zip(ds,reversed(ds)):
                t+=1;lo+=a;hi+=b
                if t<15:need(-E<=lo<=hi<=E,'panel fails a within-block permutation')
            p+=sum(ds)
        need(t==15,'wrong horizon');end.append(p)
    need(abs(end[0]-end[1])<=2*E,'panel lacks terminal overlap')


@lru_cache(None)
def contrast_rows(lengths):
    rows=[]
    for i,j,k in combinations(range(16),3):
        for sign in (-1,1):
            c=[sign*((k-j) if i<=t<j else -(j-i) if j<=t<k else 0) for t in range(15)]
            w=[];s=0
            for n in lengths:
                w.extend(sorted(c[s:s+n]));s+=n
            rows.append((w,c[6],c[7],sum(max(0,v) for v in c[s:]),sum(min(0,v) for v in c[s:]),k-i))
    return rows


def check_leaf(groups,params,jump7,mu):
    """Rearrangement over each past block and independent future command extrema."""
    from math import lcm
    weights,future,jump8=unpack_leaf(params)
    for l in (0,1):
        physical=law_rates(l,weights[l])
        past=[a-b for a,b in zip(physical,mu)]
        residual=[a-b for a,b in zip(physical,future)]
        scale=lcm(*(v.denominator for v in past+residual+[jump7,jump8,E]))
        support=[int(scale*a) for g in groups for a in sorted(past[c] for c in g)]
        low,high=int(scale*min(residual)),int(scale*max(residual))
        f7,f8,e=[int(scale*v) for v in (jump7,jump8,E)]
        for coeff,c7,c8,pos,neg,span in contrast_rows(tuple(map(len,groups))):
            value=sum(a*b for a,b in zip(coeff,support))-c7*f7-c8*f8+pos*high+neg*low
            need(value<=2*span*e,'an analytic leaf misses an original strip triple')


def verify(receiver):
    mu=receiver.mu
    need(len(receiver.reference)==len(receiver.eighth)==len(receiver.seventh)==2,'missing group')
    table_count=0;leaf_count=0
    for g in (0,1):
        x=2+3*g;table=receiver.reference[g];eta=list(map(Q,table['adjustments']))
        need(len(eta)==9 and len(table['indices'])==len(TAILS),'incomplete reference panel')
        now=mu.copy();now[x]+=eta[0];future=[v+d for v,d in zip(mu,eta[1:])]
        for tail,index in zip(TAILS,table['indices']):
            need(type(index) is int and 0<=index<len(table['bank']),'invalid world pair index')
            weights,coords=canonical_weights(table['bank'][index])
            panel_bounds(weights,coords,[([0]*7,mu),([x],now),(tail,future)])
            table_count+=1
        h=receiver.hard[g]
        # Root-seven prior is x_g followed by six permutable commands. The
        # next command selects its child only after the common mark is fixed.
        middle=list(h);middle.remove(x);middle.remove(x);tree=receiver.seventh[g]
        need(len(tree['children'])==8,'missing seventh-mark child')
        for c,params in enumerate(tree['children']):
            check_leaf([[x],middle,[c]],params,Q(tree['adjustment']),mu);leaf_count+=1
        leaves=receiver.eighth[g]
        keys=[(tuple(v['left']),tuple(v['right'])) for v in leaves]
        expected={((),(c,)) for c in set(h) if c!=x}|{((c,),(x,)) for c in set(h) if c!=x}
        need(set(keys)==expected and len(keys)==len(expected),'incomplete eighth-mark cover')
        for v in leaves:
            left,right=v['left'],v['right'];middle=list(h)
            for c in left+right:middle.remove(c)
            groups=[[c] for c in left]+[middle]+[[c] for c in right]
            check_leaf(groups,v['params'],ZERO,mu);leaf_count+=1
    missing=[];small=set()
    for g,l,u,refs,order in product(range(2),(1,2),(1,2,3),range(8),range(2)):
        key=(g,l,u,refs,order);counts=[u if j//3==g else 3-u for j in range(6)];counts[3*g+l]-=1
        suf=[2+j for j,q in enumerate(counts) for _ in range(q)];baseline=[0]*refs+[1]*(7-refs)
        if key not in receiver.single:missing.append(key);continue
        small.add(key);weights,coords=canonical_weights(receiver.single[key]);blocks=[(baseline,mu),(suf,mu)]
        panel_bounds(weights,coords,blocks[::-1] if order else blocks)
    need(small==set(receiver.single) and set(missing)=={(g,1,2,7,o) for g,o in product(range(2),range(2))},'single-difference cover changed')
    expected=set()
    for g in (0,1):
        for first in set(receiver.hard[g])-{2,5}:
            rest=list(receiver.hard[g]);rest.remove(first)
            for last in set(rest):
                middle=rest.copy();middle.remove(last);key=(g,0,first,last);expected.add(key)
                weights,coords=canonical_weights(receiver.ordered[key])
                panel_bounds(weights,coords,[([0]*7,mu),([first],mu),(middle,mu),([last],mu)])
    need(expected==set(receiver.ordered),'ordered exception cover changed')
    distributed=0
    for s in (7,8):
        b=15-s
        for h in combinations_with_replacement(range(2,8),s):
            c=Counter(h)
            if b==7 and sum(abs(c[2+3*g]-c[2+3*g+l]) for g,l in product(range(2),(1,2)))==1:continue
            for order in (0,1):
                blocks=[([0]*b,mu),(h,mu)]
                if order:blocks.reverse()
                w=[n for bl,_ in blocks for n in bl];weights,coords,_=receiver.critical(w,b,s,order)
                # Both baseline rate residuals must agree, including arbitrary group commands.
                need(all(law_rates(l,weights[l])[1]-mu[1]==law_rates(l,weights[l])[0]-mu[0] for l in (0,1)),'distributed move changes a baseline')
                panel_bounds(weights,coords,blocks);distributed+=1
    return dict(horizon='15',adaptiveRadius=str(E),fixedRadius=str(E),literalWords=str(8**15),
                referenceHistogramPanels=table_count,analyticLeaves=leaf_count,singleDifferencePanels=len(small),
                orderedPanels=len(expected),distributedHistogramOrders=distributed)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('packet',type=Path)
    parser.add_argument('--commands',nargs='*',help='received command prefix through any of the fifteen pulses')
    args=parser.parse_args()
    receiver=Receiver(json.loads(args.source.read_text()),json.loads(args.packet.read_text()))
    result=verify(receiver) if args.commands is None else receiver.receive(args.commands)
    print(json.dumps(result))
