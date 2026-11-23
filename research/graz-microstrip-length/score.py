"""Score both predeclared physical standards only after a hash-locked full forecast exists."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import zipfile
import numpy as np
from receiver import HELD_LENGTHS,line_name,read_standard
from forecast import ARCHIVE_SHA,ARM_NAMES


def pair(z):
    return [float(z.real),float(z.imag)]


def main():
    p=argparse.ArgumentParser()
    p.add_argument('archive',type=Path);p.add_argument('locked',type=Path)
    p.add_argument('digest');p.add_argument('output',type=Path)
    a=p.parse_args()
    if sha256(a.archive.read_bytes()).hexdigest()!=ARCHIVE_SHA:
        raise ValueError('official archive mismatch')
    if sha256(a.locked.read_bytes()).hexdigest()!=a.digest:
        raise ValueError('forecast lock mismatch before held access')
    with np.load(a.locked,allow_pickle=False) as f:
        if set(f.files)!=set(ARM_NAMES):
            raise ValueError('frozen model roster mismatch')
        predictions={n:f[n] for n in ARM_NAMES}
    if any(z.shape!=(2,299,2,2) or not np.all(np.isfinite(z)) for z in predictions.values()):
        raise ValueError('forecast dimensions or values differ')
    a.output.mkdir(exist_ok=False,parents=True)
    allowed={line_name(l) for l in HELD_LENGTHS}
    observed=[]
    condition={}
    frequency=None
    with zipfile.ZipFile(a.archive) as z:
        for target in HELD_LENGTHS:
            arr,condition[target],frequency=read_standard(z,line_name(target),allowed,frequency)
            observed.append(arr)
    sweeps=np.stack(observed)
    truth=sweeps.mean(axis=1)
    report={'target_length_half_mm':HELD_LENGTHS,'held_sweep_A_cond_max':condition,
            'frequency_hz':frequency.tolist(),'observations':{'physical_lines':2,'sweeps_per_line':25,
            'complex_components_per_frequency':4,'frequency_points':299},
            'scores':{},'frozen_forecasts':a.digest}
    for name,forecast in predictions.items():
        err=forecast-truth
        norm=np.abs(err)
        per_length=np.sqrt(np.mean(norm**2,axis=(1,2,3)))
        per_sweep=np.sqrt(np.mean(abs(forecast[:,None]-sweeps)**2,axis=(2,3,4)))
        worsts=[]
        for j in range(2):
            fi,o,i=np.unravel_index(np.argmax(norm[j]),norm[j].shape)
            worsts.append({'frequency_index':int(fi),'frequency_hz':float(frequency[fi]),
               'output_port':int(o+1),'input_port':int(i+1),
               'truth_mean':pair(truth[j,fi,o,i]),'forecast':pair(forecast[j,fi,o,i]),
               'complex_error_abs':float(norm[j,fi,o,i]),
               'four_truth':[[pair(v) for v in row] for row in truth[j,fi]],
               'all_models_at_witness':{k:pair(arr[j,fi,o,i]) for k,arr in predictions.items()},
               'all_25_observations':[pair(v) for v in sweeps[j,:,fi,o,i]]})
        report['scores'][name]={'per_length_rmse':per_length.tolist(),
            'equal_length_mean':float(np.mean(per_length)),'worst_length_rmse':float(np.max(per_length)),
            'per_port_length_rmse':np.sqrt(np.mean(norm**2,axis=1)).tolist(),
            'all_sweep_rmse':per_sweep.tolist(),'raw_worst':worsts}
    primary=report['scores']['covariance_weighted']
    gates={n:{k:primary[k]<vals[k] for k in ('equal_length_mean','worst_length_rmse')}
           for n,vals in report['scores'].items() if n!='covariance_weighted'}
    report['gates']=gates
    report['joint']=all(val for g in gates.values() for val in g.values())
    report['within_connection_repeatability_rms']=np.sqrt(np.mean(abs(sweeps-truth[:,None])**2,
                                                                  axis=(1,2,3,4))).tolist()
    (a.output/'scores.json').write_text(json.dumps(report,sort_keys=True,allow_nan=False)+'\n')
    np.savez_compressed(a.output/'held-mean-and-sweeps.npz',sweeps=sweeps,frequency_hz=frequency)
    print(json.dumps({'joint':report['joint'],'metrics':{n:v['per_length_rmse'] for n,v in report['scores'].items()},
          'candidate_worsts':[(w['frequency_hz'],w['output_port'],w['input_port'],w['complex_error_abs'])
                              for w in primary['raw_worst']]}))


if __name__=='__main__':
    main()
