"""Read the anonymous RADAR record and the header/clock inventory; quarantine detector amplitudes."""
import collections, hashlib, io, json, pathlib, re, subprocess, tarfile, tempfile, urllib.parse, urllib.request, zipfile
from decimal import Decimal
def emit(tag,obj): print(tag,json.dumps(obj,sort_keys=True,separators=(',',':')),flush=True)
def sha(b): return hashlib.sha256(b).hexdigest()
def fetch(u,limit):
    q=urllib.request.Request(u,headers={'User-Agent':'KIT-public-deposit-header-inventory/1.0'})
    with urllib.request.urlopen(q,timeout=120) as f:
        data=f.read(limit+1)
        assert len(data)<=limit
        emit('HTTP',[u,urllib.parse.urlsplit(f.geturl()).hostname,f.status,f.headers.get('Content-Type'),len(data),sha(data)])
        return data
with tempfile.TemporaryDirectory() as root:
    def git(*args): return subprocess.check_output(['git',*args],cwd=root)
    pin='400da010312868ec84b711ac64623c63c419d09c'
    git('init','-q')
    git('fetch','-q','--depth=1','https://github.com/ER-FIZKarlsruhe/radar-api-demo.git',pin)
    assert git('rev-parse','FETCH_HEAD').decode().strip()==pin
    client=git('show',pin+':python/radar_api_demo.py')
    assert b'def read_children(' in client and b'/children' in client
    emit('PUBLIC_CLIENT',[pin,'python/radar_api_demo.py',sha(client),len(client)])
record='UTBafcXGwtpmQxvG'
html=fetch('https://radar.kit.edu/radar/en/dataset/'+record,3000000)
md5='df726a12287749ee051eb65d7091a8b9'
assert md5.encode() in html and b'10.35097/1215' in html
src=fetch('https://www.radar-service.eu/radar/api/datasets/'+record+'/download',60000000)
assert hashlib.md5(src).hexdigest()==md5,'download must match publisher whole-archive MD5 before any members'
assert sha(src)=='cc29c01b1ef3ccfa90b56490f768d69a2dcdddcef4cde72d523e23c042cdd4fe'
emit('ARCHIVE',[len(src),sha(src),md5])
files=[]; headers=[]; extras=[]; keys=collections.Counter(); groups=collections.Counter()
# Only named physical acquisition settings, specimen IDs, and time coordinates are admitted.
ALLOWED={'identity','sample','shot','date','date_time','instrument','sensor','coating','thickness_rt/mm','thickness_t/mm','sample_temperature/°c','diameter/mm','ampl_gain','analog_filter/ms','laser_filter/mm','laser_voltage/v','beam_enlargement/mm','duration/ms','no_of_points','original_range_min/ms','original_range_max/ms'}
def inventory(path,data):
    # Keep amplitudes opaque bytes. All separators, numbers and selected header keys are ASCII or latin-1.
    if data.startswith(b'\xff\xfe'): data=data[2::2]
    elif data.startswith(b'\xfe\xff'): data=data[3::2]
    f=io.BytesIO(data); hh={}; sep=None; dt=collections.Counter(); last=None; steps=0; structure=[]
    for ix in range(400):
        l=f.readline(4096).rstrip(b'\r\n').strip().lstrip(b'\xef\xbb\xbf')
        if not l:
            if f.tell()>=len(data):break
            continue
        if len(l)>2048:return extras.append([path,'header-line length',ix])
        norm=l.lower().replace(b' ',b'').replace(b'#',b'').replace(b'"',b'')
        if norm.startswith((b'time/ms;',b'time/ms\t',b'time/ms,')) and any(t in norm for t in (b'detector',b'laser',b'pulse')):
            sep=norm[7:8]; break
        if re.match(rb'^[-+]?\d+[.,]\d+[\s;,]',l):
            extras.append([path,'numeric row encountered before clock header',ix,structure]);return
        for delim in (b';',b'\t',b':',b','):
            if delim in l: break
        k,_,v=l.partition(delim)
        k=k.strip().strip(b'#').strip(b'"').strip()
        if ix<18:structure.append([ix,re.sub('[^a-zA-Z _/#]','?',k.decode('latin1'))[:45],delim.hex(),len(l)])
        ck=k.decode('latin1').lower(); keys[ck]+=1
        if ck in ALLOWED and len(v)<140: hh[ck]=v.decode('latin1').strip('" ')
    if sep is None:
        extras.append([path,'no known clock header',structure]);return
    for l in f:
        if not l.strip():continue
        t,d,_=l.partition(sep)
        if not d or len(t)>48:extras.append([path,'invalid clock column',steps]);return
        t=t.strip().strip(b'"').replace(b',',b'.')
        try: now=Decimal(t.decode('ascii'))
        except Exception:extras.append([path,'nonnumeric time in data',steps]);return
        if not now.is_finite():extras.append([path,'nonfinite clock',steps]);return
        if last is None: start=now
        else: dt[str(now-last)]+=1
        last=now;steps+=1
    if steps<2:extras.append([path,'insufficient clock',steps]);return
    headers.append([path,hh,steps,str(start),str(last),dt.most_common(4),len(dt)])
    groups[str(pathlib.PurePosixPath(path).parent)]+=1
def walk(path,data,depth):
    assert depth<=4 and len(data)<250000000
    f=io.BytesIO(data)
    if zipfile.is_zipfile(f):
        with zipfile.ZipFile(f) as z:
            for x in z.infolist():
                if x.is_dir(): continue
                assert x.file_size<250000000
                handle(path+'/'+x.filename,z.read(x),depth)
        return
    f.seek(0)
    with tarfile.open(fileobj=f,mode='r:*') as a:
        for x in a:
            if not x.isfile(): continue
            assert x.size<250000000
            handle(path+'/'+x.name,a.extractfile(x).read(),depth)
def handle(name,data,depth):
    files.append([name,len(data),sha(data)])
    ext=name.lower()
    if ext.endswith(('.zip','.tar','.tar.gz','.tgz')):walk(name,data,depth+1)
    elif ext.endswith('.csv'):inventory(name,data)
walk('deposit',src,0)
emit('INVENTORY',{'members':len(files),'recognized_csv':len(headers),'groups':groups,'first_refusal':extras[:3],'refusals':len(extras)})
def family(a):return a[0].split('/')[2]
def temp(a):return float(a[1]['sample_temperature/°c'].replace(',','.'))
settings=['sensor','beam_enlargement/mm','laser_voltage/v','laser_filter/mm','analog_filter/ms','ampl_gain']
def sg(a,fields):return tuple(a[1].get(k) for k in fields)
for g in sorted(set(family(a) for a in headers)):
    rows=[a for a in headers if family(a)==g]
    emit('CALIBRATION',[g,len(rows),sorted(set(a[1].get('sample','') for a in rows))[:15],sorted(set(a[1].get('thickness_rt/mm','') for a in rows))[:15],sorted(set(a[1].get('sensor','') for a in rows))[:15],sorted(set(a[1].get('laser_voltage/v','') for a in rows)),sorted(set(a[1].get('laser_filter/mm','') for a in rows)),[min(float(a[3]) for a in rows),max(float(a[4]) for a in rows)]])
for target_family in ('HT2','Qz_cube'):
    for orient in ('001','100'):
        tgt=[a for a in headers if family(a)==target_family+'_'+orient]
        source=[a for a in headers if family(a) in (['HT1_'+orient] if target_family=='HT2' else ['HT1_'+orient,'HT2_'+orient])]
        counts=[0]*5; complete=[]
        for a in tgt:
            pool=[x for x in source if abs(temp(a)-temp(x))<=2.0]
            groups1=[pool]+[[x for x in pool if sg(a,settings[:n])==sg(x,settings[:n])] for n in (1,4,5,6)]
            for ix,li in enumerate(groups1):counts[ix]+=bool(li)
            if groups1[-1]:complete.append([a[0].split('/')[-1],len(groups1[-1]),min(abs(temp(a)-temp(x)) for x in groups1[-1])])
        emit('NESTED_COVERAGE',[target_family,orient,len(tgt),len(source),counts,complete[:10]])
with tempfile.NamedTemporaryFile(prefix='p3-quartz-metadata-',suffix='.json',delete=False) as f:
    out=json.dumps(dict(files=files,headers=headers,extras=extras),sort_keys=True,separators=(',',':')).encode();f.write(out)
emit('METADATA_FILE',[f.name,len(out),sha(out)])
emit('BOUNDARY',{'detector_amplitude_cells_decoded':0,'pulse_amplitude_cells_decoded':0,'clock_only':True,'archive_extraction_on_filesystem':False})
