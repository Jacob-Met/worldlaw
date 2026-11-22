import io
import json
import hashlib
import tempfile
import urllib.request
from pathlib import Path
import numpy as np
from scipy.io import loadmat
from rolling_field import ROLES,correct_series
from native_vqf_factors import load_native,estimate_factors,reconstruct
from source_field_pilot_v2 import load_calibrator


def main():
    protocol=json.loads(Path('source-input-boundary.json').read_text());records=[]
    with tempfile.TemporaryDirectory() as d:
        lib=load_native(d);cls=load_calibrator()
        for name,size,blob in protocol['files']:
            trial=int(name.split('/')[-1].split('_')[0])
            if trial not in protocol['input_only_source_cases']:continue
            b=urllib.request.urlopen('https://raw.githubusercontent.com/dlaidig/broad/'+protocol['data_commit']+'/'+name,timeout=60).read()
            assert len(b)==size and hashlib.sha1(b'blob '+str(size).encode()+bytes([0])+b).hexdigest()==blob
            x=loadmat(io.BytesIO(b),variable_names=['imu_gyr','imu_acc','imu_mag','sampling_rate'])
            g,a,m=(x[k] for k in ('imu_gyr','imu_acc','imu_mag'));dt=1/x['sampling_rate'].item()
            corrected,ledger,b0=correct_series(g,m,dt,cls);D={};base0=None;raw9=None
            for r in ROLES:
                field=corrected.get(r,m);end=int(np.ceil(20/dt)) if r=='initial_field_then_6d' else len(m)
                q,bad,base,ang=estimate_factors(lib,dt,g,a,field,end)
                if base0 is None:base0=base;raw9=q
                assert np.array_equal(base0,base)
                assert np.array_equal(reconstruct(lib,base0,ang),q)
                gap=np.rad2deg(2*np.arccos(np.clip(abs((q*raw9).sum(1)),0,1)))
                D[r]=dict(quaternion_sha256=hashlib.sha256(q.tobytes()).hexdigest(),mean_diff_from_raw_deg=float(gap.mean()),max_diff_from_raw_deg=float(gap.max()),
                  mag_disturbance_fraction=float(bad.mean()),changed_input_fraction=float(np.any(field!=m,axis=1).mean()),
                  accepted_windows=[k['at'] for k in ledger if r in k['accepted']])
            # Deliberate input-only perturbation from 80s onward cannot
            # change any earlier output. Few future windows may legitimately differ.
            before=int(80/dt);alternate=m.copy();alternate[before:]+=np.array([7.,-11.,13.])
            check,_,_=correct_series(g,alternate,dt,cls)
            prior_equal=all(np.array_equal(check[r][:before],corrected[r][:before]) for r in corrected)
            assert prior_equal
            records.append(dict(trial=trial,roles=D,rank_valid_windows=sum(k['sigma_min_per_sqrt_pair']>=.08 and k['singular_ratio']>=.15 for k in ledger),
             samples=len(m),update_count=len(ledger),perturbation_sample=before,all_preceding_corrected_samples_unchanged=prior_equal,
             future_changed_rolling_values=int(np.any(check['rolling_gyro'][before:]!=corrected['rolling_gyro'][before:],axis=1).sum())))
    print(json.dumps({"source":records,"official_movement_or_optical_arrays_accessed":0,"held_files_accessed":0},sort_keys=True))


if __name__=="__main__":main()
