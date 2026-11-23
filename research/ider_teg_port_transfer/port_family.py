"""Exact observational families under fixed face temperatures or electrical-only readout."""
from fractions import Fraction as F
import json
def terminal(n,s,r,tc,th,rl):
    i=s*(th-tc)/(rl+r)
    v=n*i*rl
    return i,v,i*v
def efficiency(n,s,r,k,tc,th,i):
    alpha=n*s;rho=n*r;d=th-tc
    generated=i*(alpha*d-rho*i)
    hot=alpha*th*i-rho*i*i/2+k*d
    return generated,hot,generated/hot
if __name__=="__main__":
    n=128;s=F(1,5000);r=F(1,50);tc=F(29315,100);th=tc+65
    rls=[F(i,100) for i in range(101)]
    y=[terminal(n,s,r,tc,th,rl) for rl in rls]
    checks=0
    for delta in [F(-5),F(0),F(22)]:
        for scale in [F(3,4),F(1),F(6,5)]:
            t2=tc+delta
            th2=t2+(th-tc)/scale
            for rl,literal in zip(rls,y):
                assert terminal(n,scale*s,r,t2,th2,rl)==literal
                checks+=1
    left=0;right=61
    i0=y[left][0];i1=y[right][0]
    recovered_r=(i1*rls[right]-i0*rls[left])/(i0-i1)
    recovered_es=i0*(recovered_r+rls[left])
    assert recovered_r==r and recovered_es==s*(th-tc)
    midpoint=r
    i,v,w=terminal(n,s,r,tc,th,midpoint)
    thermal=[efficiency(n,s,r,k,tc,th,i) for k in [F(1,5),F(1,2),F(3,2)]]
    assert len({a for a,b,e in thermal})==1 and all(q[0]==w for q in thermal)
    assert thermal[0][1]<thermal[1][1]<thermal[2][1] and thermal[0][2]>thermal[1][2]>thermal[2][2]
    assert all(0<e<1-tc/th for a,b,e in thermal)
    print(json.dumps({"model":"author chapter 4.1-4.3 fixed per-couple external load and known N",
        "loads":len(rls),"equivalent_observations":checks,"R_recovered_exact":str(recovered_r),
        "S_deltaT_recovered_exact":str(recovered_es),"units":["A","V","W"],
        "same_electrical_at_matched_load":list(map(str,[i,v,w])),"hot_flux_watt_by_added_conductance":[str(q[1]) for q in thermal],
        "efficiency_ratios":[str(q[2]) for q in thermal],"synthetic":True,"experimental_sweeps":0},sort_keys=True))
