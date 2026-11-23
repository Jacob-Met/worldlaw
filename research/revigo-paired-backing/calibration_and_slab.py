import hashlib, json, math, statistics
from collections import defaultdict
from pathlib import Path

def sha(b):
    return hashlib.sha256(b).hexdigest()

def integrate(g, K, S, D):
    # Analytic matrix exponential of the two-flux generator.
    m = math.sqrt(K * (K + 2*S))
    if m == 0:
        v = D
    else:
        v = math.tanh(m*D) / m
    return ((1-(K+S)*v)*g + S*v) / (1+(K+S)*v-S*v*g)

def transport(B, gb, gw, a):
    n = 1-a*(B+gb)+B*gb
    h = B-gb
    den = n+(a-gw)*h
    return (h+(n-a*h)*gw)/den, den

def run(source):
    root = Path(source)
    spec = (root/'spectra').read_bytes()
    assert hashlib.sha1(b'blob '+str(len(spec)).encode()+b'\0'+spec).hexdigest()=='af106b1303dae3c389809b03ebf502ec4c637ad5'
    development = {'01C','04C','09C','11C'}
    final = {'02C','03C','05C','06C','10C','12C','13C','14C'}
    training = defaultdict(dict)
    skip = []
    for row in spec.splitlines()[1:]:
        label, body = row.split(b'\t',1)
        sample,channel = label.decode().rsplit('_',1)
        if sample in development or sample in final:
            skip.append(label.decode())
            continue
        values = [float(q) for q in body.split(b'\t')]
        assert len(values)==31 and all(math.isfinite(v) for v in values)
        training[sample][channel]=values
    assert len(training)==72 and len(skip)==48 and all(set(z)=={'b','ob','w','ow'} for z in training.values())
    audit={}
    for channel in ('b','ob','w','ow'):
        matrix=list(zip(*(v[channel] for v in training.values())))
        var=[statistics.pstdev(band) for band in matrix]
        flat=[r for b in matrix for r in b]
        audit[channel]={'raw_range':[min(flat),max(flat)],'median_between_recipe_sd_in_recorded_points':statistics.median(var),'max_between_recipe_sd':max(var),'across_recipe_median_400_550_700':[statistics.median(matrix[i]) for i in (0,15,30)]}
    summary={}
    for ch1,ch2 in [('ob','ow'),('b','w')]:
        items=[(v[ch2][k]-v[ch1][k],key,k) for key,v in training.items() for k in range(31)]
        summary[ch1+'/'+ch2]={'min':min(items),'max':max(items),'median':statistics.median(s[0] for s in items)}
    maxerr=0;count=0
    for k in (0.0,1e-5,0.01,.3,1.2,4):
        for s in (.01,.3,1.0,4.0):
            for thickness in (0.,.01,.4,2.,15.):
                for gb in (.05,.3):
                    for gw in (.6,.92):
                        pred_b=integrate(gb,k,s,thickness)
                        pred_w=integrate(gw,k,s,thickness)
                        est,den=transport(pred_b,gb,gw,1+k/s)
                        count+=1;maxerr=max(maxerr,abs(est-pred_w))
    assert maxerr<1e-8
    print(json.dumps({'source':str(root),'sha256':sha(spec),'calibration_count':len(training),'skipped_count':len(skip),'none_of_12_held_spectra_decoded':True,'channel_summary':audit,'backing_contrast':summary,'synthetic_transfer':{'count':count,'max_abs':maxerr},'source_suffix_doc':'The public plotting cell loads the indexed table but does not define the prefix o. Training summaries are empirical diagnostics.'},sort_keys=True),flush=True)
