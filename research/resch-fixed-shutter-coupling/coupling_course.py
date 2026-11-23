"""Bound the fixed-z third central moment over every within-cycle empirical joint law."""
from collections import Counter
from fractions import Fraction as F
from functools import lru_cache
from pathlib import Path
import json, sys
from archive_reader import load_fixed
from certified_transport import lower_flow_dual,tests
GRID=32
def avg(xs):
    xs=list(xs);return sum(xs)/len(xs)
def certificate(cols,mu,sign):
    base=[min(col) for col in cols];spread=max(max(x)-min(x) for x in cols);origin=sum(base)-mu
    if not spread:return sign*origin**3,dict(constant=str(origin))
    step=spread/GRID;scale=max(F(1),abs(origin),abs(origin+8*spread))
    marg=[]
    for col,b in zip(cols,base):
        indices=Counter()
        for x in col:
            a=(x-b)/step;lo=a.numerator//a.denominator
            idx=lo if sign==1 else -((-a.numerator)//a.denominator)
            indices[idx]+=1
        marg.append({v:F(n,len(col)) for v,n in indices.items()})
    @lru_cache(None)
    def cost(s):return sign*((origin+step*s)/scale)**3
    val,price,_=lower_flow_dual(marg,cost)
    return val*scale**3,dict(prices=[{str(k):str(v) for k,v in p.items()} for p in price],
                             origin=str(origin),step=str(step),scale=str(scale),outer=str(val*scale**3))
def run(src):
    rows=load_fixed(src);mu=avg(sum(map(avg,cols)) for cols in rows.values());reports=[]
    for cycle,cols in rows.items():
        def moment(c):
            return avg((sum(t)-mu)**3 for t in zip(*c))
        pc=[avg(x) for x in cols];shift=sum(pc)-mu
        indep=shift**3+sum(avg((x-b)**3 for x in col)+3*shift*avg((x-b)**2 for x in col) for col,b in zip(cols,pc))
        witnesses={'stored':moment(cols),'comonotone':moment([sorted(x) for x in cols]),'conditional_independence':indep}
        for j in range(8):
            witnesses['reverse_'+str(j)]=moment([sorted(x,reverse=(i==j)) for i,x in enumerate(cols)])
        lb,cert1=certificate(cols,mu,1);neg_upper,cert2=certificate(cols,mu,-1);ub=-neg_upper
        assert all(lb<=x<=ub for x in witnesses.values())
        reports.append(dict(cycle=cycle,lower=str(lb),upper=str(ub),witness={k:str(v) for k,v in witnesses.items()},certificates=[cert1,cert2]))
        if cycle%20==0:print('CYCLE',cycle,flush=True)
    norm=1815**3
    lo=avg(F(q['lower']) for q in reports)/norm;hi=avg(F(q['upper']) for q in reports)/norm
    il=avg(min(map(F,q['witness'].values())) for q in reports)/norm;iu=avg(max(map(F,q['witness'].values())) for q in reports)/norm
    observed=avg(F(q['witness']['stored']) for q in reports)/norm
    status='all_negative' if hi<0 else 'all_positive' if lo>0 else 'both_signs_attained' if il<0<iu else 'unresolved'
    widest=max(reports,key=lambda r:F(r['upper'])-F(r['lower']))
    out=dict(archive_sha256='de3047ac52facc69bacd037f93ee9c06532a3c21f9a0259b7a7f78337f7e24e3',sign=status,mean=str(mu/1815),stored=str(observed),outer=[str(lo),str(hi)],attained=[str(il),str(iu)],widest_cycle=widest['cycle'],cycles=reports)
    Path('comparison.json').write_text(json.dumps(out,sort_keys=True,separators=(',',':')))
    print('RESULT',status,'outer',float(lo),float(hi),'inner',float(il),float(iu),'observed',float(observed),'mean',float(mu/1815),'worst_width_cycle',widest['cycle'],float(F(widest['lower'])/norm),float(F(widest['upper'])/norm),flush=True)
if __name__=='__main__':tests();run(sys.argv[1])
