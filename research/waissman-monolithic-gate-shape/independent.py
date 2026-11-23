"""Independent full gate-sweep receiver using recorded figure temperatures and immutable predictions."""
import hashlib,json,math,sys,urllib.request
from pathlib import Path
from scipy.io import loadmat
import numpy as np
from io import BytesIO
F=math.fsum
def sequence(x):return list(np.atleast_1d(x).ravel())
def measured():
    u="https://zenodo.org/api/records/5500449/files/Fig2_a.fig/content"
    raw=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"WORLDLAW independent monolithic noise temperature receiver"}),timeout=90).read()
    assert hashlib.sha256(raw).hexdigest()=="e26d7284779f1fa33ca9cea3c894a21c859c1f1af3456134262ce5acd6f02e0c"
    mat=loadmat(BytesIO(raw),squeeze_me=True,struct_as_record=False)
    figure,=[obj for obj in mat.values() if getattr(obj,"type",None)=="figure"]
    vals={}
    for ax in sequence(figure.children):
        if getattr(ax,"type",None)!="axes":continue
        ch=sequence(ax.children)
        labels=[str(getattr(c.properties,"String","")) for c in ch if c.type=="text"]
        if any("DeltaT_C" in s for s in labels): key="C"
        elif any("DeltaT_H" in s for s in labels):key="H"
        else:continue
        for c in ch:
            if c.type!="graph2d.lineseries":continue
            p=c.properties
            if tuple(map(float,sequence(p.Color)))!=(.929,.694,.125):continue
            x=list(map(float,sequence(p.XData)));v=list(map(float,sequence(p.YData)))
            assert len(x)==len(v)==121 and x[0]==-7 and x[-1]==5 and key not in vals
            vals[key]=x,v
    assert vals["H"][0]==vals["C"][0]
    return vals["H"][0],vals["H"][1],vals["C"][1]
def verify(bankfile,outfile):
    B=json.loads(Path(bankfile).read_bytes());S=json.loads(Path(outfile).read_bytes())
    assert hashlib.sha256(Path(bankfile).read_bytes()).hexdigest()==S["forecast_sha256"]
    x,h,c=measured();N=len(x)
    w=[((x[min(i+1,N-1)]-x[max(i-1,0)])/2)/(x[-1]-x[0]) for i in range(N)]
    def inner(a,b):return F(k*v*q for k,v,q in zip(w,a,b,strict=True))
    def norm(a):return math.sqrt(inner(a,a))
    y=[v-4*q/3 for v,q in zip(h,c)]
    ny=norm(y);hh=norm(h);cc=norm(c);gates=[];diffs=[];witnesses={}
    def match(v,z):diffs.append(abs(v-z));assert math.isclose(v,z,rel_tol=2e-12,abs_tol=2e-12),(v,z)
    for label,b in B["assignments"].items():
        d=S["assignments"][label];assert x==b["x"]==d["x"] and h==d["held_H"] and c==d["held_C"] and b["R"]==d["held_R"]
        nclaims={}; paths={}
        for name,values in b["V"].items():
            V=[v/norm(values) for v in values];u=[t*v for t,v in zip(c,V)];s=max(0.,inner(u,y)/inner(u,u))
            resid=[a-s*z for a,z in zip(y,u)]
            bins=[]
            for i in range(5):
                mask=[j for j,g in enumerate(x) if min(4,int(5*(g-x[0])/(x[-1]-x[0])))==i]
                bins.append(math.sqrt(F(w[j]*resid[j]**2 for j in mask)/F(w[j] for j in mask))/ny)
            full=norm(resid)/ny;worst=max(bins);conds=[ny/(hh+4*cc/3),norm(u)/(cc*max(map(abs,V)))]
            q=d["scores"][name]
            for a,bb in [(s,q["gain"]),(full,q["global_loss"]),(worst,q["worst_bin"]),(ny,q["y_norm"]),(norm(u),q["u_norm"])]:match(a,bb)
            for a,bb in [(V,q["V"]),(u,q["U"]),(y,q["Y"]),(resid,q["residual"]),(bins,q["bins"]),(conds,q["condition"])]:
                for v,z in zip(a,bb,strict=True):match(v,z)
            j=max(range(N),key=lambda i:abs(resid[i]));assert j==q["worst_index"]
            assert (min(conds)>=.02)==q["qualified"]
            nclaims[name]=(full,worst,q["qualified"]);paths[name]=(resid,s,u,conds)
        for i,key in enumerate(["global_loss","worst_bin"]):
            gated=all(nclaims["physical"][2] and z[2] and nclaims["physical"][i]<z[i] for arm,z in nclaims.items() if arm!="physical")
            assert gated==d["gate"][key];gates.append(gated)
        r,s,u,cond=paths["physical"];j=max(range(N),key=lambda i:abs(r[i]))
        witnesses[label]={"gate":x[j],"row":j,"H_K":h[j],"C_K":c[j],"R_kOhm":b["R"][j],"Y_K":y[j],"sCV_K":s*u[j],
        "physical_signed_K":r[j],"control_residuals_K":{a:v[0][j] for a,v in paths.items()},"conditioning":cond,
        "raw_min_C_K":min(c),"raw_max_C_K":max(c),"min_Y_K":min(y),"max_Y_K":max(y),"full_heat_norm":hh,"full_cold_norm":cc}
    assert all(gates)==S["joint"]
    result={"target_rows":N,"arms_times_assignments":16,"comparisons":len(diffs),"maximum_absolute_difference":max(diffs),"gates":gates,
        "joint":S["joint"],"raw_witnesses":witnesses}
    print("INDEPENDENT",json.dumps(result,allow_nan=False,sort_keys=True))
if __name__=="__main__":verify(*sys.argv[1:])
