"""Recount every held-map error from the original rows and archived forecast arrays."""
from pathlib import Path
import gzip,hashlib,io,json,sys,zipfile
import numpy as np
def audit(source,lock,score):
    assert hashlib.sha256(Path(source).read_bytes()).hexdigest()=='152b9a7566679d65b37dd7e9a899d3dc5b4e9a2a35b3f2cb8983b4fb367e90c5'
    report=json.loads(Path(score).read_text())
    with np.load(lock) as f:
        pred=f['predictions'];current=f['current'];field=f['field']
    assert pred.shape==(2,231,231,6)
    def physical(z,ids):
        values=[]
        for unit in ids:
            name=next(n for n in z.namelist() if n.endswith('/datS2109_'+str(unit)+'.dat'))
            tab={}
            for line in z.read(name).splitlines():
                if not line.strip() or line.startswith(b'#'):continue
                fields=line.split();tab[float(fields[1]),float(fields[0])]=float(fields[3])
            b=sorted({entry[0] for entry in tab});i=sorted({entry[1] for entry in tab})
            values.append([[tab[B,I]-tab[B,0.] for I in i] for B in b])
        return np.asarray(values)
    def make(x):
        return np.stack((x,-np.flip(x,axis=(0,2)),np.flip(x,axis=1),-np.flip(x,axis=(0,1,2))),axis=-1)
    with zipfile.ZipFile(source) as zz:
        design=make(physical(zz,[7,8])).reshape(-1,4)
        target=physical(zz,[9,10]).ravel()
        sv,u=np.linalg.eigh(design.T@design)
        ridge=1.e-8*np.square(design).sum()/4
        weights=u@((u.T@(design.T@target))/(sv+ridge))
        candidate=make(physical(zz,[23,24]))
        forecasts=np.concatenate([candidate,candidate.mean(axis=-1,keepdims=True),(candidate@weights)[...,None]],axis=-1)
        assert np.allclose(forecasts,pred,rtol=1e-9,atol=1e-10)
    obs=[]; references=[]
    with zipfile.ZipFile(source) as z:
        for unit in [25,26]:
            nm=next(s for s in z.namelist() if s.endswith('/datS2109_'+str(unit)+'.dat'))
            chart={}
            for s in z.read(nm).splitlines():
                if not s.strip() or s.startswith(b'#'):continue
                parts=s.split();i,b,v=map(float,(parts[0],parts[1],parts[3]))
                assert (i,b) not in chart;chart[i,b]=v
            assert len(chart)==231*231
            obs.append([[chart[i,b]-chart[0.,b] for i in current] for b in field])
            references.append([chart[0.,b] for b in field])
    y=np.asarray(obs);e=pred-y[...,None];rmse=np.empty((2,6));peak=rmse.copy()
    from math import fsum,sqrt
    for a in range(2):
        for k in range(6):
            rows=[fsum(float(x)**2 for x in line)/231 for line in e[a,:,:,k]]
            rmse[a,k]=sqrt(fsum(rows)/231);peak[a,k]=sqrt(max(rows))
    assert np.allclose(rmse,report['rmse'],rtol=1e-12,atol=1e-14)
    assert np.allclose(peak,report['worst_field_rmse'],rtol=1e-12,atol=1e-14)
    checks=[bool(x[j,3]<min(x[j,k] for k in [0,1,2,4,5])) for x in [rmse,peak] for j in [0,1]]
    assert checks==report['gates'] and all(checks)==report['joint']
    ijk=np.unravel_index(np.abs(e[...,3]).argmax(),y.shape);w=report['worst']
    assert list(ijk)==w['array_indices'] and e[ijk].tolist()==w['error'] and pred[ijk].tolist()==w['pred']
    print('VERIFIED',y.size,e.size,24,checks,ijk,flush=True)
if __name__=='__main__':audit(*sys.argv[1:])
