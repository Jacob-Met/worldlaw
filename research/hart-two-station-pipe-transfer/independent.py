"""Independent raw CSV and immutable prediction recount; does not import producer modules."""
from pathlib import Path
from collections import defaultdict,Counter
import json,sys,hashlib,zipfile,re,math
import numpy as np
ARMS=('author_time','author_volume_projection','author_volume_command','one_mode','constant_mix','two_input_ridge','two_mode')
STATIONS=(7.08,8.92,13.06)
def verify(archive,forecast,metadata,results,worst_trace):
    assert hashlib.sha256(Path(archive).read_bytes()).hexdigest()=='e16a71d2c8b867f71508f6a929849da9c417eba913db5129ed7ebeb4c776434c'
    bank=np.load(forecast,allow_pickle=False);info=json.loads(Path(metadata).read_text());target=json.loads(Path(results).read_text())
    rows={(r['run'],r['station']):r for r in target['rows']};assert len(rows)==150 and len(bank.files)==50
    worst=np.load(worst_trace,allow_pickle=False);cells=defaultdict(list);clocks=set();num=0;component=0;deviation=0.;raw_worst=None
    def same(a,b):
        nonlocal deviation
        e=np.max(np.abs(np.asarray(a)-np.asarray(b)))
        deviation=max(deviation,float(e));assert e<2e-10,e
    with zipfile.ZipFile(archive) as z:
        for name in sorted(z.namelist()):
            mat=re.fullmatch(r'Unsteady/Test3/Unsteady_Test3_R(\d+)\.csv',name)
            if not mat:continue
            run=int(mat[1]);meta=info['runs'][str(run)]
            with z.open(name) as f:t,u,re_,*yy=np.loadtxt(f,delimiter=',',skiprows=1,usecols=(0,2,3,9,10,12),unpack=True)
            clocks.add(hashlib.sha256(u.tobytes()+t.tobytes()).hexdigest())
            assert hashlib.sha256(u.tobytes()+t.tobytes()).hexdigest()==meta['hydraulic_sha']
            dt=np.diff(t);assert np.all(dt>0);ww=np.r_[dt[0],dt[:-1]+dt[1:],dt[-1]]*.5
            pp=bank['run'+str(run)];assert pp.shape==(7,3,len(t))
            for j,station in enumerate(STATIONS):
                r=rows[run,station]; y=yy[j]; p=pp[:,j,:];mass=np.dot(ww,abs(y));assert mass>0
                v=abs(p-y)@ww/mass;same(mass,r['integrated_target_ppb_seconds']);same(v,[r['loss'][a] for a in ARMS])
                assert tuple(r['condition'])==tuple(meta['cell'][1:])
                cells[tuple(r['condition'])].append((station,v))
                peak=np.argmax(abs(p[-1]-y));q=r['point_error_max'];assert q['index']==peak
                same(t[peak],q['time']);same(y[peak],q['observed']);same(p[:,peak],q['pred'])
                if raw_worst is None or v[-1]>raw_worst[0]:raw_worst=(v[-1],run,station,t.copy(),y.copy(),p.copy())
                component+=p.size;num+=1
    assert num==150 and len(cells)==10 and len(clocks)==15
    assert all(len(z)==15 for z in cells.values())
    per=np.array([np.mean([v for x,v in cells[k]],axis=0) for k in sorted(cells)])
    ramp=[k for k in sorted(cells) if k[1] in ('At acceleration','Half-way through acceleration')]
    far=[np.mean([v for x,v in cells[k] if x==13.06],axis=0) for k in sorted(cells)]
    by=np.stack([per.mean(axis=0),per.max(axis=0),np.mean([np.mean([v for _,v in cells[k]],axis=0) for k in ramp],axis=0),np.mean(far,axis=0)])
    for j,a in enumerate(ARMS):same(by[:,j],target['metrics'][a])
    gates=np.all(by[:,-1:]<by[:,:-1],axis=1).tolist()
    assert gates==target['gates'] and all(gates)==target['joint']
    _,run,station,t,y,p=raw_worst;assert (int(worst['run']),float(worst['station']))==(run,station)==(target['worst']['run'],target['worst']['station'])
    for v,name in [(t,'time'),(y,'observed'),(p,'forecasts')]:assert np.array_equal(v,worst[name])
    print(json.dumps(dict(runs=50,distinct_hydraulic_histories=len(clocks),curves=num,forecast_samples=component,metrics=by.tolist(),gates=gates,worst=[run,station,float(raw_worst[0]),len(t)],maximum_metric_difference=deviation),sort_keys=True))
if __name__=='__main__':verify(*sys.argv[1:6])
