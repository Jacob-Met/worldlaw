"""Replay the frozen 41-passage optical registration and held high-speed strain comparison."""
import argparse,hashlib,json,tempfile
from pathlib import Path
import numpy as np
from bridge_source import CASES,FILE_MD5,FILE_SIZE,project,sha_file
from clock_registration import infer_clock
from fit_course import ARMS,lock
from score_course import evaluate

HERE=Path(__file__).resolve().parent

def replay(source,workdir,publisher_digest=True):
    if source.stat().st_size!=FILE_SIZE:
        raise ValueError('Expected the published 9,732,963,908-byte version-2 HDF5')
    if publisher_digest:
        with source.open('rb') as stream:digest=hashlib.file_digest(stream,'md5').hexdigest()
        if digest!=FILE_MD5:raise ValueError('Whole HDF5 differs from the publisher checksum')
    register=json.loads((HERE/'clock-qualification.json').read_text())
    original=json.loads((HERE/'held-original.json').read_text())
    original_registry=json.loads((HERE/'frozen-prediction-registry.json').read_text())
    clock_x=workdir/'lasers.npz';project(source,clock_x,'lasers')
    source_clocks={}
    with np.load(clock_x,allow_pickle=False) as z:
        for weight,runs in CASES.items():
            for run in runs:
                key=weight+'/'+run
                c=infer_clock(z,key);expected=register['fits'][key]
                for k in ('speed','range_intercept','rms_fit_m','first_axle_east_s','last_axle_west_s'):
                    np.testing.assert_allclose(c[k],expected[k],rtol=3e-10,atol=1e-9)
                if c['utc_origin_ns']!=expected['utc_origin_ns']:raise ValueError('Laser timestamp changed')
                source_clocks[key]=c
    clocks=workdir/'clocks.json';clocks.write_text(json.dumps({'fits':source_clocks,'refusal':{}},sort_keys=True))
    # Finish all nine arms and ten held grids before projecting any held strain column.
    train=workdir/'development_strain.npz';project(source,train,'development_strain')
    forecasts=workdir/'predictions.npz';fit=lock(train,clocks,forecasts)
    fit_path=workdir/'predictions.json';fit_path.write_text(json.dumps(fit,sort_keys=True,allow_nan=False))
    exact_arrays=sum(digest==original_registry['members'].get(k) for k,digest in fit['members'].items())
    target=workdir/'held_strain.npz';project(source,target,'held_strain')
    scores=evaluate(target,clocks,forecasts,fit_path,fit['prediction_sha256'])
    if scores['gates']!=original['gates'] or scores['joint']!=original['joint']:raise ValueError('Registered gate changed')
    checked=0;delta=0.
    for a in ARMS:
        for case,channels in scores['raw'][a].items():
            for gauge,v in channels.items():
                ref=original['raw'][a][case][gauge]
                if (v['n'],v['baseline_observations'],v['worst']['utc_ns'])!=(ref['n'],ref['baseline_observations'],ref['worst']['utc_ns']):
                    raise ValueError(f'Observation support or worst row differs for {case} {gauge} {a}')
                pairs=[(v[k],ref[k]) for k in ('rmse_um_per_m','mae_um_per_m')]
                pairs.extend((v['worst'][k],ref['worst'][k]) for k in ('prediction_um_per_m','target_um_per_m','signed_error_um_per_m'))
                for got,want in pairs:
                    np.testing.assert_allclose(got,want,rtol=1e-6,atol=2e-7)
                    checked+=1;delta=max(delta,abs(got-want))
    print(json.dumps({'original_prediction_sha256':original['pred_sha256'],'replayed_prediction_sha256':fit['prediction_sha256'],
                      'identical_prediction_archive_bytes':fit['prediction_sha256']==original['pred_sha256'],'recomputed_scores':scores['mean_scores'],
                      'gates':scores['gates'],'joint':scores['joint'],'numeric_checks':checked,'max_absolute_numeric_difference':delta,
                      'byte_identical_numeric_members':exact_arrays,'locked_numeric_members':len(fit['members']),
                      'source_md5_checked':publisher_digest,'number_of_actual_passages':41},indent=2,sort_keys=True))


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('hdf5',type=Path,help='Official Zenodo 20522191 full experiment HDF5')
    p.add_argument('--work-parent',type=Path,help='Existing directory with space for temporary projected arrays')
    args=p.parse_args()
    with tempfile.TemporaryDirectory(dir=args.work_parent,prefix='bridge-replay-') as td:
        replay(args.hdf5,Path(td))
