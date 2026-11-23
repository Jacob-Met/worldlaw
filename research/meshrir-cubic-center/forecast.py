"""Forecast all 98 protected microphone centers without opening their IR files."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import numpy as np
from geometry import Geometry, DONOR_OFFSETS, HZ
from directions import minimax, radial_mean
from author_filters import load_checked, author_weights
from training import choose_ridge

NAMES=("direction_minimax","radial_mean","author_isotropic","author_directional",
       "empirical_shell_ridge","empirical_26_ridge","equal_26","zero")

def pair(x):
    return np.stack((x.real,x.imag),axis=-1).tolist()

def forecast(archive,output):
    geom=Geometry(archive)
    author=load_checked(tempfile.mkdtemp(prefix="worldlaw-author-"))
    shell=np.count_nonzero(np.array(DONOR_OFFSETS),axis=1)
    dev=np.array([center[2]==4 for center,_,_ in geom.cubes])
    columns=np.array([center[0] for center,_,_ in geom.cubes])
    d=np.array([[geom.response(i) for i in ids] for _,_,ids in geom.cubes])
    train_y=np.array([geom.response(mid) for (center,mid,ids),flag in zip(geom.cubes,dev) if flag])
    assert d.shape==(147,26,7) and train_y.shape==(49,7)
    means=np.stack([d[:,shell==s,:].mean(axis=1) for s in (1,2,3)],axis=1)
    est={name:np.zeros((98,7),complex) for name in NAMES}
    limits=[]; lambdas=[]
    held=[v for v,flag in zip(geom.cubes,dev) if not flag]
    for j,f in enumerate(HZ):
        w,direction_limit=minimax(f)
        limits.append(dict(hz=float(f),weights=w.tolist(),**direction_limit))
        est["direction_minimax"][:,j]=means[~dev,:,j]@w
        est["radial_mean"][:,j]=means[~dev,:,j]@radial_mean(f)
        est["equal_26"][:,j]=d[~dev,:,j].mean(axis=1)
        for a,label in [(d,"empirical_26_ridge"),(means,"empirical_shell_ridge")]:
            beta,selection=choose_ridge(a[dev,:,j],train_y[:,j],columns[dev])
            lambdas.append(dict(hz=float(f),arm=label,**selection))
            est[label][:,j]=a[~dev,:,j]@beta
        for i,(_,mid,ids) in enumerate(held):
            for direct,label in ((False,"author_isotropic"),(True,"author_directional")):
                w=author_weights(author,f,geom.position[ids],geom.position[mid],geom.source,direct)
                est[label][i,j]=w@d[~dev,:,j][i]
    assert all(np.all(np.isfinite(v)) for v in est.values())
    bank=dict(frequencies=HZ.tolist(),candidate="direction_minimax",arms=list(NAMES),
              held_centers=[list(center) for center,_,_ in held],held_member_ids=[mid for _,mid,_ in held],
              donor_ids=[ids for _,_,ids in held],numerical_directional_bounds=limits,
              training_ridge_selection=lambdas,forecasts={name:pair(est[name]) for name in NAMES})
    raw=json.dumps(bank,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    Path(output).write_bytes(raw)
    print("FORECAST",len(raw),hashlib.sha256(raw).hexdigest(),"3822 distinct donors, 49 calibration centers, zero of 98 held center responses used.")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("archive");parser.add_argument("output")
    args=parser.parse_args()
    forecast(args.archive,args.output)
