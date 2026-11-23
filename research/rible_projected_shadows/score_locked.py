"""Read only an already locked forecast and the immutable physical archive."""
import base64, csv, hashlib, io, json, math, struct, sys, zipfile, zlib
from collections import Counter
from pathlib import Path
from urllib.request import Request, urlopen
ROOT=Path(__file__).parent
ROLES=['common_support','ellipse','chord','horizontal_sham','constant','condition','affine','multifeature']
def sha(b):return hashlib.sha256(b).hexdigest()
def rms(v):return math.sqrt(math.fsum(x*x for x in v)/len(v))
def box(z,cam,s):
    key='Data_Corrected/Camera%d/TimeData/%s.csv'%(cam,s);h=[];last=None;rep=0
    with z.open(key) as fp:
        for i,r in enumerate(csv.DictReader(io.TextIOWrapper(fp,encoding='utf-8-sig')),1):
            assert int(r['frame_no'])==i
            x=float(r['bbox_heigth']);assert math.isfinite(x) and x>0
            h.append(x);f=tuple(r[k] for k in r if k!='frame_no')
            rep+=int(f==last);last=f
    assert h
    return h,rep
def centered(a):
    b=sorted(a);m=b[(len(b)-1)//2];return [math.log(x/m) for x in a]
def quant(a):
    b=sorted(a);return [b[(j*len(b)-1)//20] for j in range(1,20)]
def w2(a,b):
    u=sorted(a);v=sorted(b);n=len(u);m=len(v)
    i=j=last=0;acc=[]
    while i<n and j<m:
        t=min((i+1)*m,(j+1)*n)
        acc.append((t-last)*(u[i]-v[j])**2);last=t
        if t==(i+1)*m:i+=1
        if t==(j+1)*n:j+=1
    assert i==n and j==m and last==m*n
    return math.sqrt(math.fsum(acc)/(m*n))
def main(lock_path,expected_sha,outpath):
    lock_bytes=zlib.decompress(base64.b85decode(Path(lock_path).read_bytes().strip()))
    assert sha(lock_bytes)==expected_sha
    f=json.loads(lock_bytes);raw_pc=(ROOT/'normalized-protocol.json').read_bytes();p=json.loads(raw_pc)
    assert f['protocol_sha256']==sha(raw_pc) and f['archive_sha256']==p['archive']['sha256']
    assert set(f['forecasts'])==set(f['float64_sha256'])==set(f['held_source'])==set(p['held']) and len(p['held'])==24
    for s in p['held']:
        assert set(f['forecasts'][s])==set(f['float64_sha256'][s])==set(ROLES)
        for k in ROLES:
            v=f['forecasts'][s][k];assert len(v)==19 and v[9]==0 and all(map(math.isfinite,v))
            assert sha(struct.pack('<19d',*v))==f['float64_sha256'][s][k]
    url='https://zenodo.org/records/18896271/files/Data_Corrected.zip?download=1'
    with urlopen(Request(url,headers={'User-Agent':'Rible locked paired-camera receiver'}),timeout=90) as fp:b=fp.read(p['archive']['bytes']+1)
    assert len(b)==p['archive']['bytes'] and sha(b)==p['archive']['sha256']
    z=zipfile.ZipFile(io.BytesIO(b));movies={};worst={k:{'absolute':-1.} for k in ROLES}
    for s in p['held']:
        a,ra=box(z,1,s);b,rb=box(z,2,s);original=f['held_source'][s]
        assert len(a)==original['n'] and ra==original['repeat'] and sorted(Counter(a).items())==[tuple(v) for v in original['counts']]
        x,y=centered(a),centered(b);cq=quant(x);truth=quant(y);pr=f['forecasts'][s]
        assert cq==pr['common_support']
        errors={k:[v-t for v,t in zip(pr[k],truth)] for k in ROLES}
        scores={k:rms(e) for k,e in errors.items()}
        for k,e in errors.items():
            i=max(range(19),key=lambda j:abs(e[j]))
            if abs(e[i])>worst[k]['absolute']:
                worst[k]={'absolute':abs(e[i]),'movie':s,'percentile':(i+1)*5,'observed_log_ratio':truth[i],
                          'observed_raw_export':sorted(b)[((i+1)*len(b)-1)//20],'target_export_median':sorted(b)[(len(b)-1)//2],
                          'all_forecasts_log_ratio':{role:values[i] for role,values in pr.items()}}
        n=min(len(x),len(y));ordinal=rms([x[i]-y[i] for i in range(n)]);lower=w2(x,y)
        assert len(x)!=len(y) or lower<=ordinal+1e-14
        movies[s]={'source_n':len(a),'target_n':len(b),'source_repeats':ra,'target_repeats':rb,'target_log_quantiles':truth,
                   'rms':scores,'whole_empirical_w2':lower,'ordinal_common_prefix_rms':ordinal}
    mean={k:math.fsum(v['rms'][k] for v in movies.values())/24 for k in ROLES}
    wins={k:sum(v['rms']['common_support']<v['rms'][k] for v in movies.values()) for k in ROLES}
    gate=all(mean['common_support']<mean[k] for k in ROLES if k!='common_support') and min(wins['affine'],wins['multifeature'])>=13
    o={'lock_sha256':expected_sha,'protocol_sha256':sha(raw_pc),'movies':movies,'mean_rms':mean,'wins':wins,'worst_by_role':worst,'pass':gate}
    raw=json.dumps(o,separators=(',',':'),sort_keys=True,allow_nan=False).encode();Path(outpath).write_bytes(raw)
    print('RECEIVER',json.dumps({'mean_rms':mean,'wins':wins,'worst':worst['common_support'],'pass':gate},sort_keys=True),flush=True)
    print('RECEIPT',len(raw),sha(raw),flush=True)
if __name__=='__main__':main(*sys.argv[1:])
