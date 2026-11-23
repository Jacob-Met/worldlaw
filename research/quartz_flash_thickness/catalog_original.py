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
emit('ARCHIVE',[len(src),sha(src),md5])
files=[]; headers=[]; extras=[]; keys=collections.Counter(); groups=collections.Counter()
def inventory(path,data):
    inp=io.BytesIO(data); hh={}; first=None; dt=collections.Counter(); previous=None; steps=0
    for _ in range(400):
        ln=inp.readline(4096)
        if not ln: break
        if not ln.strip(): continue
        ln=ln.strip().lstrip(b'\xef\xbb\xbf')
        if ln.startswith(b'#'):
            k,_,v=ln.partition(b';')
            name=k.lstrip(b'#').decode('latin1');keys[name]+=1
            if re.search(r'sample|specimen|thick|temperat|filter|gain|detector|direction|date|time|laser|pulse|voltage|range|mass|amplif|material|operator|shot|dimension',name,re.I) and not re.search(r'operator|fit|diffusi|conductiv|specific.heat|analysis|result|peak|signal',name,re.I):
                if len(v)<180: hh[name]=v.decode('latin1')
            if b'Time' in k and b'Detector' in v: first='header';break
        elif re.match(rb'^Time\s*/?\s*ms',ln,re.I) and b';' in ln:
            first='header';break
        else:
            extras.append([path,'unrecognized header',sha(ln),len(ln)]);return
    if first is None: extras.append([path,'missing time header']);return
    for ln in inp:
        if not ln.strip(): continue
        t,sep,_=ln.partition(b';')
        assert sep and len(t)<60
        now=Decimal(t.strip().replace(b',',b'.').decode('ascii'))
        if previous is None: start=now
        else: dt[str(now-previous)]+=1
        previous=now; steps+=1
    assert steps>1
    headers.append([path,hh,steps,str(start),str(previous),dt.most_common(5),len(dt)])
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
emit('INVENTORY',{'members':len(files),'csv':len(headers),'other_headers':extras[:15],'header_keys':sorted(keys.items()),'groups':groups,'first_names_only':[x[:2] for x in files[:30]]})
for g in sorted(groups):
    sample=next(x for x in headers if str(pathlib.PurePosixPath(x[0]).parent)==g)
    emit('EXAMPLE_HEADER',sample)
with tempfile.NamedTemporaryFile(prefix='p3-quartz-metadata-',suffix='.json',delete=False) as f:
    out=json.dumps(dict(files=files,headers=headers,extras=extras),sort_keys=True,separators=(',',':')).encode();f.write(out)
emit('METADATA_FILE',[f.name,len(out),sha(out)])
emit('BOUNDARY',{'detector_amplitude_cells_decoded':0,'pulse_amplitude_cells_decoded':0,'clock_only':True,'archive_extraction_on_filesystem':False})
