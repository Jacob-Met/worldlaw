"""Issue force-only predictions for the five preassigned held runs."""
import hashlib,io,json,zipfile
from pathlib import Path
import numpy as np
from scipy.io import loadmat
from author_fir import author_kernel,replay_kernel
from author_controller import forecast as feedback
from joint_fir import fit,training_stats
from trial_io import original_measurements,named_members,read_inputs,read_angles,crop_from_force,input_detrend

ROLES=['zero','author_fir','author_start','author_refit','smooth','balance','sham','author_refit_actual_speed']
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    rows={v['RunID']:v for v in json.loads(Path('design.json').read_text())}
    split=json.loads(Path('split.json').read_text())
    dev=json.loads(Path('development.json').read_text())
    sources=set(split['source_ids']);held=set(split['held_ids'])
    assert held=={186,192,250,253,257} and sources.isdisjoint(held)
    train={};test={};frozen=dev['chosen']
    for i,blob in named_members(original_measurements()):
        digest=rows[i]['sha256'];j,u,fs,v=read_inputs(blob,digest);assert j==i and fs==200
        sl=crop_from_force(u);u=input_detrend(u[sl])
        metadata={'u':u,'fs':fs,'v':v,'sl':sl}
        if i in sources:
            y=read_angles(blob,digest)[sl]
            y-=np.mean(y,axis=0)
            record=dev['source_controller'][str(i)]
            train[i]={**metadata,'stats':training_stats(u,y,fs),'kernel':author_kernel(u,y,fs),'initial':record['start'],'refit':record['refitted']}
        elif i in held:
            # Only an independent wheel-speed trace enters the supplemental role.
            # No roll or steer variable is requested for any held run.
            wheel=loadmat(io.BytesIO(blob),variable_names=['ForwardSpeed'],squeeze_me=True)
            assert set(wheel)-{'__header__','__version__','__globals__'}=={'ForwardSpeed'}
            test[i]={**metadata,'v_actual':float(np.mean(wheel['ForwardSpeed']))}
    files={};lock={'roles':ROLES,'runs':{},'protocol_sha256':sha(Path('frozen-protocol.json').read_bytes()),
                   'development_sha256':sha(Path('development.json').read_bytes()),'held_angle_variables_read':0}
    assert set(train)==sources and set(test)==held
    for cell in split['matched_cells'].values():
        si=cell['source'];hi=cell['held'];assert len(si)==2 and len(hi)==1
        target=hi[0];d=test[target];u,fs,v,sl=d['u'],d['fs'],d['v'],d['sl']
        ds=[train[j] for j in si];stats=[x['stats'] for x in ds]
        assert all(k['v']==v for k in ds)
        out={'zero':np.zeros((len(u),2)),
             'author_fir':replay_kernel(u,np.mean([k['kernel'] for k in ds],axis=0))}
        for name,param,speed in [('author_start','initial',v),('author_refit','refit',v),('author_refit_actual_speed','refit',d['v_actual'])]:
            out[name]=np.mean([feedback(u,speed,k[param],fs) for k in ds],axis=0)
        for role in ('smooth','balance','sham'):
            # The registered text labels include decimal hyperparameters.
            choices={'smooth':(0.001,0.),'balance':(0.001,10.),'sham':(0.001,1.)}
            alpha,weight=choices[role]
            assert frozen[role]==f'{role}.{alpha:.4g}.{weight:.4g}'
            out[role]=replay_kernel(u,fit(stats,v,alpha,weight,variant=role))
        name=f'run{target:05d}'
        arrays={role:np.asarray(out[role],dtype='<f8',order='C') for role in ROLES}
        assert all(a.shape==(len(u),2) and np.all(np.isfinite(a)) for a in arrays.values())
        blob=io.BytesIO();np.savez_compressed(blob,**arrays)
        files[name+'.npz']=blob.getvalue()
        lock['runs'][str(target)]={'source':si,'nominal_speed':v,'supplemental_measured_speed':d['v_actual'],
          'fs':fs,'crop':[sl.start,sl.stop],'source_mean_square':np.mean([s['yy'] for s in stats],axis=0).tolist(),
          'shape':[len(u),2],'run_archive_sha256':sha(files[name+'.npz']),
          'prediction_sha256':{a:sha(b.tobytes(order='C')) for a,b in arrays.items()}}
    files['lock.json']=(json.dumps(lock,sort_keys=True,indent=2)+'\n').encode()
    with zipfile.ZipFile('predictions.zip','x') as z:
        for name,data in sorted(files.items()):
            info=zipfile.ZipInfo(name,(2026,11,22,0,0,0));info.compress_type=zipfile.ZIP_STORED
            z.writestr(info,data)
    print('FORECAST '+json.dumps({'archive_bytes':Path('predictions.zip').stat().st_size,
          'archive_sha256':sha(Path('predictions.zip').read_bytes()),'lock_sha256':sha(files['lock.json']),
          'lock':lock},sort_keys=True,allow_nan=False),flush=True)
if __name__=='__main__':main()
