"""Independent stored-forecast and original HT2 voltage receiver. Uses stdlib scalar operations only."""
import base64,bisect,hashlib,io,json,math,pathlib,statistics,tarfile,urllib.request,zlib,zipfile
from decimal import Decimal,localcontext
ROOT=pathlib.Path(__file__).resolve().parent
H=lambda b:hashlib.sha256(b).hexdigest()
def vec(a):return [Decimal.from_float(float(x)) for x in a]
def interp(ts,vs,t):
    i=bisect.bisect_left(ts,t)
    if i<len(ts) and t==ts[i]:return vs[i]
    assert 0<i<len(ts)
    return vs[i-1]+(vs[i]-vs[i-1])/(ts[i]-ts[i-1])*(t-ts[i-1])
def truth(tar,row):
    b=tar.read(row['path']);assert H(b)==row['sha256']
    s=b.decode('utf-16' if b[:2] in (b'\xff\xfe',b'\xfe\xff') else 'latin-1')
    it=iter(s.splitlines())
    for ln in it:
        k=ln.replace('#','').replace(' ','').lower()
        if k.startswith('time/ms;detector/v'):break
    else:raise AssertionError('column identity')
    ts=[];vs=[]
    for ln in it:
        if not ln.strip():continue
        t,v=ln.split(';')[:2];ts.append(float(t.replace(',','.')));vs.append(float(v.replace(',','.')))
    assert all(x<y for x,y in zip(ts,ts[1:])) and len(ts)==row['samples'] and len(vs)==len(ts)
    base=statistics.median([x for t,x in zip(ts,vs) if -300<=t<=-10])
    raw=[interp(ts,vs,p*10.) for p in range(801)]; centered=[x-base for x in raw]
    scale=math.sqrt(math.fsum(a*a for a in centered)/801)
    assert scale>1e-12
    return raw,base,[a/scale for a in centered]
def main():
    import struct
    pr=(ROOT/'protocol.json').read_bytes();rr=(ROOT/'roster.json').read_bytes()
    spec=json.loads(pr);rows=json.loads(rr);fc=json.loads((ROOT/'forecast-lock.json').read_bytes())
    assert len(rows)==18 and H(rr)==spec['roster_sha256']==fc['roster'] and H(pr)==fc['protocol'] and fc['shape']==[18,9,801]
    b=zlib.decompress(base64.b85decode((ROOT/'forecasts.b85').read_bytes().strip()))
    assert len(b)==18*9*801*8==fc['bytes'] and H(b)==fc['sha256']
    arms=[]
    for i in range(18):
        sample=[]
        for j in range(9):
            k=(9*i+j)*6408;chunk=b[k:k+6408]
            assert H(chunk)==fc['role_digests'][i][j]
            sample.append(struct.unpack('<801d',chunk))
        arms.append(sample)
    assert [r['target']['sha256'] for r in rows]==[q['target'] for q in fc['fit']]
    pub=spec['source_archive'];url='https://www.radar-service.eu/radar/api/datasets/UTBafcXGwtpmQxvG/download'
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'public-quartz-independent-receiver/1.0'}),timeout=120) as f:packed=f.read(pub['size']+1)
    assert len(packed)==pub['size'] and H(packed)==pub['sha256'] and hashlib.md5(packed).hexdigest()==pub['md5']
    reference=json.loads((ROOT/'scores.json').read_bytes());metrics=[];worst=None; groups={}
    with tarfile.open(fileobj=io.BytesIO(packed),mode='r:*') as envelope:
        member=envelope.extractfile('10.35097-1215/data/dataset/Quartz_thermaldiffusivity_low_high_T.zip').read()
    assert H(member)=='3a7c6a447cad4d7eea0f28934c90dd682e12ba1cb60708bba782ff5c9d5a5eb2'
    with localcontext() as ctx,zipfile.ZipFile(io.BytesIO(member)) as tar:
        ctx.prec=55
        for i,(row,arm) in enumerate(zip(rows,arms)):
            raw,base,t=truth(tar,row['target']); target=vec(t);scores=[]
            for j,p in enumerate(arm):
                res=[a-b for a,b in zip(vec(p),target)]
                scores.append((sum(x*x for x in res)/801).sqrt())
                if j==0:
                    for g,e in enumerate(res):
                        if worst is None or abs(e)>worst[0]:worst=abs(e),i,g,raw[g],base,t[g],p[g]
            metrics.append(scores)
            group=(row['direction'],min((25,50,99),key=lambda z:abs(z-row['target']['temp'])))
            groups.setdefault(group,[]).append(scores)
        assert len(groups)==6 and all(len(x)==3 for x in groups.values())
        bygroup=[[sum(a)/3 for a in zip(*sc)] for sc in groups.values()]
        avg=[sum(x)/6 for x in zip(*bygroup)]
        wins=sum(all(x[0]<v for v in x[1:]) for x in bygroup);gate=wins>=5 and all(avg[0]<v for v in avg[1:])
        compare=lambda left,right:max(abs(float(x)-float(y)) for x,y in zip(left,right))
        delta=max([compare(avg,reference['means'])]+[compare(x,y) for x,y in zip(bygroup,reference['groups'])]+[compare(x,y) for x,y in zip(metrics,reference['shots'])])
        assert delta<2e-12 and wins==reference['group_wins'] and gate==reference['joint']
    _,i,g,raw,base,t,p=worst;w=reference['worst']
    assert rows[i]['target']['path']==w['shot'] and g==w['point'] and abs(raw-w['raw_V'])<2e-12 and abs(base-w['baseline_V'])<2e-12 and abs(t-w['target'])<2e-12 and abs(p-w['all_roles'][0])<2e-12
    print(json.dumps(dict(original_sha256=H(packed),forecast_sha256=H(b),verified_forecasts=162,scalar_residuals=18*9*801,summary_cells=18*9+6*9+9,maximum_absolute_metric_disagreement=delta,means=[float(x) for x in avg],group_wins=wins,joint=gate,worst=[rows[i]['target']['path'],g*10,raw,base,t,p],future_cube_records_opened=0),sort_keys=True))
if __name__=='__main__':main()
