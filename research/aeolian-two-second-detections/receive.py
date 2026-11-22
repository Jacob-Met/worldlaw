"""Recount each predicted Bernoulli event from the dated instruments, using independent clocks."""
from argparse import ArgumentParser
from collections import defaultdict
import csv
import hashlib
import json
import math
from pathlib import Path

import numpy as np

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def series(path,start,count):
    with path.open(newline='') as stream:
        rows=csv.reader(stream);header=next(rows)
        assert header[:3]==['Hour','Minute','Second']
        values={};duplicated=set()
        for row in rows:
            hr,minute,sec=map(float,row[:3]);delta=((3600*hr+60*minute+sec)-start)*25
            if not math.isfinite(delta):continue
            k=round(delta)
            if not (0<=k<45000 and abs(k-delta)<2e-5):continue
            if k in values:duplicated.add(k)
            val=np.array([float(s) if s else math.nan for s in row[3:]])
            if count:
                values[k]=float(val.sum()) if np.isfinite(val).all() and np.equal(val,np.rint(val)).all() and (val>=0).all() else math.nan
            else:values[k]=math.hypot(val[0],val[1])
        a=np.full(45000,np.nan)
        for i,value in values.items():
            if i not in duplicated:a[i]=value
        return a.reshape(900,50)


def receive(root):
    p=root/'out';raw=root/'cache';ft=root/'features'
    lock=json.loads((p/'forecast-lock.json').read_text());published=json.loads((p/'result.json').read_text())
    manifest=json.loads((ft/'manifest-development.json').read_text())
    assert sha(ft/'manifest-development.json')==lock['manifest']
    for f,k in [('development-forecasts.npz','forecast'),('development-observations.npz','observations')]:
        assert sha(p/f)==lock[k]
    with np.load(p/'development-observations.npz') as y:observed=y['observed'];ids=y['block'];tick=y['t']
    with np.load(p/'development-forecasts.npz') as forecasts:
        assert np.array_equal(forecasts['block'],ids) and np.array_equal(forecasts['t'],tick)
        methods={k:forecasts[k] for k in forecasts if k not in ['block','t']}
    assert len(methods)==10 and len(set(zip(ids,tick)))==len(tick)
    registry=defaultdict(lambda:defaultdict(list));worst={};coverage={}
    for stem,record in sorted(manifest.items()):
        site,day,start,_=stem.split('_');start=int(start[:2])*3600+int(start[2:])*60
        assert day in ['20141120','20150324'] and site in ['Jericoacoara','RanchoGuadalupe']
        files=[raw/Path(record[k+'_member']).name for k in ['wind','count']]
        assert [sha(path) for path in files]==[record[k+'_sha256'] for k in ['wind','count']]
        wind=series(files[0],start,False);pulse=series(files[1],start,True)
        kept=np.array([n for n in range(30,900) if np.isfinite(wind[n-30:n]).all() and np.isfinite(pulse[n-30:n+1]).all()],dtype=int)
        select=np.flatnonzero(ids==stem);assert np.array_equal(tick[select],kept)
        values=(pulse[kept].sum(1)>0).astype(int);assert np.array_equal(values,observed[select])
        coverage[stem]={'eligible':len(kept),'omitted':870-len(kept),'active':int(values.sum())}
        if not len(kept):continue
        for arm,ps in methods.items():
            v=ps[select]
            assert np.isfinite(v).all() and ((0<=v)&(v<=1)).all()
            bs=math.fsum((float(pred)-int(o))**2 for pred,o in zip(v,values))/len(v)
            eps=np.finfo(v.dtype).eps;clipped=np.clip(v,eps,1.-eps)
            ll=-math.fsum(math.log(prob) if o else math.log1p(-prob) for prob,o in zip(clipped,values))/len(v)
            registry[arm][day].append([bs,ll])
            for e in published['results'][arm][day]['worst']:
                if e['block']!=stem:continue
                t=e['t'];i=int(np.searchsorted(kept,t))
                assert kept[i]==t and float(v[i])==e['p'] and int(values[i])==e['y']
                target=dict(stem=stem,t=t,prior_count=int(pulse[t-1].sum()),next_count=int(pulse[t].sum()),
                    count_0p2s=pulse[t-1:t+1].reshape(20,5).sum(1).astype(int).tolist(),
                    speed_m_s_0p2s=wind[t-1:t+1].reshape(20,5).mean(1).tolist())
                worst[stem+'#'+str(t)]=target
    error=0.;rr={}
    for arm,byday in registry.items():
        rr[arm]={}
        for day,pairs in byday.items():
            a=np.array(pairs).mean(0);rr[arm][day]=a.tolist()
            row=published['results'][arm][day]
            error=max(error,abs(a[0]-row['brier']),abs(a[1]-row['logloss']))
    assert error<1e-12
    cand='gust_arrival_logit';names=[k for k in rr if k!=cand]
    days=sorted(rr[cand]);ratios=[rr[cand][d][0]/min(rr[k][d][0] for k in names) for d in days]
    guard=sum(rr[cand][d][1] for d in days)<=min(sum(rr[k][d][1] for d in days) for k in names)
    assert (all(x<=.95 for x in ratios) and guard)==published['advance']
    out={'prediction_cells':int(len(tick)*len(methods)),'issues':len(tick),'coverage':coverage,'results':rr,
         'worst_unique_events':worst,'boundary_probabilities':{k:{'zero':int(np.sum(v==0)),'one':int(np.sum(v==1))} for k,v in methods.items()},'maximum_metric_difference':error,'ratios':ratios,'logloss_guard':guard,'advance':published['advance']}
    path=p/'independent-recount.json';path.write_text(json.dumps(out,indent=2)+'\n')
    print('INDEPENDENT',len(tick),len(methods),len(worst),error,ratios,guard,sha(path),flush=True)
if __name__=='__main__':
    cli=ArgumentParser();cli.add_argument('root',type=Path);receive(cli.parse_args().root)
