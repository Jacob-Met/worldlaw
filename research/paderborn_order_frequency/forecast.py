"""Fit only artificial-damage pairs and issue predictions for all natural-damage units."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile
import numpy as np
from collect_surfaces import ALL_CONDITIONS, digest
from surface import baseline_roles, COMMON
from supervised import fit, fit_cell_gains, trained_roles

def sha(x):
    return hashlib.sha256(x).hexdigest()

def load_stage(root,stage,ident):
    path=root/stage/(ident+'.npz')
    with np.load(path,allow_pickle=False) as z:
        meta=json.loads(z['receipt'].item())
        assert meta['id']==ident and meta['stage']==stage
        answer={}
        for c,records in meta['conditions'].items():
            answer[c]=(z[c+'_surface'],z[c+'_psd'],float(np.mean([r['rpm_hz'] for r in records])))
    return answer,digest(path)

def main(root):
    home=Path(__file__).resolve().parent
    proto=json.loads((home/'protocol.json').read_text())
    hi,lo=ALL_CONDITIONS;provenance={}
    hh=[];hl=[];ph=[];pl=[]
    for i in proto['healthy']:
        d,pin=load_stage(root,'development',i);assert set(d)=={hi,lo};provenance[i]=pin
        hh.append(d[hi][0]);hl.append(d[lo][0]);ph.append(d[hi][1]);pl.append(d[lo][1])
    Hh,Hl,Ph,Pl=[np.stack(z).mean(axis=0) for z in (hh,hl,ph,pl)]
    def controls(data):
        return baseline_roles(data[0],Hh,Hl,Ph,Pl,data[2])
    training={}
    for i in proto['development']:
        d,pin=load_stage(root,'development',i);assert set(d)=={hi,lo};provenance[i]=pin
        training[i]=(controls(d[hi]),d[lo][0])
    beta,target,delta,penalty,cv=fit(training)
    gains=fit_cell_gains(training)
    lock={'training_arrays':provenance,'protocol_sha256':digest(home/'protocol.json'),
          'held_low_files_read':0,'ridge':penalty,'cell_gains':{b:{'penalty':v[1],'source_losses':v[2]} for b,v in gains.items()},'training_ridge_losses':cv,'held':{},'source_hashes':{}}
    with zipfile.ZipFile(root/'forecasts.zip','x',compression=zipfile.ZIP_STORED) as out:
        for i in proto['held']:
            d,pin=load_stage(root,'high_only',i);assert set(d)=={hi}
            roles=controls(d[hi]);roles.update(trained_roles(roles,beta,target,delta))
            for base,(factor,_,_) in gains.items():
                roles['trained_cell_'+base]=roles[base]*factor
            assert sorted(roles)==sorted(proto['roles'])
            digests={}
            for n,p in roles.items():
                ar=np.asarray(p,dtype='<f8',order='C')
                assert ar.shape==COMMON.shape and np.all(np.isfinite(ar))
                b=io.BytesIO();np.save(b,ar,allow_pickle=False);raw=b.getvalue()
                out.writestr(i+'/'+n+'.npy',raw);digests[n]=sha(raw)
            lock['held'][i]=digests;lock['source_hashes'][i]=pin
        head=(json.dumps(lock,indent=2,sort_keys=True,allow_nan=False)+'\n').encode()
        out.writestr('lock.json',head)
    print('FORECAST',json.dumps({'sha256':digest(root/'forecasts.zip'),'lock_sha256':sha(head),
          'bytes':(root/'forecasts.zip').stat().st_size,'held':len(lock['held']),
          'arrays':sum(map(len,lock['held'].values())),'ridge':penalty},sort_keys=True),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);main(parser.parse_args().root)
