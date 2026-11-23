"""Check the finite capillary counterexample and the saturated liquid limit."""
import math
from fractions import Fraction

def bundle():
    # Tuples give radius, count, path length. Common pi and Poiseuille factors cancel.
    first=[(2,2,1),(1,16,2)]
    second=[(2,1,2),(1,32,1)]
    def summary(tubes):
        volumes={r:Fraction(n*r*r*l) for r,n,l in tubes}
        flow={r:Fraction(n*r**4,l) for r,n,l in tubes}
        return volumes,sum(flow.values()),flow[1]/sum(flow.values())
    av,ak,ar=summary(first);bv,bk,br=summary(second)
    assert av==bv=={2:8,1:32} and ak==bk==40
    assert (ar,br)==(Fraction(1,5),Fraction(4,5))
    return str(ar),str(br)

def saturation(x):
    import numpy as np
    import capillary_transport as mod
    import pdi
    tr,ts,al,n,h0,tau,lam,hc,af=mod.fields(x);m=1-1/n
    g0=pdi.se_vg(al,n,m,h0);gc=pdi.se_vg(al,n,m,hc);ha=pdi.ha_pdi_vg(al,n,m,g0)
    w_m=pdi.pdi_vg(mod.fields(x),np.array([1e5]),lcon=False).th[0]
    kcap=pdi.beta4kc(20)*tau*((ts-tr)*((1-gc)/hc+pdi.F_vg(al,m,gc)-pdi.F_vg(al,m,g0))/(1-g0))**2
    kfilm=pdi.c4knc(20)*w_m*ha**(-af)
    heads=np.array([1e-2,1e-4,1e-6,1e-8,1e-10])
    v=pdi.pdi_vg(mod.fields(x),heads,TC=20.,lcap=False,lcon=True,optkc='taus',optknc='pred',lvap=False)
    return ((v.kc+v.knc)/(kcap+kfilm)-1).tolist()
