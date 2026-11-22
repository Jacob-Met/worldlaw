"""Score each complete locked surface using one equal vote per physical bearing."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile
import numpy as np
from collect_surfaces import ALL_CONDITIONS, digest
from forecast import load_stage
from surface import COMMON,FREQ,ORDER,per_bearing_loss

def main(root,expected):
    proto=json.loads((Path(__file__).resolve().parent/'protocol.json').read_text())
    zip_path=root/'forecasts.zip';assert digest(zip_path)==expected
    per={};worsts={};rows={}
    with zipfile.ZipFile(zip_path) as z:
        head=json.loads(z.read('lock.json'));assert head['protocol_sha256']==digest(Path(__file__).resolve().parent/'protocol.json')
        assert not head['held_low_files_read'] and sorted(head['held'])==sorted(proto['held'])
        for i in proto['held']:
            low,ls=load_stage(root,'held_low',i);hi,hs=load_stage(root,'high_only',i)
            assert hs==head['source_hashes'][i]
            Y=low[ALL_CONDITIONS[1]][0];X=hi[ALL_CONDITIONS[0]][0]
            roles={};metrics={};worst=None
            for n in proto['roles']:
                b=z.read(i+'/'+n+'.npy');assert hashlib.sha256(b).hexdigest()==head['held'][i][n]
                p=np.load(io.BytesIO(b),allow_pickle=False)
                roles[n]=p
                metrics[n]=per_bearing_loss(p,Y,X)
            err=roles['sideband_gain']-Y
            loc=np.unravel_index(np.argmax(np.where(COMMON,abs(err),-np.inf)),err.shape)
            normalized=float(abs(err[loc])/np.sqrt(np.mean(X[COMMON]**2)))
            worst={'carrier_Hz':float(FREQ[loc[0]]),'order':float(ORDER[loc[1]]),'cell':list(map(int,loc)),
              'target':float(Y[loc]),'source':float(X[loc]),'all_predictions':{k:float(v[loc]) for k,v in roles.items()},
              'normalized_absolute_error':normalized,'low_sha':ls,'high_sha':hs}
            per[i]=metrics;worsts[i]=worst
            rows[i]={'rpm_hi':hi[ALL_CONDITIONS[0]][2]*60.,'rpm_low':low[ALL_CONDITIONS[1]][2]*60.,
                     'source_mean_squared_amplitude':float(np.mean(X[COMMON]**2)),
                     'target_mean':float(Y[COMMON].mean()),
                     'raw_surface_rmse':{k:float(np.sqrt(np.mean((v[COMMON]-Y[COMMON])**2))) for k,v in roles.items()}}
    means={k:float(np.mean([v[k] for v in per.values()])) for k in proto['roles']}
    others=[k for k in proto['roles'] if k!='sideband_gain']
    wins={k:sum(v['sideband_gain']<v[k] for v in per.values()) for k in others}
    gate=all(means['sideband_gain']<means[k] and wins[k]>=8 for k in others)
    result={'forecast_sha':expected,'cells_per_bearing':int(COMMON.sum()),'means':means,'wins':wins,'gate':gate,
            'per_bearing':per,'metadata':rows,'worsts':worsts,'worst_id':max(worsts,key=lambda i:worsts[i]['normalized_absolute_error'])}
    out=root/'scores.json'
    with out.open('x') as f:json.dump(result,f,indent=2,sort_keys=True,allow_nan=False);f.write('\n')
    print('SCORED',digest(out),json.dumps({'gate':gate,'means':means,'wins':wins,'worst':worsts[result['worst_id']]},sort_keys=True))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('root',type=Path);p.add_argument('forecast_sha');a=p.parse_args();main(a.root,a.forecast_sha)
