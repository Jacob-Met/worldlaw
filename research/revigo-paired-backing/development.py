from __future__ import annotations

import hashlib
import itertools
import json
import math
import statistics
from pathlib import Path

DEV = ('01C', '04C', '09C', '11C')
FINAL = ('02C', '03C', '05C', '06C', '10C', '12C', '13C', '14C')
GROUPS = ('01','02','03','04','05','06','09','10','11','12','13','14')
EPS = 1e-12

def inverse_surface(v):
    return (v - .04) / (.96 * .51 + .49 * (v - .04))

def surface(v):
    return .04 + .96 * .51 * v / (1 - .49 * v)

def slab(g, k, s, thickness=1.0):
    m = math.sqrt(max(0.0,k*(k+2*s)))
    weight = thickness if m<EPS else math.tanh(m*thickness)/m
    return ((1-(k+s)*weight)*g+s*weight) / (1+(k+s)*weight-s*weight*g)

def distance(x,y):
    return math.sqrt(sum((a-b)**2 for a,b in zip(x,y))/len(x))

def vectorfit(residual, starts):
    # Damped Gauss–Newton on log optical depths. All 2×2/4×4 systems use pivoting.
    def loss(v):
        return sum(x*x for x in v)
    def solve(a,b):
        n=len(b)
        for j in range(n):
            h=max(range(j,n),key=lambda i:abs(a[i][j]))
            a[j],a[h]=a[h],a[j]; b[j],b[h]=b[h],b[j]
            div=a[j][j]
            if abs(div)<1.e-23: raise ArithmeticError('singular')
            for i in range(j+1,n):
                factor=a[i][j]/div
                for k in range(j+1,n): a[i][k]-=factor*a[j][k]
                b[i]-=factor*b[j]
        for j in reversed(range(n)):
            b[j]=(b[j]-sum(a[j][i]*b[i] for i in range(j+1,n)))/a[j][j]
        return b
    best=None
    for seed in starts:
        u=[math.log(v) for v in seed]; lam=.001
        for step in range(75):
            pars=[math.exp(v) for v in u];r=residual(pars);total=loss(r)
            if best is None or total<best[0]: best=(total,pars)
            cols=[]
            for j in range(len(u)):
                shifted=pars[:];shifted[j]*=math.exp(.0001)
                rr=residual(shifted);cols.append([(b-a)/.0001 for a,b in zip(r,rr)])
            g=[sum(a*b for a,b in zip(col,r)) for col in cols]
            h=[[sum(a*b for a,b in zip(l,rj)) for rj in cols] for l in cols]
            for j in range(len(u)): h[j][j]+=lam*(h[j][j]+1e-7)
            try: shift=solve(h,[-v for v in g])
            except ArithmeticError: break
            trial=[max(-16.,min(8.,v+max(-3.,min(3.,delta)))) for v,delta in zip(u,shift)]
            new=loss(residual([math.exp(v) for v in trial]))
            if new<total:
                u=trial; lam=max(1e-8,lam/3)
                if abs(total-new)<1e-13: break
            else:
                lam*=5
                if lam>1e9: break
        end=[math.exp(v) for v in u];score=loss(residual(end))
        if score<best[0]:best=(score,end)
    return best

def read(root, allowed):
    p=Path(root);raw=(p/'spectra').read_bytes()
    assert hashlib.sha256(raw).hexdigest()=='7cd24814f5d4bc73d012013d637de5d5d47b627ce859efa97b2e7f1a7bc010db'
    recipes={}
    for row in (p/'design').read_text().splitlines():
        key,mix=row.split('\t');names,pcts=mix.split('|')
        recipes[key]={n:float(v)/100 for n,v in zip(names.split('-'),pcts.split('-')) if float(v)>0}
    curves={}
    for row in raw.splitlines()[1:]:
        lab,v=row.split(b'\t',1);key,ch=lab.decode().rsplit('_',1)
        if not allowed(key,ch):continue
        curves.setdefault(key,{})[ch]=[float(a)/100 for a in v.split(b'\t')]
    return recipes,curves

def optical_fit(recipes,curves):
    table={}
    for l in range(31):
        def error(ids, mixpars):
            out=[]
            for key in ids:
                k,s=mixpars(key)
                for base,coat in [('b','ob'),('w','ow')]:
                    estimate=surface(slab(curves[key][base][l],k,s))
                    out.append(estimate-curves[key][coat][l])
            return out
        anchors=['07A','07C','07D','07E','07F']
        def anchor_res(p):
            def pair(key):
                w=recipes[key].get('ZincWhite',0)
                return w*p[0]+(1-w)*p[2],w*p[1]+(1-w)*p[3]
            return error(anchors,pair)
        _,anchor=vectorfit(anchor_res,[(.02,3.,2.,.05),(.1,.7,4.,.25)])
        for g in GROUPS:
            pig=next(iter(recipes[g+'A']))
            ids=[key for key,rec in recipes.items() if key in curves and key[:2]==g and pig in rec and set(rec).issubset({pig,'ZincWhite','BoneBlack'})]
            assert len(ids)>=2
            def colored(p,key):
                c=recipes[key];w=c.get('ZincWhite',0);b=c.get('BoneBlack',0)
                return c[pig]*p[0]+w*anchor[0]+b*anchor[2],c[pig]*p[1]+w*anchor[1]+b*anchor[3]
            res=lambda p:error(ids,lambda key:colored(p,key))
            _,params=vectorfit(res,[(.12,1.0),(4.,.05)])
            table[g,l]=(anchor,params,pig)
    return table

def pigment_law(table,recipes,key):
    out=[]
    for l in range(31):
        an,pa,pig=table[key[:2],l];rec=recipes[key]
        c,w,b=rec.get(pig,0),rec.get('ZincWhite',0),rec.get('BoneBlack',0)
        assert abs(c+w+b-1)<.002
        out.append((c*pa[0]+w*an[0]+b*an[2],c*pa[1]+w*an[1]+b*an[3]))
    return out

def scalar_thickness(gb,black,optics):
    def cost(logd):
        thick=math.exp(logd)
        return sum((surface(slab(g,k,s,thick))-b)**2 for g,b,(k,s) in zip(gb,black,optics))
    grid=[i/4 for i in range(-40,41)]
    j=min(range(len(grid)),key=lambda i:cost(grid[i]))
    lo,hi=grid[max(0,j-1)],grid[min(len(grid)-1,j+1)]
    for _ in range(34):
        x=(2*lo+hi)/3;y=(lo+2*hi)/3
        if cost(x)<=cost(y):hi=y
        else:lo=x
    return math.exp((lo+hi)/2)

def empirical(recipes,train,key,observed,scale):
    # A within-pigment local average of measured backing gaps, conditional on the
    # entire black-backed spectrum and composition. No held white enters weights.
    pig=next(iter(recipes[key[:2]+'A']))
    c=recipes[key];scores=[]
    for i,v in train.items():
        if i[:2]!=key[:2] or i==key or pig not in recipes[i]:continue
        delta=sum((c.get(k,0)-recipes[i].get(k,0))**2 for k in set(c)|set(recipes[i]))
        metric=delta + (distance(v['ob'],observed)/scale)**2
        scores.append((1/(.015+metric)**1.5,v))
    if not scores: return list(observed)
    total=sum(w for w,_ in scores)
    return [max(0.,min(1.,b+sum(w*(v['ow'][l]-v['ob'][l]) for w,v in scores)/total)) for l,b in enumerate(observed)]

def predict(key,rec,raw,table,train):
    gb,gw,black=(raw[c] for c in ('b','w','ob'));params=pigment_law(table,rec,key)
    fixed=[surface(slab(g,k,s)) for g,(k,s) in zip(gw,params)]
    fixb=[surface(slab(g,k,s)) for g,(k,s) in zip(gb,params)]
    scale=scalar_thickness(gb,black,params)
    shared=[surface(slab(g,k,s,scale)) for g,(k,s) in zip(gw,params)]
    spectral=[];flags=[]
    for i,(k,s) in enumerate(params):
        a=1+k/s;g=gb[i];gw_i=gw[i];b=inverse_surface(black[i])
        limit=s/(s+k+math.sqrt(k*(k+2*s)))
        if abs(limit-g)<1e-7:
            val=fixed[i];flag='unidentified'
        elif (b-g)/(limit-g)<=0:
            val=surface(gw_i);flag='zero_depth_projection'
        elif (b-g)/(limit-g)>=1:
            val=surface(limit);flag='infinite_depth_projection'
        else:
            n=1-a*(b+g)+b*g;h=b-g
            den=n+(a-gw_i)*h
            if abs(den)<1e-10:
                val=fixed[i];flag='numerical_fallback'
            else:
                val=surface((h+(n-a*h)*gw_i)/den);flag='interior'
        spectral.append(max(0.,min(1.,val)));flags.append(flag)
    return {'spectral_thickness_eliminated':spectral,'all_band_common_thickness':shared,'nominal_author_family':fixed,'nominal_plus_measured_black_residual':[max(0.,min(1.,v+b-fb)) for v,b,fb in zip(fixed,black,fixb)],'copy_measured_black':black,'empirical_local_gap':empirical(rec,train,key,black,.20)}, {'common_d':scale,'physical_branch_by_wavelength':flags}

def development(root):
    rec,train=read(root,lambda k,c:k not in DEV and k not in FINAL)
    assert len(train)==72
    rec,valid=read(root,lambda k,c:k in DEV)
    model=optical_fit(rec,train)
    result={'rows':{},'per_arm':{},'source_course':'72 train + 4 development only; 8 final remain sealed','table_ranges':{}}
    for key in DEV:
        scores={}
        pred,diag=predict(key,rec,valid[key],model,train)
        for name,vector in pred.items():
            err=[v-t for v,t in zip(vector,valid[key]['ow'])]
            j=max(range(31),key=lambda l:abs(err[l]))
            scores[name]={'rmse':distance(vector,valid[key]['ow']),'worst':[400+10*j,vector[j],valid[key]['ow'][j],err[j]]}
        result['rows'][key]={'scores':scores,'diagnostics':diag,'registered_predictions':pred,'truth':valid[key]['ow']}
    names=next(iter(result['rows'].values()))['scores']
    for n in names:
        a=[v['scores'][n]['rmse'] for v in result['rows'].values()]
        result['per_arm'][n]={'mean_equal_film':statistics.mean(a),'worst_film':max(a)}
    print(json.dumps(result,sort_keys=True),flush=True)
