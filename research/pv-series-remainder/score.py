"""Score every registered receiver row against simultaneous raw measured voltages."""
import hashlib
import io
import json
import zipfile
from pathlib import Path

import numpy as np
from scipy.io import loadmat


def score(blob, predictions, manifest):
    with zipfile.ZipFile(io.BytesIO(blob)) as z, np.load(predictions, allow_pickle=False) as f:
        arms = manifest['arms']
        if set(f.files) != set(manifest['prediction_hashes']):
            raise ValueError('prediction set mismatch')
        results = {}
        witnesses = {}
        unavailable = {}
        for key in sorted(f.files):
            paths = [n for n in z.namelist() if n.endswith('/Raw Data/Test 3/' + key + '.mat')]
            if len(paths) != 1:
                raise ValueError('target member mismatch')
            d = loadmat(io.BytesIO(z.read(paths[0])), variable_names=['V','Va','I','Irr','T'])
            va, v, current = [d[k].ravel() for k in ('Va','V','I')]
            true = va - v
            pred = f[key]
            if pred.shape != (len(arms),len(true)):
                raise ValueError('target dimensions mismatch')
            if not np.isfinite(true).all():
                unavailable[key] = np.flatnonzero(~np.isfinite(true)).tolist()
                continue
            results[key] = {}
            witnesses[key] = {}
            for ai, arm in enumerate(arms):
                hat = pred[ai]
                if hashlib.sha256(hat.astype('<f8').tobytes()).hexdigest() != manifest['prediction_hashes'][key][arm]:
                    raise ValueError('prediction bytes mismatch')
                err = hat - true
                j = int(np.argmax(np.abs(err)))
                results[key][arm] = {'n':len(hat),'rmse_V':float(np.sqrt(np.mean(err**2))),
                                     'mae_V':float(np.mean(abs(err))),'max_abs_V':float(abs(err[j]))}
                witnesses[key][arm] = {'index':j,'I_A':float(current[j]),'Va_V':float(va[j]),
                                       'selected_V':float(v[j]),'remainder_V':float(true[j]),
                                       'forecast_V':float(hat[j]),'signed_error_V':float(err[j]),
                                       'irr_W_m2':d['Irr'].item(),'T_degC':d['T'].item()}
        if unavailable:
            return {'stage':manifest['stage'],'joint':False,'unavailable_target_rows':unavailable,
                    'observed_results':results,'raw_worst':witnesses}
        summary = {}
        for arm in arms:
            rmse = np.array([values[arm]['rmse_V'] for values in results.values()])
            summary[arm] = {'mean_run_RMSE_V':float(rmse.mean()),'worst_run_RMSE_V':float(rmse.max())}
        primary = 'component_residual_tree'
        gates = {field:all(summary[primary][field] < summary[arm][field] for arm in arms if arm != primary)
                 for field in ('mean_run_RMSE_V','worst_run_RMSE_V')}
        return {'stage':manifest['stage'],'gates':gates,'joint':all(gates.values()),
                'summary':summary,'per_run':results,'raw_worst':witnesses}
