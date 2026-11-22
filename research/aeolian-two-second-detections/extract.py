"""Derive causal two-second blocks only from specified whole source dates."""
import argparse
from collections import Counter, defaultdict
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

import numpy as np

from archive_reader import RangeFile, get

SPLITS = {
    'diagnostic': {'Jericoacoara':{'20141113'}, 'RanchoGuadalupe':{'20150323'}},
    'train': {'Jericoacoara':{'20141113','20141114'}, 'RanchoGuadalupe':{'20150323'}},
    'development': {'Jericoacoara':{'20141120'}, 'RanchoGuadalupe':{'20150324'}},
}
PIN = 'md5:bae6c3fa0d7e3175e236df582dea45a5'


def time_grid(raw, hz, start_s, nrows):
    times = raw[:,0]*3600 + raw[:,1]*60 + raw[:,2]
    pos = (times-start_s)*hz
    ticks = np.rint(pos).astype(int)
    ok = np.isfinite(pos) & (np.abs(pos-ticks)<2e-5) & (ticks>=0) & (ticks<nrows)
    unique,counts = np.unique(ticks[ok],return_counts=True)
    repeated = unique[counts>1]
    accepted = ok & ~np.isin(ticks,repeated)
    values=np.full((nrows,raw.shape[1]-3),np.nan)
    values[ticks[accepted]]=raw[accepted,3:]
    return values,dict(rows=int(len(raw)),out_of_grid=int((~ok).sum()),duplicate_ticks=len(repeated),absent=nrows-len(unique))


def read_table(archive,name,cache):
    path=cache/Path(name).name
    info=archive.getinfo(name)
    if not path.exists():path.write_bytes(archive.read(info))
    data=path.read_bytes()
    import zlib
    assert zlib.crc32(data)==info.CRC
    lines=data.splitlines();header=lines[0].decode().strip().split(',')
    assert header[:3]==['Hour','Minute','Second']
    x=np.genfromtxt(lines[1:],delimiter=',',dtype=float)
    assert x.ndim==2 and x.shape[1]==len(header),(name,x.shape,header)
    return header,x,hashlib.sha256(data).hexdigest()


def build(split,cache,out):
    cache.mkdir(parents=True,exist_ok=True);out.mkdir(parents=True,exist_ok=True)
    if split not in SPLITS:raise ValueError('unregistered split')
    with get('https://zenodo.org/api/records/4992068') as r:meta=json.load(r)
    item=next(i for i in meta['files'] if i['key']=='30_Minute.zip');assert item['checksum']==PIN
    src=item['links'].get('content') or item['links']['self']
    manifest={}; names=[]
    with zipfile.ZipFile(RangeFile(src,item['size'])) as z:
        pattern=re.compile(r'^([A-Za-z]+)_(\d{8})_(\d{4})_(\d{4})_PartialFlux\.txt$')
        for name in z.namelist():
            if '__MACOSX' in name:continue
            m=pattern.match(Path(name).name)
            if m and m.group(2) in SPLITS[split].get(m.group(1),set()):names.append(name)
        for name in sorted(names):
            m=pattern.match(Path(name).name);site,date,beg,end=m.groups();stem=name[:-len('PartialFlux.txt')]
            starts=int(beg[:2])*3600+int(beg[2:])*60;ends=int(end[:2])*3600+int(end[2:])*60;assert ends-starts==1800
            sonic='S1' if site=='Oceano' else 'U1';hz=50 if site=='Oceano' else 25
            w=next(n for n in z.namelist() if n.startswith(stem+'Wind_'+sonic+'_z') and n.endswith('mm.txt'))
            height=float(re.search(r'_z(\d+)mm',w).group(1))/1000
            wh,wx,wsha=read_table(z,w,cache);ch,cx,csha=read_table(z,name,cache)
            assert wh[3:6]==['u','v','w'] and ch[3:]==[f'n{j}' for j in range(1,len(ch)-2)],(wh,ch)
            winds,ws=time_grid(wx,hz,starts,1800*hz);counts,cs=time_grid(cx,25,starts,45000)
            speed=np.hypot(winds[:,0],winds[:,1])
            invalid=~np.isfinite(speed)
            if hz==50:
                assert len(wh)>=8
                invalid |= ~np.isfinite(winds[:,-1]) | (winds[:,-1]!=0)
            speed[invalid]=np.nan
            any_invalid=(~np.isfinite(counts)|(counts<0)|(counts!=np.rint(counts))).any(axis=1)
            total=counts.sum(1);total[any_invalid]=np.nan
            speed=speed.reshape(900,2*hz)
            ct=total.reshape(900,50).sum(1)
            key=Path(name).name[:-len('_PartialFlux.txt')]
            fn=out/(key+'.npz');np.savez_compressed(fn,wind=speed,counts=ct,pulse=total.reshape(900,50),channels=counts.shape[1],height=height,
                                                    block=key,site=site,date=date,hz=hz)
            manifest[key]={'wind_member':w,'wind_sha256':wsha,'count_member':name,'count_sha256':csha,'count_grid':cs,
                'wind_grid':ws,'finite_count_bins':int(np.isfinite(ct).sum()),'finite_wind_bins':int(np.isfinite(speed).all(axis=1).sum()),
                'height_m':height,'channels':counts.shape[1]}
            print('BLOCK',key,manifest[key]['finite_count_bins'],manifest[key]['finite_wind_bins'],flush=True)
    p=out/('manifest-'+split+'.json');p.write_text(json.dumps(manifest,indent=2)+'\n')
    print('COMPLETE',hashlib.sha256(p.read_bytes()).hexdigest(),p,len(names),flush=True)
    return p

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('split',choices=list(SPLITS));p.add_argument('cache',type=Path);p.add_argument('output',type=Path)
    a=p.parse_args();build(a.split,a.cache,a.output)
