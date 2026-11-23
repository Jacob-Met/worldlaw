"""Fixed 36-condition, 72-constraint shape screen on the released work arrays."""
from functools import lru_cache
import hashlib,itertools,json,math,sys
import numpy as np
from scipy.stats import t
from source_roles import load_archive,roster,scalar
# Products use separate blocks for each raw-moment factor. Orders here never exceed four.
LOW=[(-2,(1,1,1,3)),(1.5,(1,1,2,2)),(-1,(1,1,4)),(5,(1,2,3)),(-3,(2,2,2)),(1,(2,4)),(-1.5,(3,3))]
HIGH=[(18,(1,1,1,1)),(-36,(1,1,2)),(4,(1,3)),(15,(2,2)),(-1,(4,))]
def distinct_statistics(B):
    K=len(B)
    @lru_cache(None)
    def within(group):
        v=1
        for j in group:v=v*B[:,j-1]
        return float(np.sum(v))
    @lru_cache(None)
    def distinct(groups):
        if not groups:return 1.
        head,*tail=groups
        value=within(head)*distinct(tuple(tail))
        for j,g in enumerate(tail):
            new=tail[:j]+tail[j+1:]+[tuple(sorted(head+g))]
            value-=distinct(tuple(sorted(new)))
        return value
    def poly(terms):
        return math.fsum(c*distinct(tuple((j,) for j in factors))/math.prod(range(K-len(factors)+1,K+1)) for c,factors in terms)
    return np.array([poly(LOW),poly(HIGH)])
def point(w):
    d=w-np.mean(w);v=np.mean(d*d);assert v>0 and np.isfinite(v)
    skew=np.mean(d**3)/v**1.5;ex=np.mean(d**4)/v**2-3
    return dict(mean=float(np.mean(w)),variance=float(v),skew=float(skew),excess=float(ex),lower=float(ex-1.5*skew**2),upper=float(12-ex))
def blocks(w,K):
    # Translation leaves the contrast unchanged. Rescale once by condition-wide positive variance.
    q=w.reshape(K,-1)
    B=np.stack([(q**j).mean(axis=1) for j in range(1,5)],axis=1)
    v=point(w)['variance'];scale=np.array([v**3,v**2])
    val=distinct_statistics(B)
    jack=np.array([distinct_statistics(np.delete(B,i,axis=0)) for i in range(K)])
    se=np.sqrt((K-1)/K*np.sum((jack-jack.mean(axis=0))**2,axis=0))
    critical=float(t.ppf(1-.05/72,K-1));upper=(val+critical*se)/scale
    return dict(blocks=K,original_block_size=len(w)//K,critical=critical,margin=(val/scale).tolist(),standard_error=(se/scale).tolist(),upper_bound=upper.tolist(),flags=(upper<0).tolist(),delete_one_margin=(jack/scale).tolist(),per_block=[point(b) for b in q])
def run(filename):
    records=roster(filename);d=load_archive(filename);rows=[]
    assert len(records)==36 and all(r['count']==10000 for r in records)
    assert len({r['work_bytes_sha256'] for r in records})==36
    for meta in records:
        sig=meta['protocol'];amp=meta['amplitude'];tau=meta['duration']
        # Lookup by primitive key even when a serialized condition key is a NumPy scalar.
        group=next(m for a,m in d[sig].items() if scalar(a)==amp)
        entry=next(m for t0,m in group.items() if scalar(t0)==tau)
        a=entry['W'];raw=np.frombuffer(a.body,dtype=np.dtype(a.dtype.endian+a.dtype.kind));assert len(raw)==10000 and np.isfinite(raw).all()
        w=raw/(1.38e-23*300)
        q=point(w);rr={k:blocks(w,k) for k in (5,10,20)};ext=int(np.argmax(np.abs(w-q['mean'])))
        quant=np.quantile(w,[.01,.1,.5,.9,.99,.999],method='linear')
        rows.append(dict(meta=meta,pooled=q,grouping=rr,min_kbt=float(w.min()),max_kbt=float(w.max()),negative=int(sum(w<0)),quantiles_kbt=quant.tolist(),furthest=dict(index=ext,block=ext//1000,value_kbt=float(w[ext]),previous_and_next=w[max(0,ext-2):min(len(w),ext+3)].tolist())))
    primary=[(r['meta']['protocol'],r['meta']['amplitude'],r['meta']['duration'],side) for r in rows for i,side in enumerate(['lower','upper']) if r['grouping'][10]['flags'][i]]
    return dict(rows=rows,primary_conditional_screen_flags=primary,any_conditional_screen_flag=bool(primary),conditions=len(rows),observations=sum(r['meta']['count'] for r in rows),frozen_family_size=72,statistical_interpretation='Approximate grouped screen under the authors’ stated block independence, shared condition law and adequate jackknife-t calibration; no verified per-cycle timing or model identification.')
if __name__=='__main__':
    out=run(sys.argv[1]);open('comparison-complete.json','w').write(json.dumps(out,sort_keys=True,separators=(',',':')))
    print('PRIMARY',out['conditions'],out['observations'],out['primary_conditional_screen_flags'])
    for side in [0,1]:
        row=min(out['rows'],key=lambda r:r['grouping'][10]['upper_bound'][side])
        print('WORST_UPPER_BOUND',side,row['meta'],row['pooled'],row['grouping'][10]['margin'][side],row['grouping'][10]['upper_bound'][side],row['furthest'])
