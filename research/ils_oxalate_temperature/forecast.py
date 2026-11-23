"""Learn from reference settings and early independent specimen blocks only."""
import json
import sys
import numpy as np

from acquisition import training_only

ZINC=419.527
FRACTIONS=np.array([.15,.325,.50,.675,.85])


def window(g,lo,hi):
    return (g>=lo)&(g<=hi)


def features(g,y):
    n=len(y);t=g[:n]
    start=float(np.mean(y[window(t,45,70)]));end=float(np.mean(y[window(t,235,270)]))
    if not np.isfinite(start-end) or start<=end:raise ValueError("dehydration mass decrease not qualified")
    x=t[window(t,75,235)];v=y[window(t,75,235)];choices=[]
    for fraction in FRACTIONS:
        level=start-fraction*(start-end)
        crossing=np.flatnonzero((v[:-1]>=level)&(v[1:]<=level)&(v[:-1]>v[1:]))
        if not len(crossing):raise ValueError("missing prospective dehydration crossing")
        i=crossing[0]
        choices.append(x[i]+(x[i+1]-x[i])*(level-v[i])/(v[i+1]-v[i]))
    return np.array(choices),start,end


def displacements(g,ref,y):
    x,hi,lo=features(g,ref);yc,yhi,ylo=features(g,y)
    return np.array([np.mean(yc-x),(yc[-1]-yc[0])-(x[-1]-x[0]),yhi-hi,ylo-lo])


def averaged(reference):
    return np.mean([a.mean(axis=0) for a in reference.values()],axis=0)


def regression(g,reference):
    xx=[];yy=[]
    for group,vs in reference.items():
        base=averaged({k:v for k,v in reference.items() if k!=group})
        for i in [0,5,10]:
            y=vs[i:i+5].mean(axis=0)
            xx.append(displacements(g,base,y))
            yy.append(y-base)
    x=np.array(xx);target=np.array(yy);mu=x.mean(axis=0);std=x.std(axis=0)
    std=np.where(std>0,std,1.);xn=(x-mu)/std
    c=np.linalg.solve(xn.T@xn+np.eye(4),xn.T@(target-target.mean(axis=0)))
    return mu,std,target.mean(axis=0),c


def line_prediction(g,base,a,b,vertical):
    if not np.isfinite(a) or a<=0:raise ValueError("nonpositive early affine slope")
    return np.interp((g-b)/a,g,base)+vertical


def one_group(g,base,v,ridge):
    y=v.mean(axis=0);x,_,_=features(g,base);z,_,_=features(g,y)
    dz=displacements(g,base,y)
    ref,sd,intercept,coef=ridge
    pred={"raw_reference":base,"reference":base+dz[2],
          "ridge":base+intercept+(dz-ref)/sd@coef}
    maps={};losses={}
    def add(role,a,b):
        maps[role]=[float(a),float(b)]
        pred[role]=line_prediction(g,base,a,b,dz[2])
        losses[role]=float(np.sum((a*x+b-z)**2))
    add("translation",1.,float(np.mean(z-x)))
    a=float(np.dot(x-x.mean(),z-z.mean())/np.dot(x-x.mean(),x-x.mean()))
    add("free_affine",a,float(z.mean()-a*x.mean()))
    for label,sign in [("minus",-1),("plus",1)]:
        fixed=ZINC+2*sign
        a=float(np.dot(x-ZINC,z-fixed)/np.dot(x-ZINC,x-ZINC))
        add("zinc_"+label,a,fixed-a*ZINC)
        add("constant_"+label,1.,2.*sign)
        gain=(fixed-40.)/(ZINC-40.)
        add("gain_"+label,gain,40.-40.*gain)
    choices={}
    for family in ["zinc","constant","gain"]:
        choices[family]=min([family+"_minus",family+"_plus"],key=lambda r:losses[r])
        pred[family]=pred[choices[family]]
    return pred,dict(reference_landmarks=x.tolist(),calibration_landmarks=z.tolist(),features=dz.tolist(),
                     early_temperature_SSE=losses,affine_maps=maps,chosen=choices)


def produce(grid,reference,early,receipt):
    base=averaged(reference);fit=regression(grid,reference);later=grid>=320;group_result={}
    for group in [1,6,7]:
        pred,geo=one_group(grid,base,early[group],fit)
        assert all(v.shape==grid.shape and np.isfinite(v).all() for v in pred.values())
        group_result[str(group)]={"geometry":geo,"mass":{r:v[later].tolist() for r,v in pred.items()}}
    return dict(schema=1,source=receipt,T=grid[later].tolist(),groups=group_result,
                reference_rows={str(g):15 for g in reference},calibration_rows=[1,2,3,4,5],
                known_biased_group=7,calibration_end_C=280,held_mass_used=False)


if __name__=="__main__":
    with open(sys.argv[1],"w") as f:json.dump(produce(*training_only()),f,sort_keys=True,allow_nan=False,separators=(",",":"))
