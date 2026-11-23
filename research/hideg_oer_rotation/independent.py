"""Independently validate stored forecasts and measurements, without importing the predictor or scorer."""
import csv, hashlib, io, json, math, pathlib, statistics, sys, zipfile

def verify(raw, forecast, score, pins):
    for b, h in zip((raw,forecast,score),pins):
        if hashlib.sha256(b).hexdigest()!=h: raise ValueError('input mismatch')
    f=json.loads(forecast); o=json.loads(score); byrole={}; byspeed={}; largest=(); deltas=[]; n=0
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        for metal in ('Au','Ir','Pt'):
            for speed in (1225,2500):
                rec=o['sweeps'][metal+str(speed)]
                pr=f['metals'][metal]['predictions'][str(speed)]
                name='src/pH10.458/{0}/pH10.458_{0}_{1:04d}rpm.tsv'.format(metal,speed)
                data=list(csv.reader(io.StringIO(z.read(name).decode('utf-8-sig')),delimiter='\t'))
                assert data[0][2]=='WE(1).Current (A)' and 1000*float(data[1][3])==f['metals'][metal]['inputs'][str(speed)]['notebook_rpm']
                y=[float(row[2])/(math.pi/16) for row in data[1:] if row]
                e=[float(row[1]) for row in data[1:] if row]
                assert e==rec['voltage'] and y==rec['observed']
                n+=len(y)
                for role, estimates in pr.items():
                    assert len(y)==len(estimates)
                    err=[a-b for a,b in zip(estimates,y)]
                    rmse=math.sqrt(statistics.fmean(x*x for x in err))
                    mae=statistics.fmean(map(abs,err))
                    deltas.extend([abs(rec['rmse'][role]-rmse),abs(rec['mae'][role]-mae)])
                    byrole.setdefault(role,[]).append(rmse)
                    byspeed.setdefault(speed,{}).setdefault(role,[]).append(rmse)
                    if role=='corrected_physics':
                        i=max(range(len(y)),key=lambda i:abs(err[i]))
                        k=(abs(err[i]),metal,speed,i,e[i],y[i])
                        if not largest or k[0]>largest[0]: largest=k
    av={k:statistics.fmean(v) for k,v in byrole.items()}
    deltas.extend(abs(av[k]-o['mean_rmse'][k]) for k in av)
    base=min((k for k in av if k!='corrected_physics'),key=av.get)
    wins=sum(a<b for a,b in zip(byrole['corrected_physics'],byrole[base]))
    gate=av['corrected_physics']<av[base] and wins>=4 and all(statistics.fmean(d['corrected_physics'])<statistics.fmean(d['notebook_equations_full']) for d in byspeed.values())
    assert base==o['strongest_control'] and wins==o['wins'] and gate==o['passed']
    w=o['worst'];assert (w['metal'],w['rpm'],w['index'],w['voltage'],w['observed'])==largest[1:]
    assert max(deltas)<1e-14
    return dict(physical_rows=n,forecast_values=n*len(av),metric_checks=len(deltas),maximum_metric_error=max(deltas),worst=largest,gate=gate)
