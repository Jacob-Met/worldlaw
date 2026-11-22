"""Analytic repeat-response receiver independent of the reservoir update implementation."""
import csv
import hashlib
import json
import math
from pathlib import Path
import struct
import numpy as np


def binary_grid(path):
    b=Path(path).read_bytes()
    assert hashlib.sha256(b).hexdigest()=='4fb2c770d8d7eba4f09bb61a3466d1442af9f765b7b72e8d76141f4ec74df27d'
    pos=0;grid={}
    while pos<len(b):
        start=pos;fields={}
        while True:
            raw=b[pos:pos+80];pos+=80
            name=raw[:8].decode().strip()
            if name=='END':break
            if raw[8:10]==b'= ':
                value=raw[10:].decode().split('/')[0].strip().strip("'").strip()
                fields[name]=value
        pos=start+math.ceil((pos-start)/2880)*2880
        if fields['NAXIS']=='0':continue
        assert fields['XTENSION']=='BINTABLE' and int(fields['NAXIS1'])==12
        names=[fields['TTYPE'+str(j)].lower() for j in [1,2,3]]
        assert set(names)=={'a','stim','gamma'}
        n=int(fields['NAXIS2']);end=pos+12*n
        values=np.asarray(list(struct.iter_unpack('>fff',b[pos:end])))
        grid[int(fields['EXP'])]={name:values[:,i] for i,name in enumerate(names)}
        pos+=math.ceil(12*n/2880)*2880
    return grid


def coefficient_vectors(table,duration,lam):
    times=sorted(table);upper=next(t for t in times if t>=duration)
    lower=times[times.index(upper)-1]
    frac=(duration-lower)/(upper-lower)
    out=[]
    for exposure,f in ((lower,1-frac),(upper,frac)):
        d=table[exposure];g=d['gamma'];a=d['a'];fac=a/np.array([math.gamma(t) for t in g])
        w=(np.log(7*86400/8)/48)*fac*(1000*lam[1:,None])**g
        slow=fac*(1000/(7*86400))**g/g
        out.append(f*np.vstack((slow,w)))
    return table[lower]['stim'],out[0]+out[1]


def main():
    table=binary_grid('PerCal-a_gamma.fits')
    # Direct geometric spacing of midpoint lifetimes, in reverse order from decay-rate bins.
    lo=1/(7*86400);hi=1/8
    rate=np.r_[lo/2,lo*(hi/lo)**((np.arange(48)+.5)/48)]
    durations=(349.232727,352.939514,499.231873,799.232788)
    models=[coefficient_vectors(table,t,rate) for t in durations]
    capacity=np.maximum.reduce([k.max(axis=1) for s,k in models])
    f=np.array([70000.,100000.,150000.,200000.]);t=np.array([200.,500.,1000.,2000.,4000.,6000.])
    stim,knots=models[0]
    s=np.stack([np.interp(f,stim,line) for line in knots])
    q=s/capacity[:,None]
    h=np.exp(-rate[:,None]*t)
    ref=s.T@h
    rows=list(csv.DictReader(Path('table1-12694.csv').read_text().splitlines()))
    obs={}
    for r in rows:
        a,x,delta,alpha,g=[float(r[k]) for k in ['A_e_per_s','x0_e','delta_e','alpha','gamma']]
        obs[r['visit']]=((a*(f/x)**alpha)/(1+np.exp(-(f-x)/delta)))[:,None]*(1000/t[None,:])**g
    singles=np.sqrt(obs['11']*obs['31'])
    truth={v:o/singles for v,o in obs.items()}
    times=json.loads(Path('source-12694-actual-members.json').read_text())['visits']
    cc=np.geomspace(1,32,257);aa=np.linspace(0,1,257)
    cap={};shrink={};free={};lower_bound={};allrows=[]
    for v in truth:
        ends=np.array([float(x['EXPEND']) for x in times[v]['inputs']])
        relative=(ends-ends[0])*86400
        n=len(ends);weights=np.zeros((len(cc),len(rate),len(f)));lin=np.zeros_like(s)
        for j,when in enumerate(relative):
            component=s*np.exp(-rate[:,None]*(relative[-1]-when))
            weights+=component[None,:,:]*(1-q[None,:,:]/cc[:,None,None])**(n-1-j)
            lin+=component
        cap[v]=np.einsum('kbf,bt->kft',weights,h,optimize=True)/ref
        free[v]=lin.T@h/ref
        shrink[v]=1+aa[:,None,None]*(free[v]-1)
        lower_bound[v]=float(np.sqrt(np.mean(np.maximum(0,np.log(cap[v][0]/truth[v]))**2)))
    scores={};nabove=0;within_minimum={}
    for v in sorted(truth):
        group=[j for j in truth if j[0]!=v[0]]
        def select(family):
            loss=np.zeros(257)
            for j in group:
                loss+=((np.log(family[j])-np.log(truth[j])[None,:,:])**2).mean(axis=(1,2))
            return int(loss.argmin())
        idx=select(cap);ii=select(shrink)
        counts=sorted(set(int(j[1]) for j in group))
        arr=np.stack([np.stack([np.log(truth[j]) for j in group if int(j[1])==n]).mean(axis=0) for n in counts])
        tab=np.zeros_like(ref)
        for x,y in np.ndindex(ref.shape):
            tab[x,y]=np.exp(np.interp(int(v[1]),counts,arr[:,x,y]))
        p={'capacity':cap[v][idx],'maximum':np.ones_like(ref),'sum':free[v],'shrunken_sum':shrink[v][ii],'published_repeat_shape':tab}
        scores[v]={name:float(np.sqrt(np.mean(np.log(val/truth[v])**2))) for name,val in p.items()}
        if int(v[1])>1:
            nabove+=int((cap[v][0]>truth[v]).sum())
            within_minimum[v]=int((cap[v][0]>truth[v]).sum())
        for x,y in np.ndindex(ref.shape):
            allrows.append({'visit':v,'fluence_e':f[x],'age_s':t[y],'published_ratio':truth[v][x,y],'C1_lower_bound_ratio':cap[v][0,x,y],**{k:z[x,y] for k,z in p.items()}})
    orig=json.loads(Path('source-repeat-native-result.json').read_text())
    for v in scores:
        for k,val in scores[v].items():
            assert abs(val-orig['rows'][v]['log_rmse'][k])<1e-9,(v,k,val)
    avg={k:float(np.mean([r[k] for r in scores.values()])) for k in scores['11']}
    cert={'cells':len(allrows),'five_methods_recounted':5*len(allrows),'mean_per_visit_log_rmse':avg,'mean_per_visit_log_rmse_lower_bound_all_C_ge1':float(np.mean(list(lower_bound.values()))),'n_repeat_cells_above_observed_already_at_C1':nabove,'above_by_repeat_visit':within_minimum,'repeat_cells':sum(len(f)*len(t) for v in scores if int(v[1])>1),'per_visit_lower_bounds':lower_bound,'worst_absolute_log_cell':max(allrows,key=lambda r:abs(math.log(r['capacity']/r['published_ratio'])))}
    # Single-exposure predictions are invariant in C. Every repeated-source cell
    # already lies above its positive target at C=1, so increasing C cannot improve any.
    assert all(within_minimum[v] == len(f)*len(t) for v in within_minimum)
    cert['exact_minimum_mean_per_visit_log_rmse_for_all_C_ge1']=float(np.mean([
        np.sqrt(np.mean(np.log(cap[v][0]/truth[v])**2)) for v in scores
    ]))
    with Path('source-repeat-all-216.csv').open('w',newline='') as fp:
        writer=csv.DictWriter(fp,fieldnames=list(allrows[0]));writer.writeheader();writer.writerows(allrows)
    Path('source-repeat-analytic-certificate.json').write_text(json.dumps(cert,sort_keys=True,indent=2)+'\n')
    print(json.dumps(cert,sort_keys=True))

if __name__=='__main__':
    main()
