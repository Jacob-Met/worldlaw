"""Independently transport discretized ordered thresholds, newest-first or oldest-first."""
from collections import deque
from decimal import Decimal as D, getcontext
import json

getcontext().prec=48


def marginal(r,a,b):
    u,L=D('.2968'),D('.4121')
    a,b=D(a),D(b)
    return u*L*(1+a)*r/(1+a*r)+u*(1-L)*((b*r).exp()-1)/(b.exp()-1)


def transport(n, oldest_first):
    active=deque()
    prev_on=prev_off=D(0)
    supply=[D(0)]*(n+1)
    demand=[D(0)]*(n+1)
    remain=D(0)
    edges=0
    cells=[]
    for j in range(n+1):
        r=D(j)/n
        off=marginal(r,'3.0533','4.3106');on=marginal(r,'1.7487','7.299')
        off_mass=off-prev_off;on_mass=on-prev_on
        supply[j]=off_mass;demand[j]=on_mass
        if off_mass:active.append([j,off_mass])
        while on_mass>D('1e-41'):
            if not active:
                raise ArithmeticError('No ordered assignment')
            pos=0 if oldest_first else -1
            i,v=active[pos]
            assert i<=j
            m=min(on_mass,v)
            if i*100<=n*72 and j*100<=n*95:remain+=m
            active[pos][1]-=m
            if active[pos][1]<D('1e-42'):
                if oldest_first:active.popleft()
                else:active.pop()
            on_mass-=m
            cells.append((i,j,m));edges+=1
        prev_off,prev_on=off,on
    for i,j,m in cells:
        supply[i]-=m;demand[j]-=m
    discrepancy=max(abs(x) for x in supply+demand)
    assert discrepancy<D('1e-38') and sum(v for _,v in active)<D('1e-37')
    return {'return_mass':str(remain),'max_marginal_residual':str(discrepancy),
            'positive_edges':edges,'grid_intervals':n}


if __name__=='__main__':
    out={}
    for n in (200,1000,4000):
        lo=transport(n,False);hi=transport(n,True)
        assert D('.142301255829')<D(lo['return_mass'])<D('.142301255830')
        assert D('.162129407881')<D(hi['return_mass'])<D('.162129407882')
        out[n]={'lower':lo,'upper':hi}
    print(json.dumps(out,indent=2,sort_keys=True))
