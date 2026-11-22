"""Read acquisition clocks, availability masks and measured wind before opening precipitation."""
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
import sys
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor

import numpy as np

def geometry(speed):
    u=min(speed,7.2)
    a=min(1.,.860*math.exp(-.371*u)+.229)
    b=min(1.,.728*math.exp(-.230*u)+.336)
    if a==b:
        return (0.,1.,None) if a==1. else (0.,None,None)
    M=np.array([[1.,a],[1.,b]])
    total_noise=(abs(b-1.)+abs(1.-a))/abs(b-a)
    return b-a,total_noise,float(np.linalg.cond(M))

def numeric(x):
    if not x:return None
    try:v=float(x)
    except ValueError:return None
    return v if math.isfinite(v) else None

def inventory(row):
    site=row['site']; ss=row['season'];hdr=row['columns'];doi=row['doi'];ref=next(v for v in ['R2G','R2P'] if f'Precip [mm] ({v})' in hdr)
    typ=ref[-1];roles=[ref,'R3A'+typ,'R3U'+typ];wind='ff [m/s] (at gauge height)'
    absent=[r for r in roles if f'Precip [mm] ({r})' not in hdr]
    if wind not in hdr:absent.append(wind)
    if absent:return {'site':site,'season':ss,'doi':doi,'missing_inputs':absent}
    pp=[hdr.index(f'Precip [mm] ({s})') for s in roles]
    ff=[hdr.index(f'Missing [#] ({s})') for s in roles]
    wx=hdr.index(wind);wt=hdr.index('Missing [#] (Wind_gh)');tx=next(i for i,c in enumerate(hdr) if c.startswith('TTT [°C]'));tt=hdr.index('Missing [#] (Tair)')
    controls=[hdr.index(f'Precip [mm] ({r}_adj_eq{eq}_gh)') for r in roles[1:] for eq in [3,4]]
    rec={'rows':0,'unique_clock':0,'precip_present_raw':0,'all_three_precip_flags_zero':0,'some_precip_gap_gt30':0,'met_present':0,'eligible':0}
    times=set();noise=[];cond=[];det=[];first=None;last=None;inversions=[];sha=hashlib.sha256()
    url=f'https://doi.pangaea.de/10.1594/PANGAEA.{doi}?format=textfile&charset=UTF-8'
    with urlopen(Request(url,headers={'User-Agent':'Post-SPICE raw support and weather audit'}),timeout=60) as r:
        while True:
            line=r.readline(30000);sha.update(line)
            if not line:raise ValueError('missing metadata terminator')
            if line.strip().endswith(b'*/'):break
        line=r.readline(60000);sha.update(line)
        assert line.decode().strip().split('\t')==hdr
        for line in r:
            sha.update(line);fields=line.rstrip(b'\r\n').split(b'\t');assert len(fields)==len(hdr)
            ts=datetime.fromisoformat(fields[0].decode('ascii'));assert ts.minute in [0,30] and ts.second==0
            key=ts.isoformat();assert key not in times;times.add(key)
            if first is None:first=key
            if last is not None and key<last:inversions.append([last,key])
            last=key;rec['rows']+=1
            # Deliberately check only field presence for precipitation/reference/adjusted columns.
            present=all(bool(fields[i].strip()) for i in pp);rec['precip_present_raw']+=int(present)
            flags=[numeric(fields[i]) for i in ff];valid_g=all(f==0 for f in flags)
            rec['all_three_precip_flags_zero']+=int(valid_g);rec['some_precip_gap_gt30']+=int(any(f is not None and f>30 for f in flags))
            u,t=numeric(fields[wx]),numeric(fields[tx]);met=u is not None and u>=0 and t is not None
            rec['met_present']+=int(met)
            if not (present and valid_g and met and numeric(fields[wt])==0 and numeric(fields[tt])==0 and
                    all(bool(fields[i].strip()) for i in controls)):continue
            d,a,c=geometry(u);rec['eligible']+=1;det.append(d);noise.append(a)
            if c is not None:cond.append(c)
    rec['unique_clock']=len(times)
    def summary(v):return np.quantile(v,[0,.1,.5,.9,1]).tolist() if v else None
    return dict(site=site,season=ss,doi=doi,roles=roles,source_sha256=sha.hexdigest(),counts=rec,
                total_error_amplification_quantiles=summary(noise),matrix_condition_nonsingular_quantiles=summary(cond),
                matrix_singular_but_total_identifiable=len(noise)-len(cond),det_quantiles=summary(det),first_publisher_row=first,last_publisher_row=last,min_stamp=min(times),max_stamp=max(times),
                backward_row_steps=len(inversions),first_clock_inversions=inversions[:4])

if __name__=='__main__':
    inputs=Path(sys.argv[1]);dest=Path(sys.argv[2])
    assert hashlib.sha256(inputs.read_bytes()).hexdigest()=='6bda6005584263f329a028fbd94219e40ffe9df857c189231ebb5dbc8188f49a'
    with ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(inventory,json.loads(inputs.read_text())))
    path=dest/'clock-support-wind-conditioning.json';path.write_text(json.dumps(rows,indent=2)+'\n')
    for row in rows:print('SUPPORT',row['site'],row['season'],row.get('counts',row.get('missing_inputs')),row.get('total_error_amplification_quantiles'),row.get('matrix_singular_but_total_identifiable'),row.get('backward_row_steps'),row.get('first_clock_inversions'),flush=True)
    print('COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),path,flush=True)
