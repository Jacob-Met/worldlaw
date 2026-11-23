"""Pressure-only baselines using the article's pure properties and SRK vapor."""
import numpy as np
from scipy.optimize import least_squares
from thermo.unifac import UNIFAC

R=8.31441
# order: Tc (K), Pc (MPa), acentric factor, pure volume (cm3/mol), Antoine A,B,C.
PURE={1:[508.20,4.7015,.3064,73.931,6.70561,2405.608,-62.0458],
      2:[541.,2.98,.4321,143.889,6.174980,2456.685,-86.1209],
      3:[523.30,3.88,.3664,98.594,8.20025,3308.903,-34.4944],
      4:[508.31,4.764,.6689,76.784,9.80738,3631.488,-55.0183]}
GROUPS={1:{1:1,18:1},2:{1:3,3:1,25:2},3:{1:1,2:1,21:1},4:{1:2,3:1,14:1}}
AUTHOR={1:{"Wilson":[3140.713,-1660.002],"NRTL":[8.4812,167.07]},
        3:{"Wilson":[399.301,111.522],"NRTL":[28.229,14.082]},
        4:{"Wilson":[2365.518,-9.984],"NRTL":[229.84,53.354]}}

def gamma(kind,params,x,t,comp):
    a,b=params
    xx=1-x
    if kind=="Raoult": return np.ones((len(x),2))
    if kind=="UNIFAC":
        return np.asarray([UNIFAC.from_subgroups(T=float(temp),xs=[float(x1),float(1-x1)],
                chemgroups=[GROUPS[comp],GROUPS[2]],version=0).gammas() if 0<x1<1 else [1.,1.] for x1,temp in zip(x,t)])
    if kind=="Wilson":
        vl=PURE[comp][3]/PURE[2][3]
        l12=np.exp(-a/(R*t))/vl
        l21=np.exp(-b/(R*t))*vl
        u=x+l12*xx;v=xx+l21*x
        h=l12/u-l21/v
        return np.exp(np.c_[-np.log(u)+xx*h,-np.log(v)-x*h])
    g12=a/t;g21=b/t
    a12=np.exp(-.4*g12);a21=np.exp(-.4*g21)
    u=x+xx*a21;v=xx+x*a12
    return np.exp(np.c_[xx**2*(g21*(a21/u)**2+g12*a12/v**2),
                        x**2*(g12*(a12/v)**2+g21*a21/u**2)])

def srk_lnf(y,p,t,par):
    # P in Pa. Largest real cubic root in the measured dilute-vapor regime.
    tc,pc,om=par[:,0],par[:,1]*1e6,par[:,2]
    k=.480+1.574*om-.176*om**2
    ai=.42747*R**2*tc**2/pc*(1+k*(1-np.sqrt(t[:,None]/tc)))**2
    b=.08664*R*tc/pc
    bm=y@b;sq=np.sqrt(ai)
    am=(y*sq).sum(axis=1)**2
    A=am*p/(R*t)**2;B=bm*p/(R*t)
    z=np.ones(len(t))
    for _ in range(16):
        c=A-B-B**2
        dz=(z**3-z**2+c*z-A*B)/(3*z**2-2*z+c)
        z-=dz
    assert np.all(z>B) and np.all(z>.5)
    br=b[None,:]/bm[:,None]
    ar=2*sq/np.sqrt(am[:,None])-br
    return br*(z-1)[:,None]-np.log(z-B)[:,None]-(A/B*np.log1p(B/z))[:,None]*ar

def bubble(x,t,comp,kind,params=(0,0)):
    par=np.array([PURE[comp],PURE[2]])
    ps=1e6*np.exp(par[:,4]-par[:,5]/(t[:,None]+par[:,6]))
    n=len(t)
    pure_phi=np.c_[srk_lnf(np.tile([1.,0.],(n,1)),ps[:,0],t,par)[:,0],
                   srk_lnf(np.tile([0.,1.],(n,1)),ps[:,1],t,par)[:,1]]
    a=np.c_[x,1-x]*gamma(kind,params,x,t,comp)*ps
    p=a.sum(axis=1);y=a/p[:,None]
    vol=par[:,3]*1e-6
    for _ in range(50):
        z=a*np.exp(pure_phi-srk_lnf(y,p,t,par)+(p[:,None]-ps)*vol/(R*t[:,None]))
        pp=z.sum(axis=1);yy=z/pp[:,None]
        if max(np.max(abs(pp-p)/p),np.max(abs(yy-y)))<1e-11:
            return pp/1000,yy[:,0]
        p,y=pp,yy
    raise ValueError("bubble iteration did not converge")

def controls(x,t,p,comp):
    result={};meta={}
    for kind in ("Raoult","UNIFAC","Wilson","NRTL"):
        params=AUTHOR[comp].get(kind,(0,0))
        pp,yy=bubble(x,t,comp,kind,params)
        result["published_"+kind if kind in ("Wilson","NRTL") else kind]=yy.tolist()
        meta[kind]={"author_pressure_mae_kpa":float(np.mean(abs(pp-p)))}
        if kind not in ("Wilson","NRTL"): continue
        unit=10000 if kind=="Wilson" else 1200
        def loss(ab): return (bubble(x,t,comp,kind,ab)[0]-p)/p
        fits=[least_squares(loss,start,bounds=(-unit,unit),max_nfev=250,
                              ftol=1e-12,gtol=1e-12,xtol=1e-12)
              for start in [params,[0.,0.],[unit*.1,-unit*.1],[-unit*.1,unit*.1]]]
        best=min(fits,key=lambda v:np.sum(v.fun**2))
        pp,yy=bubble(x,t,comp,kind,best.x)
        result["pressure_fit_"+kind]=yy.tolist()
        meta[kind].update(params=best.x.tolist(),pressure_mae_kpa=float(np.mean(abs(pp-p))))
    return result,meta
