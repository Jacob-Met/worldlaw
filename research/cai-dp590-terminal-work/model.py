"""Terminal signed plastic work from strain endpoints and registered load labels."""
import numpy as np
from scipy.optimize import least_squares
from source import project, HELD

KNOTS=np.array([.30,.75,1.5,3,5,8,12,20,30,45,65,85,105.])
GRID=np.linspace(0,105,2101)
DIRECTIONS=np.array([[1,0,0],[0,1,0],[.5,.5,.5]])
EXPONENTS=(4.,6.,8.)

def work(e,s):
    return np.r_[0.,np.cumsum(.5*(s[1:]+s[:-1])*np.diff(e))]

def cross(x,y,target):
    if target==x[0]:return float(y[0])
    hits=np.where((x[:-1]<=target)&(x[1:]>=target)&(x[1:]>x[:-1]))[0]
    if not len(hits):raise ValueError(f"Outside first-passage calibration support {target}")
    i=hits[0]
    return float(y[i]+(y[i+1]-y[i])*(target-x[i])/(x[i+1]-x[i]))

def uniaxial_records(root):
    return project(root,"uniaxial",("0","45","90"),"AB")

def yld(a,m,stress):
    # Barlat Yld2000-2d, full in-plane shear included for the 45-degree reference.
    x,y,t=np.asarray(stress).T
    a1,a2,a3,a4,a5,a6,a7,a8=a
    p1=a1*(2*x-y)/3
    p2=a2*(-x+2*y)/3
    diff=np.hypot(p1-p2,2*a7*t)
    z1=((-2*a3+2*a4+8*a5-2*a6)*x+(a3-4*a4-4*a5+4*a6)*y)/9
    z2=((4*a3-4*a4-4*a5+a6)*x+(-2*a3+8*a4+2*a5-2*a6)*y)/9
    zd=np.hypot(z1-z2,2*a8*t)
    p,q=.5*(z1+z2+zd),.5*(z1+z2-zd)
    return ((abs(diff)**m+abs(2*p+q)**m+abs(p+2*q)**m)/2)**(1/m)

def axis_slopes(function):
    h=1e-5
    value0=(function([1,h,0])-function([1,-h,0]))/(2*h)
    value90=(function([h,1,0])-function([-h,1,0]))/(2*h)
    return np.array([-value0/function([1,0,0]),-value90/function([0,1,0])])

def fit_yld(m,strengths,contraction):
    # The source's cofit consumed mixed ratios. Resolve missing directions
    # with a fixed isotropy penalty; this produces a particular shared-input fit.
    normalized=strengths[0]/strengths
    def objective(a):
        f=lambda v:yld(a,m,v)
        return np.r_[f(DIRECTIONS)-normalized,axis_slopes(f)-contraction,.035*(a-1)]
    fit=least_squares(objective,np.ones(8),bounds=(.35,2.),max_nfev=160)
    return fit.x,fit.nfev,float(np.dot(fit.fun,fit.fun))

def calibration(root):
    uni=uniaxial_records(root)
    pure=project(root,"biaxial",("4:0","0:4"),"ABCD")
    tab=[]
    for w in KNOTS:
        su=[]
        for d in ("0","90","45"):
            e,s=uni[d].T
            su.append(cross(work(e,s),s,w))
        ax=[]
        slopes=[]
        for key,ia,it in (("4:0",0,2),("0:4",2,0)):
            e=pure[key][:,ia];s=pure[key][:,ia+1];t=pure[key][:,it]
            wc=work(e,s)
            l=max(.1,.80*w);h=min(107.,1.20*w)
            slopes.append(-(cross(wc,t,h)-cross(wc,t,l))/(cross(wc,e,h)-cross(wc,e,l)))
            ax.append(cross(wc,s,w))
        # Both machines measured the same grade. The mean retains their observed spread.
        strengths=np.array([.5*(su[0]+ax[0]),.5*(su[1]+ax[1]),su[2]])
        if min(strengths)<=0 or not np.all((np.array(slopes)>0)&(np.array(slopes)<1)):
            raise ValueError(f"Unbounded or inconsistent tangent geometry at calibration W={w}")
        sol={}
        for m in EXPONENTS:
            a,n,obj=fit_yld(m,strengths,np.array(slopes))
            sol[str(int(m))]={"a":a.tolist(),"n":n,"objective":obj}
        tab.append({"w":w,"strengths":strengths.tolist(),"external":su,"cruciform":ax,"eta":slopes,"yld":sol})
    return tab

def curves(tab,u):
    x,y=u
    rows=[]
    for o in tab:
        sx,sy,s45=o["strengths"];cx,cy=o["eta"]
        lo=1/(x/sx+y/sy)
        upper=min([s/d for s,d in ((sx,x-cx*y),(sy,y-cy*x)) if d>0])
        if lo>upper:raise ValueError("Empty radial training bracket")
        c=.5*(cx/sx**2+cy/sy**2)
        hill=(x*x/sx**2+y*y/sy**2-2*c*x*y)**(-.5)
        xx=x/sx;yy=y/sy
        hosford=((abs(xx-yy)**6+abs(xx)**6+abs(yy)**6)/2)**(-1/6)
        estimates={"support_geomean":np.sqrt(lo*upper),"hull_lower":lo,"tangent_upper":upper,
                   "hill48":hill,"hosford6":hosford,"axis_blend":x*sx+y*sy}
        for m in EXPONENTS:
            estimates[f"yld2000_m{int(m)}"]=sx/yld(o["yld"][str(int(m))]["a"],m,[x,y,0])
        rows.append(estimates)
    return {key:np.interp(GRID,KNOTS,[o[key] for o in rows]) for key in rows[0]}

def invert_terminal(radial,projected):
    h=np.r_[0.,np.cumsum(.5*(1/radial[1:]+1/radial[:-1])*np.diff(GRID))]
    if not 0<=projected<=h[-1]:return None
    return float(np.interp(projected,h,GRID))

def required_uni(uni,ext):
    if ext<=0:return 0.
    e,s=uni.T
    frontier=0.
    total=0.
    for left,right,sl,sr in zip(e[:-1],e[1:],s[:-1],s[1:]):
        if right<=frontier:continue
        if left>frontier or right<=left:raise ValueError("Unanchored first loading")
        end=min(right,ext)
        def ordinate(q):return sl+(sr-sl)*(q-left)/(right-left)
        a,b=ordinate(frontier),ordinate(end)
        if min(a,b)<0:raise ValueError("Negative reference stress on advancing strain")
        total+=(a+b)*(end-frontier)/2
        frontier=end
        if frontier>=ext:return float(total)
    return None

def forecasts(root,tab):
    strains=project(root,"biaxial",HELD,"AC")
    uni=uniaxial_records(root)
    out={}
    for key,A in strains.items():
        x,y=map(float,key.split(":"));u=np.array([x,y])/(x+y)
        e=A[-1]-A[0]
        radial=curves(tab,u)
        preds={k:invert_terminal(r,u@e) for k,r in radial.items()}
        # A deliberately separate midpoint-area sensitivity, assuming proportional
        # force, homogeneous incompressible stretches and negligible elastic stretch.
        adj=u*np.exp(.5*e);adj=adj/sum(adj)
        alt=curves(tab,adj)
        preds["support_midarea"]=invert_terminal(alt["support_geomean"],adj@e)
        preds["yld6_midarea"]=invert_terminal(alt["yld2000_m6"],adj@e)
        ee=float(np.sqrt((2/3)*(e@e+sum(e)**2)))
        preds["mises_terminal_strain"]=required_uni(uni["0"],ee)
        lb=[required_uni(uni[d],v) for d,v in zip(("0","90","45"),(e[0],e[1],sum(e)/2))]
        out[key]={"strain_first":A[0].tolist(),"strain_last":A[-1].tolist(),"n":len(A),
                  "sum_positive_variation":np.maximum(np.diff(A,axis=0),0).sum(axis=0).tolist(),
                  "sum_negative_variation":np.minimum(np.diff(A,axis=0),0).sum(axis=0).tolist(),
                  "predicted_work":preds,"uniaxial_lower_by_0_90_45":lb}
    return out

def endpoint_compatibility(root):
    uni=uniaxial_records(root)
    pure=project(root,"biaxial",("4:0","0:4"),"ABCD")
    records=[]
    for label,d,axis in (("4:0","0",0),("0:4","90",2)):
        a=pure[label]
        e=a[:,axis]-a[0,axis]
        sigma=a[:,axis+1]
        integrals=work(e,sigma)
        for strain in (.002,.004,.006,.008,.01,.02,.04,.08,.12,.16):
            measured=cross(e,integrals,strain)
            lower=required_uni(uni[d],strain)
            if lower is None or lower<=0:raise ValueError("Reference coverage")
            records.append({"direction":d,"strain":strain,"measured":measured,"lower":lower,
                            "fractional_shortfall":max(0.,1.-measured/lower)})
    return {"controls":records,"maximum_fractional_shortfall":max(r["fractional_shortfall"] for r in records)}
