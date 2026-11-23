"""Recount all locked predictions from the raw corrected release using decimal logarithms."""
import base64, collections, csv, hashlib, io, json, math, struct, sys, urllib.request, zipfile, zlib
from decimal import Decimal as D, localcontext
from pathlib import Path
def hashed(b):return hashlib.sha256(b).hexdigest()
def rms(values):return (sum(v*v for v in values)/D(len(values))).sqrt()
def load_trajectory(z,c,s):
    with z.open(f'Data_Corrected/Camera{c}/TimeData/{s}.csv') as f:
        rows=csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig'));n=0;out=[]
        for r in rows:
            n+=1;assert int(r['frame_no'])==n;h=D(r['bbox_heigth']);assert h>0;out.append(h)
    return out
def distribution(xs):
    counts=sorted(collections.Counter(xs).items());n=len(xs)
    def select(j):
        k=(j*n+19)//20;acc=0
        for v,count in counts:
            acc+=count
            if acc>=k:return v
        raise AssertionError('unreachable quantile')
    med=select(10);log={v:(v/med).ln() for v,c in counts}
    return [(log[v],c) for v,c in counts],[log[select(j)] for j in range(1,20)],[log[v] for v in xs]
def transport(a,b):
    n=sum(c for _,c in a);m=sum(c for _,c in b)
    l=[[v,c*m] for v,c in a];r=[[v,c*n] for v,c in b];i=j=0;cost=D(0)
    while i<len(l) and j<len(r):
        mass=min(l[i][1],r[j][1]);cost+=mass*(l[i][0]-r[j][0])**2
        l[i][1]-=mass;r[j][1]-=mass;i+=int(l[i][1]==0);j+=int(r[j][1]==0)
    assert i==len(l) and j==len(r)
    return (cost/D(n*m)).sqrt()
def main():
    base=Path(__file__).parent
    p=json.loads((base/'normalized-protocol.json').read_bytes())
    scores=json.loads(zlib.decompress(base64.b85decode((base/'held-results.b85.txt').read_bytes().strip())))
    raw=zlib.decompress(base64.b85decode((base/'held-forecasts.b85.txt').read_bytes().strip()))
    assert hashed(raw)==scores['lock_sha256']=='85553b37821788217503851ea1c71ad373f6056451c94e6d00b77a9e5e17d19c'
    lock=json.loads(raw);orig=lock['forecasts'];ids=p['held'];roles=list(p['roles'])
    assert len(ids)==24 and set(ids)==set(orig)==set(scores['movies']) and len(roles)==8
    request=urllib.request.Request('https://zenodo.org/records/18896271/files/Data_Corrected.zip?download=1',headers={'User-Agent':'Independent decimal 72 paired-camera archive readback'})
    with urllib.request.urlopen(request,timeout=90) as f:body=f.read(20343113)
    assert len(body)==20343112 and hashed(body)==p['archive']['sha256']
    z=zipfile.ZipFile(io.BytesIO(body));drifts=[];metric={k:[] for k in roles};worst={};source_n=target_n=0
    for s in ids:
        x=load_trajectory(z,1,s);y=load_trajectory(z,2,s);source_n+=len(x);target_n+=len(y)
        a,qa,xx=distribution(x);b,qb,yy=distribution(y)
        so=scores['movies'][s];assert so['source_n']==len(x) and so['target_n']==len(y)
        assert len(so['target_log_quantiles'])==19;drifts.extend(abs(v-D(str(w))) for v,w in zip(qb,so['target_log_quantiles']))
        drifts.append(abs(transport(a,b)-D(str(so['whole_empirical_w2']))))
        drifts.append(abs(rms([vx-vy for vx,vy in zip(xx,yy)])-D(str(so['ordinal_common_prefix_rms']))))
        for k in roles:
            forecast=orig[s][k];assert hashed(struct.pack('<19d',*forecast))==lock['float64_sha256'][s][k]
            err=[D.from_float(float(v))-t for v,t in zip(forecast,qb)]
            value=rms(err);metric[k].append(value)
            drifts.append(abs(value-D(str(so['rms'][k]))))
            j=max(range(19),key=lambda j:abs(err[j]))
            if k not in worst or abs(err[j])>worst[k][0]:worst[k]=[abs(err[j]),s,(j+1)*5]
        drifts.extend(abs(u-D(str(v))) for u,v in zip(qa,orig[s]['common_support']))
    means={k:sum(a)/len(a) for k,a in metric.items()}
    wins={k:sum(x<y for x,y in zip(metric['common_support'],a)) for k,a in metric.items()}
    for k in roles:
        drifts.append(abs(means[k]-D(str(scores['mean_rms'][k]))))
        assert worst[k][1:]==[scores['worst_by_role'][k]['movie'],scores['worst_by_role'][k]['percentile']]
    gate=all(means['common_support']<means[k] for k in roles if k!='common_support') and min(wins['affine'],wins['multifeature'])>=13
    assert wins==scores['wins'] and gate==scores['pass'] and max(drifts)<D('1e-12')
    o={'movies':len(ids),'source_rows':source_n,'target_rows':target_n,'forecast_bytes':len(raw),'forecasts':192,'coordinate_errors':3648,'complete_W2':24,'ordinal_RMS':24,'float_crosschecks':len(drifts),'max_abs_discrepancy':str(max(drifts)),'pass':gate,'wins':wins,'mean':{k:str(v) for k,v in means.items()},'worst_common_support':[str(v) for v in worst['common_support']]}
    print('INDEPENDENT',json.dumps(o,sort_keys=True))
if __name__=='__main__':
    with localcontext() as ctx:ctx.prec=64;main()
