"""Materialize actual float32 forecasts from development pixels, without any downloader."""
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

from forecast_weights import (normalize, odd_fits, odd_prediction, ordinary_weights, kriging_inverse, select_direct, simple)
from optical_control import forward_controls

SPLIT_SHA = 'f1234fc1d4720d73a6699d1c70f97c55da34d95c97452709e77b9c33ce861587'
SOURCE_RECORD_SHA = 'f873b76417be345c8730d42bf8a1ad4df4f028504075c12967a2066c084bc509'

def digest(b):
    return hashlib.sha256(b).hexdigest()

def main():
    source_dir, split_path, out = map(Path,sys.argv[1:4])
    split_bytes=split_path.read_bytes()
    assert digest(split_bytes)==SPLIT_SHA
    s=json.loads(split_bytes)
    rec_bytes=(source_dir/'receipts.json').read_bytes()
    assert digest(rec_bytes)==SOURCE_RECORD_SHA
    rec=json.loads(rec_bytes)
    ids=sorted(int(i) for i,r in s['frames'].items() if r['access']=='development')
    held=[p for p in s['pairs'] if p['group']=='held']
    held_ids=[p['target'] for p in held]
    cal=[p for p in s['pairs'] if p['group']=='development']
    assert set(map(int,rec))==set(ids) and len(held)==98 and len(cal)==48
    assert not set(ids).intersection(held_ids)
    pidx={i:k for k,i in enumerate(ids)}
    xy={int(i):tuple(r['led_xy']) for i,r in s['frames'].items()}
    pos=np.asarray([xy[i] for i in ids],dtype=float)
    raw=np.empty((len(ids),65536),dtype='<u2')
    for j,i in enumerate(ids):
        b=(source_dir/f'{i:03}.u16le').read_bytes()
        assert len(b)==131072 and digest(b)==rec[str(i)]['raw_roi_sha256']
        raw[j]=np.frombuffer(b,'<u2')
    x=raw.astype(np.float64)
    x-=x.mean(axis=1,keepdims=True)
    norms=np.linalg.norm(x,axis=1)
    np.divide(x,norms[:,None],out=x,where=norms[:,None]!=0)
    gram=x@x.T
    direct, grid_direct=select_direct(pidx,cal,pos,gram)
    odd,grid_odd=odd_fits(cal,pidx,pos,gram,False)
    sham,grid_sham=odd_fits(cal,pidx,pos,gram,True)
    selected={'angular-kriging':direct,'odd-pair-correction':odd,'quarter-turn-sham':sham}
    grid={'angular-kriging':grid_direct,'odd-pair-correction':grid_odd,'quarter-turn-sham':grid_sham}
    _,sigma,ridge=direct
    directw=ordinary_weights(pos,np.array([xy[i] for i in held_ids]),sigma,kriging_inverse(pos,sigma,ridge))
    W={}
    for j,p in enumerate(held):
        t,d=p['target'],p['donor']
        w=simple(ids,pos,xy[t],pidx[d])
        w['angular-kriging']=directw[j]
        for role,choice,turn in [('odd-pair-correction',odd,False),('quarter-turn-sham',sham,True)]:
            w[role]=odd_prediction(cal,pidx,pos,xy[t],pidx[d],choice[1],choice[2],turn)
        for role,v in w.items():W.setdefault(role,[]).append(normalize(v,gram))
    out.mkdir(exist_ok=False)
    hashes={};role_ids={}
    def save(role,z):
        assert z.shape==(98,65536) and np.isfinite(z).all()
        body=np.asarray(z,dtype='<f4').tobytes(order='C')
        path=out/(role+'.f32le')
        with path.open('xb') as f:f.write(body)
        h=digest(body)
        hashes[role]=h
        role_ids[role]=[digest(body[k*262144:(k+1)*262144]) for k in range(98)]
        print(json.dumps({'role':role,'sessions':98,'forecast_sha256':h}),flush=True)
    for role,ws in W.items():save(role,np.asarray(ws)@x)
    empirical={k:np.asarray(v,dtype='<f8') for k,v in W.items()}
    np.savez(out/'empirical-weights.npz',**empirical)
    common=x.mean(axis=0); common/=np.linalg.norm(common)
    (out/'source-common.f64le').write_bytes(np.asarray(common,dtype='<f8').tobytes())
    del x
    optical,costs=forward_controls(ids,xy,raw,held_ids)
    for role,z in optical.items():save(role,z)
    receipt={'version':1,'split_sha256':SPLIT_SHA,'tile_receipt_sha256':SOURCE_RECORD_SHA,'source_ids':ids,
      'target_ids':held_ids,'pairs':held,'prespecified_primary':'odd-pair-correction','selected_development':selected,
      'development_all_grid':grid,'optical_costs':costs,'forecast_sha256':hashes,'per_image_sha256':role_ids,
      'source_common_sha256':digest((out/'source-common.f64le').read_bytes()),'matrix_shape':[98,256,256],'dtype':'little-endian float32','empirical_weights_sha256':digest((out/'empirical-weights.npz').read_bytes()),
      'source_to_target_denominator':'each source ROI separately centered and Euclidean normalized; targets unseen by forecast. Zero vectors stay zero.',
      'target_image_views_or_reads':0}
    b=(json.dumps(receipt,sort_keys=True,separators=(',',':'))+'\n').encode()
    (out/'lock.json').write_bytes(b)
    print(json.dumps({'complete_roles':len(hashes),'held_forecasts':98*len(hashes),'original_forecast_sha256':hashes,'lock_bytes':len(b),'lock_sha256':digest(b),'selected':selected,'optical_cost':costs,'path':str(out)}),flush=True)
if __name__=='__main__':main()
