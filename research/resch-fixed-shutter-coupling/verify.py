"""Independent raw-marginal and exact dual verification without an LP solver."""
from fractions import Fraction as F
from collections import Counter
from pathlib import Path
import json, gzip, sys, math, hashlib
from archive_reader import load_fixed
def mean(xs):
    a=list(xs);return sum(a)/len(a)
def verify(source,artifact):
    raw=load_fixed(source);r=json.loads(gzip.decompress(Path(artifact).read_bytes()))
    center=sum(sum(sum(col) for col in cols) for cols in raw.values())/(101*500)
    assert center/1815==F(r['mean'])
    bounds=[[],[]];ach=[[],[]];stored=[];largest=None;wide=None
    assert len(r['cycles'])==101
    for cyc,row in enumerate(r['cycles'],640):
        assert row['cycle']==cyc;columns=raw[cyc];offset=sum(min(x) for x in columns)-center
        spread=max(max(x)-min(x) for x in columns);step=spread/32;scale=max(F(1),abs(offset),abs(offset+8*spread))
        for side,sign in enumerate([1,-1]):
            c=row['certificates'][side]
            if not step:bound=offset**3
            else:
                assert (offset,step,scale)==tuple(F(c[k]) for k in ['origin','step','scale'])
                # Each rounded potential uses the public denominator 10^9. Work with integers.
                paths={0:0};total=0
                for col,price in zip(columns,c['prices']):
                    prices={int(i):F(p)*10**9 for i,p in price.items()}
                    assert all(x.denominator==1 for x in prices.values())
                    prices={k:int(x) for k,x in prices.items()}
                    col_min=min(col);freq=Counter((math.floor if sign==1 else math.ceil)((x-col_min)/step) for x in col)
                    assert set(freq)==set(prices)
                    total+=sum(n*prices[q] for q,n in freq.items())
                    transit={}
                    for q in freq:
                        for before,p in paths.items():
                            j=before+q;value=p+prices[q]
                            if j not in transit or value>transit[j]:transit[j]=value
                    paths=transit
                slack=min(sign*((offset+step*j)/scale)**3-F(p,10**9) for j,p in paths.items())
                bound=sign*(F(total,500*10**9)+slack)*scale**3
            assert bound==F(row[['lower','upper'][side]]);bounds[side].append(bound)
        def third(cols):
            return sum((sum(v)-center)**3 for v in zip(*cols))/500
        vals={'stored':third(columns),'comonotone':third([sorted(x) for x in columns])}
        for i in range(8):vals['reverse_'+str(i)]=third([sorted(x,reverse=j==i) for j,x in enumerate(columns)])
        means=list(map(mean,columns));h=sum(means)-center
        vals['conditional_independence']=h**3+sum(mean((x-m)**3+3*h*(x-m)**2 for x in col) for col,m in zip(columns,means))
        assert vals=={k:F(v) for k,v in row['witness'].items()}
        for j,fn in enumerate([min,max]):ach[j].append(fn(vals.values()))
        stored.append(vals['stored']);width=bounds[1][-1]-bounds[0][-1]
        if wide is None or width>wide:largest,wide=cyc,width
    den=1815**3;low,high=[mean(x)/den for x in bounds];a,b=[mean(x)/den for x in ach]
    assert [low,high]==list(map(F,r['outer'])) and [a,b]==list(map(F,r['attained']))
    assert mean(stored)/den==F(r['stored']) and largest==r['widest_cycle']
    result='all_negative' if high<0 else 'all_positive' if low>0 else 'both_signs_attained' if a<0<b else 'unresolved'
    assert result==r['sign'];print('VERIFIED',len(raw),202,1111,result,'widest',largest,flush=True)
if __name__=='__main__':verify(*sys.argv[1:])
