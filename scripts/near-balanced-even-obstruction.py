"""Construct fixed separating tapes and persistent collisions at certified horizons."""
import argparse
from collections import Counter
from fractions import Fraction as Q
import json
from pathlib import Path

NAMES=('ref','group','x0','y0','z0','x1','y1','z1')
ANCHORS=(
    ((0,0,0,1,0,0,0,0),(0,0,1,0,0,0,0,0),(0,1,0,0,0,0,1,0),(0,1,0,0,0,1,0,0)),
    ((0,0,0,0,0,0,0,0),(0,0,1,0,-1,0,0,0),(0,1,0,0,0,0,0,0),(0,1,0,0,0,1,0,-1)),
)
BALANCED=((1,2,1,2),(2,1,2,1))

def check(condition,reason):
    if not condition:
        raise ValueError(reason)

def number(value):
    check(type(value) in (int,str),'use an exact integer or rational string')
    return Q(value)

def integer(value):
    value=number(value)
    check(value.denominator==1,'pulse counts must be integers')
    return value.numerator

def rates(law,weights):
    return dict(zip(NAMES,(sum(w*v for w,v in zip(weights,column)) for column in zip(*ANCHORS[law]))))

class Experiment:
    def __init__(self,source,balanced_only=False):
        check(source.get('schema')=='worldlaw.position-drift-fixed-tape-optimum/v1','wrong source schema')
        self.h=integer(source['pulseBudget'])
        self.n=n=self.h//2
        certified_even=self.h==2*n and n>=5 and n%6 in (1,5)
        certified_odd=self.h==2*n+1 and n>=10 and n%6 in (1,4)
        self.balanced_only=balanced_only
        check(self.h>0 and (balanced_only or self.h>=67 or certified_even or certified_odd),'unsupported horizon')
        self.k=(self.h+6)//12
        self.product=n*(self.h-n) if balanced_only else 6*self.k*(self.h-6*self.k)
        self.e=e=Q(self.product,24*self.h)
        self.critical={}
        # The closest multiple of six to H/2 lies at distance at most three.
        for b in range(max(1,n-2),min(self.h,n+4)):
            s=self.h-b
            d=b*s-self.product
            if d<=0:
                continue
            check(s%6!=0 and min(s,b)>=d,'critical category or histogram bound failed')
            self.critical[s]=d
            room=Q(d,6*b)
            alpha=Q(1,12)-2*e/b
            beta=Q(1,12)-2*e/s
            check(alpha>=room and (s-1)*alpha<=2*e,'baseline-first room failed')
            check(2*e/s>=room*(1-Q(1,s)) and beta>=room/s and (b-1)*beta<=2*e,'suffix-first room failed')
            check(Q(s,6)-room==4*e*self.h/b,'terminal contrast identity failed')
        L=self.h-1
        check(L==0 or Q((L*L)//4,24*L)<=e,'a proper span exceeds the target')
        cat=source['catalog']
        check(cat.get('schema')=='worldlaw.position-drift-rate-polytopes/v1','wrong rate catalog')
        commands=cat['commands']
        check(len(commands)==8 and set(commands)==set(NAMES) and len(cat['laws'])==2,'need the eight-command, two-family catalog')
        self.bindings=[]
        for expected in ANCHORS:
            matches=[]
            for law in cat['laws']:
                observed=[tuple(number(row[commands.index(c)]) for c in NAMES) for row in law['vertices']]
                if len(observed)==4 and set(observed)==set(expected):
                    matches.append((law['id'],[observed.index(row) for row in expected]))
            check(len(matches)==1,'the required physical source vertices differ')
            self.bindings.append(matches[0])
        check(self.bindings[0][0]!=self.bindings[1][0],'duplicate law identifiers')
        self.balanced=[[Q(x,6) for x in w] for w in BALANCED]
        ar,br=[rates(l,w) for l,w in enumerate(self.balanced)]
        self.mu={c:(ar[c]+br[c])/2 for c in NAMES}
        check(all(ar[c]-br[c]==(0 if c in NAMES[:2] else Q(1,6)) for c in NAMES),'balanced physical contrast differs')
        self.requested=number(cat['noiseBound'])
        check(self.requested>=0,'negative noise')
    def describe(self):
        if self.balanced_only:
            return dict(horizon=str(self.h),radius=str(self.e),scope='balanced midpoint upper bound',
                        atRequestedNoise='closed-collision' if self.requested>=self.e else 'below-this-bound')
        return dict(horizon=str(self.h),radius=str(self.e),scope='unrestricted adaptive',
                    atRequestedNoise='policy-separates' if self.requested<self.e else 'closed-collision',
                    fixedRuns=[{'command':'ref','repeats':str(self.h-6*self.k)}]+[
                        {'command':c,'repeats':str(self.k)} for c in ('y0','x0','z0','y1','x1','z1')])
    def transfer(self,counts,room):
        """Construct a high-block mass transfer from the literal command counts."""
        w=[row.copy() for row in self.balanced]
        for g in range(2):
            x,y,z=(label+str(g) for label in 'xyz')
            for law,other in ((0,y),(1,z)):
                difference=counts[x]-counts[other]
                if not difference:
                    continue
                amount=(-1,1)[law]*room/difference
                w[law][2*g+1]+=amount
                w[law][2*g]-=amount
                check(min(w[law])>=0 and sum(w[law])==1,'invalid perturbed source mixture')
                return w,law,dict(group=g,law=self.bindings[law][0],difference=str(difference),weightChange=str(amount))
        # Uniform x,y,z counts within each group. Sixfold balance cannot be critical.
        difference=counts['y1']-counts['y0']
        check(difference!=0,'uniform six-command histogram cannot be critical')
        if counts['group']:
            suffix=sum(counts[c] for c in NAMES[2:])
            room=Q(self.critical[suffix],6*suffix)
            amount=room/counts['group']
            # Decrease B's group rate. In the swapped/negated coordinates this
            # lowers the high-block total by room, without affecting any suffix.
            w[1][0]+=amount
            w[1][2]-=amount
            check(min(w[1])>=0 and sum(w[1])==1,'invalid neutral source mixture')
            return w,1,dict(mode='neutral baseline',law=self.bindings[1][0],groupCount=str(counts['group']),weightChange=str(amount))
        amount=-room/difference
        w[0][2]+=amount
        w[0][0]-=amount
        check(min(w[0])>=0 and sum(w[0])==1,'invalid cross-group source mixture')
        return w,0,dict(mode='cross-group suffix',law=self.bindings[0][0],difference=str(difference),weightChange=str(amount))

    def receive(self,runs):
        check(isinstance(runs,list),'supply an array of command/count runs')
        runs=[(r['command'],integer(r['repeats'])) for r in runs]
        check(all(c in NAMES and count>0 for c,count in runs),'invalid command or repeat count')
        horizon=sum(count for _,count in runs)
        check(horizon<=self.h,'supplied tape exceeds the registered horizon')
        counts=Counter()
        cats=[]
        for c,count in runs:
            counts[c]+=count
            bit=c not in NAMES[:2]
            if not cats or bit!=cats[-1]:cats.append(bit)
        # A free terminal reading is available only when the full critical word is known.
        suffix=sum(counts[c] for c in NAMES[2:])
        special=horizon==self.h and len(cats)==2 and suffix in self.critical
        points=[(0,Q(0),Q(0))]
        for c,count in runs:
            t,y,d=points[-1];points.append((t+count,y+count*self.mu[c],d+(Q(count,6) if c in NAMES[2:] else 0)))
        w=self.balanced;move=None
        if special:
            baseline=self.h-suffix
            room=Q(self.critical[suffix],6*baseline)
            w,law,move=self.transfer(counts,room)
            high_first=cats[0]
            swapped=move.get('mode')=='neutral baseline'
            if swapped:
                room=Q(self.critical[suffix],6*suffix)
                baseline,suffix=suffix,baseline
                high_first=not high_first
            if high_first:
                start=[-self.e,self.e]
                drift=[(-1)**l*(-Q(1,12)+2*self.e/suffix+(room/suffix if l==law else 0)) for l in (0,1)]
            else:
                start=[self.e,-self.e];drift=[-2*self.e/baseline,2*self.e/baseline]
            if swapped:
                start=[-v for v in start]
                drift=[-v-(-1)**l*Q(1,12) for l,v in enumerate(drift)]
        else:
            if horizon:
                low=max((b[2]-a[2]-4*self.e)/(b[0]-a[0]) for j,b in enumerate(points) for a in points[:j])
                high=min((b[2]-a[2]+4*self.e)/(b[0]-a[0]) for j,b in enumerate(points) for a in points[:j])
                check(low<=high,'no common midpoint drift')
            else:
                low=Q(0)
            intercept=max(d-t*low-2*self.e for t,_,d in points)
            start=[-intercept/2,intercept/2];drift=[-low/2,low/2]
        physical=[rates(l,w[l]) for l in (0,1)];pos=start.copy()
        observed=[{'tick':'0','reading':'0'}]
        def at(t,y,clean,terminal):
            if terminal:y=sum(clean)/2
            check(all(abs(v-y)<=self.e for v in clean),'original position tube failed')
            observed.append({'tick':str(t),'reading':str(y)})
        check(all(abs(v)<=self.e for v in pos),'initial position tube failed')
        for i,(c,count) in enumerate(runs):
            inc=[drift[l]+physical[l][c] for l in (0,1)]
            t,y,_=points[i]
            final=special and i==len(runs)-1
            if final and count>1:
                at(t+count-1,y+(count-1)*self.mu[c],[v+(count-1)*d for v,d in zip(pos,inc)],False)
            pos=[v+count*d for v,d in zip(pos,inc)]
            at(t+count,y+count*self.mu[c],pos,final)
        worlds=[]
        for l,(name,order) in enumerate(self.bindings):
            source_weights=[None]*4
            for j,i in enumerate(order):source_weights[i]=str(w[l][j])
            worlds.append({'law':name,'weights':source_weights,'origin':str(start[l]),'drift':str(drift[l])})
        return dict(radius=str(self.e),branch='terminal midpoint' if special else 'balanced midpoint',
                    measurements=observed,nominalRates={c:str(v) for c,v in self.mu.items()},transfer=move,worlds=worlds)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('--runs',type=Path,help='JSON array of received command/count pairs')
    parser.add_argument('--balanced-bound',action='store_true',help='use the balanced midpoint upper bound at any positive horizon')
    args=parser.parse_args()
    experiment=Experiment(json.loads(args.source.read_text()),balanced_only=args.balanced_bound)
    print(json.dumps(experiment.describe() if args.runs is None else experiment.receive(json.loads(args.runs.read_text()))))
