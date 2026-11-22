"""Strict paired-accumulation receiver for declared post-SPICE site-seasons."""
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.request import Request,urlopen
import hashlib,json,sys

import numpy as np

TRAIN={('XBK',1),('CAR',1),('MAR',1)}
DEVELOPMENT={('CAR',2),('MAR',2)}

def extract(headers, support, out, partition):
    known={'train':TRAIN,'partial_development':DEVELOPMENT}
    if partition not in known:raise ValueError('unknown partition')
    baseline=json.loads(support.read_text());key={(c['site'],c['season']):c for c in baseline}
    out.mkdir(exist_ok=True,parents=True);packets=[]
    for row in json.loads(headers.read_text()):
        site,season,doi=row['site'],row['season'],row['doi']
        if (site,season) not in known[partition]:continue
        record=key[site,season];ref,alter,bare=record['roles'];names=row['columns']
        roles=[ref,bare,alter]
        main=[names.index('Precip [mm] ('+s+')') for s in roles]
        flags=[names.index('Missing [#] ('+s+')') for s in roles]+[names.index('Missing [#] (Wind_gh)'),names.index('Missing [#] (Tair)')]
        met=[names.index('ff [m/s] (at gauge height)'),next(i for i,c in enumerate(names) if c.startswith('TTT'))]
        methods=[names.index(f'Precip [mm] ({m}_adj_eq{k}_gh)') for m in [bare,alter] for k in [3,4]]
        times=[];data=[];extra=0;sha=hashlib.sha256();seen=set()
        url=f'https://doi.pangaea.de/10.1594/PANGAEA.{doi}?format=textfile&charset=UTF-8'
        with urlopen(Request(url,headers={'User-Agent':'Post-SPICE receipt for designated site-season'}),timeout=60) as r:
            while True:
                b=r.readline(30000);sha.update(b)
                if b.strip().endswith(b'*/'):break
                if not b:raise ValueError('header incomplete')
            b=r.readline(60000);sha.update(b);assert b.decode().strip().split('\t')==names
            for line in r:
                sha.update(line);c=line.rstrip(b'\r\n').split(b'\t')
                stamp=datetime.fromisoformat(c[0].decode());assert stamp not in seen;seen.add(stamp)
                if not (datetime(2014+season,8,1)<=stamp<datetime(2015+season,8,1)):
                    extra+=1;continue
                if any(c[i] not in (b'0',b'0.0') for i in flags):continue
                if not all(c[i].strip() for i in main+met+methods):continue
                numbers=[float(c[i]) for i in main+met+methods]
                if not np.isfinite(numbers).all() or numbers[3]<0:continue
                times.append(stamp.isoformat());data.append(numbers)
        assert sha.hexdigest()==record['source_sha256']
        expected=record['counts']['eligible']-(48 if (site,season)==('MAR',2) else 0)
        assert len(data)==expected and extra==(48 if (site,season)==('MAR',2) else 0),(site,season,len(data),expected,extra)
        path=out/(site+'-'+str(season)+'.npz');np.savez_compressed(path,times=np.array(times),values=np.array(data))
        packets.append(dict(site=site,season=season,rows=len(data),sha256=sha.hexdigest(),path=str(path),
            fieldnames=['DFAR','UN','SA','wind_gh','temperature','UN_eq3','UN_eq4','SA_eq3','SA_eq4'],
            excluded_outside_nominal_winter=extra))
    assert {(r['site'],r['season']) for r in packets}==known[partition]
    (out/('manifest-'+partition+'.json')).write_text(json.dumps(packets,indent=2)+'\n')
    return packets

def summarize(packets,out):
    names=['raw_UN','raw_SA','raw_pair_mean','UN_eq3','UN_eq4','SA_eq3','SA_eq4','equal_pair_eq3','equal_pair_eq4']
    results={}
    for rec in packets:
        with np.load(rec['path']) as data: times=data['times'];arr=data['values']
        y,U,A,w,t,p3,p4,q3,q4=arr.T
        arms=[U,A,(U+A)/2,p3,p4,q3,q4,(p3+q3)/2,(p4+q4)/2]
        rows={};masks={'all':np.ones(len(y),bool),'reference_ge_point1':y>=.1,'both_zero':(U==0)&(A==0)}
        for name,p in zip(names,arms):
            err=p-y;bad=np.argsort(np.abs(err),kind='stable')[-5:][::-1]
            rows[name]={'strata':{s:dict(n=int(i.sum()),rmse=float(np.sqrt(np.mean(err[i]**2))),mae=float(np.mean(abs(err[i]))),
                sum_measurement=float(y[i].sum()),sum_prediction=float(p[i].sum())) for s,i in masks.items() if i.any()},
                'worst':[dict(at=times[i],values=arr[i].tolist(),estimate=float(p[i]),error=float(err[i])) for i in bad]}
        results[rec['site']]={'count':len(y),'negative_reference':int(sum(y<0)),'negative_UN':int(sum(U<0)),'negative_SA':int(sum(A<0)),
            'both_zero_positive_reference':int(sum(masks['both_zero']&(y>0))),
            'raw_pair_reversal_UN_greater_than_SA':int(sum(U>A)),'methods':rows}
        best=min(names,key=lambda k:rows[k]['strata']['all']['rmse'])
        print('BASELINE',rec['site'],len(y),best,rows[best]['strata'],json.dumps(rows[best]['worst'][:2]),flush=True)
    path=out/'source-baselines.json';path.write_text(json.dumps(results,indent=2)+'\n')
    print('COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),path,flush=True)
if __name__=='__main__':
    dest=Path(sys.argv[3]);p=extract(Path(sys.argv[1]),Path(sys.argv[2]),dest,'train');summarize(p,dest)
