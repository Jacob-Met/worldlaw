"""Lock every held daily trajectory before allowing protected C04 positions into scoring."""
import base64
import hashlib
import io
import json
from pathlib import Path
import numpy as np
from response import solve
from data import build
def main():
    u,truth=build()
    forecasts,fit=solve(u,truth)
    metrics={}
    for y,t in truth.items():
        e=forecasts[y]-t[:,None,:]
        radial=np.linalg.norm(e,axis=2)
        i=int(np.argmax(radial[:,0]))
        metrics[y]=dict(rmse=np.sqrt(np.mean(radial**2,axis=0)).tolist(),worst_i=i,worst_truth=t[i].tolist(),worst_forecasts=forecasts[y][i].tolist())
    pack=io.BytesIO()
    np.savez_compressed(pack,**{"year"+str(y):forecasts[y] for y in range(2015,2025)})
    b=pack.getvalue()
    print("DEVELOPMENT",json.dumps(dict(fit=fit,years=metrics),separators=(",",":"),allow_nan=False))
    print("BOUNDARY",json.dumps({y:u[y][0].tolist() for y in range(2015,2025)},separators=(",",":")))
    print("LOCK",json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),years=10,roles=8,components=2,decision_rows=sum(len(forecasts[y]) for y in range(2015,2025)))))
    for i in range(0,len(b),24000):print("PACK",i,base64.b64encode(b[i:i+24000]).decode(),flush=True)
if __name__=="__main__":main()
