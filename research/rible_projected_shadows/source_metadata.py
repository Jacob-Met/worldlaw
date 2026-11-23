import io,json,hashlib,os,pathlib,subprocess,tempfile,urllib.request
root=pathlib.Path(tempfile.mkdtemp(prefix='rible-source-',dir=os.environ.get('TMPDIR')))
def get(cmd):return subprocess.check_output(cmd,cwd=root)
get(['git','init','-q'])
ref='e8e7bc57ac6682b4005b2e97d140b6aa3517b2c0'
get(['git','fetch','-q','--depth=1','https://github.com/genepatrickrible/Aerodynamic-levitation-of-nanofluid-drops.git',ref])
key='Vertical Wind Tunnel Code/Cache/rawData.mat'
m=get(['git','show',ref+':'+key]); mat=root/'rawData.mat';mat.write_bytes(m)
print('MAT_SOURCE',len(m),hashlib.sha256(m).hexdigest(),flush=True)
import struct,zlib
# MATLAB v5 directory inspection. Read array flags, dimensions and variable names only;
# MCOS opaque objects have a distinct header and are retained as opaque descriptors.
assert m[126:128]==b'IM'
def sub(b,i):
    tag,=struct.unpack_from('<I',b,i)
    if tag>>16:return tag&65535,tag>>16,i+4,i+8
    n,=struct.unpack_from('<I',b,i+4)
    return tag,n,i+8,i+8+((n+7)//8)*8
def read_header(b):
    kind,n,offset,_=sub(b,0)
    assert kind==14
    k,size,ptr,i=sub(b,offset);assert k==6 and size==8
    cl=struct.unpack_from('<I',b,ptr)[0]&255
    if cl==17:return {'class':cl,'scope':'opaque-object-header-only','matrix_bytes':n}
    k,size,ptr,i=sub(b,i);assert k==5 and size<=128
    dim=struct.unpack_from('<'+'i'*(size//4),b,ptr)
    k,size,ptr,i=sub(b,i);assert k==1 and size<=256
    return {'name':b[ptr:ptr+size].decode('latin1'),'class':cl,'shape':dim,'matrix_bytes':n}

i=128
while i<len(m):
    kind,sz,ptr,nxt=sub(m,i)
    if kind==15:
        raw=zlib.decompressobj().decompress(m[ptr:ptr+sz],2048);i=ptr+sz
    else:raw=m[i:i+2048];i=nxt
    label=read_header(raw)
    if label.get('name') not in ('statslist_1','cam1Video'):continue
    p=8
    for j in range(3):_,_,_,p=sub(raw,p)
    _,bs,p1,p=sub(raw,p);width=struct.unpack_from('<i',raw,p1)[0]; _,bs,p1,p=sub(raw,p)
    names=[raw[k:k+width].split(bytes([0]))[0].decode('ascii') for k in range(p1,p1+bs,width)]
    print('FIELD_ROSTER',label['name'],names,flush=True)
    if label['name']=='cam1Video':
        for field in names:
            tag0,sz0,pp,pnext=sub(raw,p);p=pnext
            block=raw[pp-8:pnext];q=8
            for j in range(3):_,_,_,q=sub(block,q)
            k,n,d,_=sub(block,q)
            if field.lower()=='filename':
                enc='utf-16le' if k in (4,17) else 'utf-8'
                print('DEBUG_ACQUISITION_ID',block[d:d+n].decode(enc).strip(chr(0)).replace(chr(92),'/').split('/')[-1],flush=True)
            if field in ('frameRate','numImages') and k in (1,2,3,4,5,6,7,9,12,13):
                fm={1:'b',2:'B',3:'h',4:'H',5:'i',6:'I',7:'f',9:'d',12:'q',13:'Q'}[k];assert n==struct.calcsize('<'+fm);print('DEBUG_METADATA',field,struct.unpack_from('<'+fm,block,d)[0],flush=True)
import csv,zipfile,posixpath,collections
url='https://zenodo.org/api/records/18896271'
def http(u):return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Rible paired-camera public research metadata qualification'}),timeout=75)
with http(url) as f:meta=json.load(f)
fmeta=meta['files'][0];assert fmeta['size']==20343112 and fmeta['checksum']=='md5:11f979187630698099dfc6a72bce9820'
print('VERSION_DOWNLOAD_LINK_KEYS', sorted(fmeta['links']),flush=True)
assert fmeta['key']=='Data_Corrected.zip' and meta['doi']=='10.5281/zenodo.18896271'
with http('https://zenodo.org/records/18896271/files/Data_Corrected.zip?download=1') as f:b=f.read(20343113)
assert len(b)==20343112 and hashlib.md5(b).hexdigest()=='11f979187630698099dfc6a72bce9820'
z=zipfile.ZipFile(io.BytesIO(b)); members=[i for i in z.infolist() if not i.is_dir() and '__MACOSX' not in i.filename]
rosters={}; unique_headers=collections.Counter()
print('CORRECTED_ARCHIVE',len(b),hashlib.sha256(b).hexdigest(),len(members),flush=True)
for item in members:
    name=item.filename;bn=posixpath.basename(name)
    if bn.lower().endswith('.csv'):
        with z.open(item) as inp:header=inp.readline(8192).decode('utf-8-sig',errors='replace').strip()
        assert all(any(x.isalpha() for x in token) for token in header.split(',')), 'unnamed/non-text header; no values emitted'
        unique_headers[header]+=1
        if bn.startswith('Properties_'):
            cols=next(csv.reader([header]));print('METADATA_COLS',name,cols,flush=True)
            if all(any(w in col.casefold() for w in ['id','name','video','rate','frame','resolution','trial','time','pixel']) for col in cols):
                rows=list(csv.DictReader(io.TextIOWrapper(z.open(item),encoding='utf-8-sig')));print('ACQUISITION_METADATA',bn,json.dumps(rows),flush=True)
        if 'TimeData/' in name:
            cam=name.split('/TimeData/')[0].split('/')[-1];rosters.setdefault(cam,[]).append(bn)
    elif bn.lower().endswith('.mat'):print('RELEASE_MAT',name,item.file_size,'matches_debug_bytes',item.file_size==len(m) and z.read(item)==m)
    elif bn.lower().startswith('readme'):print('AUTHOR_DOC',z.read(item).decode('utf-8-sig',errors='replace')[:9000],flush=True)
print('CSV_HEADERS',json.dumps(unique_headers,sort_keys=True),'ACQUISITION_NAMES',json.dumps(rosters,sort_keys=True),flush=True)
print('No frame measurements or fitted spectral rows decoded.')
