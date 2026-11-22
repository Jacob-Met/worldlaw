"""Score a published forecast digest in a fresh process; decode the held angles here."""
import hashlib,io,json,sys,zipfile
from pathlib import Path
import numpy as np
from trial_io import original_measurements,named_members,read_inputs,read_angles,crop_from_force,input_detrend

def sha(b):return hashlib.sha256(b).hexdigest()
def score(path, expected_archive,expected_lock):
    contents=path.read_bytes()
    assert sha(contents)==expected_archive
    rows={q['RunID']:q for q in json.loads(Path('design.json').read_text())}
    split=json.loads(Path('split.json').read_text())
    population=set(split['held_ids']);assert population=={186,192,250,253,257}
    metrics={};episodes={};records={}
    with zipfile.ZipFile(io.BytesIO(contents)) as z:
        head=z.read('lock.json');assert sha(head)==expected_lock
        lock=json.loads(head)
        assert lock['held_angle_variables_read']==0
        assert lock['protocol_sha256']==sha(Path('frozen-protocol.json').read_bytes())
        assert lock['development_sha256']==sha(Path('development.json').read_bytes())
        assert set(map(int,lock['runs']))==population
        for i,b in named_members(original_measurements()):
            if i not in population:continue
            digest=rows[i]['sha256'];h=lock['runs'][str(i)]
            j,pull,fs,v=read_inputs(b,digest)
            sl=crop_from_force(pull)
            assert i==j and [sl.start,sl.stop]==h['crop'] and fs==h['fs'] and v==h['nominal_speed']
            yraw=read_angles(b,digest);yr=yraw[sl];mean=yr.mean(axis=0);y=yr-mean
            u=input_detrend(pull[sl]);s2=np.array(h['source_mean_square']);assert np.all(s2>0)
            raw=z.read(f'run{i:05d}.npz');assert sha(raw)==h['run_archive_sha256']
            with np.load(io.BytesIO(raw),allow_pickle=False) as npz:
                assert set(npz.files)==set(lock['roles'])==set(h['prediction_sha256'])
                preds={name:npz[name] for name in npz.files}
            run={}
            for name,p in preds.items():
                assert p.dtype.str=='<f8' and [*p.shape]==h['shape'] and p.shape==y.shape
                assert sha(np.ascontiguousarray(p).tobytes())==h['prediction_sha256'][name]
                e=p-y;me=np.mean(e*e,axis=0)
                loc=tuple(map(int,np.unravel_index(np.argmax(abs(e)/np.sqrt(s2)),e.shape)))
                t,m=loc
                run[name]={'source_normalized_mse':(me/s2).tolist(),'rmse_rad':np.sqrt(me).tolist(),
                  'rmse_rad_uncentered_measured_angle':np.sqrt(np.mean((p-yr)**2,axis=0)).tolist(),
                  'max_sample':t+sl.start,'max_coordinate':m,'max_normalized_abs':float(abs(e[t,m])/np.sqrt(s2[m]))}
            t=run['balance']['max_sample']-sl.start;m=run['balance']['max_coordinate']
            w=u[max(0,t-768):t+1]
            record={'sample':t+sl.start,'coordinate':['roll','steer'][m],'raw_force_N':float(pull[t+sl.start]),
             'detrended_force_N':float(u[t]),'raw_angles_rad':yr[t].tolist(),'centered_angles_rad':y[t].tolist(),
             'source_scale_rad':np.sqrt(s2).tolist(),'held_measured_mean_rad':mean.tolist(),
             'preceding_769_force_range_N':[float(w.min()),float(w.max())],
             'estimates_rad':{n:p[t].tolist() for n,p in preds.items()},'max_normalized_abs':run['balance']['max_normalized_abs']}
            metrics[i]=run;records[i]=record
            episodes[i]={'full_measured_angles_rad':yraw,'full_signed_pull_N':pull,'scored_pull_N':u,
                         'scored_angles_centered_rad':y,'crop':np.asarray([sl.start,sl.stop]),**preds}
    assert set(metrics)==population
    worst=max(records,key=lambda x:records[x]['max_normalized_abs'])
    with Path('worst-held-complete-run.npz').open('xb') as f:
        np.savez_compressed(f,run_id=worst,**episodes[worst])
    def means(ids):
        return {r:np.mean([metrics[i][r]['source_normalized_mse'] for i in ids],axis=0).tolist() for r in lock['roles']}
    result=means(sorted(population))
    primary=[n for n in lock['roles'] if n not in ('author_refit_actual_speed','balance')]
    joint=all(np.mean(result['balance'])<np.mean(result[n]) for n in primary)
    wins={n:sum(np.mean(metrics[i]['balance']['source_normalized_mse'])<np.mean(metrics[i][n]['source_normalized_mse']) for i in population) for n in primary}
    return {'archive_sha256':expected_archive,'lock_sha256':expected_lock,'per_run':metrics,'primary_means':result,
            'unseen_initializer_supplemental_means':means([192,250,253]),'wins_vs_each':{k:int(v) for k,v in wins.items()},
            'gate':bool(joint),'roles':lock['roles'],'scored_rows':sum(x['shape'][0] for x in lock['runs'].values()),
            'worst_by_held_run':records,'worst_held_run':worst,'complete_worst_run_sha256':sha(Path('worst-held-complete-run.npz').read_bytes())}
if __name__=='__main__':
    out=score(Path('predictions.zip'),sys.argv[1],sys.argv[2])
    b=(json.dumps(out,indent=2,sort_keys=True,allow_nan=False)+'\n').encode()
    with Path('score.json').open('xb') as f:f.write(b)
    print('SCORED '+json.dumps({'score_sha256':sha(b),'result':out},sort_keys=True,allow_nan=False),flush=True)
