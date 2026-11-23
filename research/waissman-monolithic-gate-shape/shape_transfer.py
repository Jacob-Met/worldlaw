"""Forecast and receive the held 20 K voltage-gate sweep under a common-gain constraint."""
from pathlib import Path
import argparse, hashlib, json, math
import numpy as np
from figure_reader import fig,readaxes,numbers,names

def role(labels):
    s=" ".join(v for v in labels if isinstance(v,str))
    if "DeltaT_H" in s:return "H"
    if "DeltaT_C" in s:return "C"
    if "R_{bridge}" in s:return "R"
    return None

def load_signals(open_held):
    signal={}; rlist=[]
    for name,digest in names.items():
        for labels,lines in readaxes(fig(name,digest)):
            axis=role(labels)
            if axis is None:continue
            for color,x,opaque in lines:
                x=np.array(x,dtype=float)
                if not(np.isfinite(x).all() and (np.diff(x)>0).all()):raise ValueError("invalid gate grid")
                if axis=="R":
                    r=np.array(numbers(opaque))
                    common=(x>=-7)&(x<=5)
                    if not(np.isfinite(r[common]).all() and (r[common]>0).all()):raise ValueError("invalid common-support resistance")
                    rlist.append((tuple(color),x,r));continue
                if color==[0.0,0.447,0.741]: temp=5
                elif color==[0.929,0.694,0.125]: temp=20
                elif color==[0.85,0.325,0.098]: temp=30
                else:raise ValueError("unbound temperature")
                sphere=signal.setdefault(temp,{"x":x})
                assert np.array_equal(x,sphere["x"]) and axis not in sphere
                if open_held or temp!=20:
                    y=np.array(numbers(opaque))
                    if not np.isfinite(y[(x>=-7)&(x<=5)]).all():raise ValueError("nonfinite common-support temperature")
                    sphere[axis]=y
    assert sorted(signal)==[5,20,30] and len(rlist)==3
    r5,=filter(lambda v:len(v[1])==211,rlist)
    alternatives=sorted((v for v in rlist if len(v[1])==121),key=lambda v:v[0])
    assert len(alternatives)==2
    for label,a,b in (("dark20",0,1),("light20",1,0)):
        case={t:dict(s) for t,s in signal.items()}
        for t,(_,x,r) in zip((5,20,30),(r5,alternatives[a],alternatives[b])):
            assert np.array_equal(x,case[t]["x"]);case[t]["R"]=r
        assert all(len(case[t]["x"])==n for t,n in ((5,211),(20,121),(30,121)))
        for t in (5,20,30):
            common=(case[t]["x"]>=-7)&(case[t]["x"]<=5)
            case[t]={k:v[common] for k,v in case[t].items()}
        assert [len(case[t]["x"]) for t in (5,20,30)]==[181,121,121]
        yield label,case

def weights(x):
    h=np.diff(x);w=np.r_[h[0],h[:-1]+h[1:],h[-1]]/2
    return w/w.sum()

def rms(y,w):return float(np.sqrt(w@(y*y)))
def unit(y,w):
    n=rms(y,w)
    if not(np.isfinite(n) and n>0):raise ValueError("invalid shape norm")
    return y/n
def fshape(d,grid,beta,width):
    r,c,h,x=(d[k] for k in ("R","C","H","x"))
    u=c*r**beta;y=h-(4/3)*c
    k=np.exp(-.5*((grid[:,None]-x)/width)**2)*weights(x)
    den=k@(u*u)
    if not np.all(np.isfinite(den)&(den>0)):raise ValueError("zero or nonfinite source local normal equation")
    return (k@(u*y))/den

def assess(h,c,x,v):
    w=weights(x);u=c*unit(v,w);y=h-(4/3)*c;n=rms(y,w);un=rms(u,w)
    if not(n>0 and un>0 and rms(c,w)>0):raise ValueError("zero response or impulse norm")
    s=max(0.,float(w@(u*y)/(un*un)));res=y-s*u
    base=rms(h,w)+(4/3)*rms(c,w)
    cond=(n/base,un/(rms(c,w)*np.max(np.abs(unit(v,w)))))
    spans=np.minimum(4,np.floor(5*(x-x[0])/(x[-1]-x[0])).astype(int))
    bins=[rms(res[spans==j],w[spans==j]/w[spans==j].sum())/n for j in range(5)]
    idx=int(np.argmax(abs(res)))
    return dict(global_loss=rms(res,w)/n,worst_bin=max(bins),bins=bins,gain=s,condition=list(map(float,cond)),
                qualified=bool(min(cond)>=.02),worst_index=idx,worst_gate=float(x[idx]),worst_signed=float(res[idx]),y_norm=n,u_norm=un,
                V=unit(v,w).tolist(),Y=y.tolist(),U=u.tolist(),residual=res.tolist())
def design(x,r):
    z=x/7;l=np.log(r)
    return np.column_stack((np.ones_like(z),z,z*z,z**3,l,l*l,z*l))

def forecasts(case):
    target=case[20];x=target["x"];r=target["R"];w=weights(x)
    train=[case[5],case[30]]
    def make(beta,width):
        a,b=[unit(fshape(d,x,beta,width),w) for d in train]
        return r**beta*(.4*a+.6*b),r**beta*a,r**beta*b
    primary,cold,hot=make(1,.35)
    q=dict(physical=primary,wiedemann_franz=r,constant=np.ones_like(r),direct=make(0,.35)[0],only5=cold,only30=hot)
    rankings=[]
    for beta in (-1,0,.5,1,1.5,2):
        for width in (.15,.35,.70,1.4):
            losses=[]
            for i in range(2):
                a,b=train[i],train[1-i];m=(b["x"]>=-7)&(b["x"]<=5)
                bx=b["x"][m];pred=b["R"][m]**beta*fshape(a,bx,beta,width)
                losses.append(assess(b["H"][m],b["C"][m],bx,pred)["global_loss"])
            rankings.append((sum(losses)/2,beta,width))
    _,beta,width=min(rankings);q["optimized_exponent"]=make(beta,width)[0]
    preds=[]
    for d in train:
        g=d["x"];wg=weights(g);y=unit(fshape(d,g,0,.35),wg);A=design(g,d["R"])
        M=A.T@(wg[:,None]*A)+np.diag([0.]+[1e-4]*6)
        coeff=np.linalg.solve(M,A.T@(wg*y));preds.append(unit(design(x,r)@coeff,w))
    q["empirical_ridge"]=.4*preds[0]+.6*preds[1]
    return {"x":x.tolist(),"R":r.tolist(),"V":{k:v.tolist() for k,v in q.items()},"training_candidates":rankings,"selected":[beta,width]}

def main():
    p=argparse.ArgumentParser();p.add_argument("mode",choices=("forecast","score"));p.add_argument("output");p.add_argument("--bank")
    a=p.parse_args()
    if a.mode=="forecast":
        if a.bank:raise ValueError("forecast has no response input")
        bank={label:forecasts(case) for label,case in load_signals(False)}
        result={"assignments":bank,"target_temperature":20}
    else:
        if not a.bank:raise ValueError("score requires bank")
        source=Path(a.bank).read_bytes();bank=json.loads(source)["assignments"];out={}
        for label,case in load_signals(True):
            d=case[20];f=bank[label];x=d["x"];h=d["H"];c=d["C"]
            assert np.array_equal(x,f["x"]) and np.array_equal(d["R"],f["R"])
            curves={k:assess(h,c,x,np.array(v)) for k,v in f["V"].items()};p=curves["physical"]
            out[label]={"scores":curves,"x":x.tolist(),"held_H":h.tolist(),"held_C":c.tolist(),"held_R":d["R"].tolist(),
                "gate":{metric:all(q["qualified"] and p["qualified"] and p[metric]<q[metric] for k,q in curves.items() if k!="physical") for metric in ("global_loss","worst_bin")}}
        result={"forecast_sha256":hashlib.sha256(source).hexdigest(),"assignments":out,"joint":all(all(d["gate"].values()) for d in out.values())}
    Path(a.output).write_text(json.dumps(result,allow_nan=False,separators=(",",":"))+"\n")
    if a.mode=="score":
        for l,d in result["assignments"].items():
            print(l,d["gate"],{k:(q["global_loss"],q["worst_bin"]) for k,q in d["scores"].items()})
        print("JOINT",result["joint"])
if __name__=="__main__":main()
