import hashlib,json,sys
from pathlib import Path
import numpy as np
from early_capacity import representations, correction
p=Path(sys.argv[1])
mdata=(p/"historical-model.json").read_bytes()
assert hashlib.sha256(mdata).hexdigest()==sys.argv[2]
m=json.loads(mdata)
def arrays(name):
    d=json.loads((p/(name+".json")).read_bytes())
    return np.asarray(d["q"]),np.asarray(d["pred"]),np.asarray(d["y"]),[tuple(map(float,g)) for g in d["schedule"]]
qt,et,yt,pt=arrays("train");q,e,y,pol=arrays("test1")
z=representations(q)["shape"];zt=representations(qt)["shape"]
w=m["models"]["shape"];x=(z-w["mu"])/w["scale"];xt=(zt-w["mu"])/w["scale"];pred=e+correction(z,w)
i=int(np.argmax(abs(pred-y)))
bad=np.argmax(abs(x[i,:]))
reports=[]
for k in set(pol):
    ii=[j for j,pkey in enumerate(pol) if pkey==k]
    if len(ii)>1:
        yy=y[ii];vv=pred[ii];reports.append({"rows":ii,"y":yy.tolist(),"early":e[ii].tolist(),"shape":vv.tolist(),"centered_xy":float((yy-yy.mean())@(vv-vv.mean())),"centered_xx":float((vv-vv.mean())@(vv-vv.mean()))})
sxy=sum(row["centered_xy"] for row in reports);sxx=sum(row["centered_xx"] for row in reports)
assert abs(sxy/sxx-m["dev_diagnostics"]["shape"]["unclipped_shrink"])<1e-12 and m["shrink"]["shape"]==0
out={"historical_worst":{"row":i,"truth":float(y[i]),"early":float(e[i]),"shape":float(pred[i]),"q_2_10_25_50_75_100":[float(q[i,k-1]) for k in [2,10,25,50,75,100]],"shape_features":z[i].tolist(),"training_z_scores":x[i].tolist(),"fit_z_ranges":np.stack([xt.min(0),xt.max(0)],axis=1).tolist(),"per_feature_correction_contributions":(x[i]*w["coef"]).tolist(),"intercept":w["intercept"]},"groups":sorted(reports,key=lambda r:r["rows"]),"shrink_crossproduct":sxy,"shrink_ss":sxx,"shrink":sxy/sxx,"null":"On any finite accepted group, applying lambda=0 to each (u_i-mean(u)) yields zero. Both candidate and its sham equal the common prior for all accepted cells; the missing cell also receives that prior by construction. Strict superiority to either the prior or the sham is impossible for any physical endpoint vector.","validation_arrays_opened":0}
path=p/"development-falsifier.json";path.write_text(json.dumps(out,sort_keys=True,allow_nan=False))
print(json.dumps({"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),**out},sort_keys=True))
