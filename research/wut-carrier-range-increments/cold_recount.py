"""Recount every held-development forecast from cold bank and score copies. Stdlib."""
import argparse
from collections import defaultdict
from decimal import Decimal
import gzip
import hashlib
import json
import math
from pathlib import Path

FORECAST=('forecast.json.gz','baa0b064c43728eb2a24e0d51fb4e9b4185f6f3cd4b8acd6c4e52ded409c7a65')
OUTCOME=('score.json.gz','221e93a5ff462ee81b3cf9418b001c2a22d7478d181ea0540701623147a9904b')
ARMS=('nearest_a','own_first_order','average_slope','iid_corrected','differential_fit','symmetric_fit','affine_ls','affine_huber')
Q=Decimal(1381457)/Decimal(12173057)

def get(path, sha):
    data=Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest()!=sha:
        raise ValueError('cold bank identity: '+str(path))
    return json.loads(gzip.decompress(data),parse_float=Decimal)

def run(bank_path,score_path):
    b=get(bank_path,FORECAST[1])
    s=get(score_path,OUTCOME[1])
    if b['stage']!='development' or b['hours']!=list(range(12,18)) or tuple(b['arms'])!=ARMS:
        raise ValueError('unexpected development bank')
    targets={tuple(k):(cells,y) for k,cells,y in s['raw_targets']}
    assert len(targets)==len(s['raw_targets'])==len(b['rows'])
    model=b['model']
    squared=defaultdict(list)
    counts=defaultdict(int)
    worst={}
    max_delta=Decimal(0)
    max_mean_delta=Decimal(0)
    for key,raw,preds in b['rows']:
        k=tuple(key)
        h=k[0]
        cells,y=targets[k]
        e0,a0=raw[0]
        e1,a1=raw[1]
        d0=e0-a0
        d1=e1-a1
        d=(d0-d1)/2
        m=(d0+d1)/2
        design=[1]+[(x-mu)/scale for x,mu,scale in zip(((a0+a1)/2,(a0-a1)/2,m,d),model['center'],model['scale'])]
        counts[h,'all_rows']+=1
        if None not in y:
            counts[h,'paired']+=1
        clean=all(cell and cell[0] and cell[1]['L7Q'][1:]==[61,0] for cell in cells)
        counts[h,'clean']+=clean
        assert len(preds)==8
        for j,(own,di,sgn) in enumerate(((a0,d0,1),(a1,d1,-1))):
            def affine(name):
                return own+sum(x*coef[j] for x,coef in zip(design,model[name]))
            expected=(own,own+Q*di,own+Q*m,own+Q*m+sgn*d/2,own+Q*m+sgn*model['w']*d,
                      own+model['v']*m+sgn*model['w']*d,affine('coef'),affine('robust'))
            for arm,values,v in zip(ARMS,preds,expected):
                max_delta=max(max_delta,abs(values[j]-v))
                if None in y:
                    continue
                err=values[j]-y[j]
                squared[h,arm,'all'].append(err**2)
                if clean:
                    squared[h,arm,'clean'].append(err**2)
                if arm not in worst or abs(err)>worst[arm][0]:
                    worst[arm]=(abs(err),key,j)
        max_mean_delta=max(max_mean_delta,abs(sum(preds[3])-sum(preds[1]))/2)
        if None not in y:
            for arm,values in zip(ARMS,preds):
                u,v=[p-t for p,t in zip(values,y)]
                squared[h,arm,'mean'].append(((u+v)/2)**2)
                squared[h,arm,'difference'].append(((u-v)/2)**2)
    assert max_delta < Decimal('5e-10') and max_mean_delta < Decimal('5e-10')
    errors=[]
    agg={}
    hourly={}
    for h in range(12,18):
        assert counts[h,'paired']==s['hours'][str(h)]['paired']
        assert counts[h,'clean']==s['hours'][str(h)]['clean']
        hourly[h]=dict(paired=counts[h,'paired'],clean=counts[h,'clean'],eligible=counts[h,'all_rows'])
    for arm in ARMS:
        scores=[]
        for h in range(12,18):
            for family in ('all','clean','mean','difference'):
                v=squared[h,arm,family]
                rms=(sum(v)/len(v)).sqrt()
                errors.append(abs(rms-s['hours'][str(h)]['rms'][family][arm]))
                if family=='all':
                    scores.append(rms)
        agg[arm]={'mean':sum(scores)/6,'worst':max(scores)}
        for metric,z in agg[arm].items():
            errors.append(abs(z-s['aggregate'][arm][metric]))
        assert worst[arm][1]==s['worst'][arm]['key'] and worst[arm][2]==s['worst'][arm]['receiver']
    gates={}
    for metric in ('mean','worst'):
        for label,group in [('own',['own_first_order']),('strongest',[a for a in ARMS if a!='iid_corrected'])]:
            comp=min(group,key=lambda a:agg[a][metric])
            passed=agg['iid_corrected'][metric]<agg[comp][metric]
            gate=metric+'_'+label
            assert (comp,passed)==(s['gates'][gate]['comparator'],s['gates'][gate]['passed'])
            gates[gate]=passed
    assert max(errors)<Decimal('5e-10') and all(gates.values())==s['joint_pass']
    return dict(bank_bytes=Path(bank_path).stat().st_size,score_bytes=Path(score_path).stat().st_size,
                rows=len(b['rows']),forecasts=16*len(b['rows']),compared_metrics=len(errors),hourly=hourly,
                max_forecast_delta_m=str(max_delta),max_metric_delta_m=str(max(errors)),
                max_mean_identity_delta_m=str(max_mean_delta),worst_arm_cases=len(worst),gates=gates,
                primary_worst=s['worst']['iid_corrected'],aggregate=agg,final_scored=False)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('forecast',type=Path);p.add_argument('score',type=Path)
    a=p.parse_args()
    print(json.dumps(run(a.forecast,a.score),default=str,sort_keys=True))
