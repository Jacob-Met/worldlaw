"""Describe the frozen worst case using only its two small-drive fluctuation records."""
import json
import numpy as np
from recording import COMPONENTS, GROUP, LOW, PERIOD


def covariance_blocks(group,gain):
    channels=[group[n] for n in COMPONENTS]
    n=len(channels[0])//PERIOD
    segments=[]
    for j in range(0,n,10):
        size=min(10,n-j)
        rows=[t[j*PERIOD:(j+size)*PERIOD].reshape(size,PERIOD)[:,LOW] for t in channels]
        segments.append(np.stack(rows,axis=1))
    raw=np.concatenate(segments)
    center=raw.mean(axis=(0,2))
    jac=np.array([[-1,0,center[0]/center[2]],[0,-1,center[1]/center[2]]])/(gain*center[2])
    y=np.einsum("ij,njt->nit",jac,raw,optimize=True)
    y-=y.mean(axis=0,keepdims=True)
    blocks=np.array_split(y,8)
    ans=[]
    for seg in [y]+blocks:
        mats=[]
        for lag in (0,60,520):
            past=seg[:,:,:2000-lag]
            future=seg[:,:,lag:]
            mats.append(np.einsum("nat,nbt->ab",future,past)/(len(seg)*(2000-lag)))
        ans.append(mats)
    return np.asarray(ans),[len(b) for b in blocks]


def describe(h,record):
    assert record["date"]=="2013-06-13" and record["bead"]==2
    G=float(h["calibration/gain"][()])
    vals=[covariance_blocks(h[f"{GROUP}/{s}"],G) for s in (-500,500)]
    cov=np.mean([x[0] for x in vals],axis=0)
    c0,cv,cts=cov[0]
    sv=np.linalg.svd(cv,compute_uv=False)
    delta=1.6*np.array(record["locked"]["forecast"]["predictions"]["800"]["small_delta"])
    pred=(np.eye(2)-np.linalg.solve(cv.T,cts.T).T)@delta
    reported=record["locked"]["forecast"]["predictions"]["800"]["arms"]["quiet_positive_lag"][23]
    assert np.max(np.abs(pred-reported))<1e-12
    spread=np.array([np.linalg.norm(block[1]-cv,2) for block in cov[1:]])
    return dict(date=record["date"],bead=2,command=800,raw_index=4460,
                source_small_block_sizes=[x[1] for x in vals],
                singular_values_cv=sv.tolist(),singular_values_c0=np.linalg.svd(c0,compute_uv=False).tolist(),
                condition_cv=float(sv[0]/sv[-1]),cv_norm_over_c0_norm=float(sv[0]/np.linalg.norm(c0,2)),
                contiguous_block_cv_deviation_spectral_norm=spread.tolist(),
                max_cv_block_deviation_over_sigma_min=float(max(spread)/sv[-1]),
                rms_cv_block_deviation_over_sigma_min=float(np.sqrt(np.mean(spread**2))/sv[-1]),
                observed_full_c0=c0.tolist(),observed_full_cv=cv.tolist(),
                observed_full_c26=cts.tolist(),nominal_delta=delta.tolist(),prediction=pred.tolist(),
                observation=record["observed"]["800"]["target"][23],
                qualifications="Eight contiguous groups of complete periods within each small-drive recording; deterministic variation about the pooled full-record matrix. Serial dependence and a common phase mean preclude interpreting it as a calibrated uncertainty interval.")


if __name__=="__main__":
    import argparse,h5py
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("record")
    args=parser.parse_args()
    with open(args.record) as f:
        record=json.load(f)
    with h5py.File(args.source,"r") as h:
        print(json.dumps(describe(h,record),indent=2))
