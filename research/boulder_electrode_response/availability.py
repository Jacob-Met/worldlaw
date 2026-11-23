"""Check only clocks, marker tokens and eligible window counts. Never convert field values here."""
import datetime as dt, hashlib, json, os, pathlib, re, urllib.parse, urllib.request
BASE=pathlib.Path(__file__).resolve().parent
P=json.loads((BASE/'protocol.json').read_bytes())
ROOT=pathlib.Path(os.environ.get('TMPDIR','/tmp'))/'bou-official-e-b-archive'
ROOT.mkdir(exist_ok=True)
MISSING={b'99999.99',b'99999.00',b'99999.0',b'99999',b'88888.88',b'88888.00',b'88888.0',b'88888',b'-99999.99',b'-99999.00',b'-99999',b'NaN',b'nan',b'null'}
def fetch(date,kind,length=86400):
    elements=('E-N','E-E') if kind=='E' else ('X','Y')
    params=dict(id='BOU',elements=','.join(elements),type='variation',sampling_period='1',format='iaga2002',starttime=date+'T00:00:00Z',endtime=date+'T23:59:59Z')
    url='https://geomag.usgs.gov/ws/data/?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={'User-Agent':'Boulder-obs-observatory-data-study/1.0','Accept-Encoding':'identity'})
    with urllib.request.urlopen(req,timeout=80) as response:
        assert response.status==200
        body=response.read(40_000_001);assert len(body)<40_000_001
    (ROOT/(date+'-'+kind+'.iaga')).write_bytes(body)
    return body
def parse(date,kind,body,convert=False):
    lines=body.splitlines();j=next(j for j,x in enumerate(lines) if x.lstrip().startswith(b'DATE '))
    hdr=lines[:j];expected=[b'BOUE-N',b'BOUE-E'] if kind=='E' else [b'BOUX',b'BOUY']
    assert lines[j].split()[3:5]==expected and any(b'1-second' in x for x in hdr)
    assert any(b'variation' in x.lower() for x in hdr) and any(b'Boulder' in x for x in hdr)
    rows=[];missing=[0]*21;count=0;totalbad=0
    day=dt.date.fromisoformat(date).timetuple().tm_yday
    for ln in lines[j+1:]:
        if not ln.strip():continue
        tok=ln.split();i=count
        assert len(tok)>=5 and tok[0].decode()==date and int(tok[2])==day and i<86400
        h,m,s=tok[1].split(b':');sf=s.split(b'.')
        assert len(sf)<=2 and (len(sf)==1 or set(sf[1])<={48}) and 3600*int(h)+60*int(m)+int(sf[0])==i
        valid=not any(x in MISSING for x in tok[3:5])
        if not valid:
            totalbad+=1
            if i//4096<21:missing[i//4096]+=1
        if convert:
            rows.append([float(z) for z in tok[3:5]] if valid else [0.,0.])
        count+=1
    assert count==86400,(date,kind,count)
    return {'date':date,'kind':kind,'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'rows':count,'missing_rows':totalbad,'valid_windows':[i for i,c in enumerate(missing) if c==0]},rows
def main():
    out={}
    for d in P['dev']+P['held']:
        out[d]={}
        for k in ['B','E']:
            b=fetch(d,k);x,_=parse(d,k,b,False);out[d][k]=x;print('MASK',json.dumps(x,sort_keys=True),flush=True)
        ids=sorted(set(out[d]['B']['valid_windows'])&set(out[d]['E']['valid_windows']))
        out[d]['eligible']=ids;print('ELIGIBLE',d,len(ids),flush=True)
    ok=all(len(v['eligible'])>=12 for v in out.values())
    print('MASK_RESULT',json.dumps({'qualified':ok,'dates':out,'raw_values_decoded':0},sort_keys=True,separators=(',',':')),flush=True)
if __name__=='__main__':main()
