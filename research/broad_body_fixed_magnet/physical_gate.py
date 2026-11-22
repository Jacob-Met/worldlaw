"""One-way forecast and optical-score entry points for the prospectively registered BROAD trials."""
import argparse
import hashlib
import io
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path
import numpy as np
from scipy.io import loadmat
from native_vqf_factors import load_native,estimate_factors,reconstruct
from rolling_field import ROLES,correct_series
from source_field_pilot_v2 import load_calibrator

PRIMARY="rolling_gyro"
COMPARATORS=("raw_vqf","initial_field_then_6d","static60_gyro","rolling_midpoint","rolling_sphere","rolling_ellipsoid","rolling_gyro_sham")


def sha(b):
    return hashlib.sha256(b).hexdigest()


def vector(a):
    return np.asarray(a,dtype='<f8',order='C').tobytes()


def protocol():
    root=Path(__file__).resolve().parent
    p=json.loads((root/'physical-protocol.json').read_text())
    for name,expected in p['pinned_files'].items():
        assert sha((root/name).read_bytes())==expected
    source=json.loads((root/'source-input-boundary.json').read_text())
    return p,source


def roster(source):
    ids=source['prospective_attached_magnet_cases']+source['prospective_room_fixed_magnet_cases']+source['prospective_clean_combined_cases']
    r={int(path.split('/')[-1][:2]):(path,size,blob) for path,size,blob in source['files']}
    assert len(set(ids))==len(ids)==11 and set(ids).isdisjoint(source['input_only_source_cases'])
    return {i:r[i] for i in ids}


def fetch(source,record):
    name,size,blob=record
    with urllib.request.urlopen('https://raw.githubusercontent.com/dlaidig/broad/'+source['data_commit']+'/'+name,timeout=75) as f:b=f.read(size+1)
    assert len(b)==size and hashlib.sha1(b'blob '+str(size).encode()+bytes([0])+b).hexdigest()==blob
    return b


def put(z,name,data):
    info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
    z.writestr(info,data)


def canonical(d):
    return (json.dumps(d,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode()


def forecast(target):
    p,source=protocol();trials=roster(source);manifest={'format':'broad.factor-lock.v1','physical_protocol':sha((Path(__file__).parent/'physical-protocol.json').read_bytes()),'roles':list(ROLES),'cases':{},'members':{}}
    cls=load_calibrator()
    with tempfile.TemporaryDirectory() as temp,zipfile.ZipFile(target,'w',allowZip64=True) as z:
        lib=load_native(temp)
        for trial,record in trials.items():
            raw=fetch(source,record)
            x=loadmat(io.BytesIO(raw),variable_names=['imu_gyr','imu_acc','imu_mag','sampling_rate']);assert set(x)-{'__header__','__version__','__globals__'}=={'imu_gyr','imu_acc','imu_mag','sampling_rate'}
            g,a,m=(x[name] for name in ('imu_gyr','imu_acc','imu_mag'));dt=1/float(x['sampling_rate'].item())
            del raw
            n=len(g);assert abs(dt-.0035)<1e-10 and g.shape==a.shape==m.shape==(n,3) and n>17143
            corrected,ledger,fixed=correct_series(g,m,dt,cls);base0=None
            case={'n':n,'dt':dt,'mat_git_blob':record[2],'quaternion_sha256':{},'shape':[n,4],'fixed60_bias_uT':fixed.tolist(),
                  'source_axis_abs_at_least_990uT':np.sum(abs(m)>=990,axis=0).tolist(),'source_axis_range_uT':[m.min(axis=0).tolist(),m.max(axis=0).tolist()]}
            def save(name,data):
                name=f'{trial}/{name}';put(z,name,data);manifest['members'][name]=sha(data)
            for role in ROLES:
                field=corrected.get(role,m);end=int(np.ceil(20/dt)) if role=='initial_field_then_6d' else n
                q,bad,base,ang=estimate_factors(lib,dt,g,a,field,end)
                if base0 is None:
                    base0=base;save('q6.f64le',vector(base))
                assert np.array_equal(base0,base) and np.array_equal(reconstruct(lib,base0,ang),q)
                case['quaternion_sha256'][role]=sha(vector(q))
                save(role+'.yaw.f64le',vector(ang));save(role+'.magflag.bits',np.packbits(bad,bitorder='little').tobytes())
            save('decisions.json',canonical(ledger));manifest['cases'][str(trial)]=case
            print(json.dumps({'forecast_case':trial,'n':n,'full_quaternion_hashes':case['quaternion_sha256'],'recorded_optical_arrays_read':0}),flush=True)
        put(z,'manifest.json',canonical(manifest))
    print(json.dumps({'prediction_lock':sha(target.read_bytes()),'bytes':target.stat().st_size,'cases':len(trials),'forecast_arrays':len(ROLES)*len(trials),
                      'scalars_per_role':sum(x['n'] for x in manifest['cases'].values())*4,'optical_arrays_read':0}),flush=True)

def official_scorer(source):
    url='https://raw.githubusercontent.com/dlaidig/broad/'+source['data_commit']+'/example_code/broad_utils.py'
    with urllib.request.urlopen(url,timeout=30) as f:b=f.read()
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+bytes([0])+b).hexdigest()=='42cb7e7852eaedf79b066585ca0f9c2a7cca516b'
    env={};exec(compile(b,url,'exec'),env)
    return env['calculateRMSE']


def independent_errors(pred,opt):
    pred=pred/np.linalg.norm(pred,axis=1)[:,None]
    with np.errstate(invalid='ignore',divide='ignore'):
        opt=opt/np.linalg.norm(opt,axis=1)[:,None]
    w=(pred*opt).sum(axis=1)
    z=-pred[:,0]*opt[:,3]+pred[:,3]*opt[:,0]-pred[:,1]*opt[:,2]+pred[:,2]*opt[:,1]
    hd=np.rad2deg(2*np.arctan2(abs(z),abs(w)))
    inc=np.rad2deg(2*np.arccos(np.clip(np.hypot(w,z),0,1)))
    total=np.rad2deg(2*np.arccos(np.clip(abs(w),0,1)))
    return hd,inc,total


def get_arrays(z,case,trial,lib):
    n=case['n'];base=np.frombuffer(z.read(f'{trial}/q6.f64le'),dtype='<f8').reshape(n,4)
    for r in ROLES:
        angle=np.frombuffer(z.read(f'{trial}/{r}.yaw.f64le'),dtype='<f8')
        assert len(angle)==n
        q=reconstruct(lib,base,angle)
        assert sha(vector(q))==case['quaternion_sha256'][r]
        yield r,q


def validate(z,expected,p,source,lib):
    m=json.loads(z.read('manifest.json'));trials=roster(source)
    assert m['physical_protocol']==sha((Path(__file__).parent/'physical-protocol.json').read_bytes())
    assert m['roles']==list(ROLES) and set(m['cases'])==set(map(str,trials))
    names={f'{i}/{s}' for i in trials for s in ['q6.f64le','decisions.json']+[r+ext for r in ROLES for ext in ('.yaw.f64le','.magflag.bits')]}
    assert names==set(m['members']) and set(z.namelist())==names|{'manifest.json'} and len(z.namelist())==len(names)+1
    for name in names:
        assert sha(z.read(name))==m['members'][name]
    for i,record in trials.items():
        case=m['cases'][str(i)];assert case['mat_git_blob']==record[2] and abs(case['dt']-.0035)<1e-10 and case['n']>17143
        assert set(case['quaternion_sha256'])==set(ROLES)
        for r,q in get_arrays(z,case,i,lib):
            assert q.shape==(case['n'],4) and np.isfinite(q).all()
    return m


def score(path,expected):
    assert sha(path.read_bytes())==expected
    p,src=protocol();trials=roster(src);metric=official_scorer(src);rows={}
    with tempfile.TemporaryDirectory() as d,zipfile.ZipFile(path) as z:
        lib=load_native(d);m=validate(z,expected,p,src,lib)
        for i,record in trials.items():
            case=m['cases'][str(i)];n=case['n']
            # Optical and movement variables enter only after every one of
            # the 88 full orientation arrays has passed its original hash.
            x=loadmat(io.BytesIO(fetch(src,record)),variable_names=['opt_quat','movement','imu_gyr','imu_acc','imu_mag'])
            opt=x['opt_quat'];raw_mask=x['movement'].reshape(-1)
            assert opt.shape==(n,4) and len(raw_mask)==n and set(np.unique(raw_mask))<={0,1}
            mask=raw_mask.astype(bool);finite=mask&np.all(np.isfinite(opt),axis=1)&(np.linalg.norm(opt,axis=1)>0)
            assert finite.any()
            roles={};worsts={};errors={}
            for r,q in get_arrays(z,case,i,lib):
                y=metric(q,opt,mask);err=independent_errors(q,opt);h,inc,tot=err
                for k,ab in [('heading_rmse_deg',h),('inclination_rmse_deg',inc),('total_rmse_deg',tot)]:
                    alternate=float(np.sqrt(np.mean(ab[finite]**2)))
                    assert abs(y[k]-alternate)<3e-7,(i,r,k,y[k],alternate)
                w=int(np.argmax(np.where(finite,h,-np.inf)))
                roles[r]={k:float(v) for k,v in y.items()};worsts[r]={'index':w,'time_s':w*.0035,'heading_abs_deg':float(h[w])}
                errors[r]=h
            w=worsts[PRIMARY]['index']
            rows[str(i)]={'samples':n,'motion_samples':int(mask.sum()),'valid_optical_motion_samples':int(finite.sum()),'roles':roles,'worst_by_role':worsts,
                'same_sample':{'index':w,'time_s':w*.0035,'opt_quat_wxyz':opt[w].tolist(),'gyro_rad_s':x['imu_gyr'][w].tolist(),'acc_m_s2':x['imu_acc'][w].tolist(),'mag_uT':x['imu_mag'][w].tolist(),'role_heading_abs_deg':{r:float(err[w]) for r,err in errors.items()}},
                'ranked_windows_and_applied_counts':{r:sum(r in v['accepted'] for v in json.loads(z.read(f'{i}/decisions.json'))) for r in ROLES}}
    groups={'attached':src['prospective_attached_magnet_cases'],'room':src['prospective_room_fixed_magnet_cases'],'clean':src['prospective_clean_combined_cases']}
    groupscores={g:{r:{k:float(np.mean([rows[str(i)]['roles'][r][k] for i in ids])) for k in ('heading_rmse_deg','total_rmse_deg','inclination_rmse_deg')} for r in ROLES} for g,ids in groups.items()}
    heading=lambda i,r:rows[str(i)]['roles'][r]['heading_rmse_deg']
    att=groups['attached']
    wins={r:sum(heading(i,PRIMARY)<heading(i,r) for i in att) for r in COMPARATORS}
    main=all(wins[r]>=3 and groupscores['attached'][PRIMARY]['heading_rmse_deg']<groupscores['attached'][r]['heading_rmse_deg'] for r in COMPARATORS)
    retention={g:(groupscores[g][PRIMARY]['heading_rmse_deg']-groupscores[g]['raw_vqf']['heading_rmse_deg']<=.2 and max(heading(i,PRIMARY)-heading(i,'raw_vqf') for i in groups[g])<=1.) for g in ('room','clean')}
    return dict(schema='p3.broad.full-optical.v1',forecast_lock=expected,per_trial=rows,group_scores=groupscores,
          attached_trial_wins=wins,attached_gate=main,retention=retention,joint=main and all(retention.values()),
          all_full_quaternion_hashes_checked_before_any_optical_access=88)


if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('action',choices=['forecast','score']);args.add_argument('archive',type=Path);args.add_argument('--sha');args=args.parse_args()
    if args.action=='forecast':forecast(args.archive)
    else:print(json.dumps(score(args.archive,args.sha),sort_keys=True))
