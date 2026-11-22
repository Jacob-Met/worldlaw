"""Freeze predictions before reverse-spectrum scoring on held roughness levels."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path
import numpy as np
from spectra import predict, rms

ARCHIVE_SHA = '1dbe6a6e5c5a86e73862e32a9606bbf062d51e98f82df710d2b82ef7376f0caf'
FILES={
    .61:('FIG4_Transmission_a_61e-2um.csv','2de6d82ddbd2841fb05795c4365a19615d41d24eccecef31eaeac40855214d0c'),
    1.36:('FIG4_Transmission_b_136e-2um.csv','1785f6ee333f3799363b75f575cd713b629131f7f9e2a2f5e5f7142761f455a0'),
    9.2:('FIG4_Transmission_c_92e-1um.csv','3eb9275ee727bac0c803f365faf0cdf4e7ee0da2ebff915f8b187aceb0ff61bb'),
    68.:('FIG4_Transmission_d_68um.csv','ae848ffde0f024dc204e70f658585f2c4b90929a87514c067c2e465653add2a7'),
    140.:('FIG4_Transmission_e_140um.csv','43136a6caca0683f0ad21d745ae5cfe2a05bd05743dd7760e30aba478c4b6f7d')}
DEV=(.61,9.2,140.)
HELD=(1.36,68.)
CANDIDATE='donor_consensus'
ARMS=('equal','smooth_reference','transverse_gain','transverse_additive','transverse_ratio',
      'cross_level_affine','local_transverse_affine','donor_difference','fixed_frequency_operator',
      'registered_operator','donor_consensus','nonlinear_kernel')
CALIBRATED=('equal','smooth_reference','transverse_gain','transverse_additive','transverse_ratio',
            'cross_level_affine','local_transverse_affine')
GRID='557b542b6b2ae4d1804956a715ce0d1a6e84b4fafa54617b6cc25b95e81e34a9'
HEADER=b'Freq,Transmission_0 deg (a.u.),Transmission_180 deg(a.u.),Transmission_90 deg(a.u.),Transmission_270 deg(a.u.)'

def sha(b):
    return hashlib.sha256(b).hexdigest()


def read(z, level, cols):
    name,digest=FILES[level];raw=z.read(name)
    assert sha(raw)==digest and raw.splitlines()[0]==HEADER
    values=np.loadtxt(io.BytesIO(raw),delimiter=',',skiprows=1,usecols=cols,ndmin=2)
    assert values.shape==(751,len(cols)) and np.isfinite(values).all()
    assert cols[0]==0 and sha(np.ascontiguousarray(values[:,0],dtype='<f8').tobytes())==GRID
    return values


def new_member(z,name,b):
    inf=zipfile.ZipInfo(name,(2026,1,1,0,0,0));inf.compress_type=zipfile.ZIP_DEFLATED
    z.writestr(inf,b)


def lock(dataset,dest):
    raw=dataset.read_bytes();assert sha(raw)==ARCHIVE_SHA
    if dest.exists():raise ValueError('Prediction destination already exists')
    reg={'archive_sha256':ARCHIVE_SHA,'development':DEV,'held':HELD,'target_columns_decoded':0,
         'model_sha256':sha(Path(__file__).with_name('spectra.py').read_bytes()),'arms':ARMS,'members':{},'diagnostics':{}}
    with zipfile.ZipFile(io.BytesIO(raw)) as z,zipfile.ZipFile(dest,'x') as archive:
        train={}
        for level in DEV:
            a=read(z,level,(0,1,2,3,4))
            train[level]=(a[:,[1,3,4]],a[:,2])
        for level in HELD:
            a=read(z,level,(0,1,3,4))
            forecasts,diagnostics=predict(train,level,a[:,0],a[:,1:])
            assert set(forecasts)==set(ARMS)
            reg['diagnostics'][str(level)]=diagnostics
            for arm in ARMS:
                name=f'{level}/{arm}.f64';data=np.asarray(forecasts[arm],dtype='<f8').tobytes()
                assert len(data)==751*8
                new_member(archive,name,data);reg['members'][name]=sha(data)
        new_member(archive,'registry.json',json.dumps(reg,sort_keys=True).encode())
    return reg


def score(dataset,predictions,expected_hash):
    raw=dataset.read_bytes();assert sha(raw)==ARCHIVE_SHA
    pinned=predictions.read_bytes();assert sha(pinned)==expected_hash
    out={'source_archive':ARCHIVE_SHA,'prediction_sha256':expected_hash,'scores':{},'identifiability':{}}
    with zipfile.ZipFile(io.BytesIO(raw)) as z,zipfile.ZipFile(io.BytesIO(pinned)) as pred:
        reg=json.loads(pred.read('registry.json'))
        assert reg['arms']==list(ARMS) and reg['held']==list(HELD) and reg['target_columns_decoded']==0
        assert set(reg['members'])=={f'{level}/{arm}.f64' for level in HELD for arm in ARMS}
        assert len(pred.namelist())==25 and set(pred.namelist())==set(reg['members'])|{'registry.json'}
        for level in HELD:
            a=read(z,level,(0,1,2,3,4));freq,x,y,u,v=a.T;band=(freq>=400)&(freq<=600)
            assert band.sum()==251 and rms(y)>0 and rms(y[band])>0
            out['scores'][str(level)]={}
            for arm in ARMS:
                name=f'{level}/{arm}.f64';b=pred.read(name);assert sha(b)==reg['members'][name]
                p=np.frombuffer(b,dtype='<f8');err=p-y;w=int(np.argmax(abs(err)))
                out['scores'][str(level)][arm]={'whole_nrmse':rms(err)/rms(y),'band_nrmse':rms(err[band])/rms(y[band]),
                    'mae':float(np.mean(abs(err))),'p95_abs':float(np.quantile(abs(err),.95)),
                    'worst':{'row':w,'freq':freq[w],'t0':x[w],'t90':u[w],'t270':v[w],'target':y[w],'prediction':p[w],'signed_error':err[w]}}
            # Observed lower bound on error of one common scalar gain; no calibration guarantee.
            den=np.hypot(x,u);lb=np.hypot(y,v);np.divide(np.abs(x*v-u*y),den,out=lb,where=den!=0)
            k=int(np.argmax(lb))
            out['identifiability'][str(level)]={'target_exact_duplicate_of':[
                key for key,arr in [('forward',x),('transverse_forward',u),('transverse_reverse',v)] if np.array_equal(y,arr)],
                'nonpositive_counts':np.sum(a[:,1:]<=0,axis=0).tolist(),'common_gain_min_residual_rms_au':rms(lb),
                'worst_common_gain_witness':[k,float(freq[k]),float(lb[k]),x[k],y[k],u[k],v[k]]}
    mean=lambda arm,metric:np.mean([out['scores'][str(s)][arm][metric] for s in HELD])
    primary=mean(CANDIDATE,'whole_nrmse')
    out['paired_mean_whole_nrmse']={arm:float(mean(arm,'whole_nrmse')) for arm in ARMS}
    out['gates']={'mean_full_better_than_all_comparators':bool(all(primary<mean(arm,'whole_nrmse') for arm in ARMS if arm!=CANDIDATE)),
        'each_full_better_than_all_calibrated':bool(all(out['scores'][str(s)][CANDIDATE]['whole_nrmse']<
            out['scores'][str(s)][arm]['whole_nrmse'] for s in HELD for arm in CALIBRATED)),
        'mean_methods_band_no_worse_than_all_calibrated':bool(all(mean(CANDIDATE,'band_nrmse')<=mean(arm,'band_nrmse') for arm in CALIBRATED)),
        'no_held_target_exact_duplicate':all(not r['target_exact_duplicate_of'] for r in out['identifiability'].values())}
    out['joint']=all(out['gates'].values())
    return out

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['lock','score']);parser.add_argument('dataset',type=Path)
    parser.add_argument('forecasts',type=Path);parser.add_argument('--forecast-sha256')
    args=parser.parse_args()
    if args.mode=='lock':result=lock(args.dataset,args.forecasts)
    else:result=score(args.dataset,args.forecasts,args.forecast_sha256)
    print(json.dumps(result,sort_keys=True,allow_nan=False))
