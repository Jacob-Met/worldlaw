"""Leave one complete prescribed-pitch condition out of the calibration fit."""
import numpy as np

BASE="MHH_Jones_quarter_pivot"
ROSTER=("static","oye",BASE,"MHH_Jones_direct","MHH_OpenFAST_quarter_pivot","MHH_OpenFAST_direct")
CASES=tuple(f"A{mean:02}_10_k0-{rate:03}_F00" for mean in (5,15) for rate in (10,50))
def features(t,a):
    knots=np.array([-5.,2.5,10.,17.5,25.])
    hats=np.maximum(1.-abs(np.clip(a,knots[0],knots[-1])[:,None]-knots)/7.5,0.)
    rate=np.r_[0.,np.diff(a)/np.diff(t)]
    stat=hats;instant=np.column_stack([stat,hats*rate[:,None]/100.])
    memory=[]
    for threshold in (10.,14.,18.,22.):
        for width in (4.,8.):
            on=bool(a[0]>=threshold)
            value=float(on)
            state=np.empty(len(a));state[0]=value
            for i in range(1,len(a)):
                if a[i]>=threshold: on=True
                elif a[i]<=threshold-width: on=False
                tau=(3. if on else 12.)*.25/30.
                value=float(on)+(value-float(on))*np.exp(-(t[i]-t[i-1])/tau)
                state[i]=value
            memory.append(state-(a>=threshold))
    return dict(cal_static=stat,cal_rate=instant,history=np.column_stack([instant,*memory]))
def fit(cases,inputs,target,reg=.001):
    rows=[];rhs=[]
    for case in cases:
        x=inputs[case]
        scale=np.sqrt(len(x)*len(cases));rows.append(x/scale);rhs.append(target[case]/scale)
    x=np.vstack(rows); y=np.concatenate(rhs)
    return np.linalg.solve(x.T@x+reg*np.eye(x.shape[1]),x.T@y)
def cycle_areas(a,y,mean):
    # Up-crossings rearm only after a 2-degree excursion below the mean.
    # Interpolate the two boundary lift values at identical incidence.
    boundaries=[];armed=False
    for i in range(1,len(a)):
        if a[i-1]<mean-2:armed=True
        if armed and a[i-1]<mean<=a[i]:
            weight=(mean-a[i-1])/(a[i]-a[i-1])
            boundaries.append((i,y[i-1]+weight*(y[i]-y[i-1])))
            armed=False
    ans=[]
    for (i,yi),(j,yj) in zip(boundaries,boundaries[1:]):
        angles=np.r_[mean,a[i:j],mean]
        values=np.r_[yi,y[i:j],yj]
        ans.append(float(np.trapezoid(values,angles)))
    if not ans:raise ValueError("no complete rearmed mean crossing")
    return ans
def score(t,a,y,p,mean):
    err=p-y;i=int(np.argmax(abs(err)))
    obs=cycle_areas(a,y,mean);pred=cycle_areas(a,p,mean)
    return {"n":len(y),"rmse":float(np.sqrt(np.mean(err**2))),
            "area_observed":obs,"area_prediction":pred,
            "mean_abs_paired_area_error":float(np.mean(abs(np.array(pred)-obs))),
            "worst":{"row":i,"time":float(t[i]),"degrees":float(a[i]),"observed":float(y[i]),
            "predicted":float(p[i]),"signed_error":float(err[i]),
            "backward_rates_deg_s":float((a[i]-a[i-1])/(t[i]-t[i-1])) if i else 0.}}
def evaluate(d):
    assert set(d)=={c+"_"+k for c in CASES for k in (*ROSTER,"Time","AoA","Cl")}
    target={};allx={};scores={};fits={}
    for c in CASES:
        t,a=[d[c+"_"+k] for k in ("Time","AoA")]
        allx[c]=features(t,a)
        x=features(t[:113],a[:113])
        for name in x:
            assert np.array_equal(x[name],allx[c][name][:113])
        target[c]=d[c+"_Cl"]-d[c+"_"+BASE]
    for c in CASES:
        t,a,y=[d[c+"_"+k] for k in ("Time","AoA","Cl")]
        preds={name:d[c+"_"+name] for name in ROSTER}
        for name in allx[c]:
            x={case:allx[case][name] for case in CASES}
            coef=fit([case for case in CASES if case!=c],x,target)
            fits[c+"_"+name]=coef.tolist()
            preds[name]=preds[BASE]+x[c]@coef
        scores[c]={name:score(t,a,y,pred,int(c[1:3])) for name,pred in preds.items()}
        print(c,{name:round(v["rmse"],6) for name,v in scores[c].items()},flush=True)
    oracle=np.array([min(scores[c][name]['rmse'] for name in ROSTER) for c in CASES])
    cand=np.array([scores[c]['history']['rmse'] for c in CASES]);rate=np.array([scores[c]['cal_rate']['rmse'] for c in CASES])
    gates={"mean_vs_envelope":bool(cand.mean()<=.95*oracle.mean()),"mean_vs_rate":bool(cand.mean()<=.98*rate.mean()),
           "wins":int(np.sum(cand<oracle)),"all_within_10pct":bool(np.all(cand<=1.1*oracle))}
    passed=gates["mean_vs_envelope"] and gates["mean_vs_rate"] and gates["wins"]>=3 and gates["all_within_10pct"]
    summary={"scores":scores,"fits":fits,"gates":gates,"admitted":passed,"held_force_reads":0,
             "mean_rmse":{"history":float(cand.mean()),"envelope":float(oracle.mean()),"rate":float(rate.mean())}}
    return summary
