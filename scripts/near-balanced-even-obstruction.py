"""Construct measured or colliding witnesses for even horizons one suffix away from balance."""
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
    def __init__(self,source):
        check(source.get('schema')=='worldlaw.position-drift-fixed-tape-optimum/v1','wrong source schema')
        self.h=integer(source['pulseBudget'])
        self.n=n=self.h//2
        check(self.h==2*n and n>=5 and n%6 in (1,5),'need H=2n, n>=5, n=1 or 5 modulo 6')
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
        self.e=e=Q(n*n-1,48*n)
        self.alpha=Q(1,12)-2*e/n
        room=Q(1,6*n)
        check(2*e/n>=room and self.alpha>=room and (n-1)*self.alpha<=2*e,'proper-prefix bounds failed')
        check(Q(n,6)-room==8*e,'terminal contrast identity failed')
        self.k=(n+1)//6
        check(abs(6*self.k-n)==1 and Q(self.k*(self.h-6*self.k),4*self.h)==e,'fixed-tape radius differs')
        self.requested=number(cat['noiseBound'])
        check(self.requested>=0,'negative noise')
    def describe(self):
        return dict(horizon=str(self.h),radius=str(self.e),scope='unrestricted adaptive',
                    atRequestedNoise='policy-separates' if self.requested<self.e else 'closed-collision',
                    fixedRuns=[{'command':'ref','repeats':str(self.h-6*self.k)}]+[
                        {'command':c,'repeats':str(self.k)} for c in ('y0','x0','z0','y1','x1','z1')])
    def transfer(self,counts):
        """Change one within-group coordinate while keeping that group's baseline mass."""
        w=[row.copy() for row in self.balanced]
        for g in range(2):
            x,y,z=(label+str(g) for label in 'xyz')
            for law,other in ((0,y),(1,z)):
                difference=counts[x]-counts[other]
                if not difference:
                    continue
                amount=Q((-1,1)[law],6*self.n*difference)
                w[law][2*g+1]+=amount
                w[law][2*g]-=amount
                check(min(w[law])>=0 and sum(w[law])==1,'invalid perturbed source mixture')
                return w,law,dict(group=g,law=self.bindings[law][0],difference=str(difference),weightChange=str(amount))
        raise ValueError('a suffix count must differ within a group')

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
        special=horizon==self.h and len(cats)==2 and sum(counts[c] for c in NAMES[2:])==self.n
        points=[(0,Q(0),Q(0))]
        for c,count in runs:
            t,y,d=points[-1];points.append((t+count,y+count*self.mu[c],d+(Q(count,6) if c in NAMES[2:] else 0)))
        w=self.balanced;move=None
        if special:
            w,law,move=self.transfer(counts)
            if cats[0]:
                start=[-self.e,self.e]
                drift=[(-1)**l*(-self.alpha+(Q(1,6*self.n**2) if l==law else 0)) for l in (0,1)]
            else:
                start=[self.e,-self.e];drift=[-2*self.e/self.n,2*self.e/self.n]
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
    args=parser.parse_args()
    experiment=Experiment(json.loads(args.source.read_text()))
    print(json.dumps(experiment.describe() if args.runs is None else experiment.receive(json.loads(args.runs.read_text()))))
