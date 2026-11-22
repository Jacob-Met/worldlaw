"""Recount the preidentified source failure without reading any held response."""
import hashlib,io,json
from pathlib import Path
import numpy as np
from author_fir import author_kernel,replay_kernel
from author_controller import forecast as feedback
from joint_fir import fit,training_stats
from trial_io import original_measurements,named_members,read_inputs,read_angles,crop_from_force,input_detrend

def main():
    dev=json.loads(Path('development.json').read_text())
    rows={x['RunID']:x for x in json.loads(Path('design.json').read_text())}
    worst=dev['worst_source_rows']['balance'];assert worst['donor']==191 and worst['receiver']==190
    d={}
    for i,b in named_members(original_measurements()):
        if i not in (190,191):continue
        h=rows[i]['sha256']
        j,raw,fs,v=read_inputs(b,h)
        sl=crop_from_force(raw);u=input_detrend(raw[sl]);yr=read_angles(b,h)
        y=yr[sl]-np.mean(yr[sl],axis=0)
        d[i]=(raw,fs,v,sl,u,yr,y)
    _,fs,v,_,us,_,ys=d[191];force_raw,_,_,sl,u,y_raw,y=d[190]
    st=training_stats(us,ys,fs);c=dev['source_controller']['191']
    roles={'zero':np.zeros_like(y),'author_fir':replay_kernel(u,author_kernel(us,ys,fs)),
           'author_start':feedback(u,v,c['start'],fs),'author_refit':feedback(u,v,c['refitted'],fs)}
    for role,l in [('smooth',0.),('balance',10.),('sham',1.)]:
        assert dev['chosen'][role]==f'{role}.0.001.{l:.4g}'
        roles[role]=replay_kernel(u,fit([st],v,.001,l,variant=role))
    expected=worst['worst'];t=expected['index_in_published_trial']-sl.start
    assert np.isclose(roles['balance'][t,1],expected['prediction_rad'],atol=2e-12,rtol=1e-9)
    artifact=Path('source-run190-full-episode.npz')
    with artifact.open('xb') as f:
        np.savez_compressed(f,run_id=190,donor_run=191,fs=fs,crop=[sl.start,sl.stop],pull_force_raw_N=force_raw,
                            raw_roll_steer_rad=y_raw,scored_pull_N=u,scored_roll_steer_rad=y,**roles)
    history=u[max(t-768,0):t+1];near=u[max(t-50,0):t+1]
    receipt={'file':str(artifact.resolve()),'sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),
             'raw_rows':len(force_raw),'scored_rows':len(u),'sample':expected['index_in_published_trial'],'dt_s':1/fs,
             'raw_force_at_sample':float(force_raw[sl.start+t]),'detrended_force_at_sample':float(u[t]),
             'raw_roll_steer_rad':y_raw[sl.start+t].tolist(),'centered_roll_steer_rad':y[t].tolist(),
             'prediction_at_sample':{k:v[t].tolist() for k,v in roles.items()},
             'preceding_769_force_range_N':[float(np.min(history)),float(np.max(history))],
             'preceding_51_force_range_N':[float(np.min(near)),float(np.max(near))],
             'peak_abs_769_seconds_before':float((len(history)-1-np.argmax(abs(history)))/fs),
             'whole_source_arrays_retained':True,'held_angles_read':0}
    print('SOURCE_EPISODE '+json.dumps(receipt,sort_keys=True),flush=True)
if __name__=='__main__':main()
