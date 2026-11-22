"""Same-information statistical controls for the preregistered M_VV completion."""
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from completion import optical_controls


def design_one(x, geometry):
    n=x.shape[0]
    U=np.zeros(n);lo=np.zeros(n);hi=np.zeros(n);pu=np.zeros(n);mx=np.zeros(n)
    unavailable=np.zeros(n,dtype=bool)
    pure=np.empty(n,dtype="U40")
    pure_ambiguous=np.zeros(n,dtype=bool)
    intensity=x[:,0,0].copy()
    valid=np.isfinite(x).all(axis=(1,2)) & (intensity>0)
    normalized=np.zeros_like(x,dtype=float)
    normalized[valid]=x[valid]/intensity[valid,None,None]
    for i in range(n):
        if not valid[i]:
            pure[i]="unavailable_or_nonpositive_intensity";unavailable[i]=True
            continue
        controls,flags=optical_controls(normalized[i])
        U[i],pu[i],lo[i],hi[i],mx[i]=[controls[k] for k in ("fresnel_uu","pure","lower","upper","gil_max_abs")]
        unavailable[i]=flags["empty"];pure[i]=flags["pure_status"];pure_ambiguous[i]=flags["max_purity_ambiguous"]
    # Actual author axes: signed phi_d; uniform theta_d; quadratic theta_h.
    pi,di,half,wi=geometry.T
    phi=np.pi*(pi.astype(float)/180-1)
    theta_d=np.deg2rad(di.astype(float))
    theta_h=np.pi/2*(half.astype(float)/90)**2
    wave=(450+50*wi.astype(float)-550)/100
    geom=np.column_stack([np.sin(phi),np.cos(phi),np.cos(theta_d),np.cos(theta_h),wave])
    raw=np.column_stack([normalized.reshape(n,9),np.log(np.maximum(np.where(np.isfinite(intensity),intensity,0),1e-12)),geom])
    # Derived features contain no observations beyond the direct model's inputs.
    ext=np.column_stack([raw,U,pu,lo,hi,unavailable])
    return dict(raw=raw,ext=ext,U=U,lo=lo,hi=hi,pu=pu,mx=mx,empty=unavailable,
                pure=pure,ambiguous=pure_ambiguous,valid=valid,intensity=intensity)


def train_predict(train, test):
    # Each training material has equal total mass. Within a material the loss
    # weights normalized absolute errors by positive intensity, matching raw
    # absolute-error / total-intensity evaluation.
    yy=[];ww=[];xd=[];xx=[];rr=[]
    for f,t in train:
        ok=f["valid"] & np.isfinite(t)
        ii=f["intensity"][ok]
        if not len(ii):raise ValueError("training material has no eligible data")
        yy.extend(t[ok]/ii);rr.extend(t[ok]/ii-f["U"][ok])
        ww.extend(ii/ii.sum());xd.append(f["raw"][ok]);xx.append(f["ext"][ok])
    kw=dict(loss="absolute_error",max_iter=160,max_leaf_nodes=15,learning_rate=.06,
            min_samples_leaf=25,l2_regularization=.01,early_stopping=False,random_state=174)
    w=np.asarray(ww);w/=w.mean()
    direct=HistGradientBoostingRegressor(**kw).fit(np.vstack(xd),yy,sample_weight=w)
    enhanced=HistGradientBoostingRegressor(**kw).fit(np.vstack(xx),yy,sample_weight=w)
    residual=HistGradientBoostingRegressor(**kw).fit(np.vstack(xx),rr,sample_weight=w)
    pred=direct.predict(test["raw"])
    same_features=enhanced.predict(test["ext"])
    candidate=test["U"]+residual.predict(test["ext"])
    # Enforce physical bounds where they exist. An empty pencil falls back to
    # the direct model, including when an individual rank-one test refuses.
    def project(v):
        return np.where(test["empty"],pred,np.clip(v,test["lo"],test["hi"]))
    arms={"candidate":project(candidate),"direct":pred,"projected_direct":project(pred),
          "direct_same_features":same_features,"projected_direct_same_features":project(same_features),
          "unprojected_residual":candidate,"zero":np.zeros(len(pred)),"fresnel":test["U"],
          "pure":test["pu"],"gil":test["mx"],"midpoint":(test["lo"]+test["hi"])/2}
    return {k:np.where(test["valid"],v*test["intensity"],0.) for k,v in arms.items()}
