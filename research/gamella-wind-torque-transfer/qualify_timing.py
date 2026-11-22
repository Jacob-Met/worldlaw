"""Inspect only timestamps and command/recorder metadata on the five impulse acquisitions."""
import json
import zipfile
import numpy as np
import pandas as pd

def inspect():
    result={}
    with zipfile.ZipFile('impulse.zip') as source:
        for name in source.namelist():
            if not name.startswith('wt_intake_impulse_v1/load_out_') or not name.endswith('.csv'):continue
            with source.open(name) as f:
                a=pd.read_csv(f,usecols=['timestamp','counter','intervention','hatch','flag'])
            values=a.timestamp.to_numpy().reshape(-1,50)
            dt=np.diff(values,axis=1)
            def summary(v):
                return dict(zip(('min','median','max'),np.quantile(v,[0,.5,1]).tolist()))
            changes=np.diff(a.counter.to_numpy());b=a.intervention.to_numpy().reshape(-1,50)
            result[name]={'n':len(values),'within_flag_seconds':summary(dt),'baseline_to_onset_rows_seconds':summary(dt[:,4]),
                          'high_to_recovery_rows_seconds':summary(dt[:,24]),
                          'between_events_seconds':summary(values[1:,0]-values[:-1,-1]),
                          'flags_with_constant_hatch':int(np.sum(np.ptp(a.hatch.to_numpy().reshape(-1,50),axis=1)==0)),
                          'first_after_SET_count_by_row':b.sum(0).astype(int).tolist(),
                          'counter_differences':{str(int(k)):int(n) for k,n in zip(*np.unique(changes,return_counts=True))}}
    return result
if __name__=='__main__':print(json.dumps(inspect(),indent=2,sort_keys=True))
