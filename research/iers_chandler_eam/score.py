"""Receive the locked numerical trajectories before reading held C04 outcomes."""
import base64
import hashlib
import io
import json
from datetime import date,timedelta
from pathlib import Path
import numpy as np
from data import positions,block
ROOT=Path(__file__).resolve().parent
def main():
    lock=json.loads((ROOT/"prediction_lock.json").read_text())
    blob=base64.b64decode((ROOT/"forecast_bytes.txt").read_text().strip(),validate=True)
    assert len(blob)==lock["bytes"] and hashlib.sha256(blob).hexdigest()==lock["sha256"]
    with np.load(io.BytesIO(blob),allow_pickle=False) as p:
        assert set(p.files)=={"year"+str(y) for y in range(2015,2025)}
        forecasts={y:p["year"+str(y)] for y in range(2015,2025)}
    for y,a in forecasts.items():
        n=(date(y+1,1,1)-date(y,1,1)).days-1
        assert a.shape==(n,8,2) and a.dtype==np.float64 and np.isfinite(a).all()
    obs=positions("score")
    scores={};raw={}
    for y,a in forecasts.items():
        t=block(obs,y);error=a-t[:,None,:];r=np.linalg.norm(error,axis=2)
        worst=np.argmax(r,axis=0)
        scores[y]=dict(days=len(t),rmse=np.sqrt(np.mean(r*r,axis=0)).tolist(),
            mean_radial=r.mean(axis=0).tolist(),bias=error.mean(axis=0).tolist(),
            worst_indices=worst.tolist(),maximum=r.max(axis=0).tolist(),
            capacity_max=float(np.max(np.linalg.norm(a[:,0,:]-a[:,1,:],axis=1))),
            capacity_rms=float(np.sqrt(np.mean(np.sum((a[:,0,:]-a[:,1,:])**2,axis=1)))))
        i=int(worst[0])
        raw[y]=dict(date=(date(y,1,2)+timedelta(days=i)).isoformat(),truth=t[i].tolist(),forecasts=a[i].tolist(),
            errors=error[i].tolist(),neighborhood=[[int(k),t[k].tolist(),a[k].tolist()] for k in range(max(0,i-2),min(len(t),i+3))])
    mat=np.array([scores[y]["rmse"] for y in sorted(scores)])
    mean=mat.mean(axis=0);wins=[int(np.sum(mat[:,0]<mat[:,j])) for j in range(8)]
    gate=bool(mean[0]<min(mean[1:]) and wins[1]>=7 and wins[2]>=7)
    print("SCORE",json.dumps(dict(years=scores,mean=mean.tolist(),wins=wins,gate=gate,worst_candidate=raw),allow_nan=False,separators=(",",":")))
if __name__=="__main__":main()
