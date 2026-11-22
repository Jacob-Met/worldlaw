"""Read the two held suffixes only after authenticating the supplied registry and every forecast."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import wind_transfer as w

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main(out,sha):
    path=out/'prediction-lock.json'
    if digest(path)!=sha:raise ValueError('registry digest')
    lock=json.loads(path.read_text());policy=json.loads(Path('protocol.json').read_text())
    if list(sorted(lock['predictions']))!=sorted(policy['holdouts']):raise ValueError('membership')
    for name,h in lock['source_sha256'].items():
        if digest(Path(name))!=h:raise ValueError('source '+name)
    loaded={}
    for m in policy['holdouts']:
        archive=out/f'forecasts-{m}.npz';ref=lock['predictions'][m]
        if digest(archive)!=ref['archive_sha256']:raise ValueError('archive '+m)
        with np.load(archive,allow_pickle=False) as z:
            if list(z.files)!=list(w.ROLES) or set(ref['array_sha256'])!=set(w.ROLES):raise ValueError('roles')
            for k in w.ROLES:
                a=z[k]
                if a.dtype.str!='<f4' or a.shape!=(5000,45,2) or not np.isfinite(a).all():raise ValueError('schema')
                if hashlib.sha256(a.tobytes(order='C')).hexdigest()!=ref['array_sha256'][k]:raise ValueError(k)
                loaded[m,k]=a
    result={'lock_sha256':sha,'duty':{},'strict_gate':True}
    for m in policy['holdouts']:
        u,y=w.panel(m);truth=y[:,5:]
        if truth.shape!=(5000,45,2) or not np.isfinite(truth).all():raise ValueError('truth')
        scores={};event={};worst=[]
        for k in w.ROLES:
            e=loaded[m,k]-truth
            event[k]=(e*e).mean(axis=1)
            scores[k]={'rmse':np.sqrt(event[k].mean(0)).tolist(),'mae':np.abs(e).mean((0,1)).tolist(),
                       'high_rmse':np.sqrt(np.mean(e[:,:20]**2,axis=(0,1))).tolist(),
                       'recovery_rmse':np.sqrt(np.mean(e[:,20:]**2,axis=(0,1))).tolist(),
                       'max_abs':[]}
            for c in [0,1]:
                f,j=np.unravel_index(np.abs(e[:,:,c]).argmax(),(5000,45))
                scores[k]['max_abs'].append({'flag':int(f),'row':int(j+5),'truth':float(truth[f,j,c]),
                    'pred':float(loaded[m,k][f,j,c]),'abs_error':abs(float(e[f,j,c]))})
                if k==policy['candidate']:
                    worst.append({'channel':w.OUTPUT[c],'flag':int(f),'row':int(j+5),
                        'actuators_and_time':u[f].tolist(),'observed_rpm_pa':y[f].tolist(),
                        'locked_predictions_at_row':{r:loaded[m,r][f,j].tolist() for r in w.ROLES}})
        candidate=policy['candidate']
        wins={k:(event[candidate]<event[k]).sum(0).tolist() for k in policy['controls']}
        gate=all(all(a<b for a,b in zip(scores[candidate]['rmse'],scores[k]['rmse'])) for k in policy['controls'])
        result['duty'][m]={'flags':len(y),'scores':scores,'candidate_event_wins':wins,'worst':worst,'gate':gate}
        result['strict_gate'] &= gate
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('out',type=Path);p.add_argument('sha')
    a=p.parse_args();print(json.dumps(main(a.out,a.sha),separators=(',',':')))
