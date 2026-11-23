"""Resolve the author's public DSpace item and ZIP directory. Decode README only."""
import hashlib,io,json,os,pathlib,re,struct,subprocess,tempfile,urllib.parse,urllib.request,zipfile
def emit(k,x): print(k,json.dumps(x,separators=(',',':'),sort_keys=True),flush=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def req(u,headers=None):return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Cambridge-public-PIV-catalogue/1.0',**(headers or {})}),timeout=90)
def get(u):
    with req(u,{'Accept':'application/json'}) as f:
        raw=f.read(3000001);assert len(raw)<=3000000
    return json.loads(raw)
def link(x,k):return x['_links'][k]['href'].split('{')[0]
def items(x,k):return x['_embedded'][k]
with tempfile.TemporaryDirectory() as d:
    pin='2a0f9a4e1726c26b6e79a160e6dc09c82f587e1f'
    def git(*args):return subprocess.check_output(['git',*args],cwd=d)
    git('init','-q');git('fetch','-q','--depth=1','https://github.com/DSpace/RestContract.git',pin)
    assert git('rev-parse','FETCH_HEAD').decode().strip()==pin
    for n in ['items.md','bundles.md','bitstreams.md']:
        b=git('show',pin+':'+n);emit('API_CONTRACT',[pin,n,len(b),sha(b)])
id='8cd322fd-a31c-4081-88b7-f5f6acca4a87'
item=get('https://api.repository.cam.ac.uk/server/api/core/items/'+id);assert item.get('uuid',item.get('id'))==id
emit('ITEM',[id,item['name'],item['handle'],[x['value'] for k,v in item['metadata'].items() if k.startswith('dc.identifier') for x in v]])
bundles=items(get(link(item,'bundles')),'bundles')
original=[x for x in bundles if x['name']=='ORIGINAL'];assert len(original)==1
streams=items(get(link(original[0],'bitstreams')),'bitstreams');emit('CATALOG',[[x['name'],x['uuid'],x['sizeBytes'],x.get('checkSum')] for x in streams])
target=[x for x in streams if (x['name'],x['uuid'],x['sizeBytes'],x['checkSum']['value'])==('Open Access Data.zip','51ff899f-4920-4eba-a45f-5443947d1748',1351560391,'741bce55204fdb910d38db0132baef9f')];assert len(target)==1
target=target[0]; url=link(target,'content');size=target['sizeBytes']
def span(off,n):
    assert 0<=off<=size and 0<=n<=7000000
    if not n:return b''
    stop=off+n-1
    with req(url,{'Range':'bytes='+str(off)+'-'+str(stop),'Accept-Encoding':'identity'}) as f:
        assert f.status==206,'server declined bounded byte ranges: '+str(f.status)
        assert f.headers.get('Content-Range')=='bytes '+str(off)+'-'+str(stop)+'/'+str(size)
        b=f.read(n+1)
    assert len(b)==n
    return b
class ReadAt(io.RawIOBase):
    def __init__(self): self.pos=0
    def tell(self):return self.pos
    def seekable(self): return True
    def seek(self,v,w=0):
        p=[v,self.pos+v,size+v][w]
        if p<0:raise OSError('before start')
        self.pos=p;return p
    def read(self,n=-1):
        n=size-self.pos if n<0 else min(n,size-self.pos)
        b=span(self.pos,n);self.pos+=len(b);return b
with zipfile.ZipFile(ReadAt()) as z:
    entries=[e for e in z.infolist() if not e.is_dir()]
    groups={}
    for x in entries:
        parts=x.filename.split('/');key='/'.join(parts[:-1]);g=groups.setdefault(key,[0,0,[]])
        g[0]+=1;g[1]+=x.file_size
        if len(g[2])<3:g[2].append(parts[-1])
    emit('DIRECTORY',[len(entries),len(groups),list(sorted(groups.items()))[:140]])
    for m in entries:
        if not re.search(r'(?:read.?me|data description)',m.filename,re.I):continue
        if m.file_size>50000 or not m.filename.lower().endswith(('.txt','.md')):emit('DOCUMENT_METADATA',[m.filename,m.file_size]);continue
        raw=z.read(m);emit('RELEASE_DOCUMENT',[m.filename,len(raw),sha(raw),raw.decode('utf8',errors='replace')[:12000]])
    roster=json.dumps([[m.filename,m.file_size,m.compress_size,m.header_offset,m.CRC] for m in entries],separators=(',',':')).encode()
    with tempfile.NamedTemporaryFile(prefix='p3-cam-public-zip-directory-',suffix='.json',delete=False) as f:f.write(roster)
    emit('ORIGINAL_DIRECTORY_FILE',[f.name,len(roster),sha(roster)])
emit('BOUNDARY',{'force_samples_decoded':0,'PIV_cells_decoded':0,'kinematics_decoded':0,'whole_zip_hash_verified':False,'outer_checksum_kind':'repository metadata only'})
