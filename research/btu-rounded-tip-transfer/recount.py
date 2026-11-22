"""Reconstruct all errors and all seven predictions from the original plaintext, using the standard library."""
import argparse
import hashlib
import json
import math
import statistics
import zipfile
from pathlib import Path

ARMS = ['rounded_carry','nominal_bpm','rounded_secant','rounded_recent_trend','flat_full_difference','history_ridge','flat_tilt_bpm']
TRIPS = ('natural','tripped')
ANGLES = (0,5,10,20)
mean = statistics.fmean


def sub(a,b):
    return [x-y for x,y in zip(a,b)]


def plus(a,b):
    return [x+y for x,y in zip(a,b)]


def scale(a,x):
    return [v*x for v in a]


def center(a):
    return [v-mean(a) for v in a]


def inner(a,b):
    return sum(x*y for x,y in zip(a,b))


def rms(a):
    return math.sqrt(mean(v*v for v in a))


def solve(rows, outputs):
    mat = [[sum(r[i]*r[j] for r in rows) + (2. if i==j else 0.) for j in range(3)] for i in range(3)]
    rhs = [sum(r[i]*o for r,o in zip(rows,outputs)) for i in range(3)]
    for i in range(3):
        k=max(range(i,3),key=lambda j:abs(mat[j][i]))
        mat[k],mat[i]=mat[i],mat[k]
        rhs[k],rhs[i]=rhs[i],rhs[k]
        v=mat[i][i]
        mat[i]=[a/v for a in mat[i]]
        rhs[i]/=v
        for j in range(3):
            if i==j:
                continue
            a=mat[j][i]
            mat[j]=sub(mat[j],scale(mat[i],a))
            rhs[j]-=a*rhs[i]
    return rhs


def read(z,code,p):
    bn=f'{code}p{p}.txt'
    body=z.read(f'Processed_data/{code}/{bn}')
    rows=[list(map(float, line.split())) for line in body.decode('ascii').splitlines() if line.strip()]
    assert len(rows)==21 and all(len(r)==(4 if code.endswith('R') else 8) for r in rows)
    return rows


def run(z, directory, p):
    preds=json.loads((directory/f'forecast-{p}.json').read_bytes())
    scores=json.loads((directory/f'score-{p}.json').read_bytes())
    assert preds['arms']==ARMS and p==preds['target_index']
    basename='OnethirdOctaveband_freq.txt'
    freq=list(map(float,z.read(next(t for t in z.namelist() if t.split('/')[-1]==basename)).split()))
    raw={}
    for trip in TRIPS:
        for shape in ('F','R'):
            for k in range(1,p+1):
                rows=read(z,'NACA0012'+('T' if trip=='tripped' else '')+shape,k)
                for a,i in zip(ANGLES,[0,2,4,7] if shape=='F' else [0,1,2,3]):
                    raw[trip,shape,a,k]=[r[i] for r in rows]
    evidence={}
    for domain,index in [('primary',list(range(8,19))),('all21',list(range(21)))]:
        grid=[freq[i] for i in index]
        x=center([math.log10(f) for f in grid])
        den=inner(x,x)
        tilt=lambda y:scale(x,inner(x,center(y))/den)
        q=lambda y:sub(center(y),tilt(y))
        rate=lambda j:math.log10(j/(j-1))
        def spec(t,s,a,k):
            return [raw[t,s,a,k][i] for i in index]
        def changes(t,a,k):
            r1=center(spec(t,'R',a,k-1));r2=center(spec(t,'R',a,k-2))
            return [scale(sub(r1,r2),rate(k)/rate(k-1)),
                    center(sub(spec(t,'F',a,k),spec(t,'F',a,k-1))),
                    scale(x,61.*rate(k))]
        features,labels=[],[]
        for t in TRIPS:
            for a in ANGLES[1:]:
                for k in range(3,p):
                    features.extend(zip(*changes(t,a,k)))
                    labels.extend(sub(center(spec(t,'R',a,k)),center(spec(t,'R',a,k-1))))
        beta=solve(features,labels)
        score=scores[domain]
        err_pred,err_recon,max_error=0.,0.,0.
        checks=0; worst={}; summary={}
        cells={}
        for t in TRIPS:
            for a in ANGLES:
                prior=center(spec(t,'R',a,p-1));truth=spec(t,'R',a,p)
                feature=changes(t,a,p)
                recent=[center(spec(t,'R',a,k)) for k in range(p-4,p)]
                xi=[math.log10(k) for k in range(p-4,p)]
                weights=scale(center(xi),(math.log10(p)-mean(xi))/inner(center(xi),center(xi)))
                trend=[mean(v)+inner(v,weights) for v in zip(*recent)]
                zero=[0.]*len(x)
                trial=[prior,plus(prior,feature[2] if a else zero),plus(prior,feature[0]),trend,
                       plus(prior,feature[1]),plus(prior,[inner(beta,row) for row in zip(*feature)]),
                       plus(prior,tilt(feature[1]) if a else zero)]
                saved=preds['domains'][domain]['centered_predictions'][f'{t}/{a}']
                srow=next(d for d in score['rows'] if d['trip']==t and d['angle']==a)
                assert truth==srow['raw_target']
                for idx,arm in enumerate(ARMS):
                    err_pred=max(err_pred,max(map(abs,sub(center(trial[idx]),saved[idx]))))
                    for label,proj in [('center',center),('q',q)]:
                        delta=sub(proj(trial[idx]),proj(truth));v=rms(delta)
                        err_recon=max(err_recon,abs(v-srow[label+'_rms'][arm]))
                        max_error=max(max_error,max(map(abs,sub(delta,srow[label+'_signed_error'][idx]))))
                        checks+=len(delta)
                        cells[t,a,label,arm]=v
                        key=(label,arm)
                        if key not in worst or v>worst[key]['rms']:
                            i=max(range(len(delta)),key=lambda j:abs(delta[j]))
                            worst[key]={'trip':t,'angle':a,'rms':v,'peak_signed_error_db':delta[i],'frequency_hz':grid[i],'raw_target_db':truth[i]}
        for metric in ('center','q'):
            for arm in ARMS:
                vals=[v for (t,a,m,u),v in cells.items() if a and m==metric and u==arm]
                for k,n in ((mean(vals),'mean'),(max(vals),'worst')):
                    err_recon=max(err_recon,abs(k-score[metric+'_six'][arm][n]))
        def gate(metric,arm,others,stat):
            ag=lambda u:stat([v for (t,a,m,j),v in cells.items() if a and m==metric and j==u])
            return all(ag(arm)<ag(other) for other in others)
        for met,arm,others in [('center',ARMS[-1],ARMS[:-1]),('q',ARMS[0],ARMS[2:6])]:
            for stat,func in [('mean',mean),('worst',max)]:
                assert gate(met,arm,others,func)==score[met+'_gates'][stat]
        assert max(err_pred,err_recon,max_error)<1e-9
        evidence[domain]={'signed_components':checks,'max_forecast_difference':err_pred,'max_rms_difference':err_recon,
                           'max_signed_error_difference':max_error,'worst':{m+'/'+a:v for (m,a),v in worst.items()}}
    return evidence


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('archive',type=Path)
    ap.add_argument('directory',type=Path)
    args=ap.parse_args()
    with zipfile.ZipFile(args.archive) as z:
        output={str(p):run(z,args.directory,p) for p in (6,9)}
    print(json.dumps(output,sort_keys=True,allow_nan=False))
