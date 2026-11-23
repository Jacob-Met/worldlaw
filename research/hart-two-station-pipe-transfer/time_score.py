"""Score every sample of the released Test 3 processed profiles after forecast lock."""
import sys,json,zipfile,hashlib
from collections import defaultdict
from pathlib import Path
import numpy as np
from transport import checked,roster,keys,read,STATIONS
from time_model import ARMS,REQUIRED,integral as integrate
CANDIDATE='two_mode'

def score(root,bank_path,info_path,output,worstpath):
    info=json.loads(Path(info_path).read_text());assert info['arms']==list(ARMS)
    bank=np.load(bank_path,allow_pickle=False);idx=roster(checked(root,'index.xlsx'))
    rows=[];worst_trace=None;worst=-1.;cand=ARMS.index(CANDIDATE)
    with zipfile.ZipFile(checked(root,'unsteady.zip')) as z:
        files=keys(z,idx)
        for key,name in sorted(files.items()):
            if key[0]!=3:continue
            t,*vals=read(z,name,(0,9,10,12));s=t
            sr=info['runs'][str(key[1])]
            assert sr['cell']==list((3,)+idx[key]) and len(t)==sr['n']
            a=bank['run'+str(key[1])];assert a.shape==(len(ARMS),3,len(t))
            for j,(station,y) in enumerate(zip(STATIONS,vals)):
                assert np.isfinite(y).all() and integrate(abs(y),s)>0
                pp=a[:,j,:]
                n=integrate(abs(y),s)
                loss=integrate(abs(pp-y),s)/n
                outside=0.0
                peak=int(np.argmax(abs(pp[cand]-y)))
                row=dict(programme=3,run=key[1],condition=sr['cell'][1:],station=station,n=len(t),
                         integrated_target_ppb_seconds=n,unrepresented_fraction=outside,loss=dict(zip(ARMS,loss)),
                         point_error_max=dict(time=t[peak],index=peak,observed=y[peak],pred=pp[:,peak].tolist()))
                rows.append(row)
                if loss[cand]>worst:
                    worst=loss[cand];worstrow=row
                    worst_trace=dict(time=t,observed=y,forecasts=pp,
                                     station=np.array(station),run=np.array(key[1]))
    assert len(rows)==150
    cond=defaultdict(list)
    for r in rows:cond[tuple(r['condition'])].append(r)
    assert len(cond)==10 and all(len(v)==15 for v in cond.values())
    cv={str(k):{a:np.mean([rr['loss'][a] for rr in v]) for a in ARMS} for k,v in cond.items()}
    def summary(a):
        each=[(k,np.mean([r['loss'][a] for r in v])) for k,v in cond.items()]
        return [np.mean([x for k,x in each]),max(x for k,x in each),np.mean([x for k,x in each if k[1] in ('At acceleration','Half-way through acceleration')]),
                np.mean([np.mean([r['loss'][a] for r in vv if r['station']==STATIONS[-1]]) for vv in cond.values()])]
    metrics={a:summary(a) for a in ARMS}
    gates=[all(metrics[CANDIDATE][i]<metrics[a][i] for a in REQUIRED) for i in range(4)]
    result=dict(rows=rows,cells=cv,metrics=metrics,gates=list(map(bool,gates)),joint=all(gates),worst=worstrow,
                largest_outside_fraction=max(r['unrepresented_fraction'] for r in rows))
    np.savez_compressed(worstpath,**worst_trace)
    Path(output).write_text(json.dumps(result,sort_keys=True,allow_nan=False)+'\n')
    print('RECEIVED',len(rows),'metrics',json.dumps(metrics),'gates',result['gates'],'worst',json.dumps(worstrow),'max outside',result['largest_outside_fraction'])

if __name__=='__main__':score(*sys.argv[1:6])
