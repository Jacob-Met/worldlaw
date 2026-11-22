"""Measure train-only source structure at the first available sample of each integer second."""
import hashlib
import itertools
import json
from pathlib import Path
import sys
import zipfile
import numpy as np


def main(root,gas):
    name={'CO':'ethylene_CO.txt','methane':'ethylene_methane.txt'}[gas]
    n=json.loads((root/'chronology-source.json').read_text())[name]['train_rows']
    chosen=[];indices=[];previous_bin=-1;prior=None
    event_counts=np.zeros(3,dtype=np.int64);largest=None
    cases={'co_only':None,'ethylene_only':None,'both':None}
    with zipfile.ZipFile(root/'uci322-original.zip') as z, z.open(name) as f:
        assert b'Ethylene conc (ppm)' in f.readline()
        for lo in range(0,n,50000):
            count=min(50000,n-lo)
            a=np.loadtxt(itertools.islice(f,count),ndmin=2)
            assert a.shape==(count,19) and np.isfinite(a).all()
            seconds=np.floor(a[:,0]).astype(np.int64)
            keep=np.flatnonzero(np.diff(np.r_[previous_bin,seconds])>0)
            chosen.append(a[keep]);indices.append(keep+lo);previous_bin=seconds[-1]
            sample=np.vstack([prior,a]) if prior is not None else a
            d=np.diff(sample[:,1:3],axis=0)
            for j,(key,mask) in enumerate(zip(cases,[(d[:,0]!=0)&(d[:,1]==0),(d[:,0]==0)&(d[:,1]!=0),(d[:,0]!=0)&(d[:,1]!=0)])):
                observed=np.flatnonzero(mask)
                event_counts[j]+=len(observed)
                if not len(observed):continue
                ix=int(observed[np.argmax(np.abs(d[observed,1]) if j in (1,2) else np.abs(d[observed,0]))])
                delta=float(abs(d[ix,1 if j in (1,2) else 0]))
                if cases[key] is None or delta>cases[key]['delta_ppm']:
                    cases[key]={'native_index':int(lo+ix+(prior is None)),'t_s':float(sample[ix+1,0]),'before_ppm':sample[ix,1:3].tolist(),'after_ppm':sample[ix+1,1:3].tolist(),'delta_ppm':delta,
                                'before_responses':sample[ix,3:].tolist(),'after_responses':sample[ix+1,3:].tolist()}
            prior=a[-1:]
    data=np.concatenate(chosen);ids=np.concatenate(indices)
    result=root/f'training-view-{gas}.npz'
    with result.open('xb') as f:np.savez_compressed(f,rows=data,indices=ids)
    info={'source_file':name,'source_hash':'8b6323b801363e11343ba1a5a7718e76666b715e753b3a40dbdfd1838d953fe7','n_native':n,'n_view':len(ids),'test_rows_read':0,'sha256':hashlib.sha256(result.read_bytes()).hexdigest(),
          'count_events':dict(zip(cases,map(int,event_counts))),'raw_cases':cases,'minimum_response':data[:,3:].min(axis=0).tolist(),'maximum_response':data[:,3:].max(axis=0).tolist(),'last_train_t':float(prior[0,0])}
    path=root/f'training-view-{gas}.json';path.write_text(json.dumps(info,indent=2));print('TRAIN',gas,info['n_native'],info['n_view'],info['count_events'],info['sha256'],'RAW_ETHYLENE',cases['ethylene_only'],flush=True)


if __name__=='__main__':main(Path(sys.argv[1]),sys.argv[2])
