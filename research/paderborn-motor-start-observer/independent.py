"""Independently recount the archived profile losses, extreme rows, and admission gates."""
import hashlib
import json
import math
from pathlib import Path
import sys

import numpy as np

NAMES=('firmware_float','firmware_int8','temperature_reset','generic_boosting','clock_q','speed_d','speed_q')
LOCK='e40a1e992aaea2fea36ac5fb72042cbddc03e02a676f3c8ed028b9e7d93b9b9a'


def receive(folder):
    report=json.loads((folder/'development-report.json').read_text())
    assert tuple(report['names'])==NAMES and len(report['rows'])==4
    assert hashlib.sha256((folder/'forecasts.npz').read_bytes()).hexdigest()==LOCK
    scores=[];witnesses=[]
    with np.load(folder/'development-reference.npz') as refs,np.load(folder/'forecasts.npz') as pred:
        assert set(pred.files)=={'p19','p45','p52','p67'}
        assert set(refs.files)=={s+p[1:] for p in pred.files for s in ('x','y')}
        for row,(pid,count) in zip(report['rows'],[(19,10410),(45,17142),(52,3726),(67,11135)]):
            x=refs[f'x{pid}']; y=refs[f'y{pid}']; f=pred[f'p{pid}']
            assert (pid,count)==(row['profile'],row['rows']) and x.shape==(count,7) and f.shape==(count,7) and y.shape==(count,)
            for j,name in enumerate(NAMES):
                costs=[abs(float(f[k,j])-float(y[k])) for k in range(count)]
                worst=max(range(count),key=costs.__getitem__)
                witness=row['worst'][name]
                assert worst==witness['row'] and y[worst]==witness['actual'] and f[worst,j]==witness['prediction']
                assert np.array_equal(x[max(0,worst-10):worst+1],witness['history_inputs'])
                assert np.array_equal(y[max(0,worst-10):worst+1],witness['history_pm'])
                witnesses.append((pid,name,worst,float(costs[worst])))
                choices={'all':range(count),'first60':range(120),'60to600':range(120,1200),
                         'after600':range(1200,count),'low_speed':[i for i in range(count) if abs(x[i,4])<300],
                         'high_speed':[i for i in range(count) if abs(x[i,4])>=300]}
                for part,index in choices.items():
                    expected=row['metrics'][part]
                    if not index:
                        assert expected is None
                        continue
                    a=sorted(costs[i] for i in index);n=len(a);n_tail=(n+99)//100
                    assert expected['n']==n
                    result=(math.sqrt(math.fsum(v*v for v in a)/n),math.fsum(a)/n,math.fsum(a[-n_tail:])/n_tail)
                    for key,value in zip(('rmse','mae','mean_worst_1pct'),result):
                        assert math.isclose(expected[key][j],value,rel_tol=4e-13,abs_tol=2e-12),(pid,part,name,key)
                    scores.append((pid,part,name,*result))
    def values(part,method,k):
        return [r[k] for r in scores if r[1]==part and r[2]==method]
    avg=lambda a:math.fsum(a)/len(a)
    r=[avg(values('all',m,3)) for m in NAMES]
    t=[avg(values('all',m,5)) for m in NAMES]
    individual=lambda p:all(a<=1.05*min(b) for a,*b in zip(values(p,NAMES[-1],3),*[values(p,m,3) for m in NAMES[:-1]]))
    gates={'primary_mean':r[-1]<=.95*min(r[:-1]),'tail':t[-1]<=min(t[:-1]),'per_profile':individual('all'),'late_no_harm':individual('after600')}
    assert gates==report['gates'] and not any(gates.values())
    return {'profile_rows':42413,'forecasts':42413*7,'scores':len(scores)*3,'witnesses':witnesses,'gate':gates,
            'rmse':r,'tail':t,'profile_method_rmse':{m:values('all',m,3) for m in NAMES},
            'late_rmse':{m:values('after600',m,3) for m in NAMES},'locked_forecasts':LOCK}


if __name__=='__main__':print(json.dumps(receive(Path(sys.argv[1])),sort_keys=True))
