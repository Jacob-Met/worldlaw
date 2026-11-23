"""Freeze prediction arrays before opening the 2025 assay column."""
import datetime as dt
import hashlib, io, json, sys, zipfile
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
import pvlib
from sklearn.ensemble import HistGradientBoostingRegressor
from theory import predictions
from source import read, PROTOCOL

def arrays(rows, targets):
    times=[]; data=[]; missing=[]
    for t,q in rows:
        v=[q.get(c) for c in ('L','H','E')+ (('I',) if targets else ())]
        if any(a is None or not np.isfinite(a) for a in v):
            missing.append(t.isoformat());continue
        if min(v[:3])<0:raise ValueError('negative input '+t.isoformat())
        times.append(t);data.append(v)
    return times,np.asarray(data),missing

def sun_clock(times,mode):
    # Hour ends interval. Pick DST at local noon, independent of the held irradiances.
    offsets=np.array([(0 if mode=='utc' else 1 if mode=='cet' else t.replace(hour=12,tzinfo=ZoneInfo('Europe/Oslo')).utcoffset().total_seconds()/3600) for t in times])
    ix=pd.DatetimeIndex([t-dt.timedelta(hours=float(off)+0.5) for t,off in zip(times,offsets)],tz='UTC')
    angles=pvlib.solarposition.get_solarposition(ix,63+25/60,10+27/60)
    return ix,angles

def perez(times,a,clock):
    h=a[:,0]
    ix,ang=sun_clock(times,clock)
    z=ang.apparent_zenith.to_numpy(); sun=np.cos(np.radians(z))
    # Disabling clearness-index differences avoids use of the following hour.
    d=pvlib.irradiance.dirint(pd.Series(h,index=ix),ang.zenith,ix,use_delta_kt_prime=False).to_numpy()
    d[(ang.zenith.to_numpy()>=87)|(h==0)]=0
    if not np.isfinite(d).all():raise ValueError('nonfinite DIRINT daylight')
    dhi=np.maximum(0,h-np.maximum(0,np.cos(np.radians(ang.zenith.to_numpy())))*d)
    poa=pvlib.irradiance.get_total_irradiance(60,180,z,ang.azimuth.to_numpy(),d,h,dhi,dni_extra=pvlib.irradiance.get_extra_radiation(ix).to_numpy(),albedo=0.2,model='perez')['poa_global']
    poa=np.asarray(poa).copy()
    # Below horizon with positive light: use the isotropic sky/ground limit as the stated twilight extension.
    night=z>=90; poa[night]=h[night]*0.8
    poa[h==0]=0
    if not np.isfinite(poa).all():raise ValueError('nonfinite tilted irradiance')
    return poa

def features(t,a):
    phases=np.array([[np.cos(2*np.pi*(x.hour-.5)/24),np.sin(2*np.pi*(x.hour-.5)/24),np.cos(2*np.pi*(x.timetuple().tm_yday-1)/365.2425),np.sin(2*np.pi*(x.timetuple().tm_yday-1)/365.2425)] for x in t])
    xyz=a[:,:3]
    return np.column_stack((xyz,phases,(xyz[:,:,None]*phases[:,None,:]).reshape(len(t),-1),xyz[:,1]-xyz[:,2],np.minimum(xyz[:,1],xyz[:,2])))

def ridge(x,y,xall):
    mu=x.mean(axis=0);sd=x.std(axis=0);sd[sd==0]=1
    u=(x-mu)/sd
    w=np.linalg.solve(u.T@u+np.eye(x.shape[1]),u.T@(y-y.mean()))
    return [np.maximum(0,y.mean()+(v-mu)/sd@w) for v in xall]

def main(dest):
    years=[2023,2024,2025]; observed=[arrays(read(y,target=y<2025),y<2025) for y in years]
    times,raw,miss=zip(*observed);hh=raw[0][:,0]
    clock_scores={}
    for mode in ('utc','cet','oslo'):
        _,ang=sun_clock(times[0],mode)
        alt=np.maximum(0,np.sin(np.radians(ang.apparent_elevation.to_numpy())))
        clock_scores[mode]=float(np.mean((hh-alt*float(np.dot(alt,hh)/np.dot(alt,alt)))**2))
    clock=min(clock_scores,key=clock_scores.get)
    fs=[features(t,a) for t,a in zip(times,raw)]
    phys=[{k:np.array([row[k] for row in rr]) for k in rr[0]} for rr in [[predictions(*r[:3]) for r in a] for a in raw]]
    pp=[perez(t,a,clock) for t,a in zip(times,raw)]
    target=raw[0][:,3]
    roles={k:[z[k] for z in phys] for k in ('hemispheres','front_only','arithmetic_mid')}
    roles['algebraic_upper']=[z['physical_upper'] for z in phys]
    roles['perez_dirint']=pp
    roles['ordinary_linear']=ridge(raw[0][:,:3],target,[a[:,:3] for a in raw])
    roles['empirical_ridge']=ridge(fs[0],target,fs)
    # Equal feature/time budget for all three boosted regressions.
    for name,offset in [('empirical_boost',[np.zeros(len(x)) for x in raw]),('hemispheres_residual',roles['hemispheres']),('perez_calibrated',pp)]:
        model=HistGradientBoostingRegressor(loss='absolute_error',max_iter=160,max_leaf_nodes=15,learning_rate=.07,min_samples_leaf=40,l2_regularization=1,early_stopping=False,random_state=9017)
        model.fit(fs[0],target-offset[0])
        roles[name]=[np.maximum(0,base+model.predict(x)) for base,x in zip(offset,fs)]
    assert set(roles)==set(PROTOCOL['roles'])
    meta={'clock_loss':clock_scores,'clock':clock,'missing_input_or_training_truth':dict(zip(years,miss)),'development':{},'worst_development':{}}
    for yn,yr in enumerate(years[:2]):
        y=raw[yn][:,3]; eligible=raw[yn][:,0]>=20; rows={}
        for name,r in roles.items():
            err=r[yn]-y; i=int(np.argmax(abs(err)*eligible))
            rows[name]=float(np.mean(abs(err[eligible])))
            meta['worst_development'][str(yr)+'_'+name]={'hour':times[yn][i].isoformat(),'H_S_N_truth':raw[yn][i].tolist(),'prediction':float(r[yn][i])}
        meta['development'][str(yr)]=rows
    controls=('ordinary_linear','empirical_ridge','empirical_boost','perez_dirint','perez_calibrated')
    meta['selected_control']=min(controls,key=meta['development']['2024'].get)
    source_dir=Path(dest);source_dir.mkdir(exist_ok=True)
    members={k:v[2] for k,v in roles.items()}; members.update({k:phys[2][k] for k in ('lower','upper','physical_lower','physical_upper')})
    members.update(timestamp=np.array([x.strftime('%Y%m%d%H') for x in times[2]],dtype='S10'),H_S_N=raw[2][:,:3])
    if not all(np.isfinite(v).all() for k,v in members.items() if k!='timestamp'):raise ValueError('nonfinite locked forecasts')
    uri=source_dir/'forecasts.npz'
    with zipfile.ZipFile(uri,'w',zipfile.ZIP_DEFLATED) as z:
        for key,v in sorted(members.items()):
            b=io.BytesIO();np.lib.format.write_array(b,np.asarray(v),allow_pickle=False)
            info=zipfile.ZipInfo(key+'.npy',date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,b.getvalue())
    meta['forecast_bytes']=uri.stat().st_size;meta['forecast_sha256']=hashlib.sha256(uri.read_bytes()).hexdigest()
    meta['rows_held_inputs']=len(times[2]);meta['roles']=PROTOCOL['roles']
    (source_dir/'development.json').write_text(json.dumps(meta,sort_keys=True,indent=2)+'\n')
    print(json.dumps(meta,sort_keys=True))
if __name__=='__main__': main(sys.argv[1])
