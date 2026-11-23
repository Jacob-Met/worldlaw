"""Score published immutable arrays. Refuse before target selection if source, rows or roles do not match."""
import datetime as dt, hashlib, json, sys
from pathlib import Path
import numpy as np
from source import read, PROTOCOL

def main(path,digest,devpath):
    p=Path(path)
    if hashlib.sha256(p.read_bytes()).hexdigest()!=digest:raise ValueError('forecast hash')
    dev=json.loads(Path(devpath).read_bytes());assert dev['forecast_sha256']==digest and dev['roles']==PROTOCOL['roles']
    with np.load(p,allow_pickle=False) as raw:
        a={k:raw[k] for k in raw.files}
    assert set(a)==set(PROTOCOL['roles'])|{'H_S_N','timestamp','lower','upper','physical_lower','physical_upper'}
    stamps=[dt.datetime.strptime(x.decode(),'%Y%m%d%H') for x in a['timestamp']]
    n=len(stamps);assert len(set(stamps))==n==dev['rows_held_inputs']
    assert all(v.shape==(n,) for k,v in a.items() if k!='H_S_N') and a['H_S_N'].shape==(n,3)
    assert all(np.isfinite(v).all() for k,v in a.items() if k!='timestamp')
    observed=dict(read(2025,targets_only=True));assert set(stamps).issubset(observed)
    truth=np.array([float('nan') if observed[t].get('I') is None else observed[t]['I'] for t in stamps])
    valid=np.isfinite(truth); h,s,north=a['H_S_N'].T;inform=valid&(h>=20);m=np.array([x.month for x in stamps])
    masks={'all':valid,'informative':inform,'south_or_equal':inform&(s>=north),'north':inform&(s<north)}
    for i in range(1,13):masks[f'month_{i:02d}']=(m==i)&inform
    def rawrow(i):
        return dict(time=stamps[i].isoformat(),H_S_N=a['H_S_N'][i].tolist(),measured=float(truth[i]),readings={k:float(a[k][i]) for k in PROTOCOL['roles']+['lower','upper','physical_lower','physical_upper']})
    def metric(y,x):
        er=x-y
        return {'n':len(y),'mae':float(np.mean(abs(er))),'rmse':float(np.sqrt(np.mean(er**2))),'bias':float(np.mean(er))}
    rows={};inter={}
    for g,mask in masks.items():
        if not mask.any():continue
        rows[g]={k:metric(truth[mask],a[k][mask]) for k in PROTOCOL['roles']}
        inter[g]={}
        for lo,hi in [('lower','upper'),('physical_lower','physical_upper')]:
            below=np.maximum(0,a[lo][mask]-truth[mask]);above=np.maximum(0,truth[mask]-a[hi][mask])
            # A conservative Lipschitz propagation under a hypothetical independent ±3.2% box about each reported value.
            c=0.5; sn=3**0.5/2
            dh,ds,dn,dy=[0.032*abs(w[mask]) for w in (h,s,north,truth)]
            if lo=='lower':
                df=np.maximum(ds,dn)
                allowance=dy+c*dh+sn*ds+(c+sn-1)*df+np.maximum(c*(dh+2*df),sn*(ds+dn))
            else:allowance=dy+c*dh+sn*np.maximum(ds,dn)
            inter[g][lo]=dict(outside_box_even_after_conservative_allowance=int((below+above>allowance+1e-8).sum()),n=int(mask.sum()),below=int((below>1e-8).sum()),above=int((above>1e-8).sum()),max_below=float(below.max()),max_above=float(above.max()),mean_excess=float((below+above).mean()))
    worst={}
    for k in PROTOCOL['roles']:
        idx=np.flatnonzero(inform);e=abs(a[k][idx]-truth[idx]);extreme=idx[np.argsort(-e,kind='stable')[:10]]
        worst[k]=[rawrow(i) for i in extreme]
    episodes={}
    for k,arr in [('candidate',abs(a['hemispheres_residual']-truth)),('physical',abs(a['hemispheres']-truth)),('above',truth-a['upper']),('below',a['lower']-truth)]:
        ii=np.flatnonzero(inform);i=ii[np.argmax(arr[ii])]
        episodes[k]=[rawrow(j) for j in range(max(0,i-3),min(len(truth),i+4)) if valid[j]]
    cand='hemispheres_residual'; controls=['ordinary_linear','empirical_ridge','empirical_boost','perez_calibrated']
    sel=dev['selected_control']; wins=sum(rows[f'month_{i:02d}'][cand]['mae']<rows[f'month_{i:02d}'][sel]['mae'] for i in range(1,13) if f'month_{i:02d}' in rows)
    gate={'beats_all_four_fitted_MAE':all(rows['informative'][cand]['mae']<rows['informative'][k]['mae'] for k in controls), 'beats_dev_selected_RMSE':rows['informative'][cand]['rmse']<rows['informative'][sel]['rmse'],'monthly_wins':wins,'enough_months':wins>=8}
    gate['pass']=gate['beats_all_four_fitted_MAE'] and gate['beats_dev_selected_RMSE'] and gate['enough_months']
    print(json.dumps({'forecast_sha256':digest,'n_raw':len(observed),'n_forecast':n,'unforecast_timestamps':[x.isoformat() for x in sorted(set(observed)-set(stamps))],'missing_target':[stamps[i].isoformat() for i in np.flatnonzero(~valid)],'metrics':rows,'interval':inter,'episodes':episodes,'worst10':worst,'gate':gate,'dev_selected':sel},sort_keys=True,allow_nan=False))
if __name__=='__main__':main(*sys.argv[1:])
