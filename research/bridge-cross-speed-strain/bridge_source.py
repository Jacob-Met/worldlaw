"""Project only registered channels from the source file with its published MD5."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import numpy as np

WEIGHTS = {'loaded':(9340.,7160.,4750.),'unloaded':(6860.,2820.,2660.)}
STRAIN = ('Str_202Y','Str_203Y','Str_204Y','Str_211Z','Str_255Z')
LASER = ('LS_Anfang','LS_Ende','LS_Front')
CASES = {w: [f'{speed}_Run_{i}' for speed,count in
             ((('Crawling',10),('5.6',5),('11.1',5),('13.9',5)) if w=='loaded' else
              (('Crawling',11),('5.6',5))) for i in range(1,count+1)] for w in WEIGHTS}
HELD={f'loaded/{v}_Run_{i}' for v in ('11.1','13.9') for i in range(1,6)}
FILE_SIZE = 9732963908
FILE_MD5 = 'c06948aa61ba385e7fd56f5f90e460b6'


def sha_file(p):
    with open(p,'rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def project(source,dest,mode,case_subset=None):
    import h5py
    if mode not in ('lasers','development_strain','held_strain'):
        raise ValueError('Unknown projection mode')
    size = source.stat().st_size if isinstance(source,Path) else source.size
    if size!=FILE_SIZE or dest.exists():
        raise ValueError('Source size or output path differs')
    registry={'mode':mode,'source_bytes':size,'published_source_md5':FILE_MD5,
              'cases':{},'held_strain_columns_decoded':0}
    data={}
    with h5py.File(source,'r') as base:
        groups=base['box_girder_bridge/dynamic_load_test/cases']
        for weight,members in CASES.items():
            assert set(groups[weight])==set(members)
            for name in members:
                if hasattr(source,'fetched'):
                    source.cache.clear()
                    source.fetched=0
                label=weight+'/'+name
                if case_subset is not None and label not in case_subset: continue
                if mode=='development_strain' and label in HELD: continue
                if mode=='held_strain' and label not in HELD: continue
                g=groups[label]['data']
                clock=g['timestamp'].asstr()[:]
                # All source clock strings have an explicit UTC offset; retain ns.
                if any(not s.endswith('+00:00') for s in clock):
                    raise ValueError('Non-UTC recorded time in '+label)
                utc=np.asarray([s[:-6] for s in clock],dtype='datetime64[ns]').astype('int64')
                if np.any(np.diff(utc)<0):raise ValueError('Non-monotone recorded time in '+label)
                out=registry['cases'][label]={'first_utc':clock[0],'last_utc':clock[-1],'union_rows':len(clock),'channels':{}}
                for channel in LASER if mode=='lasers' else STRAIN:
                    y=g[channel][:]
                    missing=g[channel+'_missing'][:]
                    if y.shape!=utc.shape or missing.shape!=utc.shape:
                        raise ValueError('Union clock shape differs')
                    ix=np.flatnonzero(np.isfinite(y)&~missing.astype(bool))
                    # Retain every finite observed timestamp, do not fill missing union rows.
                    times=utc[ix];values=np.asarray(y[ix],dtype='<f8')
                    key=f'{label}/{channel}/'
                    data[key+'utc_ns']=times.astype('<i8')
                    data[key+'value']=values
                    out['channels'][channel]={'observed':len(ix),'duplicated_times':int(np.sum(np.diff(times)==0)),
                                              'median_dt_s':float(np.median(np.diff(times))/1e9) if len(times)>1 else None}
                    if mode=='held_strain':registry['held_strain_columns_decoded']+=1
    out=dest.with_suffix('.tmp')
    with out.open('xb') as f:np.savez_compressed(f,**data)
    os.replace(out,dest)
    registry['projection_sha256']=sha_file(dest);registry['projection_bytes']=dest.stat().st_size
    return registry


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('dest',type=Path)
    p.add_argument('mode',choices=('lasers','development_strain','held_strain'))
    a=p.parse_args();print(json.dumps(project(a.source,a.dest,a.mode),sort_keys=True),flush=True)
