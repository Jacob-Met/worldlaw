"""Independent scalar recount of every locked estimate against the deposited CSV."""
import csv
import hashlib
import io
import json
import math
import struct
import zipfile

LEVELS={'1.36':('FIG4_Transmission_b_136e-2um.csv','1785f6ee333f3799363b75f575cd713b629131f7f9e2a2f5e5f7142761f455a0'),
        '68.0':('FIG4_Transmission_d_68um.csv','ae848ffde0f024dc204e70f658585f2c4b90929a87514c067c2e465653add2a7')}
ARMS={'equal','smooth_reference','transverse_gain','transverse_additive','transverse_ratio',
      'cross_level_affine','local_transverse_affine','donor_difference','fixed_frequency_operator',
      'registered_operator','donor_consensus','nonlinear_kernel'}
CALS={'equal','smooth_reference','transverse_gain','transverse_additive','transverse_ratio','cross_level_affine','local_transverse_affine'}
PRIMARY='donor_consensus'

def norm(xs):
    return math.sqrt(math.fsum(x*x for x in xs))

def verify(archive_bytes,forecast_bytes,result):
    digest=lambda b:hashlib.sha256(b).hexdigest()
    assert digest(archive_bytes)=='1dbe6a6e5c5a86e73862e32a9606bbf062d51e98f82df710d2b82ef7376f0caf'
    assert digest(forecast_bytes)==result['prediction_sha256']
    largest=0.;count=0;totals={};tails={};bc={};no_dup=True
    def check(x,y):
        nonlocal largest,count
        largest=max(largest,abs(x-y));count+=1
        if not math.isclose(x,y,rel_tol=4e-13,abs_tol=4e-15):
            raise ValueError(f'Scalar recount mismatch {x} {y}')
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as src,zipfile.ZipFile(io.BytesIO(forecast_bytes)) as est:
        registry=json.loads(est.read('registry.json'))
        names={f'{lv}/{arm}.f64' for lv in LEVELS for arm in ARMS}
        assert set(est.namelist())==names|{'registry.json'} and len(est.namelist())==25
        assert set(registry['members'])==names and registry['target_columns_decoded']==0
        for lv,(name,pin) in LEVELS.items():
            raw=src.read(name)
            assert digest(raw)==pin
            reader=csv.reader(io.StringIO(raw.decode('ascii')))
            head=next(reader);assert head[2]=='Transmission_180 deg(a.u.)'
            rows=[list(map(float,r)) for r in reader]
            assert len(rows)==751 and all(len(r)==5 for r in rows)
            f,x,y,u,v=zip(*rows);band=[i for i,t in enumerate(f) if 400<=t<=600];assert len(band)==251
            yy=norm(y);yb=norm([y[i] for i in band]);totals[lv]={};bc[lv]={};tails[lv]={}
            for arm in sorted(ARMS):
                key=f'{lv}/{arm}.f64';b=est.read(key);assert digest(b)==registry['members'][key]
                p=struct.unpack('<751d',b);e=[pi-yi for pi,yi in zip(p,y)];ref=result['scores'][lv][arm]
                w=max(range(751),key=lambda i:abs(e[i]));q=sorted(abs(t) for t in e);ix=.95*750;ql=math.floor(ix);p95=q[ql]+(ix-ql)*(q[ql+1]-q[ql])
                totals[lv][arm]=norm(e)/yy;bc[lv][arm]=norm([e[i] for i in band])/yb
                for key,a in [('whole_nrmse',totals[lv][arm]),('band_nrmse',bc[lv][arm]),('mae',math.fsum(map(abs,e))/751),('p95_abs',p95)]:check(a,ref[key])
                rr=ref['worst'];assert rr['row']==w
                for key,a in [('freq',f[w]),('t0',x[w]),('t90',u[w]),('t270',v[w]),('target',y[w]),('prediction',p[w]),('signed_error',e[w])]:check(a,rr[key])
                tails[lv][arm]=[w,e[w]]
            # Direct least-squares residual; this differs from the producer's determinant expression.
            resid=[]
            for x0,y0,u0,v0 in zip(x,y,u,v):
                den=x0*x0+u0*u0
                g=(x0*y0+u0*v0)/den if den else 0.
                resid.append(math.hypot(y0-g*x0,v0-g*u0))
            rr=result['identifiability'][lv];check(norm(resid)/math.sqrt(751),rr['common_gain_min_residual_rms_au'])
            im=max(range(751),key=resid.__getitem__);w=rr['worst_common_gain_witness'];assert w[0]==im
            for a,b in zip([f[im],resid[im],x[im],y[im],u[im],v[im]],w[1:]):check(a,b)
            dup=[n for n,a in [('forward',x),('transverse_forward',u),('transverse_reverse',v)] if a==y]
            assert dup==rr['target_exact_duplicate_of'];no_dup &= not dup
            assert [sum(t<=0 for t in a) for a in (x,y,u,v)]==rr['nonpositive_counts']
    means={a:sum(totals[l][a] for l in LEVELS)/2 for a in ARMS}
    band_means={a:sum(bc[l][a] for l in LEVELS)/2 for a in ARMS}
    for a,value in means.items():check(value,result['paired_mean_whole_nrmse'][a])
    gates={'mean_full_better_than_all_comparators':all(means[PRIMARY]<m for a,m in means.items() if a!=PRIMARY),
           'each_full_better_than_all_calibrated':all(totals[l][PRIMARY]<totals[l][a] for l in LEVELS for a in CALS),
           'mean_methods_band_no_worse_than_all_calibrated':all(band_means[PRIMARY]<=band_means[a] for a in CALS),
           'no_held_target_exact_duplicate':bool(no_dup)}
    assert gates==result['gates'] and all(gates.values())==result['joint']
    return {'all_vectors':24,'scalar_forecasts_checked':24*751,'metric_and_worst_checks':count,
            'largest_metric_delta':largest,'gates':gates,'joint':all(gates.values()),'worst_rows':tails}
