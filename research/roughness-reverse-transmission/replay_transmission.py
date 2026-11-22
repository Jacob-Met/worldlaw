"""Rebuild and recount the 24 pre-registered reverse-transmission forecasts."""
import argparse
import io
import json
import urllib.request
import zipfile
from pathlib import Path
import numpy as np
from heo_course import (ARMS, CALIBRATED, CANDIDATE, DEV, HELD, FILES, GRID, ARCHIVE_SHA, read, sha)
from spectra import predict, rms
from port_network import checks

ROOT=Path(__file__).resolve().parent
VERSION='https://datadryad.org/api/v2/versions/89473/download'
RESULT_SHA='fe90a6b23d50c903ceef08b082edd5d6e65ab620dbe2d67199ef3905dcc19631'


def run(raw):
    original=(ROOT/'original-result.json').read_bytes()
    if sha(original)!=RESULT_SHA:raise ValueError('Original comparison report changed')
    result=json.loads(original)
    reference=json.loads((ROOT/'locked-vector-registry.json').read_text())
    predictions={}
    scores={}
    distinct_targets=[]
    max_delta=0.;max_metric_delta=0.;bins=0
    with zipfile.ZipFile(io.BytesIO(raw)) as z,np.load(ROOT/'locked-predictions.npz',allow_pickle=False) as archive:
        if len(set(z.namelist()))!=len(z.namelist()):raise ValueError('Duplicate source member')
        expected={f'{level}/{arm}' for level in HELD for arm in ARMS}
        if set(archive.files)!=expected:raise ValueError('Frozen prediction roster differs')
        train={}
        for level in DEV:
            a=read(z,level,(0,1,2,3,4))
            train[level]=(a[:,[1,3,4]],a[:,2])
        for level in HELD:
            a=read(z,level,(0,1,3,4))
            forecasts,_=predict(train,level,a[:,0],a[:,1:])
            for arm in ARMS:
                key=f'{level}/{arm}'
                frozen=archive[key]
                if frozen.shape!=(751,) or sha(frozen.astype('<f8').tobytes())!=reference['members'][key+'.f64']:
                    raise ValueError('Original forecast vector differs')
                np.testing.assert_allclose(forecasts[arm],frozen,rtol=1e-9,atol=1e-11)
                max_delta=max(max_delta,float(np.max(np.abs(forecasts[arm]-frozen))))
                predictions[level,arm]=forecasts[arm]
        # Every forecast is complete before decoding either held 180-degree column.
        for level in HELD:
            a=read(z,level,(0,1,2,3,4))
            y=a[:,2]
            distinct_targets.append(all(not np.array_equal(y,a[:,i]) for i in (1,3,4)))
            band=(a[:,0]>=400)&(a[:,0]<=600)
            for arm in ARMS:
                e=predictions[level,arm]-y;ref=result['scores'][str(level)][arm]
                current=[rms(e)/rms(y),rms(e[band])/rms(y[band]),float(np.mean(np.abs(e))),float(np.quantile(np.abs(e),.95))]
                scores[level,arm]=current[:2]
                expected=[ref[k] for k in ['whole_nrmse','band_nrmse','mae','p95_abs']]
                np.testing.assert_allclose(current,expected,rtol=1e-9,atol=1e-11)
                max_metric_delta=max(max_metric_delta,max(abs(x-y) for x,y in zip(current,expected)))
                worst=int(np.argmax(abs(e)))
                if worst!=ref['worst']['row']:raise ValueError('Worst-bin index changed')
                bins+=len(e)
    def mean_score(arm,index):
        return np.mean([scores[level,arm][index] for level in HELD])

    gates={
        'mean_full_better_than_all_comparators':all(mean_score(CANDIDATE,0)<mean_score(arm,0)
                                                    for arm in ARMS if arm!=CANDIDATE),
        'each_full_better_than_all_calibrated':all(scores[level,CANDIDATE][0]<scores[level,arm][0]
                                                  for level in HELD for arm in CALIBRATED),
        'mean_methods_band_no_worse_than_all_calibrated':all(mean_score(CANDIDATE,1)<=mean_score(arm,1)
                                                            for arm in CALIBRATED),
        'no_held_target_exact_duplicate':all(distinct_targets)}
    joint=all(gates.values())
    if gates!=result['gates'] or joint!=result['joint']:
        raise ValueError('Frozen gate verdict differs')
    return {'dryad_version':89473,'exact_native_archive_container':sha(raw)==ARCHIVE_SHA,
            'verified_figure4_member_digests':len(FILES),'scored_values':bins,'frequency_grid_sha256':GRID,
            'max_abs_forecast_difference':max_delta,'max_abs_score_difference':max_metric_delta,
            'recomputed_gates':gates,'recomputed_joint':joint,'reciprocal_control':checks()}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--archive',type=Path,help='Existing author version-89473 ZIP')
    args=parser.parse_args()
    if args.archive:
        data=args.archive.read_bytes()
    else:
        request=urllib.request.Request(VERSION,headers={'User-Agent':'WORLDLAW-acoustics-replay'})
        with urllib.request.urlopen(request,timeout=90) as r:data=r.read(2*1024**2+1)
        if len(data)>2*1024**2:raise ValueError('Version archive exceeds the expected size budget')
    print(json.dumps(run(data),sort_keys=True,indent=2))
