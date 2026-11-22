"""Inverse-torque estimators on the released 10 Hz kinematic input stream."""
import numpy as np


def lag_bank(x):
    return np.stack([x[np.maximum(np.arange(len(x))-j,0)] for j in range(4)],axis=1)


def bdf(bank):
    x0,x1,x2,x3=np.moveaxis(bank,1,0)
    return ((11*x0-18*x1+9*x2-2*x3)/.6,(2*x0-5*x1+4*x2-x3)/.01)


def features(x, arm):
    lag=lag_bank(x)
    if arm=="snapshot":return x
    if arm=="history":return lag.reshape(len(x),-1)
    if arm=="history-differences":
        # Invertible finite-difference coordinates for the same four-row history.
        return np.concatenate([np.diff(lag,n=j,axis=1)[:,0] for j in range(4)],axis=1)
    if arm in ("filter-structural","filter-mlp","position-structural","released-structural"):
        q,vel,acc=np.hsplit(x,3)
        if arm.startswith("filter"):
            da,dda=bdf(lag[:,:,12:18])
            v=vel+.5*acc+.25*da
            a=acc+da+.25*dda
        elif arm.startswith("position"):
            v,a=bdf(lag[:,:,:6])
        else:
            v,a=vel,acc
        return np.column_stack([q,vel,acc,v,a])
    raise ValueError(arm)


def predict_torch(x,y,u,arm,train_starts,test_starts,epochs=60):
    import torch
    from torch import nn
    import time
    torch.set_num_threads(1)
    torch.manual_seed(172903)
    torch.use_deterministic_algorithms(True)
    start=time.monotonic()
    def segmented(z,starts):
        stops=list(starts[1:])+[len(z)]
        F=np.concatenate([features(z[a:b],arm) for a,b in zip(starts,stops)])
        ok=np.ones(len(z),dtype=bool)
        for a in starts:ok[a:a+3]=False
        return F,ok
    fx,good=segmented(x,train_starts);fu,active=segmented(u,test_starts)
    xm,ym=x.mean(0),y.mean(0)
    fallback=(u-xm)@np.linalg.lstsq(x-xm,y-ym,rcond=None)[0]+ym
    fx=fx[good];y=y[good];fu=fu[active]
    mean,sd=fx.mean(axis=0),np.maximum(fx.std(axis=0),1e-8)
    my,sy=y.mean(axis=0),y.std(axis=0)
    tensor=lambda v:torch.as_tensor(v,dtype=torch.float32)
    train=tensor((fx-mean)/sd);target=tensor((y-my)/sy)
    test=tensor((fu-mean)/sd)
    def mlp(i,h,o):
        return nn.Sequential(nn.Linear(i,h),nn.SiLU(),nn.Linear(h,h),nn.SiLU(),nn.Linear(h,o))
    class Structured(nn.Module):
        def __init__(self):
            super().__init__()
            self.offset=mlp(24,128,6)
            self.mass=mlp(6,64,36)
        def forward(self,f):
            q=f[:,:6];a=f[:,24:30]
            return self.offset(f[:,:24])+torch.bmm(self.mass(q).reshape(-1,6,6),a[:,:,None])[:,:,0]
    model=Structured() if arm.endswith("structural") else mlp(fx.shape[1],128,6)
    optimizer=torch.optim.AdamW(model.parameters(),lr=.002,weight_decay=.0001)
    schedule=torch.optim.lr_scheduler.CosineAnnealingLR(optimizer,T_max=epochs,eta_min=.0001)
    for epoch in range(epochs):
        perm=torch.randperm(len(train))
        for idx in perm.split(512):
            residual=model(train[idx])-target[idx];loss=residual.square().mean()
            optimizer.zero_grad();loss.backward();optimizer.step()
        schedule.step()
    fit_s=time.monotonic()-start
    model.eval();start=time.monotonic()
    with torch.no_grad():p=model(test).numpy().astype(float)*sy+my
    fallback[active]=p;p=fallback
    return p,{"fit_rows":int(sum(good)),"fallback_rows":int(sum(~active)),"train_s":fit_s,"inference_s":time.monotonic()-start,
              "weights":sum(a.numel() for a in model.parameters()),"torch":torch.__version__,
              "train_rows":len(x),"evaluate_rows":len(u),"epochs":epochs,"arm":arm}


def score(y,p):
    e=p-y
    return dict(nrmse=(np.sqrt(np.mean(e*e,axis=0))/np.std(y,axis=0,ddof=1)).tolist(),
                pooled=float(np.mean(np.sqrt(np.mean(e*e,axis=0))/np.std(y,axis=0,ddof=1))),
                mae=np.mean(abs(e),axis=0).tolist(),max_abs=np.max(abs(e),axis=0).tolist(),
                worst_index=np.argmax(abs(e),axis=0).tolist())
